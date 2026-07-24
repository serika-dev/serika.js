import { HTTPClient, HTTPError } from './http.js';
import { BotAPI } from './rest/bot.js';
import { ClientAPI } from './rest/client.js';
import { GatewayClient } from './gateway.js';
import type { SerikaClientOptions, GatewayOptions } from './types.js';
import { Intents, GatewayOp, GatewayCloseCode } from './types.js';

// ─── SerikaCord Client ──────────────────────────────────────
// Unified entry point: REST (bot + client) + Gateway WebSocket

export class SerikaClient {
  readonly http: HTTPClient;
  readonly bot: BotAPI;
  readonly client: ClientAPI;
  private gateway: GatewayClient | null = null;

  constructor(opts: SerikaClientOptions = {}) {
    this.http = new HTTPClient({
      baseURL: opts.baseURL ?? 'https://api.serika.chat',
      token: opts.token,
      authToken: opts.authToken,
      timeout: opts.timeout,
      maxConcurrency: opts.maxConcurrency,
      retries: opts.retries,
      fetch: opts.fetch,
      headers: opts.headers,
    });

    this.bot = new BotAPI(this.http);
    this.client = new ClientAPI(this.http);
  }

  // ── Gateway ─────────────────────────────────────────────
  async connectGateway(opts: Omit<GatewayOptions, 'token'>): Promise<GatewayClient> {
    const token = this.http['defaultHeaders']['Authorization']?.replace('Bot ', '') ?? '';
    this.gateway = new GatewayClient({ ...opts, token });
    await this.gateway.connect();
    return this.gateway;
  }

  get gateway_(): GatewayClient | null {
    return this.gateway;
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
export { BotAPI } from './rest/bot.js';
export { ClientAPI } from './rest/client.js';
export { GatewayClient } from './gateway.js';
export { Intents, GatewayOp, GatewayCloseCode } from './types.js';
export type * from './types.js';

// ─── Default export ─────────────────────────────────────────

export default SerikaClient;
