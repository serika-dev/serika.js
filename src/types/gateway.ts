// ─── Gateway protocol types (Discord v10, JSON encoding) ────

import type {
  Snowflake, APIUser, APIUnavailableGuild, APIGatewayGuild, APIGuild, APIChannel, APIGuildMember,
  APIRole, APIEmoji, APISticker, APIMessage, APIPartialEmoji, APIPresence, APIVoiceState,
  APIAutoModerationRule, APIAutoModerationAction, APIAuditLogEntry, APIGuildScheduledEvent,
  APIThreadMember, APISoundboardSound, APIStageInstance, APIActivity, PresenceStatus, APIApplication,
} from './api.js';
import type { APIInteraction, APIGuildApplicationCommandPermissions } from './interactions.js';
import type { AutoModerationTriggerType } from './enums.js';

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
  RequestSoundboardSounds = 31,
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

/** Close codes after which reconnecting cannot help (bad token, intents, shard or version). */
export const FatalGatewayCloseCodes: ReadonlySet<number> = new Set([
  GatewayCloseCode.AuthenticationFailed,
  GatewayCloseCode.InvalidShard,
  GatewayCloseCode.ShardingRequired,
  GatewayCloseCode.InvalidAPIVersion,
  GatewayCloseCode.InvalidIntents,
  GatewayCloseCode.DisallowedIntents,
]);

/** Close codes after which the session cannot be resumed (a fresh IDENTIFY is needed). */
export const NonResumableGatewayCloseCodes: ReadonlySet<number> = new Set([
  GatewayCloseCode.InvalidSeq,
  GatewayCloseCode.SessionTimedOut,
]);

// ── Intents ─────────────────────────────────────────────────

/**
 * Gateway intent bits. `GUILD_MEMBERS`, `GUILD_PRESENCES` and `MESSAGE_CONTENT`
 * are privileged: enable them in the Developer Portal (Bot tab) first, or the
 * gateway closes with 4014 (DisallowedIntents).
 */
export const Intents = {
  GUILDS: 1 << 0,
  GUILD_MEMBERS: 1 << 1,
  GUILD_MODERATION: 1 << 2,
  /** @deprecated Discord renamed this to GUILD_MODERATION. */
  GUILD_BANS: 1 << 2,
  GUILD_EXPRESSIONS: 1 << 3,
  /** @deprecated Discord renamed this to GUILD_EXPRESSIONS. */
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
  AUTO_MODERATION_CONFIGURATION: 1 << 20,
  AUTO_MODERATION_EXECUTION: 1 << 21,
  GUILD_MESSAGE_POLLS: 1 << 24,
  DIRECT_MESSAGE_POLLS: 1 << 25,
} as const;

export type IntentFlags = typeof Intents[keyof typeof Intents];

/** Privileged intents (must be enabled for the application in the Developer Portal). */
export const PrivilegedIntents = Intents.GUILD_MEMBERS | Intents.GUILD_PRESENCES | Intents.MESSAGE_CONTENT;

/** Every intent bit the gateway accepts. */
export const AllIntents = Object.values(Intents).reduce((a, b) => a | b, 0);

/** Every non-privileged intent. */
export const NonPrivilegedIntents = AllIntents & ~PrivilegedIntents;

// ── Payloads ────────────────────────────────────────────────

export interface GatewayPayload<D = unknown, T extends string | null = string | null> {
  op: GatewayOp;
  d: D;
  s?: number | null;
  t?: T;
}

export interface GatewayHelloData {
  heartbeat_interval: number;
  _trace?: string[];
}

export interface GatewayPresenceUpdateData {
  since: number | null;
  activities: APIActivity[];
  status: Exclude<PresenceStatus, 'offline'>;
  afk: boolean;
}

export interface GatewayIdentifyProperties {
  os: string;
  browser: string;
  device: string;
}

export interface GatewayIdentifyData {
  token: string;
  intents: number;
  shard?: [number, number];
  properties?: GatewayIdentifyProperties;
  large_threshold?: number;
  presence?: Partial<GatewayPresenceUpdateData> & { status: GatewayPresenceUpdateData['status'] | string };
}

export interface GatewayResumeData {
  token: string;
  session_id: string;
  seq: number;
}

export interface GatewayVoiceStateUpdateData {
  guild_id: Snowflake;
  channel_id: Snowflake | null;
  self_mute: boolean;
  self_deaf: boolean;
}

export interface GatewayRequestGuildMembersData {
  guild_id: Snowflake;
  query?: string;
  /** 0 with an empty query = all members. */
  limit?: number;
  presences?: boolean;
  user_ids?: Snowflake | Snowflake[];
  nonce?: string;
}

export interface GatewayRequestSoundboardSoundsData {
  guild_ids: Snowflake[];
}

export interface GatewayReadyData {
  v: number;
  user: APIUser;
  guilds: APIUnavailableGuild[];
  session_id: string;
  resume_gateway_url?: string;
  shard?: [number, number];
  application: Pick<APIApplication, 'id' | 'flags'>;
  _trace?: string[];
}

/** Fields shared by dispatches that belong to a guild. */
interface GuildScoped { guild_id: Snowflake }

export interface GatewayMessageCreateData extends APIMessage {
  guild_id?: Snowflake;
  member?: Partial<APIGuildMember>;
  mentions: (APIUser & { member?: Partial<APIGuildMember> })[];
}

export type GatewayMessageUpdateData = GatewayMessageCreateData;

export interface GatewayMessageDeleteData { id: Snowflake; channel_id: Snowflake; guild_id?: Snowflake }
export interface GatewayMessageDeleteBulkData { ids: Snowflake[]; channel_id: Snowflake; guild_id?: Snowflake }

export interface GatewayMessageReactionAddData {
  user_id: Snowflake;
  channel_id: Snowflake;
  message_id: Snowflake;
  guild_id?: Snowflake;
  member?: APIGuildMember;
  emoji: APIPartialEmoji;
  message_author_id?: Snowflake;
  burst?: boolean;
  burst_colors?: string[];
  type?: number;
}

export type GatewayMessageReactionRemoveData = Omit<GatewayMessageReactionAddData, 'member' | 'message_author_id' | 'burst_colors'>;
export interface GatewayMessageReactionRemoveAllData { channel_id: Snowflake; message_id: Snowflake; guild_id?: Snowflake }
export interface GatewayMessageReactionRemoveEmojiData extends GatewayMessageReactionRemoveAllData { emoji: APIPartialEmoji }

export interface GatewayMessagePollVoteData {
  user_id: Snowflake;
  channel_id: Snowflake;
  message_id: Snowflake;
  guild_id?: Snowflake;
  answer_id: number;
}

export interface GatewayTypingStartData {
  channel_id: Snowflake;
  guild_id?: Snowflake;
  user_id: Snowflake;
  timestamp: number;
  member?: APIGuildMember;
}

export interface GatewayChannelPinsUpdateData {
  guild_id?: Snowflake;
  channel_id: Snowflake;
  last_pin_timestamp?: string | null;
}

export interface GatewayGuildDeleteData { id: Snowflake; unavailable?: boolean }

export interface GatewayGuildMemberAddData extends APIGuildMember, GuildScoped { user: APIUser }
export interface GatewayGuildMemberRemoveData extends GuildScoped { user: APIUser }
export interface GatewayGuildMemberUpdateData extends Partial<APIGuildMember>, GuildScoped { user: APIUser; roles: Snowflake[] }

export interface GatewayGuildMembersChunkData extends GuildScoped {
  members: APIGuildMember[];
  chunk_index: number;
  chunk_count: number;
  not_found?: Snowflake[];
  presences?: APIPresence[];
  nonce?: string;
}

export interface GatewayGuildBanData extends GuildScoped { user: APIUser }
export interface GatewayGuildRoleData extends GuildScoped { role: APIRole }
export interface GatewayGuildRoleDeleteData extends GuildScoped { role_id: Snowflake }
export interface GatewayGuildEmojisUpdateData extends GuildScoped { emojis: APIEmoji[] }
export interface GatewayGuildStickersUpdateData extends GuildScoped { stickers: APISticker[] }
export interface GatewayGuildIntegrationsUpdateData extends GuildScoped {}
export interface GatewayIntegrationDeleteData extends GuildScoped { id: Snowflake; application_id?: Snowflake }
export interface GatewayWebhooksUpdateData extends GuildScoped { channel_id: Snowflake }

export interface GatewayInviteCreateData {
  channel_id: Snowflake;
  code: string;
  created_at: string;
  guild_id?: Snowflake;
  inviter?: APIUser;
  max_age: number;
  max_uses: number;
  temporary: boolean;
  uses: number;
  expires_at?: string | null;
}
export interface GatewayInviteDeleteData { channel_id: Snowflake; guild_id?: Snowflake; code: string }

export interface GatewayThreadListSyncData extends GuildScoped {
  channel_ids?: Snowflake[];
  threads: APIChannel[];
  members: APIThreadMember[];
}
export interface GatewayThreadMemberUpdateData extends APIThreadMember, GuildScoped {}
export interface GatewayThreadMembersUpdateData extends GuildScoped {
  id: Snowflake;
  member_count: number;
  added_members?: APIThreadMember[];
  removed_member_ids?: Snowflake[];
}
export interface GatewayThreadCreateData extends APIChannel { newly_created?: boolean }

export interface GatewayAutoModerationActionExecutionData extends GuildScoped {
  action: APIAutoModerationAction;
  rule_id: Snowflake;
  rule_trigger_type: AutoModerationTriggerType;
  user_id: Snowflake;
  channel_id?: Snowflake;
  message_id?: Snowflake;
  alert_system_message_id?: Snowflake;
  content: string;
  matched_keyword: string | null;
  matched_content: string | null;
}

export interface GatewayGuildScheduledEventUserData extends GuildScoped {
  guild_scheduled_event_id: Snowflake;
  user_id: Snowflake;
}

export interface GatewayVoiceServerUpdateData extends GuildScoped {
  token: string;
  /** Always null on SerikaCord: bots cannot join voice media yet. */
  endpoint: string | null;
}

export interface GatewaySoundboardSoundsData extends GuildScoped { soundboard_sounds: APISoundboardSound[] }

export interface GatewayRateLimitedData {
  opcode: number;
  retry_after: number;
  meta: Record<string, unknown>;
}

export interface GatewayAuditLogEntryCreateData extends APIAuditLogEntry, GuildScoped {}

/**
 * Map of dispatch event name → payload. Every event SerikaCord emits is
 * typed; events Discord defines but SerikaCord does not emit yet are typed too
 * so code written for Discord compiles unchanged.
 */
export interface GatewayDispatchPayloads {
  READY: GatewayReadyData;
  RESUMED: Record<string, unknown>;
  RATE_LIMITED: GatewayRateLimitedData;
  APPLICATION_COMMAND_PERMISSIONS_UPDATE: APIGuildApplicationCommandPermissions;
  AUTO_MODERATION_RULE_CREATE: APIAutoModerationRule;
  AUTO_MODERATION_RULE_UPDATE: APIAutoModerationRule;
  AUTO_MODERATION_RULE_DELETE: APIAutoModerationRule;
  AUTO_MODERATION_ACTION_EXECUTION: GatewayAutoModerationActionExecutionData;
  CHANNEL_CREATE: APIChannel;
  CHANNEL_UPDATE: APIChannel;
  CHANNEL_DELETE: APIChannel;
  CHANNEL_PINS_UPDATE: GatewayChannelPinsUpdateData;
  THREAD_CREATE: GatewayThreadCreateData;
  THREAD_UPDATE: APIChannel;
  THREAD_DELETE: Pick<APIChannel, 'id' | 'guild_id' | 'parent_id' | 'type'>;
  THREAD_LIST_SYNC: GatewayThreadListSyncData;
  THREAD_MEMBER_UPDATE: GatewayThreadMemberUpdateData;
  THREAD_MEMBERS_UPDATE: GatewayThreadMembersUpdateData;
  GUILD_CREATE: APIGatewayGuild;
  GUILD_UPDATE: APIGuild;
  GUILD_DELETE: GatewayGuildDeleteData;
  GUILD_AUDIT_LOG_ENTRY_CREATE: GatewayAuditLogEntryCreateData;
  GUILD_BAN_ADD: GatewayGuildBanData;
  GUILD_BAN_REMOVE: GatewayGuildBanData;
  GUILD_EMOJIS_UPDATE: GatewayGuildEmojisUpdateData;
  GUILD_STICKERS_UPDATE: GatewayGuildStickersUpdateData;
  GUILD_INTEGRATIONS_UPDATE: GatewayGuildIntegrationsUpdateData;
  GUILD_MEMBER_ADD: GatewayGuildMemberAddData;
  GUILD_MEMBER_REMOVE: GatewayGuildMemberRemoveData;
  GUILD_MEMBER_UPDATE: GatewayGuildMemberUpdateData;
  GUILD_MEMBERS_CHUNK: GatewayGuildMembersChunkData;
  GUILD_ROLE_CREATE: GatewayGuildRoleData;
  GUILD_ROLE_UPDATE: GatewayGuildRoleData;
  GUILD_ROLE_DELETE: GatewayGuildRoleDeleteData;
  GUILD_SCHEDULED_EVENT_CREATE: APIGuildScheduledEvent;
  GUILD_SCHEDULED_EVENT_UPDATE: APIGuildScheduledEvent;
  GUILD_SCHEDULED_EVENT_DELETE: APIGuildScheduledEvent;
  GUILD_SCHEDULED_EVENT_USER_ADD: GatewayGuildScheduledEventUserData;
  GUILD_SCHEDULED_EVENT_USER_REMOVE: GatewayGuildScheduledEventUserData;
  GUILD_SOUNDBOARD_SOUND_CREATE: APISoundboardSound;
  GUILD_SOUNDBOARD_SOUND_UPDATE: APISoundboardSound;
  GUILD_SOUNDBOARD_SOUND_DELETE: { sound_id: Snowflake; guild_id: Snowflake };
  GUILD_SOUNDBOARD_SOUNDS_UPDATE: GatewaySoundboardSoundsData;
  SOUNDBOARD_SOUNDS: GatewaySoundboardSoundsData;
  INTEGRATION_DELETE: GatewayIntegrationDeleteData;
  INTERACTION_CREATE: APIInteraction;
  INVITE_CREATE: GatewayInviteCreateData;
  INVITE_DELETE: GatewayInviteDeleteData;
  MESSAGE_CREATE: GatewayMessageCreateData;
  MESSAGE_UPDATE: GatewayMessageUpdateData;
  MESSAGE_DELETE: GatewayMessageDeleteData;
  MESSAGE_DELETE_BULK: GatewayMessageDeleteBulkData;
  MESSAGE_REACTION_ADD: GatewayMessageReactionAddData;
  MESSAGE_REACTION_REMOVE: GatewayMessageReactionRemoveData;
  MESSAGE_REACTION_REMOVE_ALL: GatewayMessageReactionRemoveAllData;
  MESSAGE_REACTION_REMOVE_EMOJI: GatewayMessageReactionRemoveEmojiData;
  MESSAGE_POLL_VOTE_ADD: GatewayMessagePollVoteData;
  MESSAGE_POLL_VOTE_REMOVE: GatewayMessagePollVoteData;
  PRESENCE_UPDATE: APIPresence;
  STAGE_INSTANCE_CREATE: APIStageInstance;
  STAGE_INSTANCE_UPDATE: APIStageInstance;
  STAGE_INSTANCE_DELETE: APIStageInstance;
  TYPING_START: GatewayTypingStartData;
  USER_UPDATE: APIUser;
  VOICE_STATE_UPDATE: APIVoiceState;
  VOICE_SERVER_UPDATE: GatewayVoiceServerUpdateData;
  VOICE_CHANNEL_STATUS_UPDATE: { id: Snowflake; guild_id: Snowflake; status: string | null };
  WEBHOOKS_UPDATE: GatewayWebhooksUpdateData;
}

export type GatewayDispatchEventName = keyof GatewayDispatchPayloads;

export interface GatewayDispatchEvent<T extends string = string> {
  op: GatewayOp.Dispatch;
  t: T;
  s: number;
  d: T extends GatewayDispatchEventName ? GatewayDispatchPayloads[T] : unknown;
}

export interface GatewayEventHandler {
  (event: string, data: unknown, seq: number): void;
}
