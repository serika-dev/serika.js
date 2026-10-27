import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { HTTPClient, HTTPError } from '../src/http.js';
import { SerikaClient } from '../src/index.js';
import { MessageFlags } from '../src/types.js';

const CH = '1526627574531417544';

interface Call { url: string; init: RequestInit }

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/** fetch double that replays queued responses and records calls. */
function fakeFetch(responses: (Response | ((call: Call) => Response))[]) {
  const calls: Call[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    const next = responses.shift();
    if (!next) throw new Error(`unexpected request ${call.url}`);
    return typeof next === 'function' ? next(call) : next;
  }) as typeof fetch;
  return { fn, calls };
}

function client(fetchFn: typeof fetch, extra: Partial<ConstructorParameters<typeof HTTPClient>[0]> = {}) {
  const sleeps: number[] = [];
  let now = 1_000_000;
  const http = new HTTPClient({
    baseURL: 'https://api.test',
    token: 'Bot abc.def',
    fetch: fetchFn,
    now: () => now,
    sleep: async (ms) => { sleeps.push(ms); now += ms; },
    ...extra,
  });
  return { http, sleeps };
}

const header = (init: RequestInit, name: string) => new Headers(init.headers as Record<string, string>).get(name);

describe('HTTPClient', () => {
  test('sends the bot token once (strips a leading "Bot "), JSON body and query', async () => {
    const { fn, calls } = fakeFetch([json(200, { id: '1' })]);
    const { http } = client(fn);
    const out = await http.request<{ id: string }>({ method: 'POST', path: '/api/v10/x', body: { a: 1 }, query: { limit: 5, skip: undefined, ids: ['1', '2'] } });
    assert.deepEqual(out, { id: '1' });
    assert.equal(calls[0].url, 'https://api.test/api/v10/x?limit=5&ids=1%2C2');
    assert.equal(header(calls[0].init, 'authorization'), 'Bot abc.def');
    assert.equal(header(calls[0].init, 'content-type'), 'application/json');
    assert.equal(calls[0].init.body, '{"a":1}');
  });

  test('auth: false omits Authorization; reason sets an encoded X-Audit-Log-Reason', async () => {
    const { fn, calls } = fakeFetch([json(204, undefined), json(204, undefined)]);
    const { http } = client(fn);
    await http.request({ method: 'POST', path: '/hook', auth: false, body: {} });
    await http.request({ method: 'DELETE', path: '/m', reason: 'spam & abuse' });
    assert.equal(header(calls[0].init, 'authorization'), null);
    assert.equal(header(calls[1].init, 'x-audit-log-reason'), 'spam%20%26%20abuse');
  });

  test('204 resolves undefined', async () => {
    const { fn } = fakeFetch([new Response(null, { status: 204 })]);
    const { http } = client(fn);
    assert.equal(await http.request({ method: 'DELETE', path: '/x' }), undefined);
  });

  test('retries a 429 after retry_after and reports it', async () => {
    const seen: unknown[] = [];
    const { fn, calls } = fakeFetch([
      json(429, { message: 'You are being rate limited.', retry_after: 0.75, global: false }, { 'Retry-After': '1', 'X-RateLimit-Scope': 'user', 'X-RateLimit-Bucket': 'b1', 'X-RateLimit-Limit': '5', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset-After': '0.75' }),
      json(200, { ok: true }, { 'X-RateLimit-Bucket': 'b1', 'X-RateLimit-Limit': '5', 'X-RateLimit-Remaining': '4', 'X-RateLimit-Reset-After': '5' }),
    ]);
    const { http, sleeps } = client(fn, { onRateLimit: (i) => seen.push(i) });
    const out = await http.request({ method: 'POST', path: `/api/v10/channels/${CH}/messages`, body: { content: 'hi' } });
    assert.deepEqual(out, { ok: true });
    assert.equal(calls.length, 2);
    assert.deepEqual(sleeps, [750]);
    assert.equal((seen[0] as { fromResponse: boolean }).fromResponse, true);
    assert.equal((seen[0] as { bucket: string }).bucket, 'b1');
  });

  test('waits proactively when the learned bucket is empty', async () => {
    const { fn, calls } = fakeFetch([
      json(200, {}, { 'X-RateLimit-Bucket': 'send', 'X-RateLimit-Limit': '5', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset-After': '4' }),
      json(200, {}, { 'X-RateLimit-Bucket': 'send', 'X-RateLimit-Limit': '5', 'X-RateLimit-Remaining': '4', 'X-RateLimit-Reset-After': '5' }),
    ]);
    const { http, sleeps } = client(fn);
    await http.post(`/api/v10/channels/${CH}/messages`, { content: '1' });
    await http.post(`/api/v10/channels/${CH}/messages`, { content: '2' });
    assert.equal(calls.length, 2);
    assert.deepEqual(sleeps, [4000]);
  });

  test('a global 429 delays requests on other routes', async () => {
    const { fn } = fakeFetch([
      json(429, { message: 'x', retry_after: 2, global: true }, { 'X-RateLimit-Global': 'true' }),
      json(200, {}),
      json(200, {}),
    ]);
    const { http, sleeps } = client(fn);
    await http.get('/api/v10/users/@me');
    assert.deepEqual(sleeps, [2000]);
  });

  test('rejectOnRateLimit throws HTTPError(429) instead of waiting', async () => {
    const { fn } = fakeFetch([json(429, { message: 'slow down', retry_after: 1, global: false })]);
    const { http } = client(fn, { rejectOnRateLimit: true });
    await assert.rejects(http.get('/api/v10/users/@me'), (err: unknown) => err instanceof HTTPError && err.status === 429 && err.retryAfter === 1000);
  });

  test('retries 5xx with backoff, then succeeds', async () => {
    const { fn, calls } = fakeFetch([json(502, { message: 'bad gateway' }), json(200, { ok: 1 })]);
    const { http, sleeps } = client(fn);
    assert.deepEqual(await http.get('/x'), { ok: 1 });
    assert.equal(calls.length, 2);
    assert.equal(sleeps.length, 1);
  });

  test('4xx throws HTTPError with Discord code and flattened form errors', async () => {
    const { fn } = fakeFetch([json(400, {
      code: 50035,
      message: 'Invalid Form Body',
      errors: { embeds: { 0: { title: { _errors: [{ code: 'BASE_TYPE_MAX_LENGTH', message: 'Must be 256 or fewer in length.' }] } } } },
    })]);
    const { http } = client(fn);
    const err = (await http.post('/api/v10/channels/1/messages', {}).catch((e) => e)) as HTTPError;
    assert.ok(err instanceof HTTPError);
    assert.equal(err.status, 400);
    assert.equal(err.code, 50035);
    assert.equal(err.method, 'POST');
    assert.deepEqual(err.flattenErrors(), [{ path: 'embeds.0.title', code: 'BASE_TYPE_MAX_LENGTH', message: 'Must be 256 or fewer in length.' }]);
    assert.match(err.message, /\[400\] Invalid Form Body \(code 50035\)/);
  });

  test('client-API error bodies ({ error }) still produce a message', async () => {
    const { fn } = fakeFetch([json(403, { error: 'Forbidden' })]);
    const { http } = client(fn);
    const err = (await http.get('/api/users/@me').catch((e) => e)) as HTTPError;
    assert.equal(err.message, '[403] Forbidden');
  });

  test('files become Discord multipart: payload_json + files[n], no manual Content-Type', async () => {
    const { fn, calls } = fakeFetch([json(200, { id: 'm' })]);
    const { http } = client(fn);
    await http.request({
      method: 'POST',
      path: `/api/v10/channels/${CH}/messages`,
      body: { content: 'pic', attachments: [{ id: 0, description: 'kept' }] },
      files: [{ name: 'a.png', data: new Uint8Array([1, 2, 3]), contentType: 'image/png', description: 'alt' }],
    });
    const body = calls[0].init.body as FormData;
    assert.ok(body instanceof FormData);
    assert.equal(header(calls[0].init, 'content-type'), null);
    const payload = JSON.parse(String(body.get('payload_json')));
    assert.equal(payload.content, 'pic');
    assert.deepEqual(payload.attachments, [{ id: 0, description: 'kept' }, { id: 1, filename: 'a.png', description: 'alt' }]);
    const file = body.get('files[1]') as File;
    assert.equal(file.name, 'a.png');
    assert.equal(file.type, 'image/png');
    assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [1, 2, 3]);
  });

  test('timeouts become HTTPError(408) after retries', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fn = (async () => { throw abortErr; }) as unknown as typeof fetch;
    const { http } = client(fn, { retries: 1 });
    await assert.rejects(http.get('/slow'), (e: unknown) => e instanceof HTTPError && e.status === 408);
  });
});

describe('BotAPI routing', () => {
  function bot(responses: Response[]) {
    const f = fakeFetch(responses);
    const c = new SerikaClient({ token: 't', fetch: f.fn, baseURL: 'https://api.test/' });
    return { c, calls: f.calls };
  }

  test('createMessage accepts a string and routes under /api/v10', async () => {
    const { c, calls } = bot([json(200, { id: '1' })]);
    await c.bot.createMessage(CH, 'hello');
    assert.equal(calls[0].url, `https://api.test/api/v10/channels/${CH}/messages`);
    assert.equal(calls[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { content: 'hello' });
  });

  test('reactions encode unicode and custom emojis', async () => {
    const { c, calls } = bot([new Response(null, { status: 204 }), new Response(null, { status: 204 }), new Response(null, { status: 204 })]);
    await c.bot.addReaction(CH, '2', '👍');
    await c.bot.addReaction(CH, '2', '<a:party:123456789012345678>');
    await c.bot.addReaction(CH, '2', { id: '1', name: 'x' });
    assert.ok(calls[0].url.endsWith('/reactions/%F0%9F%91%8D/@me'));
    assert.ok(calls[1].url.endsWith('/reactions/party%3A123456789012345678/@me'));
    assert.ok(calls[2].url.endsWith('/reactions/x%3A1/@me'));
  });

  test('getMessages keeps the 1.0 limit-number form and accepts a query object', async () => {
    const { c, calls } = bot([json(200, []), json(200, [])]);
    await c.bot.getMessages(CH, 10);
    await c.bot.getMessages(CH, { before: '99', limit: 2 });
    assert.ok(calls[0].url.endsWith('/messages?limit=10'));
    assert.ok(calls[1].url.endsWith('/messages?before=99&limit=2'));
  });

  test('interaction replies hit the callback route without bot auth', async () => {
    const { c, calls } = bot([new Response(null, { status: 204 }), json(200, { id: 'm' })]);
    const interaction = { id: '10', token: 'tok', application_id: '20' };
    await c.interactions.reply(interaction, { content: 'hi', ephemeral: true });
    await c.interactions.followUp(interaction, 'later');
    assert.equal(calls[0].url, 'https://api.test/api/v10/interactions/10/tok/callback');
    assert.equal(header(calls[0].init, 'authorization'), null);
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { type: 4, data: { content: 'hi', flags: MessageFlags.Ephemeral } });
    assert.equal(calls[1].url, 'https://api.test/api/v10/webhooks/20/tok');
  });

  test('defer + editReply + showModal + autocomplete payloads', async () => {
    const { c, calls } = bot([
      new Response(null, { status: 204 }), json(200, { id: 'm' }), new Response(null, { status: 204 }), new Response(null, { status: 204 }),
    ]);
    const i = { id: '1', token: 't', application_id: 'a' };
    await c.interactions.defer(i, { ephemeral: true });
    await c.interactions.editReply(i, 'done');
    await c.interactions.showModal(i, { custom_id: 'm', title: 'T', components: [] });
    await c.interactions.autocomplete(i, [{ name: 'a', value: 'a' }]);
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { type: 5, data: { flags: 64 } });
    assert.equal(calls[1].init.method, 'PATCH');
    assert.ok(calls[1].url.endsWith('/webhooks/a/t/messages/@original'));
    assert.equal(JSON.parse(String(calls[2].init.body)).type, 9);
    assert.deepEqual(JSON.parse(String(calls[3].init.body)), { type: 8, data: { choices: [{ name: 'a', value: 'a' }] } });
  });

  test('getGuildBridge (SerikaCord extension)', async () => {
    const bridge = { platform: 'discord', enabled: true, guild_id: '1100000000000000001', links: [] };
    const { c, calls } = bot([json(200, bridge)]);
    assert.deepEqual(await c.bot.getGuildBridge('5'), bridge);
    assert.ok(calls[0].url.endsWith('/api/v10/guilds/5/bridge'));
  });

  test('createGuildBan moves a body reason to the audit-log header', async () => {
    const { c, calls } = bot([new Response(null, { status: 204 })]);
    await c.bot.createGuildBan('g', 'u', { reason: 'raid', delete_message_seconds: 60 });
    assert.equal(header(calls[0].init, 'x-audit-log-reason'), 'raid');
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { delete_message_seconds: 60 });
  });
});
