import { HTTPClient } from '../http.js';
import type {
  APIUser, APIGuild, APIGuildPreview, APIChannel, APIRole, APIGuildMember,
  APIEmoji, APISticker, APIBan, APIInvite, APIWebhook, APIMessage,
  APIAuditLog, APIApplicationCommand, APIVoiceRegion, GatewayInfo, GatewayBotInfo,
  CreateMessageOptions, CreateChannelOptions, CreateRoleOptions, CreateWebhookOptions,
  CreateEmojiOptions, CreateDMOptions, ModifyGuildOptions, ModifyChannelOptions,
  ModifyMemberOptions, BanOptions, CreateCommandOptions, ModifyCommandOptions,
} from '../types.js';

const V10 = '/api/v10';

// ─── Bot API v10 — Discord-compatible REST endpoints ────────

export class BotAPI {
  constructor(private http: HTTPClient) {}

  // ── API Root ────────────────────────────────────────────
  getAPIInfo() {
    return this.http.get<{ message: string; version: number; documentation: string; endpoints: Record<string, string> }>(`${V10}/`);
  }

  // ── Gateway ─────────────────────────────────────────────
  getGateway() {
    return this.http.get<GatewayInfo>(`${V10}/gateway`);
  }

  getGatewayBot() {
    return this.http.get<GatewayBotInfo>(`${V10}/gateway/bot`);
  }

  // ── Users ───────────────────────────────────────────────
  getCurrentUser() {
    return this.http.get<APIUser>(`${V10}/users/@me`);
  }

  getUser(userId: string) {
    return this.http.get<APIUser>(`${V10}/users/${userId}`);
  }

  // ── User DMs ────────────────────────────────────────────
  getDMChannels() {
    return this.http.get<APIChannel[]>(`${V10}/users/@me/channels`);
  }

  createDM(opts: CreateDMOptions) {
    return this.http.post<APIChannel>(`${V10}/users/@me/channels`, opts);
  }

  // ── Leave Guild ─────────────────────────────────────────
  leaveGuild(guildId: string) {
    return this.http.delete<void>(`${V10}/users/@me/guilds/${guildId}`);
  }

  // ── Guilds ──────────────────────────────────────────────
  getGuild(guildId: string) {
    return this.http.get<APIGuild>(`${V10}/guilds/${guildId}`);
  }

  modifyGuild(guildId: string, opts: ModifyGuildOptions) {
    return this.http.patch<APIGuild>(`${V10}/guilds/${guildId}`, opts);
  }

  getGuildPreview(guildId: string) {
    return this.http.get<APIGuildPreview>(`${V10}/guilds/${guildId}/preview`);
  }

  getGuildChannels(guildId: string) {
    return this.http.get<APIChannel[]>(`${V10}/guilds/${guildId}/channels`);
  }

  createGuildChannel(guildId: string, opts: CreateChannelOptions) {
    return this.http.post<APIChannel>(`${V10}/guilds/${guildId}/channels`, opts);
  }

  modifyGuildChannel(guildId: string, channelId: string, opts: ModifyChannelOptions) {
    return this.http.patch<APIChannel>(`${V10}/guilds/${guildId}/channels/${channelId}`, opts);
  }

  deleteGuildChannel(guildId: string, channelId: string) {
    return this.http.delete<void>(`${V10}/guilds/${guildId}/channels/${channelId}`);
  }

  getGuildRoles(guildId: string) {
    return this.http.get<APIRole[]>(`${V10}/guilds/${guildId}/roles`);
  }

  createGuildRole(guildId: string, opts: CreateRoleOptions) {
    return this.http.post<APIRole>(`${V10}/guilds/${guildId}/roles`, opts);
  }

  modifyGuildRole(guildId: string, roleId: string, opts: Partial<CreateRoleOptions> & { position?: number }) {
    return this.http.patch<APIRole>(`${V10}/guilds/${guildId}/roles/${roleId}`, opts);
  }

  deleteGuildRole(guildId: string, roleId: string) {
    return this.http.delete<void>(`${V10}/guilds/${guildId}/roles/${roleId}`);
  }

  getGuildMembers(guildId: string, limit?: number) {
    return this.http.get<APIGuildMember[]>(`${V10}/guilds/${guildId}/members`, limit ? { limit } : undefined);
  }

  getGuildMember(guildId: string, userId: string) {
    return this.http.get<APIGuildMember>(`${V10}/guilds/${guildId}/members/${userId}`);
  }

  modifyGuildMember(guildId: string, userId: string, opts: ModifyMemberOptions) {
    return this.http.patch<APIGuildMember>(`${V10}/guilds/${guildId}/members/${userId}`, opts);
  }

  modifyCurrentUserNick(guildId: string, nick: string) {
    return this.http.patch<string>(`${V10}/guilds/${guildId}/members/@me/nick`, { nick });
  }

  removeGuildMember(guildId: string, userId: string) {
    return this.http.delete<void>(`${V10}/guilds/${guildId}/members/${userId}`);
  }

  // ── Guild Bans ──────────────────────────────────────────
  getGuildBans(guildId: string) {
    return this.http.get<APIBan[]>(`${V10}/guilds/${guildId}/bans`);
  }

  getGuildBan(guildId: string, userId: string) {
    return this.http.get<APIBan>(`${V10}/guilds/${guildId}/bans/${userId}`);
  }

  createGuildBan(guildId: string, userId: string, opts?: BanOptions) {
    return this.http.put<void>(`${V10}/guilds/${guildId}/bans/${userId}`, opts);
  }

  removeGuildBan(guildId: string, userId: string) {
    return this.http.delete<void>(`${V10}/guilds/${guildId}/bans/${userId}`);
  }

  // ── Guild Emojis ────────────────────────────────────────
  getGuildEmojis(guildId: string) {
    return this.http.get<APIEmoji[]>(`${V10}/guilds/${guildId}/emojis`);
  }

  getGuildEmoji(guildId: string, emojiId: string) {
    return this.http.get<APIEmoji>(`${V10}/guilds/${guildId}/emojis/${emojiId}`);
  }

  createGuildEmoji(guildId: string, opts: CreateEmojiOptions) {
    return this.http.post<APIEmoji>(`${V10}/guilds/${guildId}/emojis`, opts);
  }

  modifyGuildEmoji(guildId: string, emojiId: string, opts: { name?: string; roles?: string[] }) {
    return this.http.patch<APIEmoji>(`${V10}/guilds/${guildId}/emojis/${emojiId}`, opts);
  }

  deleteGuildEmoji(guildId: string, emojiId: string) {
    return this.http.delete<void>(`${V10}/guilds/${guildId}/emojis/${emojiId}`);
  }

  // ── Guild Stickers ──────────────────────────────────────
  getGuildStickers(guildId: string) {
    return this.http.get<APISticker[]>(`${V10}/guilds/${guildId}/stickers`);
  }

  getGuildSticker(guildId: string, stickerId: string) {
    return this.http.get<APISticker>(`${V10}/guilds/${guildId}/stickers/${stickerId}`);
  }

  // ── Guild Invites ───────────────────────────────────────
  getGuildInvites(guildId: string) {
    return this.http.get<APIInvite[]>(`${V10}/guilds/${guildId}/invites`);
  }

  // ── Guild Webhooks ──────────────────────────────────────
  getGuildWebhooks(guildId: string) {
    return this.http.get<APIWebhook[]>(`${V10}/guilds/${guildId}/webhooks`);
  }

  // ── Guild Audit Log ─────────────────────────────────────
  getGuildAuditLog(guildId: string, limit?: number) {
    return this.http.get<APIAuditLog>(`${V10}/guilds/${guildId}/audit-logs`, limit ? { limit } : undefined);
  }

  // ── Channels ────────────────────────────────────────────
  getChannel(channelId: string) {
    return this.http.get<APIChannel>(`${V10}/channels/${channelId}`);
  }

  modifyChannel(channelId: string, opts: ModifyChannelOptions) {
    return this.http.patch<APIChannel>(`${V10}/channels/${channelId}`, opts);
  }

  deleteChannel(channelId: string) {
    return this.http.delete<void>(`${V10}/channels/${channelId}`);
  }

  // ── Messages ────────────────────────────────────────────
  getMessages(channelId: string, limit?: number) {
    return this.http.get<APIMessage[]>(`${V10}/channels/${channelId}/messages`, limit ? { limit } : undefined);
  }

  getMessage(channelId: string, messageId: string) {
    return this.http.get<APIMessage>(`${V10}/channels/${channelId}/messages/${messageId}`);
  }

  createMessage(channelId: string, opts: CreateMessageOptions) {
    return this.http.post<APIMessage>(`${V10}/channels/${channelId}/messages`, opts);
  }

  editMessage(channelId: string, messageId: string, opts: { content?: string; embeds?: unknown[] }) {
    return this.http.patch<APIMessage>(`${V10}/channels/${channelId}/messages/${messageId}`, opts);
  }

  deleteMessage(channelId: string, messageId: string) {
    return this.http.delete<void>(`${V10}/channels/${channelId}/messages/${messageId}`);
  }

  bulkDeleteMessages(channelId: string, messageIds: string[]) {
    return this.http.post<{ deleted_messages: string[] }>(`${V10}/channels/${channelId}/messages/bulk-delete`, { messages: messageIds });
  }

  // ── Pins ────────────────────────────────────────────────
  getPinnedMessages(channelId: string) {
    return this.http.get<APIMessage[]>(`${V10}/channels/${channelId}/pins`);
  }

  pinMessage(channelId: string, messageId: string) {
    return this.http.put<void>(`${V10}/channels/${channelId}/pins/${messageId}`);
  }

  unpinMessage(channelId: string, messageId: string) {
    return this.http.delete<void>(`${V10}/channels/${channelId}/pins/${messageId}`);
  }

  // ── Reactions ───────────────────────────────────────────
  addReaction(channelId: string, messageId: string, emoji: string) {
    return this.http.put<void>(`${V10}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`);
  }

  removeOwnReaction(channelId: string, messageId: string, emoji: string) {
    return this.http.delete<void>(`${V10}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`);
  }

  removeUserReaction(channelId: string, messageId: string, emoji: string, userId: string) {
    return this.http.delete<void>(`${V10}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/${userId}`);
  }

  getReactions(channelId: string, messageId: string, emoji: string, limit?: number) {
    return this.http.get<APIUser[]>(`${V10}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, limit ? { limit } : undefined);
  }

  removeAllReactions(channelId: string, messageId: string) {
    return this.http.delete<void>(`${V10}/channels/${channelId}/messages/${messageId}/reactions`);
  }

  // ── Typing ──────────────────────────────────────────────
  triggerTyping(channelId: string) {
    return this.http.post<void>(`${V10}/channels/${channelId}/typing`);
  }

  // ── Channel Webhooks ────────────────────────────────────
  getChannelWebhooks(channelId: string) {
    return this.http.get<APIWebhook[]>(`${V10}/channels/${channelId}/webhooks`);
  }

  createWebhook(channelId: string, opts: CreateWebhookOptions) {
    return this.http.post<APIWebhook>(`${V10}/channels/${channelId}/webhooks`, opts);
  }

  getWebhook(webhookId: string) {
    return this.http.get<APIWebhook>(`${V10}/webhooks/${webhookId}`);
  }

  deleteWebhook(webhookId: string) {
    return this.http.delete<void>(`${V10}/webhooks/${webhookId}`);
  }

  // ── Invites ─────────────────────────────────────────────
  getInvite(code: string) {
    return this.http.get<APIInvite>(`${V10}/invites/${code}`);
  }

  deleteInvite(code: string) {
    return this.http.delete<APIInvite>(`${V10}/invites/${code}`);
  }

  // ── Application Commands (Global) ───────────────────────
  getGlobalCommands(appId: string) {
    return this.http.get<APIApplicationCommand[]>(`${V10}/applications/${appId}/commands`);
  }

  getGlobalCommand(appId: string, commandId: string) {
    return this.http.get<APIApplicationCommand>(`${V10}/applications/${appId}/commands/${commandId}`);
  }

  createGlobalCommand(appId: string, opts: CreateCommandOptions) {
    return this.http.post<APIApplicationCommand>(`${V10}/applications/${appId}/commands`, opts);
  }

  modifyGlobalCommand(appId: string, commandId: string, opts: ModifyCommandOptions) {
    return this.http.patch<APIApplicationCommand>(`${V10}/applications/${appId}/commands/${commandId}`, opts);
  }

  deleteGlobalCommand(appId: string, commandId: string) {
    return this.http.delete<void>(`${V10}/applications/${appId}/commands/${commandId}`);
  }

  bulkOverwriteGlobalCommands(appId: string, commands: CreateCommandOptions[]) {
    return this.http.put<APIApplicationCommand[]>(`${V10}/applications/${appId}/commands`, commands);
  }

  // ── Application Commands (Guild) ────────────────────────
  getGuildCommands(appId: string, guildId: string) {
    return this.http.get<APIApplicationCommand[]>(`${V10}/applications/${appId}/guilds/${guildId}/commands`);
  }

  bulkOverwriteGuildCommands(appId: string, guildId: string, commands: CreateCommandOptions[]) {
    return this.http.put<APIApplicationCommand[]>(`${V10}/applications/${appId}/guilds/${guildId}/commands`, commands);
  }

  // ── Interactions ────────────────────────────────────────
  createInteractionResponse(interactionId: string, interactionToken: string, body: unknown) {
    return this.http.post<void>(`${V10}/interactions/${interactionId}/${interactionToken}/callback`, body);
  }

  createInteractionFollowup(applicationId: string, interactionToken: string, body: unknown) {
    return this.http.post<void>(`${V10}/webhooks/${applicationId}/${interactionToken}`, body);
  }

  // ── Voice Regions ───────────────────────────────────────
  getVoiceRegions() {
    return this.http.get<APIVoiceRegion[]>(`${V10}/voice/regions`);
  }
}
