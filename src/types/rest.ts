// ─── REST request bodies and query options ──────────────────

import type {
  Snowflake, APIEmbed, APIAllowedMentions, APIMessageReference, APIMessageTopLevelComponent,
  APIPollCreate, APIOverwrite, APIForumTag, APIAutoModerationAction, APIGuildWelcomeScreen,
} from './api.js';
import type {
  ChannelType, OverwriteType, AutoModerationTriggerType, AutoModerationEventType,
  GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, GuildScheduledEventStatus,
} from './enums.js';
import type { RESTPostAPIApplicationCommand, RESTPatchAPIApplicationCommand, APIApplicationCommandOption } from './interactions.js';

// ── Files ───────────────────────────────────────────────────

/** Binary data accepted for uploads. */
export type FileData = Blob | ArrayBuffer | ArrayBufferView | string;

/**
 * A file to upload with a message, webhook, interaction response or sticker.
 * Reference it from embeds / components as `attachment://<name>`.
 */
export interface RawFile {
  /** File name, e.g. `image.png`. Prefix with `SPOILER_` to mark it as a spoiler. */
  name: string;
  data: FileData;
  /** MIME type (inferred by the server when omitted). */
  contentType?: string;
  /** Alt text, sent as `attachments[n].description`. */
  description?: string;
  /** Override the multipart field name (default `files[n]`). */
  key?: string;
}

/** Options that apply to any request. */
export interface RequestOptions {
  /** Audit log reason (sent as the `X-Audit-Log-Reason` header). */
  reason?: string;
  /** Abort the request. */
  signal?: AbortSignal;
}

// ── Messages ────────────────────────────────────────────────

export interface CreateMessageOptions {
  content?: string;
  nonce?: string | number;
  tts?: boolean;
  embeds?: APIEmbed[];
  allowed_mentions?: APIAllowedMentions;
  /** Reply (type 0) or forward (type 1). */
  message_reference?: APIMessageReference;
  components?: APIMessageTopLevelComponent[];
  sticker_ids?: Snowflake[];
  /** Attachment metadata; filled in automatically for `files`. Keep `{ id }` entries to retain existing attachments on edit. */
  attachments?: { id: Snowflake | number; filename?: string; description?: string }[];
  /** MessageFlags.SuppressEmbeds | SuppressNotifications | IsComponentsV2. */
  flags?: number;
  enforce_nonce?: boolean;
  poll?: APIPollCreate;
  /** Files to upload (sent as multipart/form-data with `payload_json`). */
  files?: RawFile[];
}

export interface EditMessageOptions {
  content?: string | null;
  embeds?: APIEmbed[] | null;
  flags?: number | null;
  allowed_mentions?: APIAllowedMentions | null;
  components?: APIMessageTopLevelComponent[] | null;
  attachments?: { id: Snowflake | number; filename?: string; description?: string }[] | null;
  files?: RawFile[];
}

export interface GetMessagesQuery {
  around?: Snowflake;
  before?: Snowflake;
  after?: Snowflake;
  /** 1-100, default 50. */
  limit?: number;
}

export interface GetPinsQuery {
  /** ISO8601 timestamp: pins older than this. */
  before?: string;
  /** 1-50, default 50. */
  limit?: number;
}

export interface GetReactionsQuery {
  /** 0 normal, 1 burst. */
  type?: 0 | 1;
  after?: Snowflake;
  limit?: number;
}

/** An emoji for reaction routes: a unicode emoji, `name:id`, `<:name:id>`, or an emoji object. */
export type EmojiResolvable = string | { id?: Snowflake | null; name?: string | null; animated?: boolean };

// ── Webhooks ────────────────────────────────────────────────

export interface ExecuteWebhookOptions extends CreateMessageOptions {
  username?: string;
  avatar_url?: string;
  /** Forum / media channels: create a post with this name. */
  thread_name?: string;
  applied_tags?: Snowflake[];
}

export interface ExecuteWebhookQuery {
  /** Wait for the message to be created and return it (default false → 204). */
  wait?: boolean;
  /** Post into this thread. */
  thread_id?: Snowflake;
  /** Allow components on non-application-owned webhooks. */
  with_components?: boolean;
}

export interface CreateWebhookOptions {
  name: string;
  /** Data URI. */
  avatar?: string | null;
}

export interface ModifyWebhookOptions {
  name?: string;
  avatar?: string | null;
  channel_id?: Snowflake;
}

// ── Channels ────────────────────────────────────────────────

export interface CreateChannelOptions {
  name: string;
  type?: ChannelType | number;
  topic?: string | null;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  position?: number;
  permission_overwrites?: Partial<APIOverwrite>[];
  parent_id?: Snowflake | null;
  nsfw?: boolean;
  rtc_region?: string | null;
  default_auto_archive_duration?: number;
  default_reaction_emoji?: { emoji_id: Snowflake | null; emoji_name: string | null } | null;
  available_tags?: Partial<APIForumTag>[];
  default_sort_order?: number | null;
  default_forum_layout?: number;
  default_thread_rate_limit_per_user?: number;
}

export interface ModifyChannelOptions {
  name?: string;
  type?: number;
  position?: number | null;
  topic?: string | null;
  nsfw?: boolean | null;
  rate_limit_per_user?: number | null;
  bitrate?: number | null;
  user_limit?: number | null;
  permission_overwrites?: Partial<APIOverwrite>[] | null;
  parent_id?: Snowflake | null;
  rtc_region?: string | null;
  default_auto_archive_duration?: number | null;
  flags?: number;
  available_tags?: Partial<APIForumTag>[];
  default_reaction_emoji?: { emoji_id: Snowflake | null; emoji_name: string | null } | null;
  default_thread_rate_limit_per_user?: number;
  default_sort_order?: number | null;
  default_forum_layout?: number;
  // Threads
  archived?: boolean;
  auto_archive_duration?: number;
  locked?: boolean;
  invitable?: boolean;
  applied_tags?: Snowflake[];
}

export interface ChannelPositionChange {
  id: Snowflake;
  position?: number | null;
  lock_permissions?: boolean | null;
  parent_id?: Snowflake | null;
}

export interface EditChannelPermissionsOptions {
  allow?: string | null;
  deny?: string | null;
  type: OverwriteType | 0 | 1;
}

export interface CreateInviteOptions {
  max_age?: number;
  max_uses?: number;
  temporary?: boolean;
  unique?: boolean;
  target_type?: number;
  target_user_id?: Snowflake;
  target_application_id?: Snowflake;
}

export interface StartThreadOptions {
  name: string;
  auto_archive_duration?: 60 | 1440 | 4320 | 10080;
  rate_limit_per_user?: number | null;
}

export interface StartThreadWithoutMessageOptions extends StartThreadOptions {
  /** Default PrivateThread (12) for text channels. */
  type?: ChannelType.PublicThread | ChannelType.PrivateThread | ChannelType.AnnouncementThread | number;
  invitable?: boolean;
}

/** Forum / media channels: start a post (thread + first message). */
export interface StartForumThreadOptions extends StartThreadOptions {
  message: Omit<CreateMessageOptions, 'files' | 'nonce' | 'enforce_nonce' | 'message_reference' | 'tts'>;
  applied_tags?: Snowflake[];
  files?: RawFile[];
}

export interface ArchivedThreadsQuery {
  /** ISO8601 timestamp (public/private) or thread id (joined private). */
  before?: string;
  limit?: number;
}

export interface ThreadMembersQuery {
  with_member?: boolean;
  after?: Snowflake;
  limit?: number;
}

// ── Guilds ──────────────────────────────────────────────────

export interface ModifyGuildOptions {
  name?: string;
  verification_level?: number | null;
  default_message_notifications?: number | null;
  explicit_content_filter?: number | null;
  afk_channel_id?: Snowflake | null;
  afk_timeout?: number;
  icon?: string | null;
  splash?: string | null;
  discovery_splash?: string | null;
  banner?: string | null;
  system_channel_id?: Snowflake | null;
  system_channel_flags?: number;
  rules_channel_id?: Snowflake | null;
  public_updates_channel_id?: Snowflake | null;
  safety_alerts_channel_id?: Snowflake | null;
  preferred_locale?: string | null;
  features?: string[];
  description?: string | null;
  premium_progress_bar_enabled?: boolean;
}

export interface CreateRoleOptions {
  name?: string;
  permissions?: string;
  color?: number;
  colors?: { primary_color: number; secondary_color?: number | null; tertiary_color?: number | null };
  hoist?: boolean;
  icon?: string | null;
  unicode_emoji?: string | null;
  mentionable?: boolean;
}

export interface ModifyRoleOptions extends CreateRoleOptions {
  position?: number;
}

export interface RolePositionChange {
  id: Snowflake;
  position?: number | null;
}

export interface ListMembersQuery {
  /** 1-1000, default 1. */
  limit?: number;
  after?: Snowflake;
}

export interface AddGuildMemberOptions {
  /** OAuth2 access token with the guilds.join scope. */
  access_token: string;
  nick?: string;
  roles?: Snowflake[];
  mute?: boolean;
  deaf?: boolean;
}

export interface ModifyMemberOptions {
  nick?: string | null;
  roles?: Snowflake[] | null;
  mute?: boolean | null;
  deaf?: boolean | null;
  channel_id?: Snowflake | null;
  /** ISO8601 timestamp (max 28 days ahead) or null to remove a timeout. */
  communication_disabled_until?: string | null;
  flags?: number | null;
}

export interface ModifyCurrentMemberOptions {
  nick?: string | null;
  avatar?: string | null;
  banner?: string | null;
  bio?: string | null;
}

export interface BanOptions {
  /** 0-604800. */
  delete_message_seconds?: number;
  /** @deprecated Use delete_message_seconds. */
  delete_message_days?: number;
  /** @deprecated Pass `reason` in the request options (X-Audit-Log-Reason). */
  reason?: string;
}

export interface BulkBanOptions {
  user_ids: Snowflake[];
  delete_message_seconds?: number;
}

export interface GetBansQuery {
  limit?: number;
  before?: Snowflake;
  after?: Snowflake;
}

export interface PruneQuery {
  days?: number;
  include_roles?: Snowflake[] | string;
}

export interface BeginPruneOptions {
  days?: number;
  compute_prune_count?: boolean;
  include_roles?: Snowflake[];
}

export interface CreateEmojiOptions {
  name: string;
  /** Data URI (base64). */
  image: string;
  roles?: Snowflake[];
}

export interface CreateStickerOptions {
  name: string;
  description: string;
  /** Autocomplete/suggestion tags (comma separated). */
  tags: string;
  file: RawFile;
}

export interface ModifyStickerOptions {
  name?: string;
  description?: string | null;
  tags?: string;
}

export interface GetAuditLogQuery {
  user_id?: Snowflake;
  action_type?: number;
  before?: Snowflake;
  after?: Snowflake;
  limit?: number;
}

export interface CreateAutoModerationRuleOptions {
  name: string;
  event_type: AutoModerationEventType;
  trigger_type: AutoModerationTriggerType;
  trigger_metadata?: Record<string, unknown>;
  actions: APIAutoModerationAction[];
  enabled?: boolean;
  exempt_roles?: Snowflake[];
  exempt_channels?: Snowflake[];
}

export type ModifyAutoModerationRuleOptions = Partial<Omit<CreateAutoModerationRuleOptions, 'trigger_type'>>;

export interface CreateScheduledEventOptions {
  channel_id?: Snowflake;
  entity_metadata?: { location?: string };
  name: string;
  privacy_level: GuildScheduledEventPrivacyLevel;
  scheduled_start_time: string;
  scheduled_end_time?: string;
  description?: string;
  entity_type: GuildScheduledEventEntityType;
  image?: string;
}

export interface ModifyScheduledEventOptions extends Partial<CreateScheduledEventOptions> {
  status?: GuildScheduledEventStatus;
}

export interface GetScheduledEventUsersQuery {
  limit?: number;
  with_member?: boolean;
  before?: Snowflake;
  after?: Snowflake;
}

export interface CreateStageInstanceOptions {
  channel_id: Snowflake;
  topic: string;
  privacy_level?: number;
  send_start_notification?: boolean;
  guild_scheduled_event_id?: Snowflake;
}

export interface ModifyVoiceStateOptions {
  channel_id?: Snowflake;
  suppress?: boolean;
  request_to_speak_timestamp?: string | null;
}

export type ModifyWelcomeScreenOptions = Partial<APIGuildWelcomeScreen> & { enabled?: boolean };

// ── Users / DMs ─────────────────────────────────────────────

export interface ModifyCurrentUserOptions {
  username?: string;
  /** Data URI or null. */
  avatar?: string | null;
  banner?: string | null;
}

export interface GetCurrentUserGuildsQuery {
  before?: Snowflake;
  after?: Snowflake;
  limit?: number;
  with_counts?: boolean;
}

export interface CreateDMOptions {
  recipient_id: Snowflake;
}

// ── Commands ────────────────────────────────────────────────

export type CreateCommandOptions = RESTPostAPIApplicationCommand;
export type ModifyCommandOptions = RESTPatchAPIApplicationCommand;
export type { APIApplicationCommandOption };

// ── Invites ─────────────────────────────────────────────────

export interface GetInviteQuery {
  with_counts?: boolean;
  with_expiration?: boolean;
  guild_scheduled_event_id?: Snowflake;
}
