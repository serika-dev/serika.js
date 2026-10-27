// ─── Application commands & interactions ────────────────────

import type {
  ApplicationCommandType, ApplicationCommandOptionType, ApplicationCommandPermissionType,
  ApplicationIntegrationType, InteractionContextType, InteractionType, InteractionResponseType,
  ChannelType, ComponentType,
} from './enums.js';
import type {
  Snowflake, APIUser, APIGuildMember, APIRole, APIChannel, APIMessage, APIAttachment,
  APIModal, APIEmbed, APIAllowedMentions, APIMessageTopLevelComponent, APIPollCreate, APIEntitlement,
} from './api.js';

export type LocalizationMap = Partial<Record<string, string | null>>;

export interface APIApplicationCommandOptionChoice<V extends string | number = string | number> {
  name: string;
  name_localizations?: LocalizationMap | null;
  value: V;
}

export interface APIApplicationCommandOption {
  type: ApplicationCommandOptionType;
  name: string;
  name_localizations?: LocalizationMap | null;
  description: string;
  description_localizations?: LocalizationMap | null;
  required?: boolean;
  choices?: APIApplicationCommandOptionChoice[];
  options?: APIApplicationCommandOption[];
  channel_types?: ChannelType[];
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
  autocomplete?: boolean;
}

export interface APIApplicationCommand {
  id: Snowflake;
  type?: ApplicationCommandType;
  application_id: Snowflake;
  guild_id?: Snowflake;
  name: string;
  name_localizations?: LocalizationMap | null;
  description: string;
  description_localizations?: LocalizationMap | null;
  options?: APIApplicationCommandOption[];
  default_member_permissions: string | null;
  dm_permission?: boolean;
  /** Deprecated by Discord; still sent by SerikaCord. */
  default_permission?: boolean;
  nsfw?: boolean;
  integration_types?: ApplicationIntegrationType[];
  contexts?: InteractionContextType[] | null;
  version: Snowflake;
}

/** Body for creating / bulk-overwriting a command. */
export interface RESTPostAPIApplicationCommand {
  name: string;
  name_localizations?: LocalizationMap | null;
  /** Required for chat-input commands; must be empty/omitted for user and message commands. */
  description?: string;
  description_localizations?: LocalizationMap | null;
  options?: APIApplicationCommandOption[];
  default_member_permissions?: string | null;
  dm_permission?: boolean;
  default_permission?: boolean;
  type?: ApplicationCommandType;
  nsfw?: boolean;
  integration_types?: ApplicationIntegrationType[];
  contexts?: InteractionContextType[];
  /** Bulk overwrite only: keeps an existing command's id. */
  id?: Snowflake;
}

export type RESTPatchAPIApplicationCommand = Partial<RESTPostAPIApplicationCommand>;

export interface APIApplicationCommandPermission {
  id: Snowflake;
  type: ApplicationCommandPermissionType;
  permission: boolean;
}

export interface APIGuildApplicationCommandPermissions {
  id: Snowflake;
  application_id: Snowflake;
  guild_id: Snowflake;
  permissions: APIApplicationCommandPermission[];
}

// ── Incoming interactions ───────────────────────────────────

export interface APIInteractionDataResolved {
  users?: Record<Snowflake, APIUser>;
  members?: Record<Snowflake, Omit<APIGuildMember, 'user' | 'deaf' | 'mute'>>;
  roles?: Record<Snowflake, APIRole>;
  channels?: Record<Snowflake, Partial<APIChannel> & { id: Snowflake; type: number; permissions?: string }>;
  messages?: Record<Snowflake, APIMessage>;
  attachments?: Record<Snowflake, APIAttachment>;
}

export interface APIApplicationCommandInteractionDataOption {
  name: string;
  type: ApplicationCommandOptionType;
  value?: string | number | boolean;
  options?: APIApplicationCommandInteractionDataOption[];
  focused?: boolean;
}

export interface APIApplicationCommandInteractionData {
  id: Snowflake;
  name: string;
  type: ApplicationCommandType;
  resolved?: APIInteractionDataResolved;
  options?: APIApplicationCommandInteractionDataOption[];
  guild_id?: Snowflake;
  /** User / message context-menu commands: the clicked user or message. */
  target_id?: Snowflake;
}

export interface APIMessageComponentInteractionData {
  custom_id: string;
  component_type: ComponentType;
  /** Select menus: the selected values. */
  values?: string[];
  resolved?: APIInteractionDataResolved;
}

export interface APIModalSubmitComponent {
  type: ComponentType;
  id?: number;
  custom_id?: string;
  value?: string | boolean;
  values?: string[];
  /** Label (18) wrappers. */
  component?: APIModalSubmitComponent;
  /** Action rows (legacy). */
  components?: APIModalSubmitComponent[];
}

export interface APIModalSubmitInteractionData {
  custom_id: string;
  components: APIModalSubmitComponent[];
  resolved?: APIInteractionDataResolved;
}

interface APIBaseInteraction<T extends InteractionType, D> {
  id: Snowflake;
  application_id: Snowflake;
  type: T;
  data: D;
  guild?: { id: Snowflake; features: string[]; locale: string };
  guild_id?: Snowflake;
  channel?: Partial<APIChannel> & { id: Snowflake; type: number };
  channel_id?: Snowflake;
  /** Guild interactions: the invoking member (with `permissions`). */
  member?: APIGuildMember & { user: APIUser; permissions: string };
  /** DM interactions: the invoking user. */
  user?: APIUser;
  /** Continuation token (valid 15 minutes) for responses and follow-ups. */
  token: string;
  version: 1;
  /** Component interactions: the message the component is on. */
  message?: APIMessage;
  app_permissions: string;
  locale?: string;
  guild_locale?: string;
  entitlements: APIEntitlement[];
  authorizing_integration_owners: Partial<Record<`${ApplicationIntegrationType}`, Snowflake>>;
  context?: InteractionContextType;
  attachment_size_limit?: number;
}

export type APIPingInteraction = Omit<APIBaseInteraction<InteractionType.Ping, never>, 'data'> & { data?: never };
export type APIChatInputCommandInteraction = APIBaseInteraction<InteractionType.ApplicationCommand, APIApplicationCommandInteractionData>;
export type APIApplicationCommandInteraction = APIChatInputCommandInteraction;
export type APIMessageComponentInteraction = APIBaseInteraction<InteractionType.MessageComponent, APIMessageComponentInteractionData> & { message: APIMessage };
export type APIApplicationCommandAutocompleteInteraction = APIBaseInteraction<InteractionType.ApplicationCommandAutocomplete, APIApplicationCommandInteractionData>;
export type APIModalSubmitInteraction = APIBaseInteraction<InteractionType.ModalSubmit, APIModalSubmitInteractionData>;

export type APIInteraction =
  | APIPingInteraction
  | APIApplicationCommandInteraction
  | APIMessageComponentInteraction
  | APIApplicationCommandAutocompleteInteraction
  | APIModalSubmitInteraction;

// ── Responses ───────────────────────────────────────────────

/** Message body shared by message create, interaction replies, follow-ups and webhooks. */
export interface APIInteractionResponseCallbackData {
  tts?: boolean;
  content?: string;
  embeds?: APIEmbed[];
  allowed_mentions?: APIAllowedMentions;
  /** MessageFlags: Ephemeral, SuppressEmbeds, SuppressNotifications, IsComponentsV2. */
  flags?: number;
  components?: APIMessageTopLevelComponent[];
  attachments?: { id: Snowflake | number; filename?: string; description?: string }[];
  poll?: APIPollCreate;
}

export interface APIAutocompleteResponseData {
  choices: APIApplicationCommandOptionChoice[];
}

export type APIInteractionResponse =
  | { type: InteractionResponseType.Pong }
  | { type: InteractionResponseType.ChannelMessageWithSource; data: APIInteractionResponseCallbackData }
  | { type: InteractionResponseType.DeferredChannelMessageWithSource; data?: { flags?: number } }
  | { type: InteractionResponseType.DeferredUpdateMessage }
  | { type: InteractionResponseType.UpdateMessage; data?: APIInteractionResponseCallbackData }
  | { type: InteractionResponseType.ApplicationCommandAutocompleteResult; data: APIAutocompleteResponseData }
  | { type: InteractionResponseType.Modal; data: APIModal };

/** POST /interactions/{id}/{token}/callback?with_response=true */
export interface APIInteractionCallbackResponse {
  interaction: {
    id: Snowflake;
    type: InteractionType;
    response_message_id?: Snowflake;
    response_message_loading?: boolean;
    response_message_ephemeral?: boolean;
    channel_id?: Snowflake;
    guild_id?: Snowflake;
  };
  resource?: { type: InteractionResponseType; message?: APIMessage };
}
