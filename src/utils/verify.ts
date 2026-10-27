// ─── HTTP interactions endpoint: Ed25519 request verification ─
//
// When an application sets an Interactions Endpoint URL, SerikaCord POSTs
// interactions to it signed like Discord: header `X-Signature-Ed25519` is
// the hex signature of `X-Signature-Timestamp + rawBody`, verifiable with the
// application's public key (hex, Developer Portal → General Information).
// Answer PING (type 1) with `{ type: 1 }`.

function hexToBytes(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) throw new TypeError('Invalid hex string');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

type Subtle = typeof globalThis.crypto.subtle;
type Key = Awaited<ReturnType<Subtle['importKey']>>;

async function subtle(): Promise<Subtle> {
  if (globalThis.crypto?.subtle) return globalThis.crypto.subtle;
  // Node 18 has WebCrypto but not as a global.
  const mod = await import('node:crypto');
  return (mod.webcrypto as unknown as typeof globalThis.crypto).subtle;
}

const keyCache = new Map<string, Promise<Key>>();

function importKey(publicKeyHex: string): Promise<Key> {
  let k = keyCache.get(publicKeyHex);
  if (!k) {
    k = subtle().then((s) => s.importKey('raw', hexToBytes(publicKeyHex), { name: 'Ed25519' }, false, ['verify']));
    k.catch(() => keyCache.delete(publicKeyHex));
    keyCache.set(publicKeyHex, k);
  }
  return k;
}

/**
 * Verify a signed interaction request. `body` must be the raw request body
 * (string or bytes) exactly as received. Returns false for any malformed input.
 * Uses WebCrypto Ed25519 (Node 18.4+ / 20+, Bun, Deno, Cloudflare Workers).
 */
export async function verifyInteractionSignature(
  body: string | Uint8Array | ArrayBuffer,
  signature: string | null | undefined,
  timestamp: string | null | undefined,
  publicKeyHex: string,
): Promise<boolean> {
  if (!signature || !timestamp || !publicKeyHex) return false;
  try {
    const enc = new TextEncoder();
    const bodyBytes = typeof body === 'string' ? enc.encode(body) : body instanceof ArrayBuffer ? new Uint8Array(body) : body;
    const ts = enc.encode(timestamp);
    const message = new Uint8Array(ts.length + bodyBytes.length);
    message.set(ts, 0);
    message.set(bodyBytes, ts.length);
    const key = await importKey(publicKeyHex);
    return await (await subtle()).verify({ name: 'Ed25519' }, key, hexToBytes(signature), message);
  } catch {
    return false;
  }
}
