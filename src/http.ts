import type { APIError, SerikaClientError } from './types.js';

// ─── Optimized HTTP Client ──────────────────────────────────
// Uses a simple semaphore for concurrency control, automatic retry
// on 429/5xx with exponential backoff + jitter, and keep-alive
// connection reuse via the global fetch agent (Node 18+ keeps
// connections alive by default when using the same host).

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

interface RequestOptions {
  method: string;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Override timeout for this request */
  timeout?: number;
  /** Skip JSON parsing (return raw Response) */
  raw?: boolean;
}

export class HTTPClient {
  private readonly baseURL: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeout: number;
  private readonly maxConcurrency: number;
  private readonly retries: number;
  private readonly fetchFn: typeof fetch;
  private activeCount = 0;
  private queue: PendingRequest<unknown>[] = [];
  private globalRateLimitedUntil = 0;

  constructor(opts: {
    baseURL: string;
    token?: string;
    authToken?: string;
    timeout?: number;
    maxConcurrency?: number;
    retries?: number;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
  }) {
    this.baseURL = opts.baseURL.replace(/\/$/, '');
    this.timeout = opts.timeout ?? 15000;
    this.maxConcurrency = opts.maxConcurrency ?? 10;
    this.retries = opts.retries ?? 3;
    this.fetchFn = opts.fetch ?? globalThis.fetch;

    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...opts.headers,
    };

    if (opts.token) {
      this.defaultHeaders['Authorization'] = `Bot ${opts.token}`;
    } else if (opts.authToken) {
      this.defaultHeaders['Authorization'] = `Bearer ${opts.authToken}`;
    }
  }

  // ── Semaphore: enqueue if at capacity ───────────────────
  private acquire(): Promise<void> {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push({ resolve: resolve as (value: unknown) => void, reject: () => {} });
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next.resolve(undefined);
    } else {
      this.activeCount--;
    }
  }

  // ── Build URL with query params ─────────────────────────
  private buildURL(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseURL}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  // ── Sleep with jitter ───────────────────────────────────
  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ── Core request ────────────────────────────────────────
  async request<T>(opts: RequestOptions): Promise<T> {
    await this.acquire();
    try {
      return await this.doRequestWithRetry<T>(opts);
    } finally {
      this.release();
    }
  }

  private async doRequestWithRetry<T>(opts: RequestOptions): Promise<T> {
    const maxRetries = this.retries;
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Respect global rate limit
      const now = Date.now();
      if (this.globalRateLimitedUntil > now) {
        await this.sleep(this.globalRateLimitedUntil - now);
      }

      try {
        const result = await this.doRequest<T>(opts);
        return result;
      } catch (err) {
        lastError = err as Error;

        // Don't retry on 4xx (except 429)
        if (err instanceof HTTPError) {
          if (err.status === 429) {
            // Rate limited — respect Retry-After header
            const retryAfter = err.retryAfter ?? 1000;
            this.globalRateLimitedUntil = Date.now() + retryAfter;
            continue;
          }
          if (err.status >= 400 && err.status < 500) {
            throw err;
          }
        }

        // Retry on 5xx or network errors
        if (attempt < maxRetries) {
          const backoff = Math.min(1000 * 2 ** attempt, 8000);
          const jitter = Math.random() * 500;
          await this.sleep(backoff + jitter);
          continue;
        }
      }
    }

    throw lastError;
  }

  private async doRequest<T>(opts: RequestOptions): Promise<T> {
    const url = this.buildURL(opts.path, opts.query);
    const timeout = opts.timeout ?? this.timeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...opts.headers,
    };

    const init: RequestInit = {
      method: opts.method,
      headers,
      signal: controller.signal,
    };

    if (opts.body !== undefined && opts.method !== 'GET' && opts.method !== 'DELETE') {
      init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    }

    try {
      const response = await this.fetchFn(url, init);

      if (opts.raw) {
        return response as unknown as T;
      }

      // 204 No Content
      if (response.status === 204) {
        return undefined as unknown as T;
      }

      const text = await response.text();

      if (!response.ok) {
        let errorBody: APIError | SerikaClientError;
        try {
          errorBody = text ? JSON.parse(text) : { message: response.statusText };
        } catch {
          errorBody = { code: 0, message: text || response.statusText };
        }

        const retryAfter = response.headers.get('Retry-After');
        throw new HTTPError(
          response.status,
          errorBody,
          retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
        );
      }

      // Parse JSON
      if (!text) return undefined as unknown as T;
      return JSON.parse(text) as T;
    } catch (err) {
      if (err instanceof HTTPError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new HTTPError(408, { code: 0, message: 'Request timeout' });
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ── Convenience methods ─────────────────────────────────
  get<T>(path: string, query?: Record<string, string | number | boolean | undefined>, headers?: Record<string, string>): Promise<T> {
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

// ─── HTTP Error ─────────────────────────────────────────────

export class HTTPError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: APIError | SerikaClientError,
    public readonly retryAfter?: number,
  ) {
    const message = 'message' in body ? body.message : 'Unknown error';
    super(`[${status}] ${message}`);
    this.name = 'HTTPError';
  }
}
