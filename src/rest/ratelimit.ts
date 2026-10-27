// ─── Discord-style rate-limit bookkeeping (pure, no I/O) ────
//
// SerikaCord's bot API answers every bot request with X-RateLimit-Limit /
// -Remaining / -Reset / -Reset-After / -Bucket. A bucket is shared by every
// route the server maps to the same `X-RateLimit-Bucket` hash, and is split
// per "major parameter" (channel, guild, webhook, application). GETs report
// the per-bot global bucket (`global`, 50 req/s). A 429 carries
// `{ message, retry_after (seconds), global }`, Retry-After and
// X-RateLimit-Scope / X-RateLimit-Global.
//
// This module learns route → bucket mappings from those headers, tracks the
// remaining budget per bucket, and tells the HTTP client how long to wait
// before sending. It never sleeps itself, so it is fully unit-testable.

const SNOWFLAKE = /^\d{15,21}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a path segment that is an entity id (snowflake or UUID). */
export function isIdSegment(segment: string): boolean {
  return SNOWFLAKE.test(segment) || UUID.test(segment);
}

/** Top-level resources whose first id is a Discord "major parameter". */
const MAJOR_RESOURCES = new Set(['channels', 'guilds', 'webhooks', 'applications', 'interactions']);
/** Segments that name a code/token rather than an id. */
const CODE_PARENTS = new Set(['invites', 'templates']);

export interface RouteInfo {
  /** Method + path template, e.g. `POST /channels/123/messages` (major ids kept, other ids → `:id`). */
  route: string;
  /** Major parameter value, e.g. `channels/123` (empty when none). */
  major: string;
  method: string;
  /** Path the request was made to (without the /api/v10 prefix and query). */
  path: string;
}

/** Normalize a request path (with or without `/api/v10` and a query) into its rate-limit route. */
export function parseRoute(method: string, rawPath: string): RouteInfo {
  const m = method.toUpperCase();
  const path = rawPath.split('?')[0].replace(/^\/api(?=\/)/, '').replace(/^\/v\d+(?=\/|$)/, '') || '/';
  const segs = path.split('/').filter(Boolean);
  const out: string[] = [];
  let major = '';

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const prev = segs[i - 1];
    if (i === 1 && MAJOR_RESOURCES.has(segs[0])) {
      // First id after a major resource is kept: it splits the bucket.
      major = `${segs[0]}/${seg}`;
      out.push(seg);
      continue;
    }
    if (i === 2 && (segs[0] === 'webhooks' || segs[0] === 'interactions') && seg !== 'messages') {
      // Webhook / interaction tokens: part of the major parameter, hidden in the route.
      major += `/${seg}`;
      out.push(':token');
      continue;
    }
    if (prev === 'reactions') {
      // Every emoji (and the user segment after it) shares one bucket.
      out.push(':reaction');
      if (i + 1 < segs.length) { out.push(':user'); i++; }
      continue;
    }
    if (prev && CODE_PARENTS.has(prev) && !isIdSegment(seg)) { out.push(':code'); continue; }
    if (prev === 'answers' && /^\d+$/.test(seg)) { out.push(':id'); continue; }
    out.push(isIdSegment(seg) ? ':id' : seg);
  }

  return { route: `${m} /${out.join('/')}`, major, method: m, path };
}

export interface BucketState {
  limit: number;
  remaining: number;
  /** Epoch ms when the bucket refills. */
  resetAt: number;
}

export interface RateLimitInfo {
  method: string;
  path: string;
  route: string;
  major: string;
  /** Server bucket hash, when known. */
  bucket: string | null;
  global: boolean;
  limit: number;
  /** Milliseconds until the request may be sent. */
  timeToReset: number;
  /** True when this came from a 429 response (false = proactive wait). */
  fromResponse: boolean;
}

export interface Acquisition {
  /** Milliseconds to wait before trying again (0 = go). */
  wait: number;
  global: boolean;
  key: string;
}

type HeaderGetter = { get(name: string): string | null };

function num(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export class RateLimitManager {
  /** route → server bucket hash (learned from X-RateLimit-Bucket). */
  private readonly routeBuckets = new Map<string, string>();
  private readonly buckets = new Map<string, BucketState>();
  /** Epoch ms until which every request waits (global 429). */
  globalResetAt = 0;

  constructor(private readonly now: () => number = Date.now) {}

  /** Bucket state key for a route: the learned bucket hash (or the route) + major parameter. */
  keyFor(info: RouteInfo): string {
    const hash = this.routeBuckets.get(info.route);
    if (hash === 'global') return 'global';
    return `${hash ?? info.route}|${info.major}`;
  }

  bucketHash(info: RouteInfo): string | null {
    return this.routeBuckets.get(info.route) ?? null;
  }

  getBucket(key: string): BucketState | undefined {
    return this.buckets.get(key);
  }

  /**
   * Try to reserve a slot for a request. Returns wait=0 (and consumes one
   * `remaining`) when the request may go now, else how long to wait.
   */
  acquire(info: RouteInfo): Acquisition {
    const now = this.now();
    const key = this.keyFor(info);
    if (this.globalResetAt > now) return { wait: this.globalResetAt - now, global: true, key };
    const b = this.buckets.get(key);
    if (b) {
      if (b.resetAt <= now) {
        b.remaining = b.limit;
        b.resetAt = now;
      }
      if (b.remaining <= 0 && b.resetAt > now) return { wait: b.resetAt - now, global: key === 'global', key };
      b.remaining--;
    }
    return { wait: 0, global: false, key };
  }

  /** Learn from a response's X-RateLimit-* headers. */
  update(info: RouteInfo, headers: HeaderGetter): void {
    const now = this.now();
    const hash = headers.get('x-ratelimit-bucket');
    if (hash) this.routeBuckets.set(info.route, hash);
    const limit = num(headers.get('x-ratelimit-limit'));
    const remaining = num(headers.get('x-ratelimit-remaining'));
    const resetAfter = num(headers.get('x-ratelimit-reset-after'));
    const reset = num(headers.get('x-ratelimit-reset'));
    if (limit === null || remaining === null) return;
    const resetAt = resetAfter !== null ? now + resetAfter * 1000 : reset !== null ? reset * 1000 : now + 1000;
    this.buckets.set(this.keyFor(info), { limit, remaining, resetAt });
  }

  /**
   * Record a 429. Returns how long to wait (ms) and whether it was global.
   * `body` is the parsed JSON body (may be undefined).
   */
  onRateLimited(info: RouteInfo, headers: HeaderGetter, body?: unknown): { retryAfter: number; global: boolean } {
    const now = this.now();
    this.update(info, headers);
    const b = (body && typeof body === 'object' ? body : {}) as { retry_after?: unknown; global?: unknown; retryAfter?: unknown };
    let retrySeconds = typeof b.retry_after === 'number' ? b.retry_after : null;
    if (retrySeconds === null && typeof b.retryAfter === 'number') retrySeconds = b.retryAfter; // client API shape
    if (retrySeconds === null) retrySeconds = num(headers.get('retry-after'));
    if (retrySeconds === null) retrySeconds = num(headers.get('x-ratelimit-reset-after'));
    const retryAfter = Math.max(0, Math.ceil((retrySeconds ?? 1) * 1000));
    const global = b.global === true
      || headers.get('x-ratelimit-global') === 'true'
      || headers.get('x-ratelimit-scope') === 'global';
    if (global) {
      this.globalResetAt = Math.max(this.globalResetAt, now + retryAfter);
    } else {
      const key = this.keyFor(info);
      const prev = this.buckets.get(key);
      this.buckets.set(key, { limit: prev?.limit ?? 1, remaining: 0, resetAt: now + retryAfter });
    }
    return { retryAfter, global };
  }

  /** Forget everything (e.g. after a token change). */
  clear(): void {
    this.routeBuckets.clear();
    this.buckets.clear();
    this.globalResetAt = 0;
  }
}
