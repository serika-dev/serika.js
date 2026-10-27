import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  isSnowflake, isUuid, idFormat, snowflakeTimestamp, snowflakeFromTimestamp, compareIds, idsEqual, shardForGuild,
} from '../src/utils/snowflake.js';
import {
  hasPermission, resolvePermissions, permissionNames, permissionsFromLegacy, permissionsToLegacy,
  getBridgedFrom, isBridgedMessage, userMention, formatEmoji, time, messageLink,
} from '../src/utils/format.js';
import { CDN } from '../src/utils/cdn.js';
import { encodeEmoji, buildQuery, buildMultipartBody } from '../src/rest/multipart.js';
import { verifyInteractionSignature } from '../src/utils/verify.js';
import { PermissionFlags, LegacyPermissionFlags, Intents, PrivilegedIntents, AllIntents, VERSION } from '../src/index.js';

const SF = '1526627574531417544';
const UUID = '0B7C6A52-3f1e-4c55-9d43-2f8c6b1a9e10';

describe('ids (snowflake + legacy UUID)', () => {
  test('format detection', () => {
    assert.equal(idFormat(SF), 'snowflake');
    assert.equal(idFormat(UUID), 'uuid');
    assert.equal(idFormat('nope'), null);
    assert.ok(!isSnowflake('99999999999999999999')); // > 2^64-1
    assert.ok(isUuid(UUID.toLowerCase()));
  });

  test('timestamps round-trip and are null for UUIDs', () => {
    const t = Date.UTC(2026, 9, 27, 12, 0, 0);
    assert.equal(snowflakeTimestamp(snowflakeFromTimestamp(t)), t);
    assert.equal(snowflakeTimestamp(UUID), null);
    assert.equal(snowflakeTimestamp('0'), 1420070400000);
  });

  test('ordering and equality work for both formats', () => {
    assert.deepEqual(['20', '3', UUID, '100'].sort(compareIds), ['3', '20', '100', UUID]);
    assert.ok(idsEqual(UUID, UUID.toLowerCase()));
    assert.ok(!idsEqual(SF, '1'));
  });

  test('shardForGuild matches the server formula for snowflakes and UUIDs', () => {
    const g = String((7n << 22n) | 99n);
    assert.equal(shardForGuild(g, 4), 3);
    assert.equal(shardForGuild(g, 1), 0);
    // FNV-1a of the lower-cased UUID, same as src/lib/gateway/session.ts shardOfUuid
    let h = 0x811c9dc5;
    for (const ch of UUID.toLowerCase()) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    assert.equal(shardForGuild(UUID, 5), h % 5);
  });
});

describe('serialization helpers', () => {
  test('encodeEmoji', () => {
    assert.equal(encodeEmoji('🔥'), '%F0%9F%94%A5');
    assert.equal(encodeEmoji('<:blob:123>'), 'blob%3A123');
    assert.equal(encodeEmoji('<a:dance:456>'), 'dance%3A456');
    assert.equal(encodeEmoji('blob:123'), 'blob%3A123');
    assert.equal(encodeEmoji({ id: UUID, name: null }), encodeURIComponent(`_:${UUID}`));
    assert.equal(encodeEmoji({ name: '✅' }), encodeURIComponent('✅'));
    assert.throws(() => encodeEmoji({}));
  });

  test('buildQuery skips undefined/null and joins arrays', () => {
    assert.equal(buildQuery({ a: 1, b: undefined, c: null, d: true, e: ['x', 'y'] }), '?a=1&d=true&e=x%2Cy');
    assert.equal(buildQuery({}), '');
    assert.equal(buildQuery(), '');
  });

  test('buildMultipartBody strips `files` from payload_json and numbers new attachments', async () => {
    const form = buildMultipartBody({ content: 'x', files: ['ignored'] } as Record<string, unknown>, [
      { name: 'a.txt', data: 'hello' },
      { name: 'b.bin', data: new ArrayBuffer(2), key: 'custom' },
    ]);
    const payload = JSON.parse(String(form.get('payload_json')));
    assert.deepEqual(payload, { content: 'x', attachments: [{ id: 0, filename: 'a.txt' }, { id: 1, filename: 'b.bin' }] });
    assert.equal(await (form.get('files[0]') as File).text(), 'hello');
    assert.ok(form.get('custom'));
  });
});

describe('permissions', () => {
  test('hasPermission with names, bigints and Administrator', () => {
    const bits = (PermissionFlags.SendMessages | PermissionFlags.ViewChannel).toString();
    assert.ok(hasPermission(bits, 'SendMessages'));
    assert.ok(hasPermission(bits, ['SendMessages', 'ViewChannel']));
    assert.ok(!hasPermission(bits, 'BanMembers'));
    assert.ok(hasPermission(PermissionFlags.Administrator, 'BanMembers'));
    assert.ok(!hasPermission(PermissionFlags.Administrator, 'BanMembers', false));
    assert.equal(resolvePermissions(['KickMembers', 4n, '8']), (1n << 1n) | 4n | 8n);
    assert.deepEqual(permissionNames('3'), ['CreateInstantInvite', 'KickMembers']);
  });

  test('legacy (UUID-format app) bits 42-46 convert both ways losslessly', () => {
    const legacy = LegacyPermissionFlags.UseSoundboard | LegacyPermissionFlags.CreateEvents | PermissionFlags.SendMessages;
    const discord = permissionsFromLegacy(legacy);
    assert.equal(discord, PermissionFlags.UseSoundboard | PermissionFlags.CreateEvents | PermissionFlags.SendMessages);
    assert.equal(permissionsToLegacy(discord), legacy);
    for (let bit = 42n; bit <= 46n; bit++) assert.equal(permissionsToLegacy(permissionsFromLegacy(1n << bit)), 1n << bit);
  });

  test('intents', () => {
    assert.equal(PrivilegedIntents, (1 << 1) | (1 << 8) | (1 << 15));
    assert.equal(Intents.GUILD_MODERATION, Intents.GUILD_BANS);
    assert.equal(AllIntents & (1 << 25), 1 << 25);
    assert.equal(AllIntents & ~((1 << 26) - 1), 0, 'never sends bits the gateway rejects (4013)');
  });
});

describe('formatting, CDN and bridge helpers', () => {
  test('markup', () => {
    assert.equal(userMention('1'), '<@1>');
    assert.equal(formatEmoji('5', 'x', true), '<a:x:5>');
    assert.equal(time(new Date(1_700_000_000_000), 'R'), '<t:1700000000:R>');
    assert.equal(messageLink('c', 'm'), 'https://serika.chat/channels/@me/c/m');
  });

  test('CDN builds Discord paths for hashes and passes full URLs through (legacy apps)', () => {
    const cdn = new CDN('https://api.serika.chat/cdn-compat/');
    assert.equal(cdn.avatar(SF, 'abc', { size: 128 }), `https://api.serika.chat/cdn-compat/avatars/${SF}/abc.png?size=128`);
    assert.equal(cdn.avatar(SF, 'a_abc'), `https://api.serika.chat/cdn-compat/avatars/${SF}/a_abc.gif`);
    assert.equal(cdn.avatar(UUID, 'https://cdn.serika.chat/a.webp'), 'https://cdn.serika.chat/a.webp');
    assert.equal(cdn.avatar(SF, null), null);
    assert.equal(cdn.defaultAvatar(UUID), 'https://api.serika.chat/cdn-compat/embed/avatars/0.png');
    assert.equal(cdn.emoji('9', { animated: true }), 'https://api.serika.chat/cdn-compat/emojis/9.gif');
  });

  test('bridged_from detection', () => {
    const bridged = { bridged_from: { platform: 'discord' as const, guild_id: '1', channel_id: '2', message_id: '3', author: { id: '4', bot: false } } };
    assert.deepEqual(getBridgedFrom(bridged), bridged.bridged_from);
    assert.ok(isBridgedMessage(bridged));
    assert.ok(!isBridgedMessage({}));
  });
});

describe('verifyInteractionSignature', () => {
  test('accepts a valid Ed25519 signature over timestamp + body and rejects tampering', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
    const body = JSON.stringify({ type: 1 });
    const ts = '1700000000';
    const sig = sign(null, Buffer.from(ts + body), privateKey).toString('hex');
    assert.equal(await verifyInteractionSignature(body, sig, ts, raw), true);
    assert.equal(await verifyInteractionSignature(body + ' ', sig, ts, raw), false);
    assert.equal(await verifyInteractionSignature(body, sig, '1700000001', raw), false);
    assert.equal(await verifyInteractionSignature(body, 'zz', ts, raw), false);
    assert.equal(await verifyInteractionSignature(body, null, ts, raw), false);
  });
});

test('VERSION matches package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(VERSION, pkg.version);
});
