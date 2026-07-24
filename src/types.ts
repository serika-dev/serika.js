// ─── SerikaCord API Types ───────────────────────────────────

// ── Common ──────────────────────────────────────────────────

export interface APIError {
  code: number;
  message: string;
}

export interface SerikaClientError {
  error: string;
  details?: string;
  message?: string;
  retryAfter?: number;
}

// ── Users (Discord v10 compatible) ──────────────────────────

export interface APIUser {
  id: string;
  username: string;
  global_name: string;
  avatar: string | null;
  banner?: string | null;
  accent_color?: number | null;
  bot?: boolean;
  system?: boolean;
  mfa_enabled?: boolean;
  verified?: boolean;
  email?: string | null;
  flags?: number;
  premium_type?: number;
  public_flags?: number;
  created_at?: string;
}

// ── Guilds / Servers ────────────────────────────────────────

export interface APIRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  icon: string | null;
  unicode_emoji: string | null;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  flags: number;
}

export interface APIEmoji {
  id: string;
  name: string;
  roles: string[];
  user: APIUser | null;
  require_colons: boolean;
  managed: boolean;
  animated: boolean;
  available: boolean;
}

export interface APISticker {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  type: number;
  format_type: number;
  available: boolean;
  guild_id: string;
  user: APIUser | null;
}

export interface APIGuild {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  owner_id: string | null;
  verification_level: number;
  member_count: number;
  premium_tier: number;
  features: string[];
  roles: APIRole[];
  emojis: APIEmoji[];
  stickers: APISticker[];
  banner: string | null;
  joined_at?: string;
}

export interface APIGuildPreview {
  id: string;
  name: string;
  icon: string | null;
  banner: string | null;
  description: string | null;
  approximate_member_count: number;
  approximate_presence_count: number;
  discovery_splash: string | null;
  features: string[];
}

export interface APIGuildMember {
  user: APIUser | null;
  nick: string | null;
  roles: string[];
  joined_at?: string;
  premium_since: string | null;
  deaf: boolean;
  mute: boolean;
  flags: number;
  pending: boolean;
  permissions: string;
  communication_disabled_until: string | null;
  avatar: string | null;
  banner: string | null;
}

export interface APIBan {
  reason: string | null;
  user: { id: string };
}

export interface APIAuditLogEntry {
  id: string;
  action_type: number;
  user_id: string | null;
  target_id: string | null;
  reason: string | null;
  changes: unknown[];
  created_at?: string;
}

export interface APIAuditLog {
  audit_log_entries: APIAuditLogEntry[];
}

// ── Channels ────────────────────────────────────────────────

export type ChannelType = 0 | 1 | 2 | 3 | 4 | 5 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

export interface APIChannel {
  id: string;
  type: ChannelType;
  guild_id: string | null;
  name: string | null;
  topic: string | null;
  position: number;
  nsfw: boolean;
  rate_limit_per_user: number;
  parent_id: string | null;
  last_message_id: string | null;
  bitrate?: number;
  user_limit?: number;
  rtc_region?: string;
  recipients?: { id: string; username: string }[];
}

// ── Messages ────────────────────────────────────────────────

export interface APIAttachment {
  id: string;
  filename: string;
  content_type?: string;
  size: number;
  url: string;
  proxy_url: string;
  width?: number;
  height?: number;
}

export interface APIEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: { text: string; icon_url?: string };
  image?: { url: string };
  thumbnail?: { url: string };
  author?: { name: string; url?: string; icon_url?: string };
  fields?: { name: string; value: string; inline?: boolean }[];
}

export interface APIReaction {
  emoji: { name: string; id?: string };
  count: number;
  me: boolean;
}

export interface APIMessage {
  id: string;
  channel_id: string | null;
  author: APIUser | null;
  content: string;
  timestamp?: string;
  edited_timestamp: string | null;
  tts: boolean;
  mention_everyone: boolean;
  mentions: { id: string; username: string }[];
  mention_roles: string[];
  mention_channels: string[];
  attachments: APIAttachment[];
  embeds: APIEmbed[];
  reactions: APIReaction[];
  pinned: boolean;
  type: number;
  flags: number;
  referenced_message: APIMessage | null;
}

// ── Invites ─────────────────────────────────────────────────

export interface APIInvite {
  code: string;
  guild: { id: string; name: string } | null;
  channel: { id: string; name: string } | null;
  inviter: { id: string } | null;
  approximate_member_count: number;
  approximate_presence_count: number;
  expires_at: string | null;
  uses: number;
  max_uses: number;
  max_age: number;
  temporary: boolean;
  created_at?: string;
}

// ── Webhooks ────────────────────────────────────────────────

export interface APIWebhook {
  id: string;
  type: number;
  guild_id: string | null;
  channel_id: string;
  name: string;
  avatar: string | null;
  token: string;
  creator_id: string;
}

// ── Application Commands ────────────────────────────────────

export interface APIApplicationCommand {
  id: string;
  application_id: string;
  guild_id?: string;
  name: string;
  description: string;
  options: unknown[];
  default_permission: boolean;
  type: number;
  version: string;
}

export interface APIApplicationCommandOption {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  choices?: { name: string; value: string | number }[];
  options?: APIApplicationCommandOption[];
}

// ── Gateway ─────────────────────────────────────────────────

export interface GatewaySessionStartLimit {
  total: number;
  remaining: number;
  reset_after: number;
  max_concurrency: number;
}

export interface GatewayBotInfo {
  url: string;
  shards: number;
  session_start_limit: GatewaySessionStartLimit;
}

export interface GatewayInfo {
  url: string;
}

// ── Voice Regions ───────────────────────────────────────────

export interface APIVoiceRegion {
  id: string;
  name: string;
  optimal: boolean;
  deprecated: boolean;
  custom: boolean;
}

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

// ── Request option types ────────────────────────────────────

export interface CreateMessageOptions {
  content?: string;
  embeds?: APIEmbed[];
  tts?: boolean;
  attachments?: unknown[];
  allowed_mentions?: unknown;
  sticker_ids?: string[];
  components?: unknown[];
  flags?: number;
}

export interface CreateChannelOptions {
  name: string;
  type?: number;
  topic?: string;
  nsfw?: boolean;
  parent_id?: string;
  rate_limit_per_user?: number;
  position?: number;
}

export interface CreateRoleOptions {
  name?: string;
  color?: number;
  hoist?: boolean;
  permissions?: string;
  mentionable?: boolean;
  icon?: string;
  unicode_emoji?: string;
}

export interface CreateWebhookOptions {
  name: string;
  avatar?: string;
}

export interface CreateEmojiOptions {
  name: string;
  image: string;
  roles?: string[];
}

export interface CreateDMOptions {
  recipient_id: string;
}

export interface ModifyGuildOptions {
  name?: string;
  description?: string;
  icon?: string;
  banner?: string;
  verification_level?: number;
  default_notifications?: number;
}

export interface ModifyChannelOptions {
  name?: string;
  topic?: string;
  nsfw?: boolean;
  rate_limit_per_user?: number;
  parent_id?: string | null;
  position?: number;
}

export interface ModifyMemberOptions {
  nick?: string | null;
  roles?: string[];
  deaf?: boolean;
  mute?: boolean;
  communication_disabled_until?: string | null;
}

export interface BanOptions {
  reason?: string;
}

export interface CreateCommandOptions {
  name: string;
  description: string;
  options?: APIApplicationCommandOption[];
  default_permission?: boolean;
  type?: number;
}

export interface ModifyCommandOptions {
  name?: string;
  description?: string;
  options?: APIApplicationCommandOption[];
  default_permission?: boolean;
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
  /** Base URL of the SerikaCord API (default: https://api.serika.chat) */
  baseURL?: string;
  /** Bot token for authentication */
  token?: string;
  /** Auth token for client API (cookie-based auth) */
  authToken?: string;
  /** Request timeout in ms (default: 15000) */
  timeout?: number;
  /** Max concurrent requests (default: 10) */
  maxConcurrency?: number;
  /** Retry attempts on 429/5xx (default: 3) */
  retries?: number;
  /** Custom fetch implementation */
  fetch?: typeof fetch;
  /** Custom headers */
  headers?: Record<string, string>;
}

// ── Gateway types ───────────────────────────────────────────

export enum GatewayOp {
  Dispatch = 0,
  Heartbeat = 1,
  Identify = 2,
  PresenceUpdate = 3,
  VoiceStateUpdate = 4,
  Resume = 6,
  Reconnect = 7,
  RequestGuildMembers = 8,
  InvalidSession = 9,
  Hello = 10,
  HeartbeatAck = 11,
}

export enum GatewayCloseCode {
  UnknownError = 4000,
  UnknownOpCode = 4001,
  DecodeError = 4002,
  NotAuthenticated = 4003,
  AuthenticationFailed = 4004,
  AlreadyAuthenticated = 4005,
  InvalidSeq = 4007,
  RateLimited = 4008,
  SessionTimedOut = 4009,
  InvalidShard = 4010,
  ShardingRequired = 4011,
  InvalidAPIVersion = 4012,
  InvalidIntents = 4013,
  DisallowedIntents = 4014,
}

export interface GatewayHelloData {
  heartbeat_interval: number;
}

export interface GatewayReadyData {
  v: number;
  user: APIUser;
  guilds: { id: string; unavailable?: boolean }[];
  session_id: string;
  resume_gateway_url?: string;
  shard?: [number, number];
}

export interface GatewayIdentifyData {
  token: string;
  intents: number;
  shard?: [number, number];
  properties?: {
    os: string;
    browser: string;
    device: string;
  };
  presence?: {
    status: string;
    activities?: unknown[];
    afk?: boolean;
    since?: number | null;
  };
}

export interface GatewayResumeData {
  token: string;
  session_id: string;
  seq: number;
}

export interface GatewayDispatchEvent {
  op: GatewayOp.Dispatch;
  t: string;
  s: number;
  d: unknown;
}

export interface GatewayEventHandler {
  (event: string, data: unknown, seq: number): void;
}

export interface GatewayOptions {
  url?: string;
  token: string;
  intents: number;
  shard?: [number, number];
  properties?: {
    os: string;
    browser: string;
    device: string;
  };
  presence?: {
    status: string;
    activities?: unknown[];
    afk?: boolean;
    since?: number | null;
  };
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  initialPresence?: unknown;
}

// ── Intent flags ────────────────────────────────────────────

export const Intents = {
  GUILDS: 1 << 0,
  GUILD_MEMBERS: 1 << 1,
  GUILD_BANS: 1 << 2,
  GUILD_EMOJIS_AND_STICKERS: 1 << 3,
  GUILD_INTEGRATIONS: 1 << 4,
  GUILD_WEBHOOKS: 1 << 5,
  GUILD_INVITES: 1 << 6,
  GUILD_VOICE_STATES: 1 << 7,
  GUILD_PRESENCES: 1 << 8,
  GUILD_MESSAGES: 1 << 9,
  GUILD_MESSAGE_REACTIONS: 1 << 10,
  GUILD_MESSAGE_TYPING: 1 << 11,
  DIRECT_MESSAGES: 1 << 12,
  DIRECT_MESSAGE_REACTIONS: 1 << 13,
  DIRECT_MESSAGE_TYPING: 1 << 14,
  MESSAGE_CONTENT: 1 << 15,
  GUILD_SCHEDULED_EVENTS: 1 << 16,
} as const;

export type IntentFlags = typeof Intents[keyof typeof Intents];
