import { HTTPClient } from '../http.js';
import { encodeEmoji, seg } from './multipart.js';
import type {
  Snowflake, APIUser, APIGuild, APIPartialGuild, APIGuildPreview, APIChannel, APIRole, APIGuildMember,
  APIEmoji, APISticker, APIStickerPack, APIBan, APIInvite, APIWebhook, APIMessage, APIChannelPins,
  APIAuditLog, APIApplicationCommand, APIGuildApplicationCommandPermissions, APIApplicationCommandPermission,
  APIVoiceRegion, APIVoiceState, GatewayInfo, GatewayBotInfo, APIThreadList, APIThreadMember,
  APIFollowedChannel, APIAutoModerationRule, APIGuildScheduledEvent, APIGuildScheduledEventUser,
  APIStageInstance, APISoundboardSound, APIGuildWidgetSettings, APIGuildWelcomeScreen, APIGuildOnboarding,
  APIGuildTemplate, APIIntegration, APIGuildBridge, APIApplication, APIEntitlement, APISKU,
  APIInteractionResponse, APIInteractionCallbackResponse, APIInteractionResponseCallbackData,
  CreateMessageOptions, EditMessageOptions, GetMessagesQuery, GetPinsQuery, GetReactionsQuery,
  EmojiResolvable, CreateChannelOptions, ModifyChannelOptions, ChannelPositionChange,
  EditChannelPermissionsOptions, CreateInviteOptions, StartThreadOptions, StartThreadWithoutMessageOptions,
  StartForumThreadOptions, ArchivedThreadsQuery, ThreadMembersQuery, ModifyGuildOptions, CreateRoleOptions,
  ModifyRoleOptions, RolePositionChange, ListMembersQuery, AddGuildMemberOptions, ModifyMemberOptions,
  ModifyCurrentMemberOptions, BanOptions, BulkBanOptions, GetBansQuery, PruneQuery, BeginPruneOptions,
  CreateEmojiOptions, CreateStickerOptions, ModifyStickerOptions, GetAuditLogQuery,
  CreateAutoModerationRuleOptions, ModifyAutoModerationRuleOptions, CreateScheduledEventOptions,
  ModifyScheduledEventOptions, GetScheduledEventUsersQuery, CreateStageInstanceOptions,
  ModifyVoiceStateOptions, ModifyWelcomeScreenOptions, ModifyCurrentUserOptions, GetCurrentUserGuildsQuery,
  CreateDMOptions, CreateCommandOptions, ModifyCommandOptions, CreateWebhookOptions, ModifyWebhookOptions,
  ExecuteWebhookOptions, ExecuteWebhookQuery, GetInviteQuery, RequestOptions, RawFile,
} from '../types.js';
import { buildFormFields } from './multipart.js';

const V10 = '/api/v10';

type Body = Record<string, unknown>;

/** Split `files` out of a message-like body. */
function splitFiles<T extends { files?: RawFile[] }>(opts: T): { body: Omit<T, 'files'>; files?: RawFile[] } {
  const { files, ...body } = opts;
  return { body, files: files && files.length ? files : undefined };
}

function limitQuery<Q extends { limit?: number }>(q: number | Q | undefined): Q | undefined {
  return typeof q === 'number' ? ({ limit: q } as Q) : q;
}

/** Interaction context needed to answer it (an interaction object from INTERACTION_CREATE works). */
export interface InteractionRef {
  id: Snowflake;
  token: string;
  application_id: Snowflake;
}

// ─── Bot API v10 — Discord-compatible REST endpoints ────────
//
// Every method maps 1:1 to a route under /api/v10 (see the SerikaCord
// developer docs). Methods that change guild state accept a final
// `RequestOptions` with `reason` (written to the audit log).

export class BotAPI {
  constructor(private http: HTTPClient) {}

  private req<T>(method: string, path: string, init: {
    body?: unknown; query?: object; files?: RawFile[]; options?: RequestOptions; auth?: boolean;
  } = {}): Promise<T> {
    return this.http.request<T>({
      method,
      path: `${V10}${path}`,
      body: init.body,
      query: init.query,
      files: init.files,
      reason: init.options?.reason,
      signal: init.options?.signal,
      auth: init.auth,
    });
  }

  // ── API root & gateway ──────────────────────────────────
  getAPIInfo() {
    return this.req<{ message: string; version: number; documentation: string; endpoints: Record<string, string> }>('GET', '/');
  }

  getGateway() {
    return this.req<GatewayInfo>('GET', '/gateway');
  }

  /** Gateway URL, recommended shard count and session start limit. */
  getGatewayBot() {
    return this.req<GatewayBotInfo>('GET', '/gateway/bot');
  }

  // ── Users ───────────────────────────────────────────────
  getCurrentUser() {
    return this.req<APIUser>('GET', '/users/@me');
  }

  modifyCurrentUser(opts: ModifyCurrentUserOptions) {
    return this.req<APIUser>('PATCH', '/users/@me', { body: opts });
  }

  getUser(userId: Snowflake) {
    return this.req<APIUser>('GET', `/users/${seg(userId)}`);
  }

  getCurrentUserGuilds(query?: GetCurrentUserGuildsQuery) {
    return this.req<APIPartialGuild[]>('GET', '/users/@me/guilds', { query });
  }

  getCurrentUserGuildMember(guildId: Snowflake) {
    return this.req<APIGuildMember>('GET', `/users/@me/guilds/${seg(guildId)}/member`);
  }

  leaveGuild(guildId: Snowflake) {
    return this.req<void>('DELETE', `/users/@me/guilds/${seg(guildId)}`);
  }

  getDMChannels() {
    return this.req<APIChannel[]>('GET', '/users/@me/channels');
  }

  /** Open (or fetch) a DM with a user. */
  createDM(opts: CreateDMOptions | Snowflake) {
    const body = typeof opts === 'string' ? { recipient_id: opts } : opts;
    return this.req<APIChannel>('POST', '/users/@me/channels', { body });
  }

  // ── Applications ────────────────────────────────────────
  getCurrentApplication() {
    return this.req<APIApplication>('GET', '/applications/@me');
  }

  modifyCurrentApplication(opts: Partial<Pick<APIApplication, 'description' | 'icon' | 'cover_image' | 'interactions_endpoint_url' | 'tags' | 'install_params' | 'custom_install_url' | 'flags' | 'role_connections_verification_url'>>) {
    return this.req<APIApplication>('PATCH', '/applications/@me', { body: opts });
  }

  getApplication(appId: Snowflake) {
    return this.req<APIApplication>('GET', `/applications/${seg(appId)}`);
  }

  /** GET /oauth2/applications/@me (what discord.py calls at login). */
  getCurrentBotApplicationInformation() {
    return this.req<APIApplication>('GET', '/oauth2/applications/@me');
  }

  // ── Guilds ──────────────────────────────────────────────
  getGuild(guildId: Snowflake, query?: { with_counts?: boolean }) {
    return this.req<APIGuild>('GET', `/guilds/${seg(guildId)}`, { query });
  }

  modifyGuild(guildId: Snowflake, opts: ModifyGuildOptions, options?: RequestOptions) {
    return this.req<APIGuild>('PATCH', `/guilds/${seg(guildId)}`, { body: opts, options });
  }

  getGuildPreview(guildId: Snowflake) {
    return this.req<APIGuildPreview>('GET', `/guilds/${seg(guildId)}/preview`);
  }

  getGuildChannels(guildId: Snowflake) {
    return this.req<APIChannel[]>('GET', `/guilds/${seg(guildId)}/channels`);
  }

  createGuildChannel(guildId: Snowflake, opts: CreateChannelOptions, options?: RequestOptions) {
    return this.req<APIChannel>('POST', `/guilds/${seg(guildId)}/channels`, { body: opts, options });
  }

  modifyGuildChannelPositions(guildId: Snowflake, positions: ChannelPositionChange[], options?: RequestOptions) {
    return this.req<void>('PATCH', `/guilds/${seg(guildId)}/channels`, { body: positions, options });
  }

  /** @deprecated SerikaCord-only alias; use modifyChannel(channelId, ...). */
  modifyGuildChannel(guildId: Snowflake, channelId: Snowflake, opts: ModifyChannelOptions, options?: RequestOptions) {
    return this.req<APIChannel>('PATCH', `/guilds/${seg(guildId)}/channels/${seg(channelId)}`, { body: opts, options });
  }

  /** @deprecated SerikaCord-only alias; use deleteChannel(channelId). */
  deleteGuildChannel(guildId: Snowflake, channelId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/guilds/${seg(guildId)}/channels/${seg(channelId)}`, { options });
  }

  getActiveGuildThreads(guildId: Snowflake) {
    return this.req<APIThreadList>('GET', `/guilds/${seg(guildId)}/threads/active`);
  }

  /**
   * SerikaCord extension: which of this guild's channels are bridged to
   * Discord (only channels the bot can see). Pair with `message.bridged_from`
   * to handle each bridged message once when your bot runs on both platforms.
   */
  getGuildBridge(guildId: Snowflake) {
    return this.req<APIGuildBridge>('GET', `/guilds/${seg(guildId)}/bridge`);
  }

  /**
   * Discord-style guild message search (content, author_id, channel_id, has,
   * min_id/max_id, sort_by, limit/offset, ...). Shares the account search
   * budget, so expect 429s when searching quickly.
   */
  searchGuildMessages(guildId: Snowflake, query: Record<string, string | number | boolean | readonly (string | number)[] | undefined>) {
    return this.req<{ total_results: number; messages: APIMessage[][]; threads?: APIChannel[]; members?: APIThreadMember[]; doing_deep_historical_index?: boolean }>('GET', `/guilds/${seg(guildId)}/messages/search`, { query });
  }

  getGuildVanityURL(guildId: Snowflake) {
    return this.req<{ code: string | null; uses: number }>('GET', `/guilds/${seg(guildId)}/vanity-url`);
  }

  getGuildVoiceRegions(guildId: Snowflake) {
    return this.req<APIVoiceRegion[]>('GET', `/guilds/${seg(guildId)}/regions`);
  }

  getGuildWidgetSettings(guildId: Snowflake) {
    return this.req<APIGuildWidgetSettings>('GET', `/guilds/${seg(guildId)}/widget`);
  }

  modifyGuildWidget(guildId: Snowflake, opts: Partial<APIGuildWidgetSettings>, options?: RequestOptions) {
    return this.req<APIGuildWidgetSettings>('PATCH', `/guilds/${seg(guildId)}/widget`, { body: opts, options });
  }

  getGuildWidget(guildId: Snowflake) {
    return this.req<Record<string, unknown>>('GET', `/guilds/${seg(guildId)}/widget.json`);
  }

  getGuildOnboarding(guildId: Snowflake) {
    return this.req<APIGuildOnboarding>('GET', `/guilds/${seg(guildId)}/onboarding`);
  }

  modifyGuildOnboarding(guildId: Snowflake, opts: Partial<Omit<APIGuildOnboarding, 'guild_id'>>, options?: RequestOptions) {
    return this.req<APIGuildOnboarding>('PUT', `/guilds/${seg(guildId)}/onboarding`, { body: opts, options });
  }

  getGuildWelcomeScreen(guildId: Snowflake) {
    return this.req<APIGuildWelcomeScreen>('GET', `/guilds/${seg(guildId)}/welcome-screen`);
  }

  modifyGuildWelcomeScreen(guildId: Snowflake, opts: ModifyWelcomeScreenOptions, options?: RequestOptions) {
    return this.req<APIGuildWelcomeScreen>('PATCH', `/guilds/${seg(guildId)}/welcome-screen`, { body: opts, options });
  }

  getGuildIntegrations(guildId: Snowflake) {
    return this.req<APIIntegration[]>('GET', `/guilds/${seg(guildId)}/integrations`);
  }

  deleteGuildIntegration(guildId: Snowflake, integrationId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/guilds/${seg(guildId)}/integrations/${seg(integrationId)}`, { options });
  }

  // ── Guild templates ─────────────────────────────────────
  getGuildTemplate(code: string) {
    return this.req<APIGuildTemplate>('GET', `/guilds/templates/${seg(code)}`);
  }

  getGuildTemplates(guildId: Snowflake) {
    return this.req<APIGuildTemplate[]>('GET', `/guilds/${seg(guildId)}/templates`);
  }

  createGuildTemplate(guildId: Snowflake, opts: { name: string; description?: string | null }) {
    return this.req<APIGuildTemplate>('POST', `/guilds/${seg(guildId)}/templates`, { body: opts });
  }

  syncGuildTemplate(guildId: Snowflake, code: string) {
    return this.req<APIGuildTemplate>('PUT', `/guilds/${seg(guildId)}/templates/${seg(code)}`);
  }

  modifyGuildTemplate(guildId: Snowflake, code: string, opts: { name?: string; description?: string | null }) {
    return this.req<APIGuildTemplate>('PATCH', `/guilds/${seg(guildId)}/templates/${seg(code)}`, { body: opts });
  }

  deleteGuildTemplate(guildId: Snowflake, code: string) {
    return this.req<APIGuildTemplate>('DELETE', `/guilds/${seg(guildId)}/templates/${seg(code)}`);
  }

  // ── Roles ───────────────────────────────────────────────
  getGuildRoles(guildId: Snowflake) {
    return this.req<APIRole[]>('GET', `/guilds/${seg(guildId)}/roles`);
  }

  getGuildRole(guildId: Snowflake, roleId: Snowflake) {
    return this.req<APIRole>('GET', `/guilds/${seg(guildId)}/roles/${seg(roleId)}`);
  }

  /** Member count per role id. */
  getGuildRoleMemberCounts(guildId: Snowflake) {
    return this.req<Record<Snowflake, number>>('GET', `/guilds/${seg(guildId)}/roles/member-counts`);
  }

  createGuildRole(guildId: Snowflake, opts: CreateRoleOptions = {}, options?: RequestOptions) {
    return this.req<APIRole>('POST', `/guilds/${seg(guildId)}/roles`, { body: opts, options });
  }

  modifyGuildRolePositions(guildId: Snowflake, positions: RolePositionChange[], options?: RequestOptions) {
    return this.req<APIRole[]>('PATCH', `/guilds/${seg(guildId)}/roles`, { body: positions, options });
  }

  modifyGuildRole(guildId: Snowflake, roleId: Snowflake, opts: ModifyRoleOptions, options?: RequestOptions) {
    return this.req<APIRole>('PATCH', `/guilds/${seg(guildId)}/roles/${seg(roleId)}`, { body: opts, options });
  }

  deleteGuildRole(guildId: Snowflake, roleId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/guilds/${seg(guildId)}/roles/${seg(roleId)}`, { options });
  }

  // ── Members ─────────────────────────────────────────────
  /** List members (needs the GUILD_MEMBERS intent enabled). Pass a number for the old `limit`-only form. */
  getGuildMembers(guildId: Snowflake, query?: number | ListMembersQuery) {
    return this.req<APIGuildMember[]>('GET', `/guilds/${seg(guildId)}/members`, { query: limitQuery(query) });
  }

  searchGuildMembers(guildId: Snowflake, query: string, limit?: number) {
    return this.req<APIGuildMember[]>('GET', `/guilds/${seg(guildId)}/members/search`, { query: { query, limit } });
  }

  getGuildMember(guildId: Snowflake, userId: Snowflake) {
    return this.req<APIGuildMember>('GET', `/guilds/${seg(guildId)}/members/${seg(userId)}`);
  }

  /** Add a user with an OAuth2 `guilds.join` token. Resolves undefined (204) when already a member. */
  addGuildMember(guildId: Snowflake, userId: Snowflake, opts: AddGuildMemberOptions) {
    return this.req<APIGuildMember | undefined>('PUT', `/guilds/${seg(guildId)}/members/${seg(userId)}`, { body: opts });
  }

  modifyGuildMember(guildId: Snowflake, userId: Snowflake, opts: ModifyMemberOptions, options?: RequestOptions) {
    return this.req<APIGuildMember>('PATCH', `/guilds/${seg(guildId)}/members/${seg(userId)}`, { body: opts, options });
  }

  modifyCurrentMember(guildId: Snowflake, opts: ModifyCurrentMemberOptions, options?: RequestOptions) {
    return this.req<APIGuildMember>('PATCH', `/guilds/${seg(guildId)}/members/@me`, { body: opts, options });
  }

  /** @deprecated Use modifyCurrentMember(guildId, { nick }). */
  modifyCurrentUserNick(guildId: Snowflake, nick: string | null, options?: RequestOptions) {
    return this.req<{ nick: string | null }>('PATCH', `/guilds/${seg(guildId)}/members/@me/nick`, { body: { nick }, options });
  }

  /** Set a timeout (ISO date, Date, or milliseconds from now); null clears it. */
  timeoutGuildMember(guildId: Snowflake, userId: Snowflake, until: string | Date | number | null, options?: RequestOptions) {
    const value = until === null ? null
      : typeof until === 'number' ? new Date(Date.now() + until).toISOString()
      : until instanceof Date ? until.toISOString() : until;
    return this.modifyGuildMember(guildId, userId, { communication_disabled_until: value }, options);
  }

  addGuildMemberRole(guildId: Snowflake, userId: Snowflake, roleId: Snowflake, options?: RequestOptions) {
    return this.req<void>('PUT', `/guilds/${seg(guildId)}/members/${seg(userId)}/roles/${seg(roleId)}`, { options });
  }

  removeGuildMemberRole(guildId: Snowflake, userId: Snowflake, roleId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/guilds/${seg(guildId)}/members/${seg(userId)}/roles/${seg(roleId)}`, { options });
  }

  /** Kick a member. */
  removeGuildMember(guildId: Snowflake, userId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/guilds/${seg(guildId)}/members/${seg(userId)}`, { options });
  }

  getGuildPruneCount(guildId: Snowflake, query?: PruneQuery) {
    return this.req<{ pruned: number }>('GET', `/guilds/${seg(guildId)}/prune`, { query });
  }

  beginGuildPrune(guildId: Snowflake, opts: BeginPruneOptions = {}, options?: RequestOptions) {
    return this.req<{ pruned: number | null }>('POST', `/guilds/${seg(guildId)}/prune`, { body: opts, options });
  }

  // ── Bans ────────────────────────────────────────────────
  getGuildBans(guildId: Snowflake, query?: GetBansQuery) {
    return this.req<APIBan[]>('GET', `/guilds/${seg(guildId)}/bans`, { query });
  }

  getGuildBan(guildId: Snowflake, userId: Snowflake) {
    return this.req<APIBan>('GET', `/guilds/${seg(guildId)}/bans/${seg(userId)}`);
  }

  createGuildBan(guildId: Snowflake, userId: Snowflake, opts: BanOptions = {}, options?: RequestOptions) {
    const { reason, ...body } = opts;
    return this.req<void>('PUT', `/guilds/${seg(guildId)}/bans/${seg(userId)}`, {
      body, options: { ...options, reason: options?.reason ?? reason },
    });
  }

  bulkGuildBan(guildId: Snowflake, opts: BulkBanOptions, options?: RequestOptions) {
    return this.req<{ banned_users: Snowflake[]; failed_users: Snowflake[] }>('POST', `/guilds/${seg(guildId)}/bulk-ban`, { body: opts, options });
  }

  removeGuildBan(guildId: Snowflake, userId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/guilds/${seg(guildId)}/bans/${seg(userId)}`, { options });
  }

  // ── Emojis ──────────────────────────────────────────────
  getGuildEmojis(guildId: Snowflake) {
    return this.req<APIEmoji[]>('GET', `/guilds/${seg(guildId)}/emojis`);
  }

  getGuildEmoji(guildId: Snowflake, emojiId: Snowflake) {
    return this.req<APIEmoji>('GET', `/guilds/${seg(guildId)}/emojis/${seg(emojiId)}`);
  }

  createGuildEmoji(guildId: Snowflake, opts: CreateEmojiOptions, options?: RequestOptions) {
    return this.req<APIEmoji>('POST', `/guilds/${seg(guildId)}/emojis`, { body: opts, options });
  }

  modifyGuildEmoji(guildId: Snowflake, emojiId: Snowflake, opts: { name?: string; roles?: Snowflake[] | null }, options?: RequestOptions) {
    return this.req<APIEmoji>('PATCH', `/guilds/${seg(guildId)}/emojis/${seg(emojiId)}`, { body: opts, options });
  }

  deleteGuildEmoji(guildId: Snowflake, emojiId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/guilds/${seg(guildId)}/emojis/${seg(emojiId)}`, { options });
  }

  getApplicationEmojis(appId: Snowflake) {
    return this.req<{ items: APIEmoji[] }>('GET', `/applications/${seg(appId)}/emojis`);
  }

  getApplicationEmoji(appId: Snowflake, emojiId: Snowflake) {
    return this.req<APIEmoji>('GET', `/applications/${seg(appId)}/emojis/${seg(emojiId)}`);
  }

  createApplicationEmoji(appId: Snowflake, opts: { name: string; image: string }) {
    return this.req<APIEmoji>('POST', `/applications/${seg(appId)}/emojis`, { body: opts });
  }

  modifyApplicationEmoji(appId: Snowflake, emojiId: Snowflake, opts: { name: string }) {
    return this.req<APIEmoji>('PATCH', `/applications/${seg(appId)}/emojis/${seg(emojiId)}`, { body: opts });
  }

  deleteApplicationEmoji(appId: Snowflake, emojiId: Snowflake) {
    return this.req<void>('DELETE', `/applications/${seg(appId)}/emojis/${seg(emojiId)}`);
  }

  // ── Stickers ────────────────────────────────────────────
  getSticker(stickerId: Snowflake) {
    return this.req<APISticker>('GET', `/stickers/${seg(stickerId)}`);
  }

  getStickerPacks() {
    return this.req<{ sticker_packs: APIStickerPack[] }>('GET', '/sticker-packs');
  }

  getStickerPack(packId: Snowflake) {
    return this.req<APIStickerPack>('GET', `/sticker-packs/${seg(packId)}`);
  }

  getGuildStickers(guildId: Snowflake) {
    return this.req<APISticker[]>('GET', `/guilds/${seg(guildId)}/stickers`);
  }

  getGuildSticker(guildId: Snowflake, stickerId: Snowflake) {
    return this.req<APISticker>('GET', `/guilds/${seg(guildId)}/stickers/${seg(stickerId)}`);
  }

  /** Upload a sticker (multipart: name, description, tags, file). */
  createGuildSticker(guildId: Snowflake, opts: CreateStickerOptions, options?: RequestOptions) {
    const form = buildFormFields({ name: opts.name, description: opts.description, tags: opts.tags }, opts.file);
    return this.req<APISticker>('POST', `/guilds/${seg(guildId)}/stickers`, { body: form, options });
  }

  modifyGuildSticker(guildId: Snowflake, stickerId: Snowflake, opts: ModifyStickerOptions, options?: RequestOptions) {
    return this.req<APISticker>('PATCH', `/guilds/${seg(guildId)}/stickers/${seg(stickerId)}`, { body: opts, options });
  }

  deleteGuildSticker(guildId: Snowflake, stickerId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/guilds/${seg(guildId)}/stickers/${seg(stickerId)}`, { options });
  }

  // ── Soundboard ──────────────────────────────────────────
  getDefaultSoundboardSounds() {
    return this.req<APISoundboardSound[]>('GET', '/soundboard-default-sounds');
  }

  getGuildSoundboardSounds(guildId: Snowflake) {
    return this.req<{ items: APISoundboardSound[] }>('GET', `/guilds/${seg(guildId)}/soundboard-sounds`);
  }

  getGuildSoundboardSound(guildId: Snowflake, soundId: Snowflake) {
    return this.req<APISoundboardSound>('GET', `/guilds/${seg(guildId)}/soundboard-sounds/${seg(soundId)}`);
  }

  /** Upload a soundboard sound (`sound`: data URI, mp3/ogg). Needs a SerikaCord server with soundboard writes. */
  createGuildSoundboardSound(guildId: Snowflake, opts: { name: string; sound: string; volume?: number | null; emoji_id?: Snowflake | null; emoji_name?: string | null }, options?: RequestOptions) {
    return this.req<APISoundboardSound>('POST', `/guilds/${seg(guildId)}/soundboard-sounds`, { body: opts, options });
  }

  modifyGuildSoundboardSound(guildId: Snowflake, soundId: Snowflake, opts: { name?: string; volume?: number | null; emoji_id?: Snowflake | null; emoji_name?: string | null }, options?: RequestOptions) {
    return this.req<APISoundboardSound>('PATCH', `/guilds/${seg(guildId)}/soundboard-sounds/${seg(soundId)}`, { body: opts, options });
  }

  deleteGuildSoundboardSound(guildId: Snowflake, soundId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/guilds/${seg(guildId)}/soundboard-sounds/${seg(soundId)}`, { options });
  }

  /**
   * Play a soundboard sound in a voice channel. Unlike Discord the bot need
   * not be connected (bots can't join SerikaCord voice); it needs SPEAK +
   * USE_SOUNDBOARD (and USE_EXTERNAL_SOUNDS for another server's sound).
   */
  sendSoundboardSound(channelId: Snowflake, opts: { sound_id: Snowflake; source_guild_id?: Snowflake }) {
    return this.req<void>('POST', `/channels/${seg(channelId)}/send-soundboard-sound`, { body: opts });
  }

  // ── Invites ─────────────────────────────────────────────
  getGuildInvites(guildId: Snowflake) {
    return this.req<APIInvite[]>('GET', `/guilds/${seg(guildId)}/invites`);
  }

  getInvite(code: string, query?: GetInviteQuery) {
    return this.req<APIInvite>('GET', `/invites/${seg(code)}`, { query });
  }

  deleteInvite(code: string, options?: RequestOptions) {
    return this.req<APIInvite>('DELETE', `/invites/${seg(code)}`, { options });
  }

  // ── Audit log ───────────────────────────────────────────
  /** Pass a number for the old `limit`-only form. */
  getGuildAuditLog(guildId: Snowflake, query?: number | GetAuditLogQuery) {
    return this.req<APIAuditLog>('GET', `/guilds/${seg(guildId)}/audit-logs`, { query: limitQuery(query) });
  }

  // ── Auto moderation ─────────────────────────────────────
  getAutoModerationRules(guildId: Snowflake) {
    return this.req<APIAutoModerationRule[]>('GET', `/guilds/${seg(guildId)}/auto-moderation/rules`);
  }

  getAutoModerationRule(guildId: Snowflake, ruleId: Snowflake) {
    return this.req<APIAutoModerationRule>('GET', `/guilds/${seg(guildId)}/auto-moderation/rules/${seg(ruleId)}`);
  }

  createAutoModerationRule(guildId: Snowflake, opts: CreateAutoModerationRuleOptions, options?: RequestOptions) {
    return this.req<APIAutoModerationRule>('POST', `/guilds/${seg(guildId)}/auto-moderation/rules`, { body: opts, options });
  }

  modifyAutoModerationRule(guildId: Snowflake, ruleId: Snowflake, opts: ModifyAutoModerationRuleOptions, options?: RequestOptions) {
    return this.req<APIAutoModerationRule>('PATCH', `/guilds/${seg(guildId)}/auto-moderation/rules/${seg(ruleId)}`, { body: opts, options });
  }

  deleteAutoModerationRule(guildId: Snowflake, ruleId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/guilds/${seg(guildId)}/auto-moderation/rules/${seg(ruleId)}`, { options });
  }

  // ── Scheduled events ────────────────────────────────────
  getGuildScheduledEvents(guildId: Snowflake, query?: { with_user_count?: boolean }) {
    return this.req<APIGuildScheduledEvent[]>('GET', `/guilds/${seg(guildId)}/scheduled-events`, { query });
  }

  getGuildScheduledEvent(guildId: Snowflake, eventId: Snowflake, query?: { with_user_count?: boolean }) {
    return this.req<APIGuildScheduledEvent>('GET', `/guilds/${seg(guildId)}/scheduled-events/${seg(eventId)}`, { query });
  }

  createGuildScheduledEvent(guildId: Snowflake, opts: CreateScheduledEventOptions, options?: RequestOptions) {
    return this.req<APIGuildScheduledEvent>('POST', `/guilds/${seg(guildId)}/scheduled-events`, { body: opts, options });
  }

  modifyGuildScheduledEvent(guildId: Snowflake, eventId: Snowflake, opts: ModifyScheduledEventOptions, options?: RequestOptions) {
    return this.req<APIGuildScheduledEvent>('PATCH', `/guilds/${seg(guildId)}/scheduled-events/${seg(eventId)}`, { body: opts, options });
  }

  deleteGuildScheduledEvent(guildId: Snowflake, eventId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/guilds/${seg(guildId)}/scheduled-events/${seg(eventId)}`, { options });
  }

  getGuildScheduledEventUsers(guildId: Snowflake, eventId: Snowflake, query?: GetScheduledEventUsersQuery) {
    return this.req<APIGuildScheduledEventUser[]>('GET', `/guilds/${seg(guildId)}/scheduled-events/${seg(eventId)}/users`, { query });
  }

  // ── Stage instances ─────────────────────────────────────
  createStageInstance(opts: CreateStageInstanceOptions, options?: RequestOptions) {
    return this.req<APIStageInstance>('POST', '/stage-instances', { body: opts, options });
  }

  getStageInstance(channelId: Snowflake) {
    return this.req<APIStageInstance>('GET', `/stage-instances/${seg(channelId)}`);
  }

  modifyStageInstance(channelId: Snowflake, opts: { topic?: string; privacy_level?: number }, options?: RequestOptions) {
    return this.req<APIStageInstance>('PATCH', `/stage-instances/${seg(channelId)}`, { body: opts, options });
  }

  deleteStageInstance(channelId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/stage-instances/${seg(channelId)}`, { options });
  }

  // ── Voice ───────────────────────────────────────────────
  getVoiceRegions() {
    return this.req<APIVoiceRegion[]>('GET', '/voice/regions');
  }

  getCurrentUserVoiceState(guildId: Snowflake) {
    return this.req<APIVoiceState>('GET', `/guilds/${seg(guildId)}/voice-states/@me`);
  }

  getUserVoiceState(guildId: Snowflake, userId: Snowflake) {
    return this.req<APIVoiceState>('GET', `/guilds/${seg(guildId)}/voice-states/${seg(userId)}`);
  }

  modifyCurrentUserVoiceState(guildId: Snowflake, opts: ModifyVoiceStateOptions) {
    return this.req<void>('PATCH', `/guilds/${seg(guildId)}/voice-states/@me`, { body: opts });
  }

  modifyUserVoiceState(guildId: Snowflake, userId: Snowflake, opts: Omit<ModifyVoiceStateOptions, 'request_to_speak_timestamp'>) {
    return this.req<void>('PATCH', `/guilds/${seg(guildId)}/voice-states/${seg(userId)}`, { body: opts });
  }

  // ── Channels ────────────────────────────────────────────
  getChannel(channelId: Snowflake) {
    return this.req<APIChannel>('GET', `/channels/${seg(channelId)}`);
  }

  modifyChannel(channelId: Snowflake, opts: ModifyChannelOptions, options?: RequestOptions) {
    return this.req<APIChannel>('PATCH', `/channels/${seg(channelId)}`, { body: opts, options });
  }

  /** Delete a channel / close a DM. Resolves the deleted channel. */
  deleteChannel(channelId: Snowflake, options?: RequestOptions) {
    return this.req<APIChannel>('DELETE', `/channels/${seg(channelId)}`, { options });
  }

  editChannelPermissions(channelId: Snowflake, overwriteId: Snowflake, opts: EditChannelPermissionsOptions, options?: RequestOptions) {
    return this.req<void>('PUT', `/channels/${seg(channelId)}/permissions/${seg(overwriteId)}`, { body: opts, options });
  }

  deleteChannelPermission(channelId: Snowflake, overwriteId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/channels/${seg(channelId)}/permissions/${seg(overwriteId)}`, { options });
  }

  getChannelInvites(channelId: Snowflake) {
    return this.req<APIInvite[]>('GET', `/channels/${seg(channelId)}/invites`);
  }

  createChannelInvite(channelId: Snowflake, opts: CreateInviteOptions = {}, options?: RequestOptions) {
    return this.req<APIInvite>('POST', `/channels/${seg(channelId)}/invites`, { body: opts, options });
  }

  followAnnouncementChannel(channelId: Snowflake, webhookChannelId: Snowflake, options?: RequestOptions) {
    return this.req<APIFollowedChannel>('POST', `/channels/${seg(channelId)}/followers`, { body: { webhook_channel_id: webhookChannelId }, options });
  }

  groupDMAddRecipient(channelId: Snowflake, userId: Snowflake, opts: { access_token: string; nick?: string }) {
    return this.req<void>('PUT', `/channels/${seg(channelId)}/recipients/${seg(userId)}`, { body: opts });
  }

  groupDMRemoveRecipient(channelId: Snowflake, userId: Snowflake) {
    return this.req<void>('DELETE', `/channels/${seg(channelId)}/recipients/${seg(userId)}`);
  }

  /** Set (or clear with null) a voice channel's status text (≤ 500 chars). */
  setVoiceChannelStatus(channelId: Snowflake, status: string | null, options?: RequestOptions) {
    return this.req<void>('PUT', `/channels/${seg(channelId)}/voice-status`, { body: { status }, options });
  }

  triggerTyping(channelId: Snowflake) {
    return this.req<void>('POST', `/channels/${seg(channelId)}/typing`);
  }

  // ── Messages ────────────────────────────────────────────
  /** Pass a number for the old `limit`-only form. */
  getMessages(channelId: Snowflake, query?: number | GetMessagesQuery) {
    return this.req<APIMessage[]>('GET', `/channels/${seg(channelId)}/messages`, { query: limitQuery(query) });
  }

  getMessage(channelId: Snowflake, messageId: Snowflake) {
    return this.req<APIMessage>('GET', `/channels/${seg(channelId)}/messages/${seg(messageId)}`);
  }

  /**
   * Send a message. `files` are uploaded as multipart (`payload_json` +
   * `files[n]`); reference them from embeds / components v2 as
   * `attachment://<name>`. Set `flags: MessageFlags.IsComponentsV2` for a
   * components v2 layout (no `content` / `embeds`).
   */
  createMessage(channelId: Snowflake, opts: CreateMessageOptions | string) {
    const { body, files } = splitFiles(typeof opts === 'string' ? { content: opts } : opts);
    return this.req<APIMessage>('POST', `/channels/${seg(channelId)}/messages`, { body, files });
  }

  /** Reply to a message (sets message_reference). */
  reply(channelId: Snowflake, messageId: Snowflake, opts: CreateMessageOptions | string, failIfNotExists = false) {
    const base = typeof opts === 'string' ? { content: opts } : opts;
    return this.createMessage(channelId, {
      ...base,
      message_reference: { type: 0, message_id: messageId, channel_id: channelId, fail_if_not_exists: failIfNotExists },
    });
  }

  /** Forward a message into another channel (message_reference type 1). */
  forwardMessage(targetChannelId: Snowflake, sourceChannelId: Snowflake, messageId: Snowflake, guildId?: Snowflake) {
    return this.createMessage(targetChannelId, {
      message_reference: { type: 1, message_id: messageId, channel_id: sourceChannelId, ...(guildId ? { guild_id: guildId } : {}) },
    });
  }

  editMessage(channelId: Snowflake, messageId: Snowflake, opts: EditMessageOptions | string) {
    const { body, files } = splitFiles(typeof opts === 'string' ? { content: opts } : opts);
    return this.req<APIMessage>('PATCH', `/channels/${seg(channelId)}/messages/${seg(messageId)}`, { body, files });
  }

  deleteMessage(channelId: Snowflake, messageId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/channels/${seg(channelId)}/messages/${seg(messageId)}`, { options });
  }

  /** Delete 2-100 messages (not older than 14 days). */
  bulkDeleteMessages(channelId: Snowflake, messageIds: Snowflake[], options?: RequestOptions) {
    return this.req<void>('POST', `/channels/${seg(channelId)}/messages/bulk-delete`, { body: { messages: messageIds }, options });
  }

  crosspostMessage(channelId: Snowflake, messageId: Snowflake) {
    return this.req<APIMessage>('POST', `/channels/${seg(channelId)}/messages/${seg(messageId)}/crosspost`);
  }

  // ── Polls ───────────────────────────────────────────────
  getPollAnswerVoters(channelId: Snowflake, messageId: Snowflake, answerId: number, query?: { after?: Snowflake; limit?: number }) {
    return this.req<{ users: APIUser[] }>('GET', `/channels/${seg(channelId)}/polls/${seg(messageId)}/answers/${answerId}`, { query });
  }

  /** End a poll now. Resolves the updated message. */
  endPoll(channelId: Snowflake, messageId: Snowflake) {
    return this.req<APIMessage>('POST', `/channels/${seg(channelId)}/polls/${seg(messageId)}/expire`);
  }

  // ── Pins ────────────────────────────────────────────────
  /** Paginated pins, newest first: `{ items: [{ pinned_at, message }], has_more }`. */
  getChannelPins(channelId: Snowflake, query?: GetPinsQuery) {
    return this.req<APIChannelPins>('GET', `/channels/${seg(channelId)}/messages/pins`, { query });
  }

  /** @deprecated Discord's legacy pins route (array, max 50). Use getChannelPins(). */
  getPinnedMessages(channelId: Snowflake) {
    return this.req<APIMessage[]>('GET', `/channels/${seg(channelId)}/pins`);
  }

  pinMessage(channelId: Snowflake, messageId: Snowflake, options?: RequestOptions) {
    return this.req<void>('PUT', `/channels/${seg(channelId)}/messages/pins/${seg(messageId)}`, { options });
  }

  unpinMessage(channelId: Snowflake, messageId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/channels/${seg(channelId)}/messages/pins/${seg(messageId)}`, { options });
  }

  // ── Reactions ───────────────────────────────────────────
  private reactionPath(channelId: Snowflake, messageId: Snowflake, emoji?: EmojiResolvable) {
    const base = `/channels/${seg(channelId)}/messages/${seg(messageId)}/reactions`;
    return emoji === undefined ? base : `${base}/${encodeEmoji(emoji)}`;
  }

  /** Emoji: unicode (`'👍'`), `'name:id'`, `'<:name:id>'` or `{ id, name }`. */
  addReaction(channelId: Snowflake, messageId: Snowflake, emoji: EmojiResolvable) {
    return this.req<void>('PUT', `${this.reactionPath(channelId, messageId, emoji)}/@me`);
  }

  removeOwnReaction(channelId: Snowflake, messageId: Snowflake, emoji: EmojiResolvable) {
    return this.req<void>('DELETE', `${this.reactionPath(channelId, messageId, emoji)}/@me`);
  }

  removeUserReaction(channelId: Snowflake, messageId: Snowflake, emoji: EmojiResolvable, userId: Snowflake) {
    return this.req<void>('DELETE', `${this.reactionPath(channelId, messageId, emoji)}/${seg(userId)}`);
  }

  /** Pass a number for the old `limit`-only form. */
  getReactions(channelId: Snowflake, messageId: Snowflake, emoji: EmojiResolvable, query?: number | GetReactionsQuery) {
    return this.req<APIUser[]>('GET', this.reactionPath(channelId, messageId, emoji), { query: limitQuery(query) });
  }

  removeAllReactions(channelId: Snowflake, messageId: Snowflake) {
    return this.req<void>('DELETE', this.reactionPath(channelId, messageId));
  }

  removeAllReactionsForEmoji(channelId: Snowflake, messageId: Snowflake, emoji: EmojiResolvable) {
    return this.req<void>('DELETE', this.reactionPath(channelId, messageId, emoji));
  }

  // ── Threads & forums ────────────────────────────────────
  startThreadFromMessage(channelId: Snowflake, messageId: Snowflake, opts: StartThreadOptions, options?: RequestOptions) {
    return this.req<APIChannel>('POST', `/channels/${seg(channelId)}/messages/${seg(messageId)}/threads`, { body: opts, options });
  }

  startThreadWithoutMessage(channelId: Snowflake, opts: StartThreadWithoutMessageOptions, options?: RequestOptions) {
    return this.req<APIChannel>('POST', `/channels/${seg(channelId)}/threads`, { body: opts, options });
  }

  /** Forum / media channels: create a post. Resolves the thread with its first `message`. */
  startForumThread(channelId: Snowflake, opts: StartForumThreadOptions, options?: RequestOptions) {
    const { body, files } = splitFiles(opts);
    return this.req<APIChannel & { message?: APIMessage }>('POST', `/channels/${seg(channelId)}/threads`, { body, files, options });
  }

  joinThread(threadId: Snowflake) {
    return this.req<void>('PUT', `/channels/${seg(threadId)}/thread-members/@me`);
  }

  leaveThread(threadId: Snowflake) {
    return this.req<void>('DELETE', `/channels/${seg(threadId)}/thread-members/@me`);
  }

  addThreadMember(threadId: Snowflake, userId: Snowflake) {
    return this.req<void>('PUT', `/channels/${seg(threadId)}/thread-members/${seg(userId)}`);
  }

  removeThreadMember(threadId: Snowflake, userId: Snowflake) {
    return this.req<void>('DELETE', `/channels/${seg(threadId)}/thread-members/${seg(userId)}`);
  }

  getThreadMember(threadId: Snowflake, userId: Snowflake, query?: { with_member?: boolean }) {
    return this.req<APIThreadMember>('GET', `/channels/${seg(threadId)}/thread-members/${seg(userId)}`, { query });
  }

  getThreadMembers(threadId: Snowflake, query?: ThreadMembersQuery) {
    return this.req<APIThreadMember[]>('GET', `/channels/${seg(threadId)}/thread-members`, { query });
  }

  getPublicArchivedThreads(channelId: Snowflake, query?: ArchivedThreadsQuery) {
    return this.req<APIThreadList>('GET', `/channels/${seg(channelId)}/threads/archived/public`, { query });
  }

  getPrivateArchivedThreads(channelId: Snowflake, query?: ArchivedThreadsQuery) {
    return this.req<APIThreadList>('GET', `/channels/${seg(channelId)}/threads/archived/private`, { query });
  }

  getJoinedPrivateArchivedThreads(channelId: Snowflake, query?: ArchivedThreadsQuery) {
    return this.req<APIThreadList>('GET', `/channels/${seg(channelId)}/users/@me/threads/archived/private`, { query });
  }

  /** Search forum posts / threads in a channel. */
  searchThreads(channelId: Snowflake, query?: Record<string, string | number | boolean | undefined>) {
    return this.req<APIThreadList & { total_results?: number; first_messages?: APIMessage[] }>('GET', `/channels/${seg(channelId)}/threads/search`, { query });
  }

  // ── Webhooks ────────────────────────────────────────────
  getGuildWebhooks(guildId: Snowflake) {
    return this.req<APIWebhook[]>('GET', `/guilds/${seg(guildId)}/webhooks`);
  }

  getChannelWebhooks(channelId: Snowflake) {
    return this.req<APIWebhook[]>('GET', `/channels/${seg(channelId)}/webhooks`);
  }

  createWebhook(channelId: Snowflake, opts: CreateWebhookOptions, options?: RequestOptions) {
    return this.req<APIWebhook>('POST', `/channels/${seg(channelId)}/webhooks`, { body: opts, options });
  }

  getWebhook(webhookId: Snowflake) {
    return this.req<APIWebhook>('GET', `/webhooks/${seg(webhookId)}`);
  }

  modifyWebhook(webhookId: Snowflake, opts: ModifyWebhookOptions, options?: RequestOptions) {
    return this.req<APIWebhook>('PATCH', `/webhooks/${seg(webhookId)}`, { body: opts, options });
  }

  deleteWebhook(webhookId: Snowflake, options?: RequestOptions) {
    return this.req<void>('DELETE', `/webhooks/${seg(webhookId)}`, { options });
  }

  getWebhookWithToken(webhookId: Snowflake, token: string) {
    return this.req<APIWebhook>('GET', `/webhooks/${seg(webhookId)}/${seg(token)}`, { auth: false });
  }

  modifyWebhookWithToken(webhookId: Snowflake, token: string, opts: Omit<ModifyWebhookOptions, 'channel_id'>) {
    return this.req<APIWebhook>('PATCH', `/webhooks/${seg(webhookId)}/${seg(token)}`, { body: opts, auth: false });
  }

  deleteWebhookWithToken(webhookId: Snowflake, token: string) {
    return this.req<void>('DELETE', `/webhooks/${seg(webhookId)}/${seg(token)}`, { auth: false });
  }

  /** Execute a webhook. Resolves the message with `{ wait: true }`, else undefined. */
  executeWebhook(webhookId: Snowflake, token: string, opts: ExecuteWebhookOptions | string, query?: ExecuteWebhookQuery) {
    const { body, files } = splitFiles(typeof opts === 'string' ? { content: opts } : opts);
    return this.req<APIMessage | undefined>('POST', `/webhooks/${seg(webhookId)}/${seg(token)}`, { body, files, query, auth: false });
  }

  getWebhookMessage(webhookId: Snowflake, token: string, messageId: Snowflake | '@original', query?: { thread_id?: Snowflake }) {
    return this.req<APIMessage>('GET', `/webhooks/${seg(webhookId)}/${seg(token)}/messages/${messageId === '@original' ? messageId : seg(messageId)}`, { query, auth: false });
  }

  editWebhookMessage(webhookId: Snowflake, token: string, messageId: Snowflake | '@original', opts: EditMessageOptions | string, query?: { thread_id?: Snowflake; with_components?: boolean }) {
    const { body, files } = splitFiles(typeof opts === 'string' ? { content: opts } : opts);
    return this.req<APIMessage>('PATCH', `/webhooks/${seg(webhookId)}/${seg(token)}/messages/${messageId === '@original' ? messageId : seg(messageId)}`, { body, files, query, auth: false });
  }

  deleteWebhookMessage(webhookId: Snowflake, token: string, messageId: Snowflake | '@original', query?: { thread_id?: Snowflake }) {
    return this.req<void>('DELETE', `/webhooks/${seg(webhookId)}/${seg(token)}/messages/${messageId === '@original' ? messageId : seg(messageId)}`, { query, auth: false });
  }

  // ── Application commands (global) ───────────────────────
  getGlobalCommands(appId: Snowflake, query?: { with_localizations?: boolean }) {
    return this.req<APIApplicationCommand[]>('GET', `/applications/${seg(appId)}/commands`, { query });
  }

  getGlobalCommand(appId: Snowflake, commandId: Snowflake) {
    return this.req<APIApplicationCommand>('GET', `/applications/${seg(appId)}/commands/${seg(commandId)}`);
  }

  createGlobalCommand(appId: Snowflake, opts: CreateCommandOptions) {
    return this.req<APIApplicationCommand>('POST', `/applications/${seg(appId)}/commands`, { body: opts });
  }

  modifyGlobalCommand(appId: Snowflake, commandId: Snowflake, opts: ModifyCommandOptions) {
    return this.req<APIApplicationCommand>('PATCH', `/applications/${seg(appId)}/commands/${seg(commandId)}`, { body: opts });
  }

  deleteGlobalCommand(appId: Snowflake, commandId: Snowflake) {
    return this.req<void>('DELETE', `/applications/${seg(appId)}/commands/${seg(commandId)}`);
  }

  /** Replace every global command (commands not listed are deleted). */
  bulkOverwriteGlobalCommands(appId: Snowflake, commands: CreateCommandOptions[]) {
    return this.req<APIApplicationCommand[]>('PUT', `/applications/${seg(appId)}/commands`, { body: commands });
  }

  // ── Application commands (guild) ────────────────────────
  getGuildCommands(appId: Snowflake, guildId: Snowflake, query?: { with_localizations?: boolean }) {
    return this.req<APIApplicationCommand[]>('GET', `/applications/${seg(appId)}/guilds/${seg(guildId)}/commands`, { query });
  }

  getGuildCommand(appId: Snowflake, guildId: Snowflake, commandId: Snowflake) {
    return this.req<APIApplicationCommand>('GET', `/applications/${seg(appId)}/guilds/${seg(guildId)}/commands/${seg(commandId)}`);
  }

  createGuildCommand(appId: Snowflake, guildId: Snowflake, opts: CreateCommandOptions) {
    return this.req<APIApplicationCommand>('POST', `/applications/${seg(appId)}/guilds/${seg(guildId)}/commands`, { body: opts });
  }

  modifyGuildCommand(appId: Snowflake, guildId: Snowflake, commandId: Snowflake, opts: ModifyCommandOptions) {
    return this.req<APIApplicationCommand>('PATCH', `/applications/${seg(appId)}/guilds/${seg(guildId)}/commands/${seg(commandId)}`, { body: opts });
  }

  deleteGuildCommand(appId: Snowflake, guildId: Snowflake, commandId: Snowflake) {
    return this.req<void>('DELETE', `/applications/${seg(appId)}/guilds/${seg(guildId)}/commands/${seg(commandId)}`);
  }

  bulkOverwriteGuildCommands(appId: Snowflake, guildId: Snowflake, commands: CreateCommandOptions[]) {
    return this.req<APIApplicationCommand[]>('PUT', `/applications/${seg(appId)}/guilds/${seg(guildId)}/commands`, { body: commands });
  }

  getGuildCommandPermissions(appId: Snowflake, guildId: Snowflake) {
    return this.req<APIGuildApplicationCommandPermissions[]>('GET', `/applications/${seg(appId)}/guilds/${seg(guildId)}/commands/permissions`);
  }

  getCommandPermissions(appId: Snowflake, guildId: Snowflake, commandId: Snowflake) {
    return this.req<APIGuildApplicationCommandPermissions>('GET', `/applications/${seg(appId)}/guilds/${seg(guildId)}/commands/${seg(commandId)}/permissions`);
  }

  /** Requires an OAuth2 Bearer token with applications.commands.permissions.update (like Discord). */
  editCommandPermissions(appId: Snowflake, guildId: Snowflake, commandId: Snowflake, permissions: APIApplicationCommandPermission[]) {
    return this.req<APIGuildApplicationCommandPermissions>('PUT', `/applications/${seg(appId)}/guilds/${seg(guildId)}/commands/${seg(commandId)}/permissions`, { body: { permissions } });
  }

  // ── Interactions (low level; see InteractionsAPI for helpers) ─
  /**
   * POST /interactions/{id}/{token}/callback. Must be called within 3 s of
   * receiving the interaction. With `withResponse` the server returns an
   * InteractionCallbackResponse (resource.message is the created message).
   */
  createInteractionResponse(interactionId: Snowflake, interactionToken: string, body: APIInteractionResponse | Body, opts: { withResponse?: boolean; files?: RawFile[] } = {}) {
    return this.req<APIInteractionCallbackResponse | undefined>('POST', `/interactions/${seg(interactionId)}/${seg(interactionToken)}/callback`, {
      body,
      files: opts.files,
      query: opts.withResponse ? { with_response: true } : undefined,
      auth: false,
    });
  }

  getOriginalInteractionResponse(applicationId: Snowflake, interactionToken: string) {
    return this.getWebhookMessage(applicationId, interactionToken, '@original');
  }

  editOriginalInteractionResponse(applicationId: Snowflake, interactionToken: string, opts: EditMessageOptions | string) {
    return this.editWebhookMessage(applicationId, interactionToken, '@original', opts);
  }

  deleteOriginalInteractionResponse(applicationId: Snowflake, interactionToken: string) {
    return this.deleteWebhookMessage(applicationId, interactionToken, '@original');
  }

  /** Send a follow-up message (valid for 15 minutes after the interaction). */
  createInteractionFollowup(applicationId: Snowflake, interactionToken: string, body: APIInteractionResponseCallbackData & { files?: RawFile[] } | Body) {
    const { files, ...rest } = body as { files?: RawFile[] };
    return this.req<APIMessage>('POST', `/webhooks/${seg(applicationId)}/${seg(interactionToken)}`, { body: rest, files, auth: false });
  }

  getFollowupMessage(applicationId: Snowflake, interactionToken: string, messageId: Snowflake) {
    return this.getWebhookMessage(applicationId, interactionToken, messageId);
  }

  editFollowupMessage(applicationId: Snowflake, interactionToken: string, messageId: Snowflake, opts: EditMessageOptions | string) {
    return this.editWebhookMessage(applicationId, interactionToken, messageId, opts);
  }

  deleteFollowupMessage(applicationId: Snowflake, interactionToken: string, messageId: Snowflake) {
    return this.deleteWebhookMessage(applicationId, interactionToken, messageId);
  }

  // ── Monetization (always empty on SerikaCord; Discord parity) ─
  getSKUs(appId: Snowflake) {
    return this.req<APISKU[]>('GET', `/applications/${seg(appId)}/skus`);
  }

  getEntitlements(appId: Snowflake, query?: Record<string, string | number | boolean | undefined>) {
    return this.req<APIEntitlement[]>('GET', `/applications/${seg(appId)}/entitlements`, { query });
  }
}
