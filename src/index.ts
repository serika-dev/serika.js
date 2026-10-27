import { HTTPClient } from './http.js';
import { BotAPI } from './rest/bot.js';
import { ClientAPI } from './rest/client.js';
import { InteractionsAPI } from './rest/interactions.js';
import { GatewayClient } from './gateway.js';
import { ShardManager, type ShardManagerOptions } from './sharding.js';
import { CDN } from './utils/cdn.js';
import type { SerikaClientOptions, GatewayOptions } from './types.js';

// ─── SerikaCord Client ──────────────────────────────────────
// Unified entry point: REST (bot + client API), interaction helpers, CDN
// helpers, and the gateway (single connection or sharded).

export interface ConnectGatewayOptions extends Omit<GatewayOptions, 'token'> {
  /** Resolve only after READY (default false: resolve once the socket is opened). */
  waitForReady?: boolean;
}

export class SerikaClient {
  readonly http: HTTPClient;
  /** Discord v10-compatible bot API (/api/v10). */
  readonly bot: BotAPI;
  /** SerikaCord client API (user sessions, /api). */
  readonly client: ClientAPI;
  /** Interaction reply helpers (reply, defer, update, showModal, followUp, ...). */
  readonly interactions: InteractionsAPI;
  /** CDN URL helpers (Discord-style paths via /cdn-compat). */
  readonly cdn: CDN;
  private gateway: GatewayClient | null = null;
  private shardManager: ShardManager | null = null;
  private readonly gatewayURL?: string;

  constructor(opts: SerikaClientOptions = {}) {
    const baseURL = (opts.baseURL ?? 'https://api.serika.chat').replace(/\/+$/, '');
    this.http = new HTTPClient({
      baseURL,
      token: opts.token,
      authToken: opts.authToken,
      timeout: opts.timeout,
      maxConcurrency: opts.maxConcurrency,
      retries: opts.retries,
      fetch: opts.fetch,
      headers: opts.headers,
      onRateLimit: opts.onRateLimit,
      rejectOnRateLimit: opts.rejectOnRateLimit,
    });
    this.gatewayURL = opts.gatewayURL;
    this.bot = new BotAPI(this.http);
    this.client = new ClientAPI(this.http);
    this.interactions = new InteractionsAPI(this.bot);
    this.cdn = new CDN(`${baseURL}/cdn-compat`);
  }

  private requireToken(): string {
    const token = this.http.botToken;
    if (!token) throw new Error('The gateway needs a bot token: new SerikaClient({ token })');
    return token;
  }

  // ── Gateway ─────────────────────────────────────────────
  /**
   * Open one gateway connection. Without `url` the client uses `gatewayURL`
   * from the constructor, else the default SerikaCord gateway.
   */
  async connectGateway(opts: ConnectGatewayOptions): Promise<GatewayClient> {
    const { waitForReady, ...rest } = opts;
    this.gateway?.destroy();
    this.gateway = new GatewayClient({ url: this.gatewayURL, ...rest, token: this.requireToken() });
    const ready = waitForReady ? this.gateway.waitForReady() : null;
    await this.gateway.connect();
    if (ready) await ready;
    return this.gateway;
  }

  /**
   * Run several shards. Shard count and identify concurrency come from
   * GET /gateway/bot unless `totalShards` / `maxConcurrency` are given.
   */
  async connectShards(opts: Omit<ShardManagerOptions, 'token' | 'fetchGatewayBot'>): Promise<ShardManager> {
    this.shardManager?.destroy();
    this.shardManager = new ShardManager({
      url: this.gatewayURL,
      ...opts,
      token: this.requireToken(),
      fetchGatewayBot: () => this.bot.getGatewayBot(),
    });
    await this.shardManager.connect();
    return this.shardManager;
  }

  /** The single gateway connection opened with connectGateway(). */
  get gatewayClient(): GatewayClient | null {
    return this.gateway;
  }

  /** @deprecated Use `gatewayClient`. */
  get gateway_(): GatewayClient | null {
    return this.gateway;
  }

  /** The shard manager opened with connectShards(). */
  get shards(): ShardManager | null {
    return this.shardManager;
  }

  /** Close every gateway connection. */
  destroy(): void {
    this.gateway?.destroy();
    this.shardManager?.destroy();
    this.gateway = null;
    this.shardManager = null;
  }

  // ── Convenience ─────────────────────────────────────────
  getAPIInfo() {
    return this.bot.getAPIInfo();
  }

  health() {
    return this.client.health();
  }
}

// ─── Re-exports ─────────────────────────────────────────────

export { HTTPClient, HTTPError } from './http.js';
export type { HTTPRequestOptions, HTTPClientOptions, Query, QueryValue } from './http.js';
export { BotAPI } from './rest/bot.js';
export type { InteractionRef } from './rest/bot.js';
export { ClientAPI } from './rest/client.js';
export { InteractionsAPI } from './rest/interactions.js';
export type { ReplyOptions } from './rest/interactions.js';
export { RateLimitManager, parseRoute } from './rest/ratelimit.js';
export type { RateLimitInfo, RouteInfo, BucketState } from './rest/ratelimit.js';
export { buildMultipartBody, buildQuery, encodeEmoji } from './rest/multipart.js';
export { GatewayClient, DEFAULT_GATEWAY_URL, identifyGate } from './gateway.js';
export type { GatewayEventMap, GatewayEventName, GatewayLifecycleEvents, GatewayInternalOptions } from './gateway.js';
export { ShardManager } from './sharding.js';
export type { ShardManagerOptions } from './sharding.js';
export { ZlibStreamInflater } from './gateway/compression.js';
export { CDN, DEFAULT_CDN_URL } from './utils/cdn.js';
export type { ImageURLOptions, ImageExtension, ImageSize } from './utils/cdn.js';
export * from './utils/snowflake.js';
export * from './utils/format.js';
export { verifyInteractionSignature } from './utils/verify.js';
export { VERSION } from './version.js';
export * from './types.js';

// ─── Default export ─────────────────────────────────────────

export default SerikaClient;
