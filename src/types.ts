// ─── SerikaCord API Types ───────────────────────────────────
// Barrel: Discord v10-compatible models live in ./types/*, the SerikaCord
// client-API (user session) models and the library options live here.

export * from './types/enums.js';
export * from './types/api.js';
export * from './types/interactions.js';
export * from './types/gateway.js';
export * from './types/rest.js';

import type { GatewayIdentifyProperties, GatewayIdentifyData } from './types/gateway.js';
import type { RateLimitInfo } from './rest/ratelimit.js';

// ── SerikaCord Client API Types ─────────────────────────────

export interface SerikaUser {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  pronouns: string | null;
  timezone: string | null;
  showTimezone: boolean;
  status: string;
  customStatus: string | null;
  isPremium: boolean;
  premiumSince: string | null;
  premiumTier: number;
  badges: string[];
  isVerified: boolean;
  settings: Record<string, unknown>;
  customization: Record<string, unknown>;
  gifFavorites: unknown[];
  createdAt: string;
}

export interface SerikaServer {
  id: string;
  name: string;
  icon: string | null;
  banner: string | null;
  description: string | null;
  memberCount: number;
  isOfficial: boolean;
  isVerified: boolean;
  isPartnered: boolean;
  vanityUrlCode: string | null;
  ownerId: string | null;
  isOwner: boolean;
  systemChannelId: string | null;
  rulesChannelId: string | null;
  afkChannelId: string | null;
  afkTimeout: number;
  isAgeGated: boolean;
  joinedAt: string;
  roles: string[];
  nickname: string | null;
}

export interface SerikaGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

export interface SerikaNotification {
  id: string;
  type: 'mention';
  title: string;
  description: string;
  avatar: string | null;
  timestamp: string;
  isRead: boolean;
  serverId: string;
  channelId: string;
  serverName: string;
  channelName: string;
  content: string;
}

export interface SerikaMention {
  id: string;
  content: string;
  channelId: string;
  channelName: string;
  serverId: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
  } | null;
}

export interface SerikaEmoji {
  id: string;
  name: string;
  url: string;
  animated: boolean;
  serverId: string;
  serverName: string;
}

export interface SerikaSticker {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  tags: string[];
  serverId: string;
  serverName: string;
}

export interface SerikaApplication {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  coverImage: string | null;
  botId: string | null;
  botPublic: boolean;
  botRequireCodeGrant: boolean;
  botToken: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  scopes: string[];
  installParams: unknown;
  customInstallUrl: string | null;
  verified: boolean;
  verificationStatus: string;
  serverCount: number;
  tags: string[];
  teamId: string | null;
  termsOfServiceUrl: string | null;
  privacyPolicyUrl: string | null;
  flags: number;
  gatewayIntents: number;
  interactionsEndpointUrl: string | null;
  publicKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerikaTeam {
  id: string;
  name: string;
  icon: string | null;
  ownerUsername: string;
  memberCount: number;
  appCount: number;
  verified: boolean;
  description: string | null;
  members: {
    id: string;
    username: string;
    avatar: string | null;
    role: string;
  }[];
  createdAt: string;
}

export interface ModifyUserOptions {
  displayName?: string;
  bio?: string;
  pronouns?: string;
  customStatus?: string;
  status?: string;
  settings?: Record<string, unknown>;
  customization?: Record<string, unknown>;
  gifFavorites?: unknown[];
  timezone?: string;
  showTimezone?: boolean;
}

// ── Client options ──────────────────────────────────────────

export interface SerikaClientOptions {
  /** Base URL of the SerikaCord API (default: https://api.serika.chat). The bot API lives under /api/v10. */
  baseURL?: string;
  /** Bot token (sends `Authorization: Bot <token>`). A leading "Bot " is stripped. */
  token?: string;
  /** User session / OAuth2 bearer token for the client API (sends `Authorization: Bearer <token>`). */
  authToken?: string;
  /** Request timeout in ms (default: 15000). */
  timeout?: number;
  /** Max concurrent in-flight requests (default: 10). */
  maxConcurrency?: number;
  /** Retry attempts on 5xx / network errors, and on 429s (default: 3). */
  retries?: number;
  /** Custom fetch implementation. */
  fetch?: typeof fetch;
  /** Extra default headers. */
  headers?: Record<string, string>;
  /** Called whenever a request hits (or proactively waits for) a rate limit. */
  onRateLimit?: (info: RateLimitInfo) => void;
  /**
   * Throw an HTTPError(429) instead of waiting when a request would be rate
   * limited. `true` for every route, or a predicate per rate-limit event.
   */
  rejectOnRateLimit?: boolean | ((info: RateLimitInfo) => boolean);
  /** Gateway URL override (default: the URL from GET /gateway/bot, else wss://api.serika.chat/api/v10/gateway). */
  gatewayURL?: string;
}

/** Minimal WebSocket constructor shape (native WebSocket, `ws`, or a test double). */
export interface WebSocketLike {
  readonly readyState: number;
  binaryType: string;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type WebSocketConstructor = new (url: string) => WebSocketLike;

export interface GatewayOptions {
  /** Gateway URL (default wss://api.serika.chat/api/v10/gateway). Query params are added automatically. */
  url?: string;
  token: string;
  /** Intent bitfield (see `Intents`). */
  intents: number;
  /** [shard_id, num_shards]. */
  shard?: [number, number];
  properties?: GatewayIdentifyProperties;
  presence?: GatewayIdentifyData['presence'];
  /** Members threshold above which GUILD_CREATE omits offline members (50-250). */
  largeThreshold?: number;
  /** Reconnect (resume when possible) after unexpected closes (default true). */
  reconnect?: boolean;
  /** Give up after this many consecutive failed reconnects (default 10). */
  maxReconnectAttempts?: number;
  /** Gateway version (default 10; 9 is also accepted). */
  version?: 9 | 10;
  /**
   * Transport compression. `true` / 'zlib-stream' inflates a shared zlib
   * stream (Node.js, Bun and Deno — needs `node:zlib`). Default: off.
   */
  compress?: boolean | 'zlib-stream';
  /** WebSocket implementation (default: global WebSocket, else the `ws` package). */
  WebSocket?: WebSocketConstructor;
  /** Debug log hook. */
  debug?: (message: string) => void;
  /** @deprecated Use `presence`. */
  initialPresence?: unknown;
}
