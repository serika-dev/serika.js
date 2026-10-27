// ─── Discord v10-compatible API objects (SerikaCord bot API) ─
//
// Ids: every id is a string. Applications with `api_id_format = 'snowflake'`
// (the default for new apps) see Discord-style numeric snowflakes; legacy
// applications see UUIDs. Requests accept both forms. Never parse ids as
// numbers — use the helpers in `utils/snowflake` instead.

import type {
  ChannelType, ComponentType, ButtonStyle, TextInputStyle, SeparatorSpacing, MessageType,
  MessageReferenceType, OverwriteType, StickerFormatType, WebhookType, InviteTargetType,
  GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, GuildScheduledEventStatus,
  AutoModerationTriggerType, AutoModerationEventType, AutoModerationActionType, PollLayoutType,
  ActivityType,
} from './enums.js';
import type { APIApplicationCommand } from './interactions.js';

/** A SerikaCord id: a numeric snowflake string (snowflake-format apps) or a UUID (legacy apps). */
export type Snowflake = string;
/** ISO 8601 timestamp. */
export type ISOTimestamp = string;

// ── Errors ──────────────────────────────────────────────────

/** Discord-shaped error body. `errors` is the nested form-error tree for code 50035. */
export interface APIError {
  code: number;
  message: string;
  errors?: APIFormErrors;
}

export interface APIFormErrors {
  _errors?: { code: string; message: string }[];
  [key: string]: APIFormErrors | { code: string; message: string }[] | undefined;
}

/** Error body of the non-bot SerikaCord client API. */
export interface SerikaClientError {
  error: string;
  details?: string;
  message?: string;
  retryAfter?: number;
}

/** Body of a 429 from the bot API. `retry_after` is in seconds (float). */
export interface APIRateLimitError {
  message: string;
  retry_after: number;
  global: boolean;
  code?: number;
}

// ── Users ───────────────────────────────────────────────────

export interface APIUser {
  id: Snowflake;
  username: string;
  /** Always "0" on SerikaCord (no discriminators). */
  discriminator?: string;
  global_name: string | null;
  /** Image hash (snowflake-format apps) or a full URL (legacy apps). */
  avatar: string | null;
  banner?: string | null;
  accent_color?: number | null;
  bot?: boolean;
  system?: boolean;
  mfa_enabled?: boolean;
  verified?: boolean;
  email?: string | null;
  locale?: string;
  flags?: number;
  premium_type?: number;
  public_flags?: number;
  avatar_decoration_data?: unknown;
  created_at?: string;
}

export interface APIPartialUser {
  id: Snowflake;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  bot?: boolean;
}

// ── Roles, emojis, stickers ─────────────────────────────────

export interface APIRoleTags {
  bot_id?: Snowflake;
  integration_id?: Snowflake;
  premium_subscriber?: null;
  available_for_purchase?: null;
  guild_connections?: null;
}

export interface APIRole {
  id: Snowflake;
  name: string;
  color: number;
  colors?: { primary_color: number; secondary_color: number | null; tertiary_color: number | null };
  hoist: boolean;
  icon: string | null;
  unicode_emoji: string | null;
  position: number;
  /** Permission bitfield as a decimal string. */
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  flags: number;
  tags?: APIRoleTags;
}

export interface APIEmoji {
  id: Snowflake | null;
  name: string | null;
  roles?: Snowflake[];
  user?: APIUser | null;
  require_colons?: boolean;
  managed?: boolean;
  animated?: boolean;
  available?: boolean;
}

export interface APIPartialEmoji {
  id: Snowflake | null;
  name: string | null;
  animated?: boolean;
}

export interface APISticker {
  id: Snowflake;
  pack_id?: Snowflake;
  name: string;
  description: string | null;
  /** Discord sends a comma-separated string; older SerikaCord builds sent an array. */
  tags: string | string[];
  type: number;
  format_type: StickerFormatType | number;
  available?: boolean;
  guild_id?: Snowflake;
  user?: APIUser | null;
  sort_value?: number;
}

export interface APIStickerItem {
  id: Snowflake;
  name: string;
  format_type: StickerFormatType | number;
}

export interface APIStickerPack {
  id: Snowflake;
  stickers: APISticker[];
  name: string;
  sku_id: Snowflake;
  cover_sticker_id?: Snowflake;
  description: string;
  banner_asset_id?: Snowflake;
}

export interface APISoundboardSound {
  name: string;
  sound_id: Snowflake;
  volume: number;
  emoji_id: Snowflake | null;
  emoji_name: string | null;
  guild_id?: Snowflake;
  available: boolean;
  user?: APIUser;
}

// ── Guilds ──────────────────────────────────────────────────

export interface APIGuild {
  id: Snowflake;
  name: string;
  icon: string | null;
  icon_hash?: string | null;
  splash?: string | null;
  discovery_splash?: string | null;
  description: string | null;
  owner_id: Snowflake | null;
  owner?: boolean;
  permissions?: string;
  afk_channel_id?: Snowflake | null;
  afk_timeout?: number;
  widget_enabled?: boolean;
  widget_channel_id?: Snowflake | null;
  verification_level: number;
  default_message_notifications?: number;
  explicit_content_filter?: number;
  mfa_level?: number;
  nsfw_level?: number;
  application_id?: Snowflake | null;
  system_channel_id?: Snowflake | null;
  system_channel_flags?: number;
  rules_channel_id?: Snowflake | null;
  public_updates_channel_id?: Snowflake | null;
  safety_alerts_channel_id?: Snowflake | null;
  max_presences?: number | null;
  max_members?: number;
  vanity_url_code?: string | null;
  member_count?: number;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  premium_tier: number;
  premium_subscription_count?: number;
  preferred_locale?: string;
  features: string[];
  roles: APIRole[];
  emojis: APIEmoji[];
  stickers?: APISticker[];
  banner: string | null;
  premium_progress_bar_enabled?: boolean;
  joined_at?: string;
}

/** Entry of GET /users/@me/guilds. */
export interface APIPartialGuild {
  id: Snowflake;
  name: string;
  icon: string | null;
  banner?: string | null;
  owner?: boolean;
  permissions?: string;
  features: string[];
  approximate_member_count?: number;
  approximate_presence_count?: number;
}

/** GUILD_CREATE payload: the guild plus the gateway-only fields. */
export interface APIGatewayGuild extends APIGuild {
  joined_at: string;
  large?: boolean;
  unavailable?: boolean;
  member_count: number;
  voice_states?: APIVoiceState[];
  members?: APIGuildMember[];
  channels?: APIChannel[];
  threads?: APIChannel[];
  presences?: APIPresence[];
  stage_instances?: APIStageInstance[];
  guild_scheduled_events?: APIGuildScheduledEvent[];
  soundboard_sounds?: APISoundboardSound[];
}

export interface APIUnavailableGuild {
  id: Snowflake;
  unavailable?: boolean;
}

export interface APIGuildPreview {
  id: Snowflake;
  name: string;
  icon: string | null;
  splash?: string | null;
  banner: string | null;
  description: string | null;
  approximate_member_count: number;
  approximate_presence_count: number;
  discovery_splash: string | null;
  features: string[];
  emojis?: APIEmoji[];
  stickers?: APISticker[];
}

export interface APIGuildMember {
  user?: APIUser | null;
  nick: string | null;
  avatar: string | null;
  banner: string | null;
  roles: Snowflake[];
  joined_at?: string;
  premium_since: string | null;
  deaf: boolean;
  mute: boolean;
  flags: number;
  pending: boolean;
  /** Only present on interaction payloads. */
  permissions?: string;
  communication_disabled_until: string | null;
}

export interface APIBan {
  reason: string | null;
  user: APIUser | { id: Snowflake };
}

export interface APIGuildWidgetSettings {
  enabled: boolean;
  channel_id: Snowflake | null;
}

export interface APIGuildWelcomeScreen {
  description: string | null;
  welcome_channels: { channel_id: Snowflake; description: string; emoji_id: Snowflake | null; emoji_name: string | null }[];
}

export interface APIGuildOnboarding {
  guild_id: Snowflake;
  prompts: unknown[];
  default_channel_ids: Snowflake[];
  enabled: boolean;
  mode: number;
}

export interface APIGuildTemplate {
  code: string;
  name: string;
  description: string | null;
  usage_count: number;
  creator_id: Snowflake;
  creator: APIUser;
  created_at: string;
  updated_at: string;
  source_guild_id: Snowflake;
  serialized_source_guild: unknown;
  is_dirty: boolean | null;
}

export interface APIIntegration {
  id: Snowflake;
  name: string;
  type: string;
  enabled: boolean;
  account: { id: string; name: string };
  application?: { id: Snowflake; name: string; icon: string | null; description: string; bot?: APIUser };
  scopes?: string[];
  user?: APIUser;
}

/**
 * SerikaCord extension: GET /guilds/{guild.id}/bridge — which of the guild's
 * channels the Discord bridge links. Only links to channels the bot can see.
 */
export interface APIGuildBridge {
  platform: 'discord';
  enabled: boolean;
  /** The bridged Discord guild id (always a Discord snowflake), or null when the bridge is off. */
  guild_id: string | null;
  links: APIGuildBridgeLink[];
}

export interface APIGuildBridgeLink {
  /** SerikaCord channel id (snowflake or UUID per the app's id format). */
  channel_id: Snowflake;
  /** Discord channel id (always a Discord snowflake). */
  discord_channel_id: string;
  /** Discord → SerikaCord relaying is on. */
  inbound: boolean;
  /** SerikaCord → Discord relaying is on. */
  outbound: boolean;
  /** Discord bot messages are relayed in. */
  include_bots: boolean;
}

// ── Channels & threads ──────────────────────────────────────

export interface APIOverwrite {
  id: Snowflake;
  type: OverwriteType | number;
  allow: string;
  deny: string;
}

export interface APIForumTag {
  id: Snowflake;
  name: string;
  moderated: boolean;
  emoji_id: Snowflake | null;
  emoji_name: string | null;
}

export interface APIThreadMetadata {
  archived: boolean;
  auto_archive_duration: number;
  archive_timestamp: string;
  locked: boolean;
  invitable?: boolean;
  create_timestamp?: string | null;
}

export interface APIThreadMember {
  id?: Snowflake;
  user_id?: Snowflake;
  join_timestamp: string;
  flags: number;
  member?: APIGuildMember;
}

export interface APIChannel {
  id: Snowflake;
  type: ChannelType | number;
  guild_id?: Snowflake | null;
  position?: number;
  permission_overwrites?: APIOverwrite[];
  name?: string | null;
  topic?: string | null;
  nsfw?: boolean;
  last_message_id?: Snowflake | null;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  recipients?: APIUser[];
  icon?: string | null;
  owner_id?: Snowflake;
  application_id?: Snowflake;
  parent_id?: Snowflake | null;
  last_pin_timestamp?: string | null;
  rtc_region?: string | null;
  video_quality_mode?: number;
  message_count?: number;
  member_count?: number;
  thread_metadata?: APIThreadMetadata;
  member?: APIThreadMember;
  default_auto_archive_duration?: number;
  permissions?: string;
  flags?: number;
  total_message_sent?: number;
  available_tags?: APIForumTag[];
  applied_tags?: Snowflake[];
  default_reaction_emoji?: { emoji_id: Snowflake | null; emoji_name: string | null } | null;
  default_thread_rate_limit_per_user?: number;
  default_sort_order?: number | null;
  default_forum_layout?: number;
}

export interface APIThreadList {
  threads: APIChannel[];
  members: APIThreadMember[];
  has_more?: boolean;
}

export interface APIFollowedChannel {
  channel_id: Snowflake;
  webhook_id: Snowflake;
}

// ── Messages ────────────────────────────────────────────────

export interface APIAttachment {
  id: Snowflake;
  filename: string;
  title?: string;
  description?: string;
  content_type?: string;
  size: number;
  url: string;
  proxy_url: string;
  height?: number | null;
  width?: number | null;
  ephemeral?: boolean;
  duration_secs?: number;
  waveform?: string;
  flags?: number;
}

export interface APIEmbedField { name: string; value: string; inline?: boolean }
export interface APIEmbedMedia { url: string; proxy_url?: string; height?: number; width?: number }

export interface APIEmbed {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: { text: string; icon_url?: string; proxy_icon_url?: string };
  image?: APIEmbedMedia;
  thumbnail?: APIEmbedMedia;
  video?: APIEmbedMedia;
  provider?: { name?: string; url?: string };
  author?: { name: string; url?: string; icon_url?: string; proxy_icon_url?: string };
  fields?: APIEmbedField[];
}

export interface APIReaction {
  count: number;
  count_details?: { burst: number; normal: number };
  me: boolean;
  me_burst?: boolean;
  emoji: APIPartialEmoji;
  burst_colors?: string[];
}

export interface APIMessageReference {
  type?: MessageReferenceType | number;
  message_id?: Snowflake;
  channel_id?: Snowflake;
  guild_id?: Snowflake;
  fail_if_not_exists?: boolean;
}

export interface APIMessageSnapshot {
  message: Pick<APIMessage, 'type' | 'content' | 'embeds' | 'attachments' | 'timestamp' | 'edited_timestamp' | 'flags' | 'mentions' | 'mention_roles' | 'components'> & {
    sticker_items?: APIStickerItem[];
  };
}

export interface APIMessageInteractionMetadata {
  id: Snowflake;
  type: number;
  name?: string;
  user: APIUser;
  authorizing_integration_owners: Record<string, Snowflake>;
  original_response_message_id?: Snowflake;
  interacted_message_id?: Snowflake;
}

export interface APIPollMedia {
  text?: string;
  emoji?: APIPartialEmoji;
}

export interface APIPollAnswer {
  answer_id: number;
  poll_media: APIPollMedia;
}

export interface APIPoll {
  question: APIPollMedia;
  answers: APIPollAnswer[];
  expiry: string | null;
  allow_multiselect: boolean;
  layout_type: PollLayoutType | number;
  results?: {
    is_finalized: boolean;
    answer_counts: { id: number; count: number; me_voted: boolean }[];
  };
}

/** Poll create request (POST message `poll` field). */
export interface APIPollCreate {
  question: APIPollMedia;
  answers: { poll_media: APIPollMedia }[];
  /** Hours, 1-768 (default 24). */
  duration?: number;
  allow_multiselect?: boolean;
  layout_type?: PollLayoutType | number;
}

/**
 * SerikaCord extension: present on messages the Discord bridge relayed in
 * from Discord. All ids are Discord's own (never translated). A bot running on
 * both platforms should skip these when its Discord copy is in that server.
 */
export interface APIBridgedFrom {
  platform: 'discord';
  guild_id: string | null;
  channel_id: string;
  message_id: string;
  author: { id: string; bot: boolean };
}

export interface APIMessage {
  id: Snowflake;
  channel_id: Snowflake;
  /** Present on gateway events (and some REST responses) for guild messages. */
  guild_id?: Snowflake;
  author: APIUser;
  /** Present on gateway MESSAGE_CREATE / MESSAGE_UPDATE for guild messages. */
  member?: Partial<APIGuildMember>;
  content: string;
  timestamp: string;
  edited_timestamp: string | null;
  tts: boolean;
  mention_everyone: boolean;
  mentions: APIUser[];
  mention_roles: Snowflake[];
  mention_channels?: { id: Snowflake; guild_id: Snowflake; type: number; name: string }[];
  attachments: APIAttachment[];
  embeds: APIEmbed[];
  reactions?: APIReaction[];
  nonce?: string | number;
  pinned: boolean;
  webhook_id?: Snowflake;
  type: MessageType | number;
  application_id?: Snowflake;
  flags?: number;
  message_reference?: APIMessageReference;
  message_snapshots?: APIMessageSnapshot[];
  referenced_message?: APIMessage | null;
  interaction_metadata?: APIMessageInteractionMetadata;
  /** Deprecated by Discord in favour of interaction_metadata; still sent. */
  interaction?: { id: Snowflake; type: number; name: string; user: APIUser };
  thread?: APIChannel;
  components?: APIMessageTopLevelComponent[];
  sticker_items?: APIStickerItem[];
  position?: number;
  poll?: APIPoll;
  call?: { participants: Snowflake[]; ended_timestamp: string | null };
  /** SerikaCord extension: set when the Discord bridge relayed this message in. */
  bridged_from?: APIBridgedFrom;
}

/** GET /channels/{id}/messages/pins */
export interface APIChannelPins {
  items: { pinned_at: string; message: APIMessage }[];
  has_more: boolean;
}

export interface APIAllowedMentions {
  parse?: ('users' | 'roles' | 'everyone')[];
  roles?: Snowflake[];
  users?: Snowflake[];
  replied_user?: boolean;
}

// ── Components (v1 + v2) ────────────────────────────────────

export interface APIUnfurledMediaItem {
  /** http(s) URL or `attachment://<filename>` for a file uploaded with the message. */
  url: string;
  proxy_url?: string;
  width?: number | null;
  height?: number | null;
  content_type?: string;
  attachment_id?: Snowflake;
}

interface APIBaseComponent<T extends ComponentType> {
  type: T;
  /** Numeric id; assigned by the server when omitted. */
  id?: number;
}

export interface APIButtonComponentWithCustomId extends APIBaseComponent<ComponentType.Button> {
  style: ButtonStyle.Primary | ButtonStyle.Secondary | ButtonStyle.Success | ButtonStyle.Danger;
  custom_id: string;
  label?: string;
  emoji?: APIPartialEmoji;
  disabled?: boolean;
}

export interface APIButtonComponentWithURL extends APIBaseComponent<ComponentType.Button> {
  style: ButtonStyle.Link;
  url: string;
  label?: string;
  emoji?: APIPartialEmoji;
  disabled?: boolean;
}

export interface APIButtonComponentWithSKUId extends APIBaseComponent<ComponentType.Button> {
  style: ButtonStyle.Premium;
  sku_id: Snowflake;
  disabled?: boolean;
}

export type APIButtonComponent = APIButtonComponentWithCustomId | APIButtonComponentWithURL | APIButtonComponentWithSKUId;

export interface APISelectMenuOption {
  label: string;
  value: string;
  description?: string;
  emoji?: APIPartialEmoji;
  default?: boolean;
}

export interface APISelectMenuDefaultValue {
  id: Snowflake;
  type: 'user' | 'role' | 'channel';
}

interface APIBaseSelectMenu<T extends ComponentType> extends APIBaseComponent<T> {
  custom_id: string;
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  disabled?: boolean;
  /** Modals only. */
  required?: boolean;
}

export interface APIStringSelectComponent extends APIBaseSelectMenu<ComponentType.StringSelect> {
  options: APISelectMenuOption[];
}
export interface APIUserSelectComponent extends APIBaseSelectMenu<ComponentType.UserSelect> {
  default_values?: APISelectMenuDefaultValue[];
}
export interface APIRoleSelectComponent extends APIBaseSelectMenu<ComponentType.RoleSelect> {
  default_values?: APISelectMenuDefaultValue[];
}
export interface APIMentionableSelectComponent extends APIBaseSelectMenu<ComponentType.MentionableSelect> {
  default_values?: APISelectMenuDefaultValue[];
}
export interface APIChannelSelectComponent extends APIBaseSelectMenu<ComponentType.ChannelSelect> {
  channel_types?: ChannelType[];
  default_values?: APISelectMenuDefaultValue[];
}

export type APISelectMenuComponent =
  | APIStringSelectComponent
  | APIUserSelectComponent
  | APIRoleSelectComponent
  | APIMentionableSelectComponent
  | APIChannelSelectComponent;

export interface APITextInputComponent extends APIBaseComponent<ComponentType.TextInput> {
  custom_id: string;
  style: TextInputStyle;
  /** Deprecated in favour of a Label (18) wrapper; still accepted. */
  label?: string;
  min_length?: number;
  max_length?: number;
  required?: boolean;
  value?: string;
  placeholder?: string;
}

export interface APIFileUploadComponent extends APIBaseComponent<ComponentType.FileUpload> {
  custom_id: string;
  min_values?: number;
  max_values?: number;
  required?: boolean;
}

export interface APIRadioGroupComponent extends APIBaseComponent<ComponentType.RadioGroup> {
  custom_id: string;
  options: { label: string; value: string; description?: string; default?: boolean }[];
  required?: boolean;
}

export interface APICheckboxGroupComponent extends APIBaseComponent<ComponentType.CheckboxGroup> {
  custom_id: string;
  options: { label: string; value: string; description?: string; default?: boolean }[];
  min_values?: number;
  max_values?: number;
  required?: boolean;
}

export interface APICheckboxComponent extends APIBaseComponent<ComponentType.Checkbox> {
  custom_id: string;
  default?: boolean;
}

export interface APIActionRowComponent<C = APIButtonComponent | APISelectMenuComponent | APITextInputComponent>
  extends APIBaseComponent<ComponentType.ActionRow> {
  components: C[];
}

export interface APITextDisplayComponent extends APIBaseComponent<ComponentType.TextDisplay> {
  content: string;
}

export interface APIThumbnailComponent extends APIBaseComponent<ComponentType.Thumbnail> {
  media: APIUnfurledMediaItem;
  description?: string | null;
  spoiler?: boolean;
}

export interface APISectionComponent extends APIBaseComponent<ComponentType.Section> {
  /** 1-3 text displays. */
  components: APITextDisplayComponent[];
  accessory: APIButtonComponent | APIThumbnailComponent;
}

export interface APIMediaGalleryItem {
  media: APIUnfurledMediaItem;
  description?: string | null;
  spoiler?: boolean;
}

export interface APIMediaGalleryComponent extends APIBaseComponent<ComponentType.MediaGallery> {
  items: APIMediaGalleryItem[];
}

export interface APIFileComponent extends APIBaseComponent<ComponentType.File> {
  /** Must be `attachment://<filename>`. */
  file: APIUnfurledMediaItem;
  spoiler?: boolean;
  name?: string;
  size?: number;
}

export interface APISeparatorComponent extends APIBaseComponent<ComponentType.Separator> {
  divider?: boolean;
  spacing?: SeparatorSpacing;
}

export type APIComponentInContainer =
  | APIActionRowComponent<APIButtonComponent | APISelectMenuComponent>
  | APITextDisplayComponent
  | APISectionComponent
  | APIMediaGalleryComponent
  | APIFileComponent
  | APISeparatorComponent;

export interface APIContainerComponent extends APIBaseComponent<ComponentType.Container> {
  components: APIComponentInContainer[];
  accent_color?: number | null;
  spoiler?: boolean;
}

/** Components a message may hold at the top level (v1: action rows only; v2: all of these). */
export type APIMessageTopLevelComponent =
  | APIActionRowComponent<APIButtonComponent | APISelectMenuComponent>
  | APITextDisplayComponent
  | APISectionComponent
  | APIMediaGalleryComponent
  | APIFileComponent
  | APISeparatorComponent
  | APIContainerComponent;

export interface APILabelComponent extends APIBaseComponent<ComponentType.Label> {
  label: string;
  description?: string;
  component:
    | APITextInputComponent
    | APISelectMenuComponent
    | APIFileUploadComponent
    | APIRadioGroupComponent
    | APICheckboxGroupComponent
    | APICheckboxComponent;
}

/** Components a modal may hold at the top level. */
export type APIModalTopLevelComponent =
  | APILabelComponent
  | APITextDisplayComponent
  | APIActionRowComponent<APITextInputComponent>;

export interface APIModal {
  custom_id: string;
  title: string;
  components: APIModalTopLevelComponent[];
}

// ── Invites ─────────────────────────────────────────────────

export interface APIInvite {
  type?: number;
  code: string;
  guild?: Partial<APIGuild> & { id: Snowflake; name: string } | null;
  channel: { id: Snowflake; name: string; type?: number } | null;
  inviter?: APIUser | null;
  target_type?: InviteTargetType;
  target_user?: APIUser;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  expires_at?: string | null;
  guild_scheduled_event?: APIGuildScheduledEvent;
  uses?: number;
  max_uses?: number;
  max_age?: number;
  temporary?: boolean;
  created_at?: string;
}

// ── Webhooks ────────────────────────────────────────────────

export interface APIWebhook {
  id: Snowflake;
  type: WebhookType | number;
  guild_id?: Snowflake | null;
  channel_id: Snowflake | null;
  user?: APIUser;
  name: string | null;
  avatar: string | null;
  /** Only for incoming webhooks the bot can manage. */
  token?: string;
  application_id?: Snowflake | null;
  url?: string;
  /** Legacy SerikaCord field. */
  creator_id?: Snowflake;
}

// ── Audit log ───────────────────────────────────────────────

export interface APIAuditLogChange {
  key: string;
  new_value?: unknown;
  old_value?: unknown;
}

export interface APIAuditLogEntry {
  id: Snowflake;
  action_type: number;
  user_id: Snowflake | null;
  target_id: string | null;
  reason?: string | null;
  changes?: APIAuditLogChange[];
  options?: Record<string, string>;
  created_at?: string;
}

export interface APIAuditLog {
  audit_log_entries: APIAuditLogEntry[];
  users?: APIUser[];
  webhooks?: APIWebhook[];
  threads?: APIChannel[];
  integrations?: unknown[];
  application_commands?: APIApplicationCommand[];
  auto_moderation_rules?: APIAutoModerationRule[];
  guild_scheduled_events?: APIGuildScheduledEvent[];
}

// ── Auto moderation ─────────────────────────────────────────

export interface APIAutoModerationAction {
  type: AutoModerationActionType;
  metadata?: { channel_id?: Snowflake; duration_seconds?: number; custom_message?: string };
}

export interface APIAutoModerationRule {
  id: Snowflake;
  guild_id: Snowflake;
  name: string;
  creator_id: Snowflake;
  event_type: AutoModerationEventType;
  trigger_type: AutoModerationTriggerType;
  trigger_metadata: {
    keyword_filter?: string[];
    regex_patterns?: string[];
    presets?: number[];
    allow_list?: string[];
    mention_total_limit?: number;
    mention_raid_protection_enabled?: boolean;
  };
  actions: APIAutoModerationAction[];
  enabled: boolean;
  exempt_roles: Snowflake[];
  exempt_channels: Snowflake[];
}

// ── Scheduled events & stage instances ──────────────────────

export interface APIGuildScheduledEvent {
  id: Snowflake;
  guild_id: Snowflake;
  channel_id: Snowflake | null;
  creator_id?: Snowflake | null;
  name: string;
  description?: string | null;
  scheduled_start_time: string;
  scheduled_end_time: string | null;
  privacy_level: GuildScheduledEventPrivacyLevel;
  status: GuildScheduledEventStatus;
  entity_type: GuildScheduledEventEntityType;
  entity_id: Snowflake | null;
  entity_metadata: { location?: string } | null;
  creator?: APIUser;
  user_count?: number;
  image?: string | null;
  recurrence_rule?: unknown;
}

export interface APIGuildScheduledEventUser {
  guild_scheduled_event_id: Snowflake;
  user: APIUser;
  member?: APIGuildMember;
}

export interface APIStageInstance {
  id: Snowflake;
  guild_id: Snowflake;
  channel_id: Snowflake;
  topic: string;
  privacy_level: number;
  discoverable_disabled?: boolean;
  guild_scheduled_event_id: Snowflake | null;
}

// ── Voice ───────────────────────────────────────────────────

export interface APIVoiceState {
  guild_id?: Snowflake;
  channel_id: Snowflake | null;
  user_id: Snowflake;
  member?: APIGuildMember;
  session_id: string;
  deaf: boolean;
  mute: boolean;
  self_deaf: boolean;
  self_mute: boolean;
  self_stream?: boolean;
  self_video: boolean;
  suppress: boolean;
  request_to_speak_timestamp: string | null;
}

export interface APIVoiceRegion {
  id: string;
  name: string;
  optimal: boolean;
  deprecated: boolean;
  custom: boolean;
}

// ── Presence ────────────────────────────────────────────────

export interface APIActivity {
  name: string;
  type: ActivityType | number;
  url?: string | null;
  state?: string | null;
  details?: string | null;
  created_at?: number;
  timestamps?: { start?: number; end?: number };
  application_id?: Snowflake;
  emoji?: APIPartialEmoji | null;
}

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

export interface APIPresence {
  user: { id: Snowflake } & Partial<APIUser>;
  guild_id?: Snowflake;
  status: PresenceStatus;
  activities: APIActivity[];
  client_status?: { desktop?: string; mobile?: string; web?: string };
}

// ── Applications ────────────────────────────────────────────

export interface APIApplication {
  id: Snowflake;
  name: string;
  icon: string | null;
  description: string;
  rpc_origins?: string[];
  bot_public?: boolean;
  bot_require_code_grant?: boolean;
  bot?: APIUser;
  terms_of_service_url?: string;
  privacy_policy_url?: string;
  owner?: APIUser;
  verify_key: string;
  team?: unknown;
  guild_id?: Snowflake;
  cover_image?: string;
  flags?: number;
  approximate_guild_count?: number;
  redirect_uris?: string[];
  interactions_endpoint_url?: string | null;
  role_connections_verification_url?: string | null;
  tags?: string[];
  install_params?: { scopes: string[]; permissions: string };
  integration_types_config?: Record<string, unknown>;
  custom_install_url?: string;
}

export interface APIEntitlement {
  id: Snowflake;
  sku_id: Snowflake;
  application_id: Snowflake;
  user_id?: Snowflake;
  type: number;
  deleted: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  guild_id?: Snowflake;
  consumed?: boolean;
}

export interface APISKU {
  id: Snowflake;
  type: number;
  application_id: Snowflake;
  name: string;
  slug: string;
  flags: number;
}

// ── Gateway REST info ───────────────────────────────────────

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
