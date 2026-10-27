// ─── Id helpers: snowflakes and legacy UUIDs ────────────────
//
// SerikaCord applications see one of two id formats, chosen per application
// (`api_id_format` in the Developer Portal → Bot → "Discord-style ids"):
//   - 'snowflake' (default for new apps): Discord-style 64-bit numeric strings
//   - 'uuid' (legacy apps): RFC 4122 UUIDs
// Requests accept both. Treat ids as opaque strings; these helpers make the
// few things that depend on the format (timestamps, ordering, sharding) work
// for both.

/** Discord epoch (2015-01-01T00:00:00Z), which SerikaCord snowflakes use too. */
export const DISCORD_EPOCH = 1420070400000n;

const SNOWFLAKE_RE = /^\d{1,20}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type IdFormat = 'snowflake' | 'uuid';

export function isSnowflake(id: unknown): boolean {
  if (typeof id !== 'string' || !SNOWFLAKE_RE.test(id)) return false;
  return BigInt(id) <= 0xffffffffffffffffn;
}

export function isUuid(id: unknown): boolean {
  return typeof id === 'string' && UUID_RE.test(id);
}

/** The format of an id, or null when it is neither. */
export function idFormat(id: unknown): IdFormat | null {
  if (isSnowflake(id)) return 'snowflake';
  if (isUuid(id)) return 'uuid';
  return null;
}

/** True for a well-formed SerikaCord id in either format. */
export function isValidId(id: unknown): boolean {
  return idFormat(id) !== null;
}

/** Creation time (ms since epoch) of a snowflake, or null for UUIDs / invalid ids. */
export function snowflakeTimestamp(id: string): number | null {
  if (!isSnowflake(id)) return null;
  return Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
}

/** Creation date of a snowflake, or null for UUIDs. */
export function snowflakeDate(id: string): Date | null {
  const t = snowflakeTimestamp(id);
  return t === null ? null : new Date(t);
}

/** Smallest snowflake created at `timestamp` (for before/after pagination by time). */
export function snowflakeFromTimestamp(timestamp: number | Date): string {
  const ms = BigInt(timestamp instanceof Date ? timestamp.getTime() : Math.floor(timestamp));
  const delta = ms - DISCORD_EPOCH;
  return (delta < 0n ? 0n : delta << 22n).toString();
}

/** Same entity? UUIDs compare case-insensitively. */
export function idsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b || (isUuid(a) && isUuid(b) && a.toLowerCase() === b.toLowerCase());
}

/**
 * Sort comparator: snowflakes numerically (= creation order), UUIDs
 * lexicographically (no time order), snowflakes before UUIDs.
 */
export function compareIds(a: string, b: string): number {
  const sa = isSnowflake(a);
  const sb = isSnowflake(b);
  if (sa && sb) {
    const x = BigInt(a);
    const y = BigInt(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (sa !== sb) return sa ? -1 : 1;
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  return la < lb ? -1 : la > lb ? 1 : 0;
}

/**
 * The shard a guild belongs to, exactly as the SerikaCord gateway computes it:
 * `(guild_id >> 22) % num_shards` for snowflakes, a stable FNV-1a hash of the
 * lower-cased UUID for legacy apps.
 */
export function shardForGuild(guildId: string, numShards: number): number {
  if (numShards <= 1) return 0;
  if (isSnowflake(guildId)) return Number((BigInt(guildId) >> 22n) % BigInt(numShards));
  let h = 0x811c9dc5;
  for (const ch of guildId.toLowerCase()) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % numShards;
}
