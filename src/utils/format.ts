// ─── Message formatting helpers (Discord markup, works on SerikaCord) ─

import { PermissionFlags, LegacyPermissionFlags, type PermissionFlagName } from '../types/enums.js';
import type { APIBridgedFrom, APIMessage } from '../types/api.js';

export const userMention = (id: string) => `<@${id}>`;
export const channelMention = (id: string) => `<#${id}>`;
export const roleMention = (id: string) => `<@&${id}>`;
export const slashCommandMention = (name: string, id: string) => `</${name}:${id}>`;
export const formatEmoji = (id: string, name = '_', animated = false) => `<${animated ? 'a' : ''}:${name}:${id}>`;

export type TimestampStyle = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R';

/** `<t:unix:style>` timestamp markup. */
export function time(date: Date | number, style?: TimestampStyle): string {
  const seconds = Math.floor((date instanceof Date ? date.getTime() : date) / 1000);
  return style ? `<t:${seconds}:${style}>` : `<t:${seconds}>`;
}

/** Link to a message (`/channels/{guild|@me}/{channel}/{message}`, opens the message on serika.chat). */
export function messageLink(channelId: string, messageId: string, guildId?: string | null, base = 'https://serika.chat'): string {
  return `${base}/channels/${guildId ?? '@me'}/${channelId}/${messageId}`;
}

// ── Permissions ─────────────────────────────────────────────

export type PermissionResolvable = bigint | string | number | PermissionFlagName | PermissionResolvable[];

/** Resolve flag names, bigints, decimal strings or arrays into one bitfield. */
export function resolvePermissions(p: PermissionResolvable): bigint {
  if (Array.isArray(p)) return p.reduce<bigint>((acc, x) => acc | resolvePermissions(x), 0n);
  if (typeof p === 'bigint') return p;
  if (typeof p === 'number') return BigInt(p);
  if (p in PermissionFlags) return PermissionFlags[p as PermissionFlagName];
  if (/^\d+$/.test(p)) return BigInt(p);
  throw new TypeError(`Unknown permission: ${p}`);
}

/**
 * True when `bitfield` (e.g. `interaction.member.permissions`) grants every
 * permission in `required`. Administrator grants everything unless
 * `checkAdmin` is false.
 */
export function hasPermission(bitfield: string | bigint, required: PermissionResolvable, checkAdmin = true): boolean {
  const bits = typeof bitfield === 'bigint' ? bitfield : BigInt(bitfield || '0');
  if (checkAdmin && (bits & PermissionFlags.Administrator) === PermissionFlags.Administrator) return true;
  const need = resolvePermissions(required);
  return (bits & need) === need;
}

/** Flag names set in a bitfield. */
export function permissionNames(bitfield: string | bigint): PermissionFlagName[] {
  const bits = typeof bitfield === 'bigint' ? bitfield : BigInt(bitfield || '0');
  return (Object.keys(PermissionFlags) as PermissionFlagName[]).filter((k) => (bits & PermissionFlags[k]) !== 0n);
}

const LEGACY_TO_DISCORD: [bigint, bigint][] = [
  [LegacyPermissionFlags.UseExternalSounds, PermissionFlags.UseExternalSounds],
  [LegacyPermissionFlags.SendVoiceMessages, PermissionFlags.SendVoiceMessages],
  [LegacyPermissionFlags.UseSoundboard, PermissionFlags.UseSoundboard],
  [LegacyPermissionFlags.CreateGuildExpressions, PermissionFlags.CreateGuildExpressions],
  [LegacyPermissionFlags.CreateEvents, PermissionFlags.CreateEvents],
];
const MOVED_MASK = LEGACY_TO_DISCORD.reduce((m, [a]) => m | a, 0n);

function permute(bits: bigint, pairs: [bigint, bigint][]): bigint {
  if ((bits & MOVED_MASK) === 0n) return bits;
  let out = bits & ~MOVED_MASK;
  for (const [from, to] of pairs) if (bits & from) out |= to;
  return out;
}

/** Legacy (UUID-format app) bitfield → Discord v10 numbering. Only bits 42-46 move. */
export function permissionsFromLegacy(bitfield: string | bigint): bigint {
  return permute(typeof bitfield === 'bigint' ? bitfield : BigInt(bitfield || '0'), LEGACY_TO_DISCORD);
}

/** Discord v10 bitfield → legacy (UUID-format app) numbering. */
export function permissionsToLegacy(bitfield: string | bigint): bigint {
  return permute(typeof bitfield === 'bigint' ? bitfield : BigInt(bitfield || '0'), LEGACY_TO_DISCORD.map(([a, b]) => [b, a]));
}

// ── Bridged messages ────────────────────────────────────────

/**
 * The Discord origin of a message relayed in by the SerikaCord ↔ Discord
 * bridge, or null for native SerikaCord messages.
 */
export function getBridgedFrom(message: Pick<APIMessage, 'bridged_from'> | { bridged_from?: APIBridgedFrom | null }): APIBridgedFrom | null {
  const b = message.bridged_from;
  return b && b.platform === 'discord' ? b : null;
}

/** True when the Discord bridge relayed this message in from Discord. */
export function isBridgedMessage(message: { bridged_from?: APIBridgedFrom | null }): boolean {
  return getBridgedFrom(message) !== null;
}
