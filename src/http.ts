import type { APIError, APIFormErrors, SerikaClientError, RawFile } from './types.js';
import { RateLimitManager, parseRoute, type RateLimitInfo, type RouteInfo } from './rest/ratelimit.js';
import { buildMultipartBody, buildQuery } from './rest/multipart.js';
import { VERSION } from './version.js';

// ─── HTTP client ────────────────────────────────────────────
// - Discord-style rate limits: buckets learned from X-RateLimit-* headers,
//   proactive waits when a bucket is empty, global lock on global 429s,
//   retry after `retry_after` on any 429.
// - A concurrency cap (semaphore) on in-flight requests.
// - Retries with exponential backoff + jitter on 5xx and network errors.
// - JSON bodies, or Discord multipart (payload_json + files[n]) when files
//   are attached; X-Audit-Log-Reason support.

export type QueryValue = string | number | boolean | undefined | null | readonly (string | number)[];
export type Query = Record<string, QueryValue>;

export interface HTTPRequestOptions {
  method: string;
  path: string;
  query?: Query | object;
  body?: unknown;
  /** Files to send as multipart/form-data (with the body as payload_json). */
  files?: RawFile[];
  headers?: Record<string, string>;
  /** Audit log reason (X-Audit-Log-Reason). */
  reason?: string;
  /** Override the timeout for this request. */
  timeout?: number;
  /** Return the raw Response (no JSON parsing, no error throwing). */
  raw?: boolean;
  /** Don't send the Authorization header (webhook / interaction token routes). */
  auth?: boolean;
  signal?: AbortSignal;
}

export interface HTTPClientOptions {
  baseURL: string;
  token?: string;
  authToken?: string;
  timeout?: number;
  maxConcurrency?: number;
  retries?: number;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  onRateLimit?: (info: RateLimitInfo) => void;
  rejectOnRateLimit?: boolean | ((info: RateLimitInfo) => boolean);
  /** Injected clock / sleeper (tests). */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const USER_AGENT = `SerikaBot (https://github.com/serika-dev/serika.js, ${VERSION})`;

export class HTTPClient {
  private readonly baseURL: string;
  private readonly defaultHeaders: Record<string, string>;
  private authorization: string | null = null;
  private readonly timeout: number;
  private readonly maxConcurrency: number;
  private readonly retries: number;
  private readonly fetchFn: typeof fetch;
  private readonly onRateLimit?: (info: RateLimitInfo) => void;
  private readonly rejectOnRateLimit?: boolean | ((info: RateLimitInfo) => boolean);
  private readonly now: () => number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private activeCount = 0;
  private queue: (() => void)[] = [];
  readonly rateLimits: RateLimitManager;

  constructor(opts: HTTPClientOptions) {
    this.baseURL = opts.baseURL.replace(/\/+$/, '');
    this.timeout = opts.timeout ?? 15000;
    this.maxConcurrency = Math.max(1, opts.maxConcurrency ?? 10);
    this.retries = opts.retries ?? 3;
    this.fetchFn = opts.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
    this.onRateLimit = opts.onRateLimit;
    this.rejectOnRateLimit = opts.rejectOnRateLimit;
    this.now = opts.now ?? Date.now;
    this.sleepFn = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.rateLimits = new RateLimitManager(this.now);

    this.defaultHeaders = { ...opts.headers };
    if (typeof process !== 'undefined' && process.versions?.node && !('User-Agent' in this.defaultHeaders)) {
      // Browsers forbid setting User-Agent; servers get a Discord-style one.
      this.defaultHeaders['User-Agent'] = USER_AGENT;
    }
    if (opts.token) this.setToken(opts.token);
    else if (opts.authToken) this.setAuthToken(opts.authToken);
  }

  /** Use a bot token (`Authorization: Bot <token>`). */
  setToken(token: string | null): this {
    this.authorization = token ? `Bot ${token.replace(/^Bot\s+/i, '')}` : null;
    this.rateLimits.clear();
    return this;
  }

  /** Use a bearer token (`Authorization: Bearer <token>`). */
  setAuthToken(token: string | null): this {
    this.authorization = token ? `Bearer ${token.replace(/^Bearer\s+/i, '')}` : null;
    this.rateLimits.clear();
    return this;
  }

  /** The bot token in use, if any (without the "Bot " prefix). */
  get botToken(): string | null {
    return this.authorization?.startsWith('Bot ') ? this.authorization.slice(4) : null;
  }

  // ── Semaphore ───────────────────────────────────────────
  private acquire(): Promise<void> {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) next();
    else this.activeCount--;
  }

  private buildURL(path: string, query?: Query | object): string {
    return `${this.baseURL}${path}${buildQuery(query as Record<string, unknown> | undefined)}`;
  }

  // ── Core request ────────────────────────────────────────
  request<T>(opts: HTTPRequestOptions): Promise<T> {
    return this.requestWithRetry<T>(opts);
  }

  /** Send under the concurrency cap (rate-limit waits happen outside it, so one busy bucket never blocks others). */
  private async sendLimited(opts: HTTPRequestOptions): Promise<Response> {
    await this.acquire();
    try {
      return await this.send(opts);
    } finally {
      this.release();
    }
  }

  private info(route: RouteInfo, wait: number, global: boolean, fromResponse: boolean): RateLimitInfo {
    const key = this.rateLimits.keyFor(route);
    return {
      method: route.method,
      path: route.path,
      route: route.route,
      major: route.major,
      bucket: this.rateLimits.bucketHash(route),
      global,
      limit: this.rateLimits.getBucket(key)?.limit ?? 0,
      timeToReset: wait,
      fromResponse,
    };
  }

  private shouldReject(info: RateLimitInfo): boolean {
    const r = this.rejectOnRateLimit;
    return typeof r === 'function' ? r(info) : r === true;
  }

  private async waitForBucket(route: RouteInfo): Promise<void> {
    for (;;) {
      const a = this.rateLimits.acquire(route);
      if (a.wait <= 0) return;
      const info = this.info(route, a.wait, a.global, false);
      this.onRateLimit?.(info);
      if (this.shouldReject(info)) {
        throw new HTTPError(429, { code: 0, message: 'You are being rate limited (client-side).' }, a.wait, {
          method: route.method, path: route.path,
        });
      }
      await this.sleepFn(a.wait);
    }
  }

  private async requestWithRetry<T>(opts: HTTPRequestOptions): Promise<T> {
    const route = parseRoute(opts.method, opts.path);
    let serverErrors = 0;
    let rateLimitHits = 0;

    for (;;) {
      await this.waitForBucket(route);
      let response: Response;
      try {
        response = await this.sendLimited(opts);
      } catch (err) {
        if (err instanceof HTTPError && err.status !== 408) throw err;
        if (serverErrors < this.retries && !opts.signal?.aborted) {
          await this.sleepFn(this.backoff(serverErrors++));
          continue;
        }
        throw err;
      }

      this.rateLimits.update(route, response.headers);
      if (opts.raw) return response as unknown as T;

      if (response.status === 429) {
        const body = await readBody(response);
        const { retryAfter, global } = this.rateLimits.onRateLimited(route, response.headers, body);
        const info = this.info(route, retryAfter, global, true);
        this.onRateLimit?.(info);
        if (rateLimitHits++ >= this.retries || this.shouldReject(info)) {
          throw HTTPError.from(response, body, opts, retryAfter);
        }
        // Loop: waitForBucket sleeps until the bucket / global lock resets.
        continue;
      }

      if (response.status >= 500 && serverErrors < this.retries) {
        await response.body?.cancel().catch(() => {});
        await this.sleepFn(this.backoff(serverErrors++));
        continue;
      }

      if (response.status === 204) return undefined as T;
      const body = await readBody(response);
      if (!response.ok) throw HTTPError.from(response, body, opts);
      return body as T;
    }
  }

  private backoff(attempt: number): number {
    return Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 500;
  }

  private async send(opts: HTTPRequestOptions): Promise<Response> {
    const url = this.buildURL(opts.path, opts.query);
    const timeout = opts.timeout ?? this.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    const headers: Record<string, string> = { ...this.defaultHeaders, ...opts.headers };
    if (opts.auth !== false && this.authorization && !hasHeader(headers, 'authorization')) {
      headers['Authorization'] = this.authorization;
    }
    if (opts.reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(opts.reason);

    let body: RequestInit['body'] | undefined;
    if (opts.files && opts.files.length > 0) {
      body = buildMultipartBody(opts.body as Record<string, unknown> | undefined, opts.files);
      deleteHeader(headers, 'content-type'); // fetch sets the multipart boundary
    } else if (opts.body instanceof FormData) {
      body = opts.body;
      deleteHeader(headers, 'content-type');
    } else if (opts.body !== undefined && opts.method !== 'GET' && opts.method !== 'HEAD') {
      body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
      if (!hasHeader(headers, 'content-type')) headers['Content-Type'] = 'application/json';
    }

    try {
      return await this.fetchFn(url, { method: opts.method, headers, body, signal: controller.signal });
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new HTTPError(408, { code: 0, message: 'Request timeout' }, undefined, { method: opts.method, path: opts.path });
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      opts.signal?.removeEventListener('abort', onAbort);
    }
  }

  // ── Convenience methods ─────────────────────────────────
  get<T>(path: string, query?: Query | object, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'GET', path, query, headers });
  }

  post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'POST', path, body, headers });
  }

  put<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'PUT', path, body, headers });
  }

  patch<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'PATCH', path, body, headers });
  }

  delete<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'DELETE', path, headers });
  }
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.keys(headers).some((k) => k.toLowerCase() === name);
}

function deleteHeader(headers: Record<string, string>, name: string): void {
  for (const k of Object.keys(headers)) if (k.toLowerCase() === name) delete headers[k];
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ─── HTTP Error ─────────────────────────────────────────────

export class HTTPError extends Error {
  /** Discord JSON error code (e.g. 10003 Unknown Channel, 50013 Missing Permissions), 0 when none. */
  readonly code: number;
  /** Nested form errors for code 50035 (Invalid Form Body). */
  readonly errors?: APIFormErrors;
  readonly method?: string;
  readonly path?: string;

  constructor(
    public readonly status: number,
    public readonly body: APIError | SerikaClientError,
    /** Milliseconds until the rate limit resets (429 only). */
    public readonly retryAfter?: number,
    request?: { method?: string; path?: string },
  ) {
    const b = body as Partial<APIError> & Partial<SerikaClientError>;
    const message = b.message ?? b.error ?? 'Unknown error';
    super(`[${status}] ${message}${typeof b.code === 'number' && b.code ? ` (code ${b.code})` : ''}`);
    this.name = 'HTTPError';
    this.code = typeof b.code === 'number' ? b.code : 0;
    this.errors = b.errors;
    this.method = request?.method;
    this.path = request?.path;
  }

  static from(response: Response, body: unknown, req: { method?: string; path?: string }, retryAfter?: number): HTTPError {
    let errorBody: APIError | SerikaClientError;
    if (body && typeof body === 'object') errorBody = body as APIError;
    else errorBody = { code: 0, message: (typeof body === 'string' && body) || response.statusText || 'Unknown error' };
    return new HTTPError(response.status, errorBody, retryAfter, req);
  }

  /** Flattened form errors: `[{ path: 'embeds.0.title', code, message }]`. */
  flattenErrors(): { path: string; code: string; message: string }[] {
    const out: { path: string; code: string; message: string }[] = [];
    const walk = (node: unknown, path: string[]) => {
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === '_errors' && Array.isArray(v)) {
          for (const e of v as { code: string; message: string }[]) out.push({ path: path.join('.'), code: e.code, message: e.message });
        } else {
          walk(v, [...path, k]);
        }
      }
    };
    walk(this.errors, []);
    return out;
  }
}
