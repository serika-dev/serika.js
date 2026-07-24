import { HTTPClient } from '../http.js';
import type {
  SerikaUser, SerikaServer, SerikaGuild, SerikaNotification, SerikaMention,
  SerikaEmoji, SerikaSticker, SerikaApplication, SerikaTeam, ModifyUserOptions,
} from '../types.js';

const API = '/api';

// ─── SerikaCord Client API ──────────────────────────────────
// Covers the non-bot endpoints: users, friends, notifications,
// platform, uploads, experiments, developers, oembed, etc.

export class ClientAPI {
  constructor(private http: HTTPClient) {}

  // ── Health & Platform ───────────────────────────────────
  health() {
    return this.http.get<{ status: string; service: string; timestamp: string }>(`${API}/health`);
  }

  getPlatformAnnouncement() {
    return this.http.get<{ announcement: string | null; updatedAt: string | null; maintenanceMode: boolean }>(`${API}/platform/announcement`);
  }

  getFileTypes() {
    return this.http.get<{ fileTypes: string[] }>(`${API}/platform/file-types`);
  }

  getFileTypesAccept() {
    return this.http.get<{ accept: string }>(`${API}/platform/file-types-accept`);
  }

  getTtsSounds() {
    return this.http.get<{ sounds: { triggerWord: string; path: string }[] }>(`${API}/tts-sounds`);
  }

  getTtsVoices() {
    return this.http.get<{ voices: { id: string; name: string; provider: string; referenceId: string; description: string; isDefault: boolean }[] }>(`${API}/tts-voices`);
  }

  // ── Users ───────────────────────────────────────────────
  getCurrentUser() {
    return this.http.get<SerikaUser>(`${API}/users/@me`);
  }

  getCurrentUserServers() {
    return this.http.get<SerikaServer[]>(`${API}/users/@me/servers`);
  }

  getCurrentUserGuilds() {
    return this.http.get<SerikaGuild[]>(`${API}/users/@me/guilds`);
  }

  getMentions(serverId?: string) {
    return this.http.get<{ servers: { id: string }[]; mentions: SerikaMention[] }>(`${API}/users/@me/mentions`, serverId ? { serverId } : undefined);
  }

  getEmojis() {
    return this.http.get<{ emojis: SerikaEmoji[] }>(`${API}/users/@me/emojis`);
  }

  getStickers() {
    return this.http.get<{ stickers: SerikaSticker[] }>(`${API}/users/@me/stickers`);
  }

  updateCurrentUser(opts: ModifyUserOptions) {
    return this.http.put<{ success: boolean; user: SerikaUser }>(`${API}/users/me`, opts);
  }

  // ── Notifications ───────────────────────────────────────
  getNotifications() {
    return this.http.get<{ notifications: SerikaNotification[] }>(`${API}/notifications/`);
  }

  markNotificationsRead() {
    return this.http.post<{ success: boolean }>(`${API}/notifications/read-all`);
  }

  // ── Friends ─────────────────────────────────────────────
  sendFriendRequest(username: string) {
    return this.http.post<{ success: boolean; message: string }>(`${API}/friends/request`, { username });
  }

  acceptFriendRequest(userId: string) {
    return this.http.post<{ success: boolean; message: string }>(`${API}/friends/accept/${userId}`);
  }

  cancelFriendRequest(userId: string) {
    return this.http.delete<{ success: boolean; message: string }>(`${API}/friends/cancel/${userId}`);
  }

  declineFriendRequest(userId: string) {
    return this.http.delete<{ success: boolean; message: string }>(`${API}/friends/decline/${userId}`);
  }

  blockUser(userId: string) {
    return this.http.post<{ success: boolean; message: string }>(`${API}/friends/block/${userId}`);
  }

  unblockUser(userId: string) {
    return this.http.delete<{ success: boolean; message: string }>(`${API}/friends/unblock/${userId}`);
  }

  removeFriend(userId: string) {
    return this.http.delete<{ success: boolean; message: string }>(`${API}/friends/${userId}`);
  }

  // ── Auth ────────────────────────────────────────────────
  register(email: string, username: string, password: string, displayName?: string) {
    return this.http.post<{ success: boolean; message: string; user?: unknown }>(`${API}/auth/register`, { email, username, password, displayName });
  }

  login(email: string, password: string) {
    return this.http.post<unknown>(`${API}/auth/login`, { email, password });
  }

  logout() {
    return this.http.post<{ success: boolean }>(`${API}/auth/logout`);
  }

  // ── Uploads ─────────────────────────────────────────────
  uploadAvatar(file: Blob | File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.request<{ url: string }>({
      method: 'POST',
      path: `${API}/upload/avatar`,
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  uploadBanner(file: Blob | File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.request<{ url: string }>({
      method: 'POST',
      path: `${API}/upload/banner`,
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  // ── Experiments ─────────────────────────────────────────
  getExperimentVariant(experimentKey: string) {
    return this.http.get<{ experimentKey: string; variant: string | null; inExperiment: boolean }>(`${API}/experiments/variant/${experimentKey}`);
  }

  getActiveExperiments() {
    return this.http.get<{ experiments: { key: string; name: string; type: string; variant: string | null; inExperiment: boolean }[] }>(`${API}/experiments/active`);
  }

  // ── Developers ──────────────────────────────────────────
  getApplications() {
    return this.http.get<{ applications: SerikaApplication[] }>(`${API}/developers/applications`);
  }

  getApplication(appId: string) {
    return this.http.get<{ application: SerikaApplication }>(`${API}/developers/applications/${appId}`);
  }

  createApplication(name: string) {
    return this.http.post<{ application: SerikaApplication }>(`${API}/developers/applications`, { name });
  }

  updateApplication(appId: string, updates: Partial<SerikaApplication>) {
    return this.http.patch<{ application: SerikaApplication }>(`${API}/developers/applications/${appId}`, updates);
  }

  deleteApplication(appId: string) {
    return this.http.delete<{ success: boolean }>(`${API}/developers/applications/${appId}`);
  }

  getTeams() {
    return this.http.get<{ teams: SerikaTeam[] }>(`${API}/developers/teams`);
  }

  // ── IGDB ────────────────────────────────────────────────
  lookupGame(name: string) {
    return this.http.get<{ game: unknown }>(`${API}/igdb/game`, { name });
  }

  // ── GIFs ────────────────────────────────────────────────
  searchGifs(query: string, limit?: number) {
    return this.http.get<{ gifs: { id: string; title: string; url: string; previewUrl: string; source: string; tags: string[] }[] }>(`${API}/gifs/search`, { q: query, limit });
  }

  getTrendingGifs(limit?: number) {
    return this.http.get<{ gifs: { id: string; title: string; url: string; previewUrl: string; source: string; tags: string[] }[] }>(`${API}/gifs/trending`, { limit });
  }

  // ── OEmbed ──────────────────────────────────────────────
  getOEmbed(url: string) {
    return this.http.get<{ title?: string; description?: string; thumbnail?: string; siteName?: string; url?: string; type?: string }>(`${API}/oembed`, { url });
  }

  // ── Webhooks (public execute) ───────────────────────────
  executeWebhook(channelId: string, token: string, opts: { content?: string; username?: string; avatar_url?: string }) {
    return this.http.post<{ id: string; channel_id: string; content: string; webhook_id: string }>(`${API}/webhooks/${channelId}/${token}`, opts);
  }
}
