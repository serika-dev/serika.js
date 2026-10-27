// ─── Request body serialization (JSON / multipart) ──────────

import type { RawFile, FileData, EmojiResolvable } from '../types/rest.js';

function toBlob(data: FileData, contentType?: string): Blob {
  const opts = contentType ? { type: contentType } : undefined;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return contentType && !data.type ? new Blob([data], opts) : data;
  }
  if (typeof data === 'string') return new Blob([data], opts);
  if (data instanceof ArrayBuffer) return new Blob([data], opts);
  if (ArrayBuffer.isView(data)) {
    // Copy the view's bytes so Buffer pools / offsets are respected.
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return new Blob([bytes.slice()], opts);
  }
  throw new TypeError('Unsupported file data: use a Blob, ArrayBuffer, typed array / Buffer, or string');
}

/**
 * Build Discord's multipart body: `payload_json` (the JSON body, with an
 * `attachments` entry per file) plus `files[n]` parts. Existing `attachments`
 * entries in the body (e.g. `{ id }` to keep an attachment on edit) are
 * preserved; new files get ids continuing after the highest numeric id.
 */
export function buildMultipartBody(body: Record<string, unknown> | undefined, files: RawFile[]): FormData {
  const form = new FormData();
  const payload: Record<string, unknown> = { ...(body ?? {}) };
  delete payload.files;

  const existing = Array.isArray(payload.attachments) ? [...(payload.attachments as Record<string, unknown>[])] : [];
  let nextId = 0;
  for (const a of existing) {
    const n = Number(a?.id);
    if (Number.isInteger(n) && n >= nextId && n < 1000) nextId = n + 1;
  }
  const attachments = existing;

  files.forEach((file, i) => {
    const id = nextId + i;
    const key = file.key ?? `files[${id}]`;
    form.append(key, toBlob(file.data, file.contentType), file.name);
    attachments.push({ id, filename: file.name, ...(file.description ? { description: file.description } : {}) });
  });
  if (attachments.length) payload.attachments = attachments;

  form.append('payload_json', JSON.stringify(payload));
  return form;
}

/** Multipart body for routes that take plain form fields + one file (e.g. stickers). */
export function buildFormFields(fields: Record<string, string | undefined>, file?: RawFile, fileKey = 'file'): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.append(k, v);
  if (file) form.append(file.key ?? fileKey, toBlob(file.data, file.contentType), file.name);
  return form;
}

/** Build a query string from defined values (arrays become comma-separated). */
export function buildQuery(query?: Record<string, unknown>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/**
 * Encode an emoji for reaction routes: unicode emojis as-is, custom emojis as
 * `name:id`. Accepts `<:name:id>`, `<a:name:id>`, `name:id`, a bare id
 * (`:id` is not valid on Discord, so pass the name too), or an emoji object.
 */
export function encodeEmoji(emoji: EmojiResolvable): string {
  let value: string;
  if (typeof emoji === 'string') {
    const m = /^<a?:([^:<>]+):([^>]+)>$/.exec(emoji);
    value = m ? `${m[1]}:${m[2]}` : emoji.replace(/^:|:$/g, '');
  } else if (emoji.id) {
    value = `${emoji.name ?? '_'}:${emoji.id}`;
  } else if (emoji.name) {
    value = emoji.name;
  } else {
    throw new TypeError('Emoji needs an id or a name');
  }
  return encodeURIComponent(value);
}

/** Encode a single path segment (ids, tokens, codes). */
export function seg(value: string | number): string {
  return encodeURIComponent(String(value));
}
