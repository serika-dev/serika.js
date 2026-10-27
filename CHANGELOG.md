# Changelog

All notable changes to `@serikadev/serika.js`. Versions follow [semver](https://semver.org).

## 1.1.0 - 2026-10-27

Brings the SDK up to date with the SerikaCord bot API (Discord v10 parity work in SerikaCord 2.1.15+). Backwards compatible with 1.0.x; see "Migrating from 1.0.x" in the README.

### Features

- REST: 190 bot route methods, up from 73. New: replies and forwards, polls, crossposting, the paginated pins API, emoji reaction removal, threads and forum posts, thread members and archives, channel permission overwrites, invites, announcement following, guild settings (widget, onboarding, welcome screen, templates, integrations, vanity URL, prune), role positions and member counts, member search, roles and timeouts, bulk ban, stickers (upload), application emojis, soundboard (list, create, edit, delete, play), auto moderation, scheduled events, stage instances, voice states and voice channel status, guild message search, webhooks with tokens and webhook messages, guild commands and command permissions, interaction `@original` and follow-up management, current application, SKUs and entitlements.
- File uploads on messages, edits, webhooks, forum posts and interaction responses (`files`), sent as Discord multipart (`payload_json` + `files[n]`) for `attachment://` references in embeds and components v2.
- Typed models for every payload: messages (including `message_snapshots`, `poll`, `interaction_metadata`), components v1 and v2 (container, section, text display, thumbnail, media gallery, file, separator) and modal components (label, file upload, radio and checkbox groups), interactions as a discriminated union, application commands, gateway events, and enums (`ComponentType`, `ButtonStyle`, `MessageFlags`, `InteractionType`, `InteractionResponseType`, `ChannelType`, `PermissionFlags`, ...).
- `client.interactions`: `reply` (with `ephemeral`), `defer`, `deferUpdate`, `update`, `autocomplete`, `showModal`, `editReply`, `followUp` and friends, with `withResponse` for `?with_response=true`.
- Discord-compatible rate limiting: route buckets learned from `X-RateLimit-Bucket` and split by major parameter, proactive waits on exhausted buckets, global lock on global 429s, retry after `retry_after`; `onRateLimit` and `rejectOnRateLimit` options.
- Gateway: typed events (`gateway.on('MESSAGE_CREATE', ...)`), `waitForReady()`, `compress: true` (zlib-stream), resume on `resume_gateway_url`, op 7 and op 9 handling, zombie detection, fatal close codes (4004, 4010-4014) with clear errors, identify spacing (5 s per token), client-side send limit (120 / 60 s), `ping`, op 31 soundboard requests.
- `ShardManager` / `client.connectShards()` honouring `GET /gateway/bot` (shard count, `max_concurrency`, remaining session starts), with the server's guild-to-shard mapping for snowflake and UUID ids.
- All gateway intents, including `GUILD_MODERATION`, `GUILD_EXPRESSIONS`, AutoMod and poll intents, plus `PrivilegedIntents`, `NonPrivilegedIntents` and `AllIntents`.
- SerikaCord extensions: `bridged_from` on messages relayed from Discord (`getBridgedFrom`, `isBridgedMessage`) and `client.bot.getGuildBridge(guildId)`.
- Id helpers for both id formats (snowflake and legacy UUID): `idFormat`, `snowflakeTimestamp`, `compareIds`, `idsEqual`, `shardForGuild`; permission helpers (`hasPermission`, `permissionNames`, `permissionsFromLegacy` / `permissionsToLegacy` for UUID-format apps' bits 42-46).
- `client.cdn`: avatar, banner, icon, emoji and sticker URLs on `https://api.serika.chat/cdn-compat`, passing legacy full URLs through.
- `verifyInteractionSignature()` for HTTP interaction endpoints (Ed25519, WebCrypto).
- `HTTPError` now has `code`, `errors`, `method`, `path` and `flattenErrors()`.
- Audit log reasons (`{ reason }` → `X-Audit-Log-Reason`) on moderation and guild-editing methods.

### Bug Fixes

- Avatar and banner uploads (`client.client.uploadAvatar` / `uploadBanner`) sent `Content-Type: multipart/form-data` without a boundary, so the server could not parse them.
- Any 429 paused every route, and `retry_after` from the response body was ignored (only the whole-second `Retry-After` header was read).
- The gateway threw on Node 18-21 with the `ws` package (`WebSocket.OPEN` was undefined) and in browsers (`process` was referenced unguarded).
- The gateway never used `resume_gateway_url`, never cleared the first-heartbeat timer on disconnect, reconnected with a fresh IDENTIFY after op 7 instead of resuming, and retried immediately after op 9 instead of waiting 1-5 s.
- Close codes 4007 and 4009 now start a new session instead of attempting a resume that cannot succeed.
- `createInteractionFollowup` is typed as returning the created message; `getGuildMembers` and friends accept the full query (`after`, `before`, `around`, ...).
- The request body is no longer dropped on `DELETE` requests that need one.

### Other

- Tests: `npm test` runs a `node:test` suite (no extra dependencies) covering route normalization, the rate-limit bucket logic, the HTTP client (429, global locks, retries, multipart), gateway frame handling against a mock WebSocket (identify, heartbeat, resume, op 7/9, fatal closes, zombie detection, zlib-stream), sharding and the helpers.
- Package: `exports` gains a `default` condition and `./package.json`; `sideEffects: false`; repository metadata.

## 1.0.1 - 2026-07

- Initial public release: REST (bot + client API), gateway client.
