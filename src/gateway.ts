import type { GatewayOptions, GatewayOp, GatewayDispatchEvent } from './types.js';
import { GatewayOp as Op, GatewayCloseCode } from './types.js';

// ─── Gateway Client ─────────────────────────────────────────
// Handles WebSocket connection lifecycle: HELLO → IDENTIFY → READY,
// heartbeat on interval, zombie detection (missed ACK), RESUME on
// reconnect, and exponential backoff + jitter.

type DispatchHandler = (event: string, data: unknown, seq: number) => void;
type ErrorHandler = (error: Error) => void;
type CloseHandler = (code: number, reason: string) => void;
type ReadyHandler = (data: unknown) => void;

let wsImpl: typeof WebSocket | null = null;

async function getWebSocketImpl(): Promise<typeof WebSocket> {
  if (wsImpl) return wsImpl;
  if (typeof globalThis.WebSocket !== 'undefined') {
    wsImpl = globalThis.WebSocket;
    return wsImpl;
  }
  try {
    const { default: WS } = await import('ws');
    wsImpl = WS as unknown as typeof WebSocket;
    return wsImpl;
  } catch {
    throw new Error(
      'WebSocket implementation not found. Native WebSocket is available in Node 22+, Bun, Deno, and browsers. ' +
        'For Node 18-21, install the optional peer dependency: npm install ws',
    );
  }
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private seq: number | null = null;
  private sessionId: string | null = null;
  private resumeUrl: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatAcked = true;
  private reconnectAttempts = 0;
  private connected = false;
  private destroyed = false;
  private identifyPayload: unknown = null;
  private wsImpl: typeof WebSocket | null = null;

  // Event handlers
  private dispatchHandlers = new Set<DispatchHandler>();
  private errorHandlers = new Set<ErrorHandler>();
  private closeHandlers = new Set<CloseHandler>();
  private readyHandlers = new Set<ReadyHandler>();

  constructor(private opts: GatewayOptions) {}

  // ── Event subscription ──────────────────────────────────
  onDispatch(handler: DispatchHandler): this {
    this.dispatchHandlers.add(handler);
    return this;
  }

  onError(handler: ErrorHandler): this {
    this.errorHandlers.add(handler);
    return this;
  }

  onClose(handler: CloseHandler): this {
    this.closeHandlers.add(handler);
    return this;
  }

  onReady(handler: ReadyHandler): this {
    this.readyHandlers.add(handler);
    return this;
  }

  offDispatch(handler: DispatchHandler): this {
    this.dispatchHandlers.delete(handler);
    return this;
  }

  // ── Connection lifecycle ────────────────────────────────
  async connect(): Promise<void> {
    if (this.connected || this.destroyed) return;
    const url = this.opts.url || 'wss://api.serika.chat/api/v10/gateway';

    const WebSocketImpl = await getWebSocketImpl();
    this.wsImpl = WebSocketImpl;
    this.ws = new WebSocketImpl(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = () => {
      this.emitError(new Error('WebSocket error'));
    };

    this.ws.onclose = (event: { code: number; reason: string }) => {
      this.handleClose(event.code, event.reason);
    };
  }

  disconnect(): void {
    this.cleanup();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.connected = false;
  }

  destroy(): void {
    this.destroyed = true;
    this.disconnect();
    this.dispatchHandlers.clear();
    this.errorHandlers.clear();
    this.closeHandlers.clear();
    this.readyHandlers.clear();
  }

  // ── Message handling ────────────────────────────────────
  private handleMessage(raw: unknown): void {
    let payload: { op: number; t?: string; s?: number; d?: unknown };
    try {
      const data = typeof raw === 'string' ? raw : new TextDecoder().decode(raw as ArrayBuffer);
      payload = JSON.parse(data);
    } catch {
      this.emitError(new Error('Failed to parse gateway message'));
      return;
    }

    const op = payload.op as GatewayOp;

    switch (op) {
      case Op.Hello: {
        const helloData = payload.d as { heartbeat_interval: number };
        this.startHeartbeat(helloData.heartbeat_interval);
        if (this.sessionId && this.seq !== null) {
          this.sendResume();
        } else {
          this.sendIdentify();
        }
        break;
      }

      case Op.Dispatch: {
        if (payload.s !== undefined) this.seq = payload.s;
        const eventType = payload.t || '';
        const eventData = payload.d;

        if (eventType === 'READY') {
          const readyData = eventData as { session_id: string; resume_gateway_url?: string };
          this.sessionId = readyData.session_id;
          if (readyData.resume_gateway_url) this.resumeUrl = readyData.resume_gateway_url;
          this.connected = true;
          this.readyHandlers.forEach((h) => h(eventData));
        }

        this.dispatchHandlers.forEach((h) => h(eventType, eventData, this.seq ?? 0));
        break;
      }

      case Op.HeartbeatAck: {
        this.heartbeatAcked = true;
        break;
      }

      case Op.Heartbeat: {
        this.sendHeartbeat();
        break;
      }

      case Op.Reconnect: {
        void this.reconnect();
        break;
      }

      case Op.InvalidSession: {
        const resumable = payload.d as boolean;
        if (resumable) {
          void this.reconnect();
        } else {
          this.sessionId = null;
          this.seq = null;
          void this.reconnect();
        }
        break;
      }
    }
  }

  // ── Heartbeat ───────────────────────────────────────────
  private startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();
    this.heartbeatAcked = true;
    // Send first heartbeat after a jittered delay (Discord spec)
    const jitter = Math.random() * intervalMs;
    setTimeout(() => {
      if (!this.connected && !this.ws) return;
      this.sendHeartbeat();
      this.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat();
      }, intervalMs);
    }, jitter);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendHeartbeat(): void {
    if (!this.heartbeatAcked) {
      // Zombie connection — no ACK received, reconnect
      this.emitError(new Error('Heartbeat ACK not received — connection is zombie'));
      void this.reconnect();
      return;
    }
    this.heartbeatAcked = false;
    this.send({ op: Op.Heartbeat, d: this.seq });
  }

  // ── Identify / Resume ───────────────────────────────────
  private sendIdentify(): void {
    const data = {
      token: this.opts.token,
      intents: this.opts.intents,
      shard: this.opts.shard,
      properties: this.opts.properties ?? {
        os: process?.platform ?? 'unknown',
        browser: 'serika.js',
        device: 'serika.js',
      },
      presence: this.opts.presence,
    };
    this.identifyPayload = data;
    this.send({ op: Op.Identify, d: data });
  }

  private sendResume(): void {
    this.send({
      op: Op.Resume,
      d: {
        token: this.opts.token,
        session_id: this.sessionId,
        seq: this.seq,
      },
    });
  }

  // ── Send ────────────────────────────────────────────────
  private send(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(data));
  }

  // ── Public send (for voice state update, presence, etc.) ─
  sendVoiceStateUpdate(data: unknown): void {
    this.send({ op: Op.VoiceStateUpdate, d: data });
  }

  sendPresenceUpdate(data: unknown): void {
    this.send({ op: Op.PresenceUpdate, d: data });
  }

  requestGuildMembers(data: unknown): void {
    this.send({ op: Op.RequestGuildMembers, d: data });
  }

  // ── Reconnection ────────────────────────────────────────
  private handleClose(code: number, reason: string): void {
    this.cleanup();
    this.connected = false;
    this.closeHandlers.forEach((h) => h(code, reason));

    if (this.destroyed) return;

    // Don't reconnect on auth failure
    if (code === GatewayCloseCode.AuthenticationFailed ||
        code === GatewayCloseCode.DisallowedIntents ||
        code === GatewayCloseCode.InvalidIntents ||
        code === GatewayCloseCode.InvalidAPIVersion ||
        code === GatewayCloseCode.InvalidShard) {
      this.emitError(new Error(`Gateway closed with fatal code ${code}: ${reason}`));
      return;
    }

    if (this.opts.reconnect !== false) {
      void this.reconnect();
    }
  }

  private async reconnect(): Promise<void> {
    this.cleanup();
    this.connected = false;

    const maxAttempts = this.opts.maxReconnectAttempts ?? 10;
    if (this.reconnectAttempts >= maxAttempts) {
      this.emitError(new Error(`Max reconnection attempts (${maxAttempts}) reached`));
      return;
    }

    this.reconnectAttempts++;
    const backoff = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    const jitter = Math.random() * 1000;

    await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
    if (this.destroyed) return;
    await this.connect();
  }

  private cleanup(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
    }
  }

  private emitError(err: Error): void {
    this.errorHandlers.forEach((h) => h(err));
  }

  // ── State getters ───────────────────────────────────────
  get isConnected(): boolean {
    return this.connected;
  }

  get sequence(): number | null {
    return this.seq;
  }

  get sessionId_(): string | null {
    return this.sessionId;
  }
}
