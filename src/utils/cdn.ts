// ─── CDN URLs ───────────────────────────────────────────────
//
// Snowflake-format apps receive Discord-style image hashes; SerikaCord serves
// Discord CDN paths from https://api.serika.chat/cdn-compat (302 to
// cdn.serika.chat). Legacy UUID-format apps receive full image URLs instead.
// Every helper here returns a usable URL for both: a value that is already a
// URL is returned unchanged.

import { isSnowflake } from './snowflake.js';

export const DEFAULT_CDN_URL = 'https://api.serika.chat/cdn-compat';

export type ImageExtension = 'png' | 'jpg' | 'jpeg' | 'webp' | 'gif';
export type ImageSize = 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096;

export interface ImageURLOptions {
  extension?: ImageExtension;
  size?: ImageSize;
  /** Use .gif for animated (a_) hashes (default true). */
  animated?: boolean;
}

const isURL = (v: string) => /^https?:\/\//i.test(v);

export class CDN {
  constructor(readonly base: string = DEFAULT_CDN_URL) {
    this.base = base.replace(/\/+$/, '');
  }

  private make(path: string, hash: string, opts: ImageURLOptions = {}): string {
    const ext = opts.animated !== false && hash.startsWith('a_') ? 'gif' : (opts.extension ?? 'png');
    return `${this.base}${path}.${ext}${opts.size ? `?size=${opts.size}` : ''}`;
  }

  private image(prefix: string, hash: string | null | undefined, opts?: ImageURLOptions): string | null {
    if (!hash) return null;
    if (isURL(hash)) return hash;
    return this.make(`${prefix}/${hash}`, hash, opts);
  }

  avatar(userId: string, hash: string | null | undefined, opts?: ImageURLOptions) {
    return this.image(`/avatars/${userId}`, hash, opts);
  }

  /** Default avatar (index = (id >> 22) % 6 for snowflakes, 0 for UUIDs). */
  defaultAvatar(userId: string): string {
    const index = isSnowflake(userId) ? Number((BigInt(userId) >> 22n) % 6n) : 0;
    return `${this.base}/embed/avatars/${index}.png`;
  }

  /** Avatar if set, else the default avatar. */
  displayAvatar(user: { id: string; avatar?: string | null }, opts?: ImageURLOptions): string {
    return this.avatar(user.id, user.avatar, opts) ?? this.defaultAvatar(user.id);
  }

  userBanner(userId: string, hash: string | null | undefined, opts?: ImageURLOptions) {
    return this.image(`/banners/${userId}`, hash, opts);
  }

  guildIcon(guildId: string, hash: string | null | undefined, opts?: ImageURLOptions) {
    return this.image(`/icons/${guildId}`, hash, opts);
  }

  guildBanner(guildId: string, hash: string | null | undefined, opts?: ImageURLOptions) {
    return this.image(`/banners/${guildId}`, hash, opts);
  }

  guildSplash(guildId: string, hash: string | null | undefined, opts?: ImageURLOptions) {
    return this.image(`/splashes/${guildId}`, hash, opts);
  }

  memberAvatar(guildId: string, userId: string, hash: string | null | undefined, opts?: ImageURLOptions) {
    return this.image(`/guilds/${guildId}/users/${userId}/avatars`, hash, opts);
  }

  roleIcon(roleId: string, hash: string | null | undefined, opts?: ImageURLOptions) {
    return this.image(`/role-icons/${roleId}`, hash, opts);
  }

  appIcon(appId: string, hash: string | null | undefined, opts?: ImageURLOptions) {
    return this.image(`/app-icons/${appId}`, hash, opts);
  }

  guildScheduledEventCover(eventId: string, hash: string | null | undefined, opts?: ImageURLOptions) {
    return this.image(`/guild-events/${eventId}`, hash, opts);
  }

  emoji(emojiId: string, opts: ImageURLOptions & { animated?: boolean } = {}): string {
    const ext = opts.animated ? 'gif' : (opts.extension ?? 'png');
    return `${this.base}/emojis/${emojiId}.${ext}${opts.size ? `?size=${opts.size}` : ''}`;
  }

  sticker(stickerId: string, extension: 'png' | 'gif' | 'json' = 'png'): string {
    return `${this.base}/stickers/${stickerId}.${extension}`;
  }
}
