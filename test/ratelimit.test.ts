import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, RateLimitManager, isIdSegment } from '../src/rest/ratelimit.js';

const SF = '1526627574531417544';
const SF2 = '1522221870365383034';
const UUID = '0b7c6a52-3f1e-4c55-9d43-2f8c6b1a9e10';

function headers(h: Record<string, string>) {
  const lower = Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => lower[name.toLowerCase()] ?? null };
}

describe('parseRoute', () => {
  test('keeps the major channel id and strips the /api/v10 prefix and query', () => {
    const r = parseRoute('post', `/api/v10/channels/${SF}/messages?wait=true`);
    assert.equal(r.route, `POST /channels/${SF}/messages`);
    assert.equal(r.major, `channels/${SF}`);
    assert.equal(r.path, `/channels/${SF}/messages`);
  });

  test('replaces non-major ids (snowflake or UUID) with :id', () => {
    assert.equal(parseRoute('DELETE', `/channels/${SF}/messages/${SF2}`).route, `DELETE /channels/${SF}/messages/:id`);
    assert.equal(parseRoute('PATCH', `/guilds/${UUID}/members/${UUID}`).route, `PATCH /guilds/${UUID}/members/:id`);
    assert.equal(parseRoute('GET', `/users/${SF}`).route, 'GET /users/:id');
  });

  test('legacy UUID ids are major parameters too', () => {
    const r = parseRoute('GET', `/api/v10/guilds/${UUID}/roles`);
    assert.equal(r.major, `guilds/${UUID}`);
  });

  test('collapses every reaction emoji and user into one route', () => {
    const a = parseRoute('PUT', `/channels/${SF}/messages/${SF2}/reactions/%F0%9F%91%8D/@me`);
    const b = parseRoute('PUT', `/channels/${SF}/messages/${SF2}/reactions/blob%3A${SF2}/@me`);
    assert.equal(a.route, b.route);
    assert.equal(a.route, `PUT /channels/${SF}/messages/:id/reactions/:reaction/:user`);
    assert.equal(parseRoute('DELETE', `/channels/${SF}/messages/${SF2}/reactions/x`).route, `DELETE /channels/${SF}/messages/:id/reactions/:reaction`);
  });

  test('webhook and interaction tokens go into the major parameter, not the route', () => {
    const w = parseRoute('POST', `/webhooks/${SF}/secret-token-abc`);
    assert.equal(w.route, `POST /webhooks/${SF}/:token`);
    assert.equal(w.major, `webhooks/${SF}/secret-token-abc`);
    const m = parseRoute('PATCH', `/webhooks/${SF}/tok/messages/@original`);
    assert.equal(m.route, `PATCH /webhooks/${SF}/:token/messages/@original`);
    const i = parseRoute('POST', `/interactions/${SF}/aW50ZXJhY3Rpb24/callback`);
    assert.equal(i.route, `POST /interactions/${SF}/:token/callback`);
    assert.equal(i.major, `interactions/${SF}/aW50ZXJhY3Rpb24`);
  });

  test('invite codes and poll answer ids are normalized', () => {
    assert.equal(parseRoute('GET', '/invites/abcDEF').route, 'GET /invites/:code');
    assert.equal(parseRoute('GET', `/channels/${SF}/polls/${SF2}/answers/3`).route, `GET /channels/${SF}/polls/:id/answers/:id`);
  });

  test('isIdSegment', () => {
    assert.ok(isIdSegment(SF));
    assert.ok(isIdSegment(UUID));
    assert.ok(!isIdSegment('@me'));
    assert.ok(!isIdSegment('messages'));
  });
});

describe('RateLimitManager', () => {
  test('learns the bucket hash from headers and waits when it is empty', () => {
    let now = 1_000_000;
    const rl = new RateLimitManager(() => now);
    const route = parseRoute('POST', `/channels/${SF}/messages`);
    assert.equal(rl.acquire(route).wait, 0);
    rl.update(route, headers({ 'X-RateLimit-Bucket': 'abc123', 'X-RateLimit-Limit': '5', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset-After': '2.5' }));
    assert.equal(rl.bucketHash(route), 'abc123');
    const a = rl.acquire(route);
    assert.equal(a.wait, 2500);
    assert.equal(a.global, false);
    now += 2500;
    assert.equal(rl.acquire(route).wait, 0, 'bucket refills after reset');
  });

  test('reserves remaining slots locally between responses', () => {
    const now = 0;
    const rl = new RateLimitManager(() => now);
    const route = parseRoute('POST', `/channels/${SF}/messages`);
    rl.update(route, headers({ 'X-RateLimit-Bucket': 'b', 'X-RateLimit-Limit': '5', 'X-RateLimit-Remaining': '2', 'X-RateLimit-Reset-After': '5' }));
    assert.equal(rl.acquire(route).wait, 0);
    assert.equal(rl.acquire(route).wait, 0);
    assert.equal(rl.acquire(route).wait, 5000);
  });

  test('buckets are split by major parameter', () => {
    const rl = new RateLimitManager(() => 0);
    const a = parseRoute('POST', `/channels/${SF}/messages`);
    const b = parseRoute('POST', `/channels/${SF2}/messages`);
    rl.update(a, headers({ 'X-RateLimit-Bucket': 'send', 'X-RateLimit-Limit': '5', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset-After': '5' }));
    rl.update(b, headers({ 'X-RateLimit-Bucket': 'send', 'X-RateLimit-Limit': '5', 'X-RateLimit-Remaining': '4', 'X-RateLimit-Reset-After': '5' }));
    assert.ok(rl.acquire(a).wait > 0);
    assert.equal(rl.acquire(b).wait, 0);
  });

  test("routes in the server's `global` bucket share one budget regardless of major", () => {
    const rl = new RateLimitManager(() => 0);
    const a = parseRoute('GET', `/channels/${SF}/messages`);
    const b = parseRoute('GET', `/guilds/${SF2}`);
    rl.update(a, headers({ 'X-RateLimit-Bucket': 'global', 'X-RateLimit-Limit': '50', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset-After': '1' }));
    rl.update(b, headers({ 'X-RateLimit-Bucket': 'global' }));
    assert.equal(rl.keyFor(a), 'global');
    assert.equal(rl.keyFor(b), 'global');
    assert.equal(rl.acquire(b).wait, 1000);
  });

  test('a global 429 locks every route; retry_after comes from the body in seconds', () => {
    let now = 0;
    const rl = new RateLimitManager(() => now);
    const a = parseRoute('POST', `/channels/${SF}/messages`);
    const other = parseRoute('GET', '/users/@me');
    const r = rl.onRateLimited(a, headers({ 'Retry-After': '2', 'X-RateLimit-Global': 'true', 'X-RateLimit-Scope': 'global' }), { message: 'You are being rate limited.', retry_after: 1.25, global: true });
    assert.deepEqual(r, { retryAfter: 1250, global: true });
    const w = rl.acquire(other);
    assert.equal(w.wait, 1250);
    assert.equal(w.global, true);
    now += 1250;
    assert.equal(rl.acquire(other).wait, 0);
  });

  test('a route 429 only locks that bucket; falls back to Retry-After', () => {
    const rl = new RateLimitManager(() => 0);
    const a = parseRoute('PUT', `/channels/${SF}/messages/${SF2}/reactions/x/@me`);
    const other = parseRoute('POST', `/channels/${SF}/typing`);
    const r = rl.onRateLimited(a, headers({ 'Retry-After': '3', 'X-RateLimit-Scope': 'user' }), 'not json');
    assert.deepEqual(r, { retryAfter: 3000, global: false });
    assert.equal(rl.acquire(a).wait, 3000);
    assert.equal(rl.acquire(other).wait, 0);
  });

  test('clear() forgets everything', () => {
    const rl = new RateLimitManager(() => 0);
    const a = parseRoute('GET', '/users/@me');
    rl.onRateLimited(a, headers({}), { retry_after: 5, global: true });
    rl.clear();
    assert.equal(rl.acquire(a).wait, 0);
  });
});
