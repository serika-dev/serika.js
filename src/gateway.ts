import type {
  GatewayOptions, GatewayReadyData, GatewayDispatchPayloads, GatewayDispatchEventName, GatewayPresenceUpdateData,
  GatewayVoiceStateUpdateData, GatewayRequestGuildMembersData, GatewayRequestSoundboardSoundsData,
  GatewayHelloData, WebSocketLike, WebSocketConstructor,
} from './types.js';
import { GatewayOp as Op, GatewayCloseCode, FatalGatewayCloseCodes, NonResumableGatewayCloseCodes } from './types.js';
import { ZlibStreamInflater, toBytes } from './gateway/compression.js';

// ─── Gateway client (one shard) ─────────────────────────────
// HELLO → IDENTIFY (or RESUME) → READY / RESUMED; heartbeats with jittered
// first beat and zombie detection (missed ACK → reconnect + resume); op 7
// RECONNECT and op 9 INVALID_SESSION; resume via resume_gateway_url; fatal
// close codes stop reconnecting; optional zlib-stream; client-side send rate
// limit (120 payloads / 60 s, like the server enforces with close 4008).

export const DEFAULT_GATEWAY_URL = 'wss://api.serika.chat/api/v10/gateway';

const WS_OPEN = 1;
const SEND_LIMIT = 115; // of 120 / 60 s; a few slots stay free for heartbeats
const SEND_WINDOW_MS = 60_000;
const IDENTIFY_INTERVAL_MS = 5_000;

type DispatchHandler = (event: string, data: unknown, seq: number) => void;
type ErrorHandler = (error: Error) => void;
type CloseHandler = (code: number, reason: string) => void;
type ReadyHandler = (data: GatewayReadyData) => void;

/** Lifecycle events (lower-case) next to the typed dispatch events (upper-case). */
export interface GatewayLifecycleEvents {
  ready: [data: GatewayReadyData, shardId: number];
  resumed: [shardId: number];
  dispatch: [event: string, data: unknown, seq: number, shardId: number];
  error: [error: Error, shardId: number];
  close: [code: number, reason: string, shardId: number];
  reconnecting: [attempt: number, delayMs: number, shardId: number];
  debug: [message: string, shardId: number];
}

export type GatewayEventMap = GatewayLifecycleEvents & {
  [K in GatewayDispatchEventName]: [data: GatewayDispatchPayloads[K], shardId: number];
};

export type GatewayEventName = keyof GatewayEventMap;
type Listener<K extends GatewayEventName> = (...args: GatewayEventMap[K]) => void;

let wsImplCache: WebSocketConstructor | null = null;

async function getWebSocketImpl(): Promise<WebSocketConstructor> {
  if (wsImplCache) return wsImplCache;
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket !== 'undefined') {
    wsImplCache = (globalThis as unknown as { WebSocket: WebSocketConstructor }).WebSocket;
    return wsImplCache;
  }
  try {
    const mod = (await import('ws')) as unknown as { default: WebSocketConstructor };
    wsImplCache = mod.default;
    return wsImplCache;
  } catch {
    throw new Error(
      'WebSocket implementation not found. Native WebSocket is available in Node 22+, Bun, Deno, and browsers. ' +
        'For Node 18-21, install the optional peer dependency: npm install ws',
    );
  }
}

/** Per-token (and per max_concurrency bucket) identify spacing shared by every client in the process. */
const identifyQueues = new Map<string, Promise<void>>();

/**
 * Wait for this shard's turn to IDENTIFY. Shards share a queue per token and
 * rate-limit bucket (`shard_id % max_concurrency`); each IDENTIFY holds its
 * bucket for 5 s, matching the server's identify limit.
 */
const unrefSleep = (ms: number) => new Promise<void>((r) => {
  const t = setTimeout(r, ms) as { unref?: () => void };
  t.unref?.(); // never keep a process alive just to space identifies
});

export function identifyGate(token: string, bucket: number, sleep: (ms: number) => Promise<void> = unrefSleep): Promise<void> {
  return defaultIdentifyGate(`${token}:${bucket}`, sleep);
}

function defaultIdentifyGate(key: string, sleep: (ms: number) => Promise<void>): Promise<void> {
  const prev = identifyQueues.get(key) ?? Promise.resolve();
  // Each identify waits for the previous one in its bucket + 5 s.
  const mine = prev.then(() => undefined);
  identifyQueues.set(key, mine.then(() => sleep(IDENTIFY_INTERVAL_MS)));
  return mine;
}

/** Options only the ShardManager (or tests) set. */
export interface GatewayInternalOptions {
  /** Called before every IDENTIFY; resolve when this shard may identify. */
  identifyGate?: () => Promise<void>;
  /** Sleep implementation (tests). */
  sleep?: (ms: number) => Promise<void>;
  /** Random source in [0, 1) for jitter (tests). */
  random?: () => number;
}

export class GatewayClient {
  private ws: WebSocketLike | null = null;
  private seq: number | null = null;
  private _sessionId: string | null = null;
  private resumeUrl: string | null = null;
  private heartbeatIntervalMs = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatStartTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatAcked = true;
  private lastHeartbeatAt = 0;
  private latency = -1;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private destroyed = false;
  private manualClose = false;
  private connecting = false;
  private inflater: ZlibStreamInflater | null = null;
  private sendWindow = { start: 0, count: 0 };
  private sendQueue: string[] = [];
  private sendQueueTimer: ReturnType<typeof setTimeout> | null = null;
  private readyWaiters: { resolve: (d: GatewayReadyData) => void; reject: (e: Error) => void }[] = [];
  private lastReady: GatewayReadyData | null = null;
  private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly textDecoder = new TextDecoder();

  /** Shard id this client runs (0 when unsharded). */
  readonly shardId: number;

  constructor(private opts: GatewayOptions, private internal: GatewayInternalOptions = {}) {
    this.opts = { ...opts, token: opts.token.replace(/^Bot\s+/i, '') };
    this.shardId = opts.shard?.[0] ?? 0;
    this.sleep = internal.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = internal.random ?? Math.random;
  }

  // ── Event subscription ──────────────────────────────────
  on<K extends GatewayEventName>(event: K, listener: Listener<K>): this {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(listener as (...args: unknown[]) => void);
    return this;
  }

  once<K extends GatewayEventName>(event: K, listener: Listener<K>): this {
    const wrapped = ((...args: GatewayEventMap[K]) => {
      this.off(event, wrapped);
      listener(...args);
    }) as Listener<K>;
    return this.on(event, wrapped);
  }

  off<K extends GatewayEventName>(event: K, listener: Listener<K>): this {
    this.listeners.get(event)?.delete(listener as (...args: unknown[]) => void);
    return this;
  }

  removeAllListeners(event?: GatewayEventName): this {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
    return this;
  }

  private emit<K extends GatewayEventName>(event: K, ...args: GatewayEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(...args);
      } catch (err) {
        if (event !== 'error') this.emit('error', err as Error, this.shardId);
        else queueMicrotask(() => { throw err; });
      }
    }
  }

  // Backwards-compatible handler API (1.0.x)
  onDispatch(handler: DispatchHandler): this {
    return this.on('dispatch', handler as Listener<'dispatch'>);
  }

  offDispatch(handler: DispatchHandler): this {
    return this.off('dispatch', handler as Listener<'dispatch'>);
  }

  onError(handler: ErrorHandler): this {
    return this.on('error', handler as Listener<'error'>);
  }

  onClose(handler: CloseHandler): this {
    return this.on('close', handler as Listener<'close'>);
  }

  onReady(handler: ReadyHandler): this {
    return this.on('ready', handler as Listener<'ready'>);
  }

  private debug(msg: string): void {
    this.opts.debug?.(`[gateway shard ${this.shardId}] ${msg}`);
    this.emit('debug', msg, this.shardId);
  }

  // ── Connection lifecycle ────────────────────────────────
  private buildUrl(): string {
    const base = (this._sessionId && this.resumeUrl) || this.opts.url || DEFAULT_GATEWAY_URL;
    const url = new URL(base);
    url.searchParams.set('v', String(this.opts.version ?? 10));
    url.searchParams.set('encoding', 'json');
    if (this.compressionEnabled) url.searchParams.set('compress', 'zlib-stream');
    else url.searchParams.delete('compress');
    return url.toString();
  }

  private get compressionEnabled(): boolean {
    return this.opts.compress === true || this.opts.compress === 'zlib-stream';
  }

  /**
   * Open the connection. Resolves once the socket is created; listen for
   * `ready` (or `await waitForReady()`) to know the session is up.
   */
  async connect(): Promise<void> {
    if (this.destroyed || this.connecting || (this.ws && !this.manualClose)) return;
    this.connecting = true;
    this.manualClose = false;
    try {
      const WebSocketImpl = this.opts.WebSocket ?? (await getWebSocketImpl());
      if (this.compressionEnabled) {
        this.inflater?.close();
        this.inflater = await ZlibStreamInflater.create(
          (text) => this.handleText(text),
          (err) => {
            this.emit('error', err, this.shardId);
            this.reconnectNow('zlib error');
          },
        );
      }
      const url = this.buildUrl();
      this.debug(`connecting to ${url.replace(/\?.*$/, '')}`);
      const ws = new WebSocketImpl(url);
      this.ws = ws;
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => this.debug('socket open');
      ws.onmessage = (event) => this.handleRaw(event.data);
      ws.onerror = (event) => {
        const msg = (event as { message?: string; error?: Error })?.error?.message ?? (event as { message?: string })?.message;
        this.emit('error', new Error(`WebSocket error${msg ? `: ${msg}` : ''}`), this.shardId);
      };
      ws.onclose = (event) => {
        if (this.ws !== ws) return; // an old socket we already replaced
        this.handleClose(event.code, event.reason);
      };
    } finally {
      this.connecting = false;
    }
  }

  /** Wait for READY (resolves immediately if this session is already ready). */
  waitForReady(timeoutMs = 30_000): Promise<GatewayReadyData> {
    if (this.connected && this.lastReady) return Promise.resolve(this.lastReady);
    return new Promise((resolve, reject) => {
      const waiter = {
        resolve: (d: GatewayReadyData) => { clearTimeout(timer); resolve(d); },
        reject: (e: Error) => { clearTimeout(timer); reject(e); },
      };
      const timer = setTimeout(() => {
        this.readyWaiters = this.readyWaiters.filter((w) => w !== waiter);
        reject(new Error(`Gateway READY not received within ${timeoutMs} ms`));
      }, timeoutMs);
      this.readyWaiters.push(waiter);
    });
  }

  /**
   * Close the connection. By default the session is ended (close code 1000);
   * pass `{ resumable: true }` to keep it so a later connect() resumes.
   */
  disconnect(opts: { resumable?: boolean } = {}): void {
    this.manualClose = true;
    this.clearReconnect();
    this.cleanupTimers();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      detach(ws);
      try { ws.close(opts.resumable ? 4000 : 1000, opts.resumable ? 'Reconnecting' : 'Client disconnect'); } catch { /* already closed */ }
    }
    this.inflater?.close();
    this.inflater = null;
    if (!opts.resumable) this.resetSession();
    const wasConnected = this.connected;
    this.connected = false;
    if (wasConnected || ws) this.emit('close', opts.resumable ? 4000 : 1000, 'Client disconnect', this.shardId);
  }

  destroy(): void {
    this.destroyed = true;
    this.disconnect();
    this.rejectReadyWaiters(new Error('Gateway client destroyed'));
    this.listeners.clear();
  }

  // ── Message handling ────────────────────────────────────
  private handleRaw(raw: unknown): void {
    if (typeof raw === 'string') return this.handleText(raw);
    const bytes = toBytes(raw);
    if (!bytes) {
      this.emit('error', new Error('Unsupported gateway frame type'), this.shardId);
      return;
    }
    if (this.inflater) this.inflater.push(bytes);
    else this.handleText(this.textDecoder.decode(bytes));
  }

  /** Handle one decoded JSON payload (exposed for tests and custom transports). */
  handleText(text: string): void {
    let payload: { op: number; t?: string | null; s?: number | null; d?: unknown };
    try {
      payload = JSON.parse(text);
    } catch {
      this.emit('error', new Error('Failed to parse gateway message'), this.shardId);
      return;
    }
    this.handlePayload(payload);
  }

  private handlePayload(payload: { op: number; t?: string | null; s?: number | null; d?: unknown }): void {
    switch (payload.op) {
      case Op.Hello: {
        const hello = payload.d as GatewayHelloData;
        this.startHeartbeat(hello?.heartbeat_interval ?? 41250);
        if (this._sessionId && this.seq !== null) this.sendResume();
        else void this.identify();
        break;
      }

      case Op.Dispatch: {
        if (typeof payload.s === 'number') this.seq = payload.s;
        const t = payload.t ?? '';
        const d = payload.d;
        if (t === 'READY') {
          const ready = d as GatewayReadyData;
          this._sessionId = ready.session_id;
          this.resumeUrl = ready.resume_gateway_url ?? null;
          this.connected = true;
          this.reconnectAttempts = 0;
          this.lastReady = ready;
          this.debug(`READY session=${ready.session_id.slice(0, 8)} guilds=${ready.guilds?.length ?? 0}`);
          this.emit('ready', ready, this.shardId);
          const waiters = this.readyWaiters.splice(0);
          waiters.forEach((w) => w.resolve(ready));
        } else if (t === 'RESUMED') {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.debug(`RESUMED seq=${this.seq}`);
          this.emit('resumed', this.shardId);
          if (this.lastReady) {
            const waiters = this.readyWaiters.splice(0);
            waiters.forEach((w) => w.resolve(this.lastReady!));
          }
        }
        this.emit('dispatch', t, d, this.seq ?? 0, this.shardId);
        if (t) this.emit(t as GatewayDispatchEventName, d as never, this.shardId);
        break;
      }

      case Op.HeartbeatAck:
        this.heartbeatAcked = true;
        if (this.lastHeartbeatAt) this.latency = Date.now() - this.lastHeartbeatAt;
        break;

      case Op.Heartbeat:
        // Server asks for an immediate beat.
        this.sendHeartbeat(true);
        break;

      case Op.Reconnect:
        this.debug('server requested reconnect (op 7)');
        this.reconnectNow('op 7');
        break;

      case Op.InvalidSession: {
        const resumable = payload.d === true;
        this.debug(`invalid session (resumable=${resumable})`);
        if (!resumable) this.resetSession();
        // Discord: wait 1-5 s before re-identifying.
        const delay = 1000 + Math.floor(this.random() * 4000);
        void this.sleep(delay).then(() => {
          if (!this.ws || this.ws.readyState !== WS_OPEN || this.destroyed) return;
          if (resumable && this._sessionId && this.seq !== null) this.sendResume();
          else void this.identify();
        });
        break;
      }
    }
  }

  // ── Heartbeat ───────────────────────────────────────────
  private startHeartbeat(intervalMs: number): void {
    this.cleanupTimers();
    this.heartbeatIntervalMs = intervalMs;
    this.heartbeatAcked = true;
    // First beat after interval * jitter (Discord spec), then every interval.
    const jitter = Math.floor(this.random() * intervalMs);
    this.heartbeatStartTimer = setTimeout(() => {
      this.heartbeatStartTimer = null;
      this.sendHeartbeat(false);
      this.heartbeatTimer = setInterval(() => this.sendHeartbeat(false), intervalMs);
    }, jitter);
  }

  private cleanupTimers(): void {
    if (this.heartbeatStartTimer) clearTimeout(this.heartbeatStartTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.sendQueueTimer) clearTimeout(this.sendQueueTimer);
    this.heartbeatStartTimer = null;
    this.heartbeatTimer = null;
    this.sendQueueTimer = null;
    this.sendQueue = [];
  }

  private sendHeartbeat(requested: boolean): void {
    if (!requested && !this.heartbeatAcked) {
      // Zombie connection: no ACK since the last beat.
      this.emit('error', new Error('Heartbeat ACK not received — reconnecting (zombie connection)'), this.shardId);
      this.reconnectNow('zombie');
      return;
    }
    this.heartbeatAcked = false;
    this.lastHeartbeatAt = Date.now();
    this.rawSend({ op: Op.Heartbeat, d: this.seq }, true);
  }

  // ── Identify / Resume ───────────────────────────────────
  private async identify(): Promise<void> {
    const ws = this.ws;
    const gate = this.internal.identifyGate ?? (() => defaultIdentifyGate(`${this.opts.token}:0`, this.internal.sleep ?? unrefSleep));
    await gate();
    if (this.ws !== ws || !ws || ws.readyState !== WS_OPEN || this.destroyed) return;
    const proc = typeof process !== 'undefined' ? process : undefined;
    const presence = this.opts.presence ?? (this.opts.initialPresence as GatewayOptions['presence']);
    const d = {
      token: this.opts.token,
      intents: this.opts.intents,
      ...(this.opts.shard ? { shard: this.opts.shard } : {}),
      properties: this.opts.properties ?? {
        os: proc?.platform ?? 'browser',
        browser: 'serika.js',
        device: 'serika.js',
      },
      ...(this.opts.largeThreshold ? { large_threshold: this.opts.largeThreshold } : {}),
      ...(presence ? { presence } : {}),
    };
    this.debug(`identifying (intents=${this.opts.intents}${this.opts.shard ? ` shard=${this.opts.shard.join('/')}` : ''})`);
    this.rawSend({ op: Op.Identify, d }, true);
  }

  private sendResume(): void {
    this.debug(`resuming session=${this._sessionId?.slice(0, 8)} seq=${this.seq}`);
    this.rawSend({ op: Op.Resume, d: { token: this.opts.token, session_id: this._sessionId, seq: this.seq } }, true);
  }

  // ── Send (rate limited) ─────────────────────────────────
  private rawSend(data: unknown, priority = false): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WS_OPEN) return;
    const text = JSON.stringify(data);
    const now = Date.now();
    if (now - this.sendWindow.start >= SEND_WINDOW_MS) this.sendWindow = { start: now, count: 0 };
    if (!priority && (this.sendWindow.count >= SEND_LIMIT || this.sendQueue.length > 0)) {
      this.sendQueue.push(text);
      this.scheduleSendQueue();
      return;
    }
    this.sendWindow.count++;
    ws.send(text);
  }

  private scheduleSendQueue(): void {
    if (this.sendQueueTimer) return;
    const wait = Math.max(0, this.sendWindow.start + SEND_WINDOW_MS - Date.now());
    this.sendQueueTimer = setTimeout(() => {
      this.sendQueueTimer = null;
      const ws = this.ws;
      if (!ws || ws.readyState !== WS_OPEN) return;
      this.sendWindow = { start: Date.now(), count: 0 };
      while (this.sendQueue.length && this.sendWindow.count < SEND_LIMIT) {
        this.sendWindow.count++;
        ws.send(this.sendQueue.shift()!);
      }
      if (this.sendQueue.length) this.scheduleSendQueue();
    }, wait);
  }

  /** Send a raw gateway payload `{ op, d }`. */
  send(op: number, d: unknown): void {
    this.rawSend({ op, d });
  }

  /** Op 3: update the bot's status / activities. */
  sendPresenceUpdate(data: Partial<GatewayPresenceUpdateData> & { status: string }): void {
    this.rawSend({ op: Op.PresenceUpdate, d: { since: null, activities: [], afk: false, ...data } });
  }

  /** Op 4: join / move / leave voice (SerikaCord answers with VOICE_STATE_UPDATE; no media for bots yet). */
  sendVoiceStateUpdate(data: GatewayVoiceStateUpdateData): void {
    this.rawSend({ op: Op.VoiceStateUpdate, d: data });
  }

  /** Op 8: request members → GUILD_MEMBERS_CHUNK events (needs GUILD_MEMBERS for full lists). */
  requestGuildMembers(data: GatewayRequestGuildMembersData): void {
    this.rawSend({ op: Op.RequestGuildMembers, d: { query: '', limit: 0, ...data } });
  }

  /** Op 31: request soundboard sounds → SOUNDBOARD_SOUNDS events. */
  requestSoundboardSounds(data: GatewayRequestSoundboardSoundsData): void {
    this.rawSend({ op: Op.RequestSoundboardSounds, d: data });
  }

  // ── Reconnection ────────────────────────────────────────
  private handleClose(code: number, reason: string): void {
    this.cleanupTimers();
    const ws = this.ws;
    if (ws) detach(ws);
    this.ws = null;
    this.inflater?.close();
    this.inflater = null;
    this.connected = false;
    this.debug(`closed ${code} ${reason || ''}`.trim());
    this.emit('close', code, reason, this.shardId);

    if (this.destroyed || this.manualClose) return;

    if (FatalGatewayCloseCodes.has(code)) {
      const hint = code === GatewayCloseCode.DisallowedIntents
        ? ' (enable the privileged intents for your app in the Developer Portal → Bot)'
        : code === GatewayCloseCode.AuthenticationFailed ? ' (invalid bot token)' : '';
      const err = new Error(`Gateway closed with fatal code ${code}: ${reason || GatewayCloseCode[code] || 'unknown'}${hint}`);
      this.resetSession();
      this.emit('error', err, this.shardId);
      this.rejectReadyWaiters(err);
      return;
    }
    if (NonResumableGatewayCloseCodes.has(code)) this.resetSession();

    if (this.opts.reconnect !== false) this.scheduleReconnect();
    else this.rejectReadyWaiters(new Error(`Gateway closed (${code})`));
  }

  /** Close the socket keeping the session, then reconnect and resume. */
  private reconnectNow(why: string): void {
    this.debug(`reconnecting (${why})`);
    this.cleanupTimers();
    const ws = this.ws;
    this.ws = null;
    this.connected = false;
    if (ws) {
      detach(ws);
      try { ws.close(4000, 'Reconnecting'); } catch { /* ignore */ }
    }
    this.inflater?.close();
    this.inflater = null;
    if (!this.destroyed && !this.manualClose) this.scheduleReconnect(true);
  }

  private scheduleReconnect(immediate = false): void {
    if (this.reconnectTimer || this.destroyed) return;
    const max = this.opts.maxReconnectAttempts ?? 10;
    if (this.reconnectAttempts >= max) {
      const err = new Error(`Max reconnection attempts (${max}) reached`);
      this.emit('error', err, this.shardId);
      this.rejectReadyWaiters(err);
      return;
    }
    const attempt = this.reconnectAttempts++;
    const delay = immediate && attempt === 0
      ? 0
      : Math.min(1000 * 2 ** attempt, 30_000) + Math.floor(this.random() * 1000);
    this.emit('reconnecting', attempt + 1, delay, this.shardId);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.destroyed || this.manualClose) return;
      this.connect().catch((err) => {
        this.emit('error', err as Error, this.shardId);
        this.scheduleReconnect();
      });
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private resetSession(): void {
    this._sessionId = null;
    this.seq = null;
    this.resumeUrl = null;
    this.lastReady = null;
  }

  private rejectReadyWaiters(err: Error): void {
    const waiters = this.readyWaiters.splice(0);
    waiters.forEach((w) => w.reject(err));
  }

  // ── State getters ───────────────────────────────────────
  get isConnected(): boolean {
    return this.connected;
  }

  get sequence(): number | null {
    return this.seq;
  }

  get sessionId(): string | null {
    return this._sessionId;
  }

  /** @deprecated Use `sessionId`. */
  get sessionId_(): string | null {
    return this._sessionId;
  }

  /** Round-trip time of the last heartbeat in ms (-1 before the first ACK). */
  get ping(): number {
    return this.latency;
  }

  /** Heartbeat interval from HELLO (ms). */
  get heartbeatInterval(): number {
    return this.heartbeatIntervalMs;
  }

  /** The READY payload of the current session. */
  get readyData(): GatewayReadyData | null {
    return this.lastReady;
  }
}

function detach(ws: WebSocketLike): void {
  ws.onopen = null;
  ws.onmessage = null;
  ws.onerror = null;
  ws.onclose = null;
}
