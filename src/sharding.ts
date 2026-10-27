import { GatewayClient, identifyGate, type GatewayEventMap, type GatewayEventName } from './gateway.js';
import type { GatewayOptions, GatewayBotInfo, GatewayReadyData, GatewayPresenceUpdateData } from './types.js';
import { shardForGuild } from './utils/snowflake.js';

// ─── Shard manager ──────────────────────────────────────────
// Runs several GatewayClients in one process. Shard count and identify
// concurrency come from GET /gateway/bot (`shards`,
// `session_start_limit.max_concurrency`) unless given. Shards in the same
// rate-limit bucket (shard_id % max_concurrency) identify 5 s apart, like
// Discord requires. Guilds map to shards exactly as the gateway does
// (snowflakes: (id >> 22) % n; legacy UUIDs: FNV-1a hash).

export interface ShardManagerOptions extends Omit<GatewayOptions, 'shard'> {
  /** Total shards, or 'auto' to use the `shards` value from GET /gateway/bot (default 'auto'). */
  totalShards?: number | 'auto';
  /** Shard ids this process runs (default: all of them). */
  shardIds?: number[];
  /** Identify concurrency (default: session_start_limit.max_concurrency, else 1). */
  maxConcurrency?: number;
  /** Fetches GET /gateway/bot (SerikaClient provides it). Required for 'auto'. */
  fetchGatewayBot?: () => Promise<GatewayBotInfo>;
}

type Listener<K extends GatewayEventName> = (...args: GatewayEventMap[K]) => void;

export class ShardManager {
  readonly shards = new Map<number, GatewayClient>();
  totalShards = 1;
  private readonly listeners: [GatewayEventName, (...args: unknown[]) => void][] = [];
  private maxConcurrency = 1;

  constructor(private readonly opts: ShardManagerOptions) {}

  /** Subscribe on every shard (current and future). Handlers get the shard id as the last argument. */
  on<K extends GatewayEventName>(event: K, listener: Listener<K>): this {
    this.listeners.push([event, listener as (...args: unknown[]) => void]);
    for (const shard of this.shards.values()) shard.on(event, listener);
    return this;
  }

  off<K extends GatewayEventName>(event: K, listener: Listener<K>): this {
    const i = this.listeners.findIndex(([e, l]) => e === event && l === listener);
    if (i >= 0) this.listeners.splice(i, 1);
    for (const shard of this.shards.values()) shard.off(event, listener);
    return this;
  }

  private gate(shardId: number): () => Promise<void> {
    const token = this.opts.token.replace(/^Bot\s+/i, '');
    return () => identifyGate(token, shardId % this.maxConcurrency);
  }

  /** Resolve the shard count, create every shard and connect them. Resolves once all sockets are opened. */
  async connect(): Promise<void> {
    let info: GatewayBotInfo | null = null;
    const needInfo = this.opts.totalShards === undefined || this.opts.totalShards === 'auto' || this.opts.maxConcurrency === undefined || !this.opts.url;
    if (needInfo && this.opts.fetchGatewayBot) info = await this.opts.fetchGatewayBot();
    if ((this.opts.totalShards === undefined || this.opts.totalShards === 'auto') && !info) {
      throw new Error("totalShards: 'auto' needs fetchGatewayBot (use SerikaClient.connectShards)");
    }
    this.totalShards = typeof this.opts.totalShards === 'number' ? this.opts.totalShards : Math.max(1, info!.shards);
    this.maxConcurrency = Math.max(1, this.opts.maxConcurrency ?? info?.session_start_limit.max_concurrency ?? 1);
    const ids = this.opts.shardIds ?? Array.from({ length: this.totalShards }, (_, i) => i);
    if (info && info.session_start_limit.remaining < ids.length) {
      throw new Error(`Not enough session starts left (${info.session_start_limit.remaining}) for ${ids.length} shards; resets in ${info.session_start_limit.reset_after} ms`);
    }
    const url = this.opts.url ?? info?.url;

    for (const id of ids) {
      if (id < 0 || id >= this.totalShards) throw new RangeError(`Shard id ${id} is outside 0..${this.totalShards - 1}`);
      if (this.shards.has(id)) continue;
      const shard = new GatewayClient(
        { ...this.opts, url, shard: [id, this.totalShards] },
        { identifyGate: this.gate(id) },
      );
      for (const [event, listener] of this.listeners) shard.on(event, listener as Listener<typeof event>);
      this.shards.set(id, shard);
    }
    await Promise.all([...this.shards.values()].map((s) => s.connect()));
  }

  /** Resolve when every shard is READY. */
  waitForReady(timeoutMs = 30_000 + this.shards.size * 6_000): Promise<GatewayReadyData[]> {
    return Promise.all([...this.shards.values()].map((s) => s.waitForReady(timeoutMs)));
  }

  /** The shard id a guild lives on. */
  shardIdForGuild(guildId: string): number {
    return shardForGuild(guildId, this.totalShards);
  }

  /** The shard handling a guild (undefined when this process doesn't run it). */
  shardForGuild(guildId: string): GatewayClient | undefined {
    return this.shards.get(this.shardIdForGuild(guildId));
  }

  /** Op 3 on every shard. */
  setPresence(data: Partial<GatewayPresenceUpdateData> & { status: string }): void {
    for (const s of this.shards.values()) s.sendPresenceUpdate(data);
  }

  /** Average heartbeat latency across ready shards (-1 when none). */
  get ping(): number {
    const pings = [...this.shards.values()].map((s) => s.ping).filter((p) => p >= 0);
    return pings.length ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : -1;
  }

  disconnect(): void {
    for (const s of this.shards.values()) s.disconnect();
  }

  destroy(): void {
    for (const s of this.shards.values()) s.destroy();
    this.shards.clear();
  }
}
