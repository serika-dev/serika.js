// ─── Discord v10 enums and flag sets used by SerikaCord ─────
// Numbers match Discord API v10, which SerikaCord follows.

/** Channel types. SerikaCord has no stage channels yet (13 is accepted but unused). */
export enum ChannelType {
  GuildText = 0,
  DM = 1,
  GuildVoice = 2,
  GroupDM = 3,
  GuildCategory = 4,
  GuildAnnouncement = 5,
  AnnouncementThread = 10,
  PublicThread = 11,
  PrivateThread = 12,
  GuildStageVoice = 13,
  GuildDirectory = 14,
  GuildForum = 15,
  GuildMedia = 16,
}

export enum MessageType {
  Default = 0,
  RecipientAdd = 1,
  RecipientRemove = 2,
  Call = 3,
  ChannelNameChange = 4,
  ChannelIconChange = 5,
  ChannelPinnedMessage = 6,
  UserJoin = 7,
  GuildBoost = 8,
  GuildBoostTier1 = 9,
  GuildBoostTier2 = 10,
  GuildBoostTier3 = 11,
  ChannelFollowAdd = 12,
  GuildDiscoveryDisqualified = 14,
  GuildDiscoveryRequalified = 15,
  ThreadCreated = 18,
  Reply = 19,
  ChatInputCommand = 20,
  ThreadStarterMessage = 21,
  ContextMenuCommand = 23,
  AutoModerationAction = 24,
  PollResult = 46,
}

/** Message flags (bitfield). */
export const MessageFlags = {
  Crossposted: 1 << 0,
  IsCrosspost: 1 << 1,
  SuppressEmbeds: 1 << 2,
  SourceMessageDeleted: 1 << 3,
  Urgent: 1 << 4,
  HasThread: 1 << 5,
  Ephemeral: 1 << 6,
  Loading: 1 << 7,
  FailedToMentionSomeRolesInThread: 1 << 8,
  SuppressNotifications: 1 << 12,
  IsVoiceMessage: 1 << 13,
  HasSnapshot: 1 << 14,
  /** Switches the message to the components v2 layout (no content/embeds; up to 40 components). */
  IsComponentsV2: 1 << 15,
} as const;

export enum MessageReferenceType {
  Default = 0,
  Forward = 1,
}

export enum ComponentType {
  ActionRow = 1,
  Button = 2,
  StringSelect = 3,
  TextInput = 4,
  UserSelect = 5,
  RoleSelect = 6,
  MentionableSelect = 7,
  ChannelSelect = 8,
  Section = 9,
  TextDisplay = 10,
  Thumbnail = 11,
  MediaGallery = 12,
  File = 13,
  Separator = 14,
  Container = 17,
  Label = 18,
  FileUpload = 19,
  RadioGroup = 21,
  CheckboxGroup = 22,
  Checkbox = 23,
}

export enum ButtonStyle {
  Primary = 1,
  Secondary = 2,
  Success = 3,
  Danger = 4,
  Link = 5,
  Premium = 6,
}

export enum TextInputStyle {
  Short = 1,
  Paragraph = 2,
}

export enum SeparatorSpacing {
  Small = 1,
  Large = 2,
}

export enum InteractionType {
  Ping = 1,
  ApplicationCommand = 2,
  MessageComponent = 3,
  ApplicationCommandAutocomplete = 4,
  ModalSubmit = 5,
}

/** Interaction callback (response) types. */
export enum InteractionResponseType {
  Pong = 1,
  ChannelMessageWithSource = 4,
  DeferredChannelMessageWithSource = 5,
  DeferredUpdateMessage = 6,
  UpdateMessage = 7,
  ApplicationCommandAutocompleteResult = 8,
  Modal = 9,
}

export enum InteractionContextType {
  Guild = 0,
  BotDM = 1,
  PrivateChannel = 2,
}

export enum ApplicationIntegrationType {
  GuildInstall = 0,
  UserInstall = 1,
}

export enum ApplicationCommandType {
  ChatInput = 1,
  User = 2,
  Message = 3,
  PrimaryEntryPoint = 4,
}

export enum ApplicationCommandOptionType {
  Subcommand = 1,
  SubcommandGroup = 2,
  String = 3,
  Integer = 4,
  Boolean = 5,
  User = 6,
  Channel = 7,
  Role = 8,
  Mentionable = 9,
  Number = 10,
  Attachment = 11,
}

export enum ApplicationCommandPermissionType {
  Role = 1,
  User = 2,
  Channel = 3,
}

export enum OverwriteType {
  Role = 0,
  Member = 1,
}

export enum GuildScheduledEventPrivacyLevel {
  GuildOnly = 2,
}

export enum GuildScheduledEventStatus {
  Scheduled = 1,
  Active = 2,
  Completed = 3,
  Canceled = 4,
}

export enum GuildScheduledEventEntityType {
  StageInstance = 1,
  Voice = 2,
  External = 3,
}

export enum AutoModerationTriggerType {
  Keyword = 1,
  Spam = 3,
  KeywordPreset = 4,
  MentionSpam = 5,
  MemberProfile = 6,
}

export enum AutoModerationEventType {
  MessageSend = 1,
  MemberUpdate = 2,
}

export enum AutoModerationActionType {
  BlockMessage = 1,
  SendAlertMessage = 2,
  Timeout = 3,
  BlockMemberInteraction = 4,
}

export enum WebhookType {
  Incoming = 1,
  ChannelFollower = 2,
  Application = 3,
}

export enum InviteTargetType {
  Stream = 1,
  EmbeddedApplication = 2,
}

export enum StickerFormatType {
  PNG = 1,
  APNG = 2,
  Lottie = 3,
  GIF = 4,
}

export enum ActivityType {
  Playing = 0,
  Streaming = 1,
  Listening = 2,
  Watching = 3,
  Custom = 4,
  Competing = 5,
}

export enum PollLayoutType {
  Default = 1,
}

export enum AuditLogEvent {
  GuildUpdate = 1,
  ChannelCreate = 10,
  ChannelUpdate = 11,
  ChannelDelete = 12,
  ChannelOverwriteCreate = 13,
  ChannelOverwriteUpdate = 14,
  ChannelOverwriteDelete = 15,
  MemberKick = 20,
  MemberPrune = 21,
  MemberBanAdd = 22,
  MemberBanRemove = 23,
  MemberUpdate = 24,
  MemberRoleUpdate = 25,
  MemberMove = 26,
  MemberDisconnect = 27,
  BotAdd = 28,
  RoleCreate = 30,
  RoleUpdate = 31,
  RoleDelete = 32,
  InviteCreate = 40,
  InviteUpdate = 41,
  InviteDelete = 42,
  WebhookCreate = 50,
  WebhookUpdate = 51,
  WebhookDelete = 52,
  EmojiCreate = 60,
  EmojiUpdate = 61,
  EmojiDelete = 62,
  MessageDelete = 72,
  MessageBulkDelete = 73,
  MessagePin = 74,
  MessageUnpin = 75,
  IntegrationCreate = 80,
  IntegrationUpdate = 81,
  IntegrationDelete = 82,
  StageInstanceCreate = 83,
  StageInstanceUpdate = 84,
  StageInstanceDelete = 85,
  StickerCreate = 90,
  StickerUpdate = 91,
  StickerDelete = 92,
  GuildScheduledEventCreate = 100,
  GuildScheduledEventUpdate = 101,
  GuildScheduledEventDelete = 102,
  ThreadCreate = 110,
  ThreadUpdate = 111,
  ThreadDelete = 112,
  ApplicationCommandPermissionUpdate = 121,
  AutoModerationRuleCreate = 140,
  AutoModerationRuleUpdate = 141,
  AutoModerationRuleDelete = 142,
  AutoModerationBlockMessage = 143,
  AutoModerationFlagToChannel = 144,
  AutoModerationUserCommunicationDisabled = 145,
}

/**
 * Permission bits in Discord v10 numbering, as bigints. Permission fields on
 * the wire are decimal strings; use `hasPermission()` / `PermissionsBitField`
 * helpers from this package to work with them.
 */
export const PermissionFlags = {
  CreateInstantInvite: 1n << 0n,
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  Administrator: 1n << 3n,
  ManageChannels: 1n << 4n,
  ManageGuild: 1n << 5n,
  AddReactions: 1n << 6n,
  ViewAuditLog: 1n << 7n,
  PrioritySpeaker: 1n << 8n,
  Stream: 1n << 9n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  SendTTSMessages: 1n << 12n,
  ManageMessages: 1n << 13n,
  EmbedLinks: 1n << 14n,
  AttachFiles: 1n << 15n,
  ReadMessageHistory: 1n << 16n,
  MentionEveryone: 1n << 17n,
  UseExternalEmojis: 1n << 18n,
  ViewGuildInsights: 1n << 19n,
  Connect: 1n << 20n,
  Speak: 1n << 21n,
  MuteMembers: 1n << 22n,
  DeafenMembers: 1n << 23n,
  MoveMembers: 1n << 24n,
  UseVAD: 1n << 25n,
  ChangeNickname: 1n << 26n,
  ManageNicknames: 1n << 27n,
  ManageRoles: 1n << 28n,
  ManageWebhooks: 1n << 29n,
  ManageGuildExpressions: 1n << 30n,
  UseApplicationCommands: 1n << 31n,
  RequestToSpeak: 1n << 32n,
  ManageEvents: 1n << 33n,
  ManageThreads: 1n << 34n,
  CreatePublicThreads: 1n << 35n,
  CreatePrivateThreads: 1n << 36n,
  UseExternalStickers: 1n << 37n,
  SendMessagesInThreads: 1n << 38n,
  UseEmbeddedActivities: 1n << 39n,
  ModerateMembers: 1n << 40n,
  ViewCreatorMonetizationAnalytics: 1n << 41n,
  UseSoundboard: 1n << 42n,
  CreateGuildExpressions: 1n << 43n,
  CreateEvents: 1n << 44n,
  UseExternalSounds: 1n << 45n,
  SendVoiceMessages: 1n << 46n,
  SetVoiceChannelStatus: 1n << 48n,
  SendPolls: 1n << 49n,
  UseExternalApps: 1n << 50n,
  PinMessages: 1n << 51n,
} as const;

export type PermissionFlagName = keyof typeof PermissionFlags;

/**
 * Legacy (UUID-format) applications see SerikaCord's original numbering for
 * five permission bits that Serika assigned before Discord published theirs.
 * Snowflake-format applications (the default for new apps) see Discord
 * numbering everywhere. Convert with `permissionsFromLegacy()` /
 * `permissionsToLegacy()`.
 *
 *   flag                     legacy (UUID apps)   Discord v10
 *   UseExternalSounds        1 << 42              1 << 45
 *   SendVoiceMessages        1 << 43              1 << 46
 *   UseSoundboard            1 << 44              1 << 42
 *   CreateGuildExpressions   1 << 45              1 << 43
 *   CreateEvents             1 << 46              1 << 44
 */
export const LegacyPermissionFlags = {
  UseExternalSounds: 1n << 42n,
  SendVoiceMessages: 1n << 43n,
  UseSoundboard: 1n << 44n,
  CreateGuildExpressions: 1n << 45n,
  CreateEvents: 1n << 46n,
} as const;

/** Application flags (bitfield) — includes the privileged-intent approval bits. */
export const ApplicationFlags = {
  ApplicationAutoModerationRuleCreateBadge: 1 << 6,
  GatewayPresence: 1 << 12,
  GatewayPresenceLimited: 1 << 13,
  GatewayGuildMembers: 1 << 14,
  GatewayGuildMembersLimited: 1 << 15,
  VerificationPendingGuildLimit: 1 << 16,
  Embedded: 1 << 17,
  GatewayMessageContent: 1 << 18,
  GatewayMessageContentLimited: 1 << 19,
  ApplicationCommandBadge: 1 << 23,
} as const;
