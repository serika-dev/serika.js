// ─── zlib-stream transport decompression ────────────────────
//
// With `?compress=zlib-stream` the gateway deflates the whole session through
// one zlib context and flushes (Z_SYNC_FLUSH) after every payload, so each
// payload ends with 00 00 FF FF. The client keeps one inflate context for the
// connection, buffers binary frames until that suffix, then inflates.
// Frames are processed strictly one at a time so output can never mix.

const SUFFIX = [0x00, 0x00, 0xff, 0xff];

/** True when a buffer ends with the Z_SYNC_FLUSH marker. */
export function endsWithFlushSuffix(buf: Uint8Array): boolean {
  if (buf.length < 4) return false;
  for (let i = 0; i < 4; i++) if (buf[buf.length - 4 + i] !== SUFFIX[i]) return false;
  return true;
}

export function toBytes(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  // `ws` may deliver fragmented messages as Buffer[].
  if (Array.isArray(data) && data.every((d) => d instanceof Uint8Array)) return concat(data as Uint8Array[]);
  return null;
}

function concat(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1) return parts[0];
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.byteLength; }
  return out;
}

interface InflateLike {
  on(event: 'data', fn: (chunk: Uint8Array) => void): unknown;
  on(event: 'error', fn: (err: Error) => void): unknown;
  write(chunk: Uint8Array): boolean;
  flush(kind: number, cb: () => void): void;
  close(): void;
}

export class ZlibStreamInflater {
  private pending: Uint8Array[] = [];
  private out: Uint8Array[] = [];
  private chain: Promise<void> = Promise.resolve();
  private closed = false;
  private readonly decoder = new TextDecoder();

  private constructor(
    private readonly inflate: InflateLike,
    private readonly syncFlush: number,
    private readonly onText: (text: string) => void,
    private readonly onError: (err: Error) => void,
  ) {
    inflate.on('data', (chunk) => { this.out.push(chunk); });
    inflate.on('error', (err) => { this.closed = true; onError(err); });
  }

  /** Create an inflater (loads `node:zlib`; works in Node.js, Bun and Deno). */
  static async create(onText: (text: string) => void, onError: (err: Error) => void): Promise<ZlibStreamInflater> {
    let zlib: typeof import('node:zlib');
    try {
      zlib = await import('node:zlib');
    } catch {
      throw new Error('compress: zlib-stream needs node:zlib (Node.js, Bun or Deno). Disable `compress` in browsers.');
    }
    const inflate = zlib.createInflate({ chunkSize: 128 * 1024 }) as unknown as InflateLike;
    return new ZlibStreamInflater(inflate, zlib.constants.Z_SYNC_FLUSH, onText, onError);
  }

  /** Feed one binary WebSocket message. */
  push(data: Uint8Array): void {
    if (this.closed) return;
    this.pending.push(data);
    if (!endsWithFlushSuffix(data)) return;
    const frame = concat(this.pending);
    this.pending = [];
    this.chain = this.chain.then(() => this.inflateFrame(frame)).catch((err) => this.onError(err as Error));
  }

  private inflateFrame(frame: Uint8Array): Promise<void> {
    return new Promise((resolve) => {
      if (this.closed) return resolve();
      this.inflate.write(frame);
      this.inflate.flush(this.syncFlush, () => {
        const bytes = concat(this.out.splice(0));
        if (bytes.byteLength > 0 && !this.closed) {
          try { this.onText(this.decoder.decode(bytes)); } catch (err) { this.onError(err as Error); }
        }
        resolve();
      });
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.pending = [];
    try { this.inflate.close(); } catch { /* already closed */ }
  }
}
