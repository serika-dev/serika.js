import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as zlib from 'node:zlib';
import { GatewayClient } from '../src/gateway.js';
import { ShardManager } from '../src/sharding.js';
import { GatewayOp, Intents, type WebSocketLike, type GatewayOptions } from '../src/types.js';
import { endsWithFlushSuffix } from '../src/gateway/compression.js';

class FakeWS implements WebSocketLike {
  static instances: FakeWS[] = [];
  readyState = 0;
  binaryType = 'blob';
  onopen: WebSocketLike['onopen'] = null;
  onmessage: WebSocketLike['onmessage'] = null;
  onerror: WebSocketLike['onerror'] = null;
  onclose: WebSocketLike['onclose'] = null;
  sent: { op: number; d: any }[] = [];
  closed: { code?: number; reason?: string } | null = null;

  constructor(public url: string) {
    FakeWS.instances.push(this);
  }

  send(data: string) { this.sent.push(JSON.parse(data)); }
  close(code?: number, reason?: string) { this.closed = { code, reason }; this.readyState = 3; }

  // test helpers
  open() { this.readyState = 1; this.onopen?.({}); }
  receive(payload: unknown) { this.onmessage?.({ data: JSON.stringify(payload) }); }
  receiveBinary(bytes: Uint8Array) { this.onmessage?.({ data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }); }
  serverClose(code: number, reason = '') { this.readyState = 3; this.onclose?.({ code, reason }); }
  ops(op: number) { return this.sent.filter((p) => p.op === op); }
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms = 2000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out waiting for condition');
    await tick(2);
  }
}

const clients: GatewayClient[] = [];
let tokenSeq = 0;

function makeClient(opts: Partial<GatewayOptions> = {}) {
  FakeWS.instances = [];
  const c = new GatewayClient(
    { token: `Bot test-token-${tokenSeq++}`, intents: Intents.GUILDS | Intents.GUILD_MESSAGES, WebSocket: FakeWS, ...opts },
    { sleep: async () => {}, random: () => 0, identifyGate: async () => {} },
  );
  clients.push(c);
  return c;
}

const ws = () => FakeWS.instances[FakeWS.instances.length - 1];

const READY = (overrides: Record<string, unknown> = {}) => ({
  op: 0, t: 'READY', s: 1,
  d: { v: 10, user: { id: '1', username: 'bot', global_name: null, avatar: null }, guilds: [{ id: '2', unavailable: true }], session_id: 'sess-1', resume_gateway_url: 'wss://resume.test/gw', application: { id: '3', flags: 0 }, ...overrides },
});

afterEach(() => {
  for (const c of clients.splice(0)) c.destroy();
});

describe('GatewayClient', () => {
  test('connects with v=10&encoding=json, identifies after HELLO, emits ready + typed events', async () => {
    const c = makeClient({ url: 'wss://gw.test/api/v10/gateway', shard: [0, 1], presence: { status: 'dnd' } });
    const events: string[] = [];
    c.on('ready', (d) => events.push(`ready:${d.session_id}`));
    c.on('GUILD_CREATE', (g, shard) => events.push(`guild:${g.id}:${shard}`));
    c.onDispatch((t, _d, s) => events.push(`dispatch:${t}:${s}`));
    await c.connect();
    const sock = ws();
    assert.equal(sock.url, 'wss://gw.test/api/v10/gateway?v=10&encoding=json');
    sock.open();
    sock.receive({ op: GatewayOp.Hello, d: { heartbeat_interval: 41250 } });
    await until(() => sock.ops(GatewayOp.Identify).length === 1);
    const identify = sock.ops(GatewayOp.Identify)[0].d;
    assert.equal(identify.token, `test-token-${tokenSeq - 1}`, 'the "Bot " prefix is stripped');
    assert.equal(identify.intents, Intents.GUILDS | Intents.GUILD_MESSAGES);
    assert.deepEqual(identify.shard, [0, 1]);
    assert.equal(identify.properties.browser, 'serika.js');
    assert.deepEqual(identify.presence, { status: 'dnd' });

    const ready = c.waitForReady(1000);
    sock.receive(READY());
    sock.receive({ op: 0, t: 'GUILD_CREATE', s: 2, d: { id: '2', name: 'g' } });
    assert.equal((await ready).session_id, 'sess-1');
    assert.equal(c.isConnected, true);
    assert.equal(c.sessionId, 'sess-1');
    assert.equal(c.sequence, 2);
    assert.deepEqual(events, ['ready:sess-1', 'dispatch:READY:1', 'dispatch:GUILD_CREATE:2', 'guild:2:0']);
  });

  test('heartbeats with the last sequence and answers a server heartbeat request immediately', async () => {
    const c = makeClient();
    await c.connect();
    const sock = ws();
    sock.open();
    sock.receive({ op: GatewayOp.Hello, d: { heartbeat_interval: 30 } });
    sock.receive(READY());
    await until(() => sock.ops(GatewayOp.Heartbeat).length >= 1);
    assert.equal(sock.ops(GatewayOp.Heartbeat)[0].d, 1);
    sock.receive({ op: GatewayOp.HeartbeatAck });
    const before = sock.ops(GatewayOp.Heartbeat).length;
    sock.receive({ op: GatewayOp.Heartbeat });
    assert.equal(sock.ops(GatewayOp.Heartbeat).length, before + 1);
    assert.ok(c.ping >= 0);
  });

  test('op 7 RECONNECT closes with 4000 and RESUMEs on resume_gateway_url', async () => {
    const c = makeClient({ url: 'wss://gw.test/gateway' });
    await c.connect();
    const first = ws();
    first.open();
    first.receive({ op: GatewayOp.Hello, d: { heartbeat_interval: 41250 } });
    first.receive(READY());
    first.receive({ op: 0, t: 'MESSAGE_CREATE', s: 5, d: { id: 'm' } });
    first.receive({ op: GatewayOp.Reconnect, d: null });
    assert.equal(first.closed?.code, 4000);
    await until(() => FakeWS.instances.length === 2);
    const second = ws();
    assert.equal(second.url, 'wss://resume.test/gw?v=10&encoding=json');
    second.open();
    second.receive({ op: GatewayOp.Hello, d: { heartbeat_interval: 41250 } });
    const resume = second.ops(GatewayOp.Resume);
    assert.equal(resume.length, 1);
    assert.deepEqual(resume[0].d, { token: `test-token-${tokenSeq - 1}`, session_id: 'sess-1', seq: 5 });
    assert.equal(second.ops(GatewayOp.Identify).length, 0);
    let resumed = false;
    c.on('resumed', () => { resumed = true; });
    second.receive({ op: 0, t: 'RESUMED', s: 6, d: {} });
    assert.ok(resumed);
    assert.equal(c.isConnected, true);
  });

  test('op 9 (not resumable) clears the session and identifies again', async () => {
    const c = makeClient();
    await c.connect();
    const sock = ws();
    sock.open();
    sock.receive({ op: GatewayOp.Hello, d: { heartbeat_interval: 41250 } });
    sock.receive(READY());
    await until(() => sock.ops(GatewayOp.Identify).length === 1);
    sock.receive({ op: GatewayOp.InvalidSession, d: false });
    await until(() => sock.ops(GatewayOp.Identify).length === 2);
    assert.equal(c.sessionId, null);
    assert.equal(c.sequence, null);
  });

  test('close 4009 (session timed out) reconnects with a fresh IDENTIFY', async () => {
    const c = makeClient();
    await c.connect();
    const first = ws();
    first.open();
    first.receive({ op: GatewayOp.Hello, d: { heartbeat_interval: 41250 } });
    first.receive(READY());
    first.serverClose(4009, 'Session timed out');
    await until(() => FakeWS.instances.length === 2, 3000);
    const second = ws();
    second.open();
    second.receive({ op: GatewayOp.Hello, d: { heartbeat_interval: 41250 } });
    await until(() => second.ops(GatewayOp.Identify).length === 1);
    assert.equal(second.ops(GatewayOp.Resume).length, 0);
  });

  test('fatal close 4014 stops reconnecting, emits an error and rejects waitForReady', async () => {
    const c = makeClient();
    const errors: Error[] = [];
    c.onError((e) => errors.push(e));
    await c.connect();
    const sock = ws();
    sock.open();
    const ready = c.waitForReady(1000);
    sock.serverClose(4014, 'Disallowed intent(s)');
    await assert.rejects(ready, /fatal code 4014.*Developer Portal/);
    await tick(20);
    assert.equal(FakeWS.instances.length, 1, 'no reconnect after a fatal close');
    assert.equal(errors.length, 1);
  });

  test('a missed heartbeat ACK is treated as a zombie connection and resumed', async () => {
    const c = makeClient();
    const errors: string[] = [];
    c.onError((e) => errors.push(e.message));
    await c.connect();
    const sock = ws();
    sock.open();
    sock.receive({ op: GatewayOp.Hello, d: { heartbeat_interval: 15 } });
    sock.receive(READY());
    // never ACK: the second beat detects the zombie
    await until(() => FakeWS.instances.length === 2, 3000);
    assert.equal(sock.closed?.code, 4000);
    assert.ok(errors.some((m) => /zombie/.test(m)));
    const next = ws();
    next.open();
    next.receive({ op: GatewayOp.Hello, d: { heartbeat_interval: 41250 } });
    assert.equal(next.ops(GatewayOp.Resume).length, 1);
  });

  test('disconnect() ends the session and does not reconnect', async () => {
    const c = makeClient();
    await c.connect();
    const sock = ws();
    sock.open();
    sock.receive({ op: GatewayOp.Hello, d: { heartbeat_interval: 41250 } });
    sock.receive(READY());
    c.disconnect();
    assert.equal(sock.closed?.code, 1000);
    assert.equal(c.isConnected, false);
    assert.equal(c.sessionId, null);
    await tick(20);
    assert.equal(FakeWS.instances.length, 1);
  });

  test('sendPresenceUpdate / requestGuildMembers / requestSoundboardSounds payloads', async () => {
    const c = makeClient();
    await c.connect();
    const sock = ws();
    sock.open();
    c.sendPresenceUpdate({ status: 'idle', activities: [{ name: 'tests', type: 0 }] });
    c.requestGuildMembers({ guild_id: '2', user_ids: ['1'] });
    c.requestSoundboardSounds({ guild_ids: ['2'] });
    assert.deepEqual(sock.ops(GatewayOp.PresenceUpdate)[0].d, { since: null, activities: [{ name: 'tests', type: 0 }], afk: false, status: 'idle' });
    assert.deepEqual(sock.ops(GatewayOp.RequestGuildMembers)[0].d, { query: '', limit: 0, guild_id: '2', user_ids: ['1'] });
    assert.deepEqual(sock.ops(GatewayOp.RequestSoundboardSounds)[0].d, { guild_ids: ['2'] });
  });

  test('compress: zlib-stream inflates a shared context across split frames', async () => {
    const c = makeClient({ compress: true });
    const got: string[] = [];
    c.onDispatch((t) => got.push(t));
    await c.connect();
    const sock = ws();
    assert.match(sock.url, /compress=zlib-stream/);
    sock.open();

    // Server side: one deflate context, Z_SYNC_FLUSH after every payload.
    const deflate = zlib.createDeflate();
    const chunks: Buffer[] = [];
    deflate.on('data', (b: Buffer) => chunks.push(b));
    const compress = (payload: unknown) => new Promise<Uint8Array>((resolve) => {
      deflate.write(JSON.stringify(payload));
      deflate.flush(zlib.constants.Z_SYNC_FLUSH, () => resolve(new Uint8Array(Buffer.concat(chunks.splice(0)))));
    });

    sock.receiveBinary(await compress({ op: GatewayOp.Hello, d: { heartbeat_interval: 41250 } }));
    await until(() => sock.ops(GatewayOp.Identify).length === 1);
    const ready = await compress(READY());
    assert.ok(endsWithFlushSuffix(ready));
    // Deliver READY in two WebSocket messages: only the second ends with 00 00 FF FF.
    const cut = Math.floor(ready.length / 2);
    sock.receiveBinary(ready.slice(0, cut));
    sock.receiveBinary(ready.slice(cut));
    sock.receiveBinary(await compress({ op: 0, t: 'MESSAGE_CREATE', s: 2, d: { id: 'x', content: 'y'.repeat(2000) } }));
    await until(() => got.length === 2);
    assert.deepEqual(got, ['READY', 'MESSAGE_CREATE']);
    assert.equal(c.sequence, 2);
    deflate.close();
  });
});

describe('ShardManager', () => {
  test('uses /gateway/bot for the shard count and URL and routes guilds to shards', async () => {
    FakeWS.instances = [];
    const mgr = new ShardManager({
      token: 'tok-shards',
      intents: Intents.GUILDS,
      WebSocket: FakeWS,
      fetchGatewayBot: async () => ({ url: 'wss://from-bot.test/gw', shards: 3, session_start_limit: { total: 1000, remaining: 999, reset_after: 1, max_concurrency: 3 } }),
    });
    await mgr.connect();
    assert.equal(mgr.totalShards, 3);
    assert.equal(FakeWS.instances.length, 3);
    assert.ok(FakeWS.instances.every((w) => w.url.startsWith('wss://from-bot.test/gw?v=10')));
    for (const w of FakeWS.instances) { w.open(); w.receive({ op: GatewayOp.Hello, d: { heartbeat_interval: 41250 } }); }
    await until(() => FakeWS.instances.every((w) => w.ops(GatewayOp.Identify).length === 1));
    assert.deepEqual(FakeWS.instances.map((w) => w.ops(GatewayOp.Identify)[0].d.shard), [[0, 3], [1, 3], [2, 3]]);
    // (guild_id >> 22) % 3
    const guild = String((5n << 22n) | 123n);
    assert.equal(mgr.shardIdForGuild(guild), 2);
    assert.equal(mgr.shardForGuild(guild), mgr.shards.get(2));
    mgr.destroy();
  });

  test('refuses to start more shards than session starts remain', async () => {
    const mgr = new ShardManager({
      token: 't', intents: 0, WebSocket: FakeWS,
      fetchGatewayBot: async () => ({ url: 'wss://x', shards: 2, session_start_limit: { total: 1000, remaining: 1, reset_after: 5, max_concurrency: 1 } }),
    });
    await assert.rejects(mgr.connect(), /Not enough session starts/);
  });
});
