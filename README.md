# serika.js

TypeScript SDK for [SerikaCord](https://serika.chat): the Discord API v10-compatible bot API (REST + gateway) plus the SerikaCord client API.

- **Full bot REST coverage**: messages (files, replies, forwards, polls, components v1 and v2), reactions, pins, threads and forums, guilds, channels, roles, members, bans, emojis, stickers, soundboard, invites, webhooks, application commands, interactions, audit logs, auto moderation, scheduled events, stage instances, voice states, templates, onboarding, and the SerikaCord bridge info.
- **Discord-style rate limits**: per-bucket tracking from `X-RateLimit-*` headers, proactive waits, global lock, automatic retry after `retry_after`.
- **Resilient gateway**: identify/resume, `resume_gateway_url`, zombie detection, op 7/op 9 handling, fatal close codes, `zlib-stream` compression, client-side send limit, typed events.
- **Sharding** that honours `GET /gateway/bot` (shard count and `max_concurrency`).
- **Interaction helpers**: `reply`, `defer`, `update`, `showModal`, `autocomplete`, `editReply`, `followUp`, plus Ed25519 verification for HTTP endpoints.
- **Both id formats**: snowflakes (new apps) and legacy UUIDs work everywhere; helpers for timestamps, sorting, sharding and CDN URLs.
- **Typed** models for every payload, ESM, zero runtime dependencies (Node 22+, Bun, Deno, browsers; optional `ws` for Node 18-21).

## Install

```bash
npm install @serikadev/serika.js
# Node 18-21 also needs a WebSocket implementation for the gateway:
npm install ws
# or
bun add @serikadev/serika.js
```

Create an application and bot in the [Developer Portal](https://serika.chat/developers/applications) and copy the bot token.

## Quick start: slash command + button

```ts
import {
  SerikaClient, Intents, InteractionType, ComponentType, ButtonStyle, ApplicationCommandOptionType,
} from '@serikadev/serika.js';

const client = new SerikaClient({ token: process.env.SERIKA_BOT_TOKEN });

const gateway = await client.connectGateway({
  intents: Intents.GUILDS | Intents.GUILD_MESSAGES,
  waitForReady: true,
});
const appId = gateway.readyData!.application.id;

// Register a global slash command (replaces the whole command list).
await client.bot.bulkOverwriteGlobalCommands(appId, [
  {
    name: 'ping',
    description: 'Replies with pong and a button',
    options: [{ type: ApplicationCommandOptionType.String, name: 'note', description: 'Optional note' }],
  },
]);

gateway.on('INTERACTION_CREATE', async (interaction) => {
  // Slash command
  if (interaction.type === InteractionType.ApplicationCommand && interaction.data.name === 'ping') {
    const note = interaction.data.options?.find((o) => o.name === 'note')?.value;
    await client.interactions.reply(interaction, {
      content: `Pong!${note ? ` (${note})` : ''}`,
      components: [{
        type: ComponentType.ActionRow,
        components: [{ type: ComponentType.Button, style: ButtonStyle.Primary, custom_id: 'again', label: 'Again' }],
      }],
    });
  }

  // Button click
  if (interaction.type === InteractionType.MessageComponent && interaction.data.custom_id === 'again') {
    const user = interaction.member?.user ?? interaction.user;
    await client.interactions.update(interaction, { content: `Pong again, ${user?.username}!` });
  }
});

gateway.on('MESSAGE_CREATE', async (message) => {
  if (message.author.bot) return;
  if (message.content === '!hello') await client.bot.reply(message.channel_id, message.id, 'Hello!');
});
```

Reading `message.content` in servers needs the privileged `MESSAGE_CONTENT` intent (see below); slash commands and buttons don't.

### Interaction responses

Answer within 3 seconds. If you need longer, `defer` first and finish with `editReply`. Tokens stay valid for follow-ups for 15 minutes.

| Helper | Callback type |
|---|---|
| `client.interactions.reply(i, data)` (`ephemeral: true` for invoker-only) | 4 `ChannelMessageWithSource` |
| `client.interactions.defer(i, { ephemeral })` | 5 `DeferredChannelMessageWithSource` |
| `client.interactions.deferUpdate(i)` | 6 `DeferredUpdateMessage` |
| `client.interactions.update(i, data)` | 7 `UpdateMessage` |
| `client.interactions.autocomplete(i, choices)` | 8 `ApplicationCommandAutocompleteResult` |
| `client.interactions.showModal(i, modal)` | 9 `Modal` |
| `editReply`, `getReply`, `deleteReply`, `followUp`, `editFollowUp`, `deleteFollowUp` | webhook routes |

Pass `withResponse: true` to `reply` / `update` / `defer` to get the created message back (`?with_response=true`). The low-level `client.bot.createInteractionResponse(id, token, body)` is still there.

## Gateway

```ts
const gateway = await client.connectGateway({
  intents: Intents.GUILDS | Intents.GUILD_MESSAGES | Intents.MESSAGE_CONTENT,
  compress: true,                 // zlib-stream (Node.js, Bun, Deno)
  presence: { status: 'online', activities: [{ name: 'with serika.js', type: 0 }] },
  waitForReady: true,             // resolve after READY instead of on socket open
});

gateway.on('MESSAGE_CREATE', (message, shardId) => { /* typed GatewayMessageCreateData */ });
gateway.on('GUILD_CREATE', (guild) => { /* channels, members, roles, voice_states, ... */ });
gateway.on('dispatch', (event, data, seq) => { /* every event, raw */ });
gateway.on('ready', (ready) => {});
gateway.on('resumed', () => {});
gateway.on('reconnecting', (attempt, delayMs) => {});
gateway.on('close', (code, reason) => {});
gateway.on('error', (err) => {});

gateway.sendPresenceUpdate({ status: 'dnd', activities: [] });
gateway.requestGuildMembers({ guild_id, query: '', limit: 0 }); // → GUILD_MEMBERS_CHUNK
gateway.ping;          // heartbeat round trip in ms
gateway.disconnect();  // ends the session (close 1000)
```

What the client handles for you:

- `?v=10&encoding=json` (and `&compress=zlib-stream`) on the URL; JSON only (SerikaCord has no ETF).
- Heartbeats at the `heartbeat_interval` from HELLO (41 250 ms) with a jittered first beat; an unanswered heartbeat closes the zombie socket and resumes.
- RESUME on `resume_gateway_url` after drops, op 7 RECONNECT and resumable op 9. A non-resumable op 9 or close 4007/4009 re-identifies.
- Fatal closes stop reconnecting and reject `waitForReady()`: 4004 (bad token), 4010/4011 (shard), 4012 (version), 4013 (invalid intents), 4014 (disallowed intents).
- Identifies are spaced 5 s apart per token (the server's limit), and outgoing payloads stay under 120 per minute (close 4008).
- The 1.0 handler API (`onDispatch`, `onReady`, `onError`, `onClose`) still works.

### Intents

| Intent | Bit | Events |
|---|---|---|
| `GUILDS` | 0 | GUILD_CREATE/UPDATE/DELETE, roles, channels, threads |
| `GUILD_MEMBERS` (privileged) | 1 | GUILD_MEMBER_ADD/UPDATE/REMOVE, THREAD_MEMBERS_UPDATE |
| `GUILD_MODERATION` | 2 | GUILD_BAN_ADD/REMOVE, GUILD_AUDIT_LOG_ENTRY_CREATE |
| `GUILD_EXPRESSIONS` | 3 | GUILD_EMOJIS_UPDATE, GUILD_STICKERS_UPDATE |
| `GUILD_INTEGRATIONS` | 4 | GUILD_INTEGRATIONS_UPDATE, INTEGRATION_DELETE |
| `GUILD_WEBHOOKS` | 5 | WEBHOOKS_UPDATE |
| `GUILD_INVITES` | 6 | INVITE_CREATE/DELETE |
| `GUILD_VOICE_STATES` | 7 | VOICE_STATE_UPDATE |
| `GUILD_PRESENCES` (privileged) | 8 | PRESENCE_UPDATE |
| `GUILD_MESSAGES` | 9 | MESSAGE_CREATE/UPDATE/DELETE(_BULK) in servers |
| `GUILD_MESSAGE_REACTIONS` | 10 | MESSAGE_REACTION_* in servers |
| `GUILD_MESSAGE_TYPING` | 11 | TYPING_START in servers |
| `DIRECT_MESSAGES` | 12 | messages in DMs |
| `DIRECT_MESSAGE_REACTIONS` | 13 | reactions in DMs |
| `DIRECT_MESSAGE_TYPING` | 14 | typing in DMs |
| `MESSAGE_CONTENT` (privileged) | 15 | content/embeds/attachments/components of other people's server messages |
| `GUILD_SCHEDULED_EVENTS` | 16 | GUILD_SCHEDULED_EVENT_* |
| `AUTO_MODERATION_CONFIGURATION` | 20 | AUTO_MODERATION_RULE_* |
| `AUTO_MODERATION_EXECUTION` | 21 | AUTO_MODERATION_ACTION_EXECUTION |
| `GUILD_MESSAGE_POLLS` | 24 | MESSAGE_POLL_VOTE_* in servers |
| `DIRECT_MESSAGE_POLLS` | 25 | MESSAGE_POLL_VOTE_* in DMs |

`PrivilegedIntents`, `NonPrivilegedIntents` and `AllIntents` are exported too. Enable privileged intents in the Developer Portal (your app → Bot) first, or the gateway closes with 4014. Without `MESSAGE_CONTENT`, server messages arrive with empty content except DMs, messages that mention the bot, and the bot's own.

INTERACTION_CREATE needs no intent. Bots can't send or receive voice audio yet (SerikaCord voice is peer-to-peer), but they see voice states.

### Sharding

```ts
const shards = await client.connectShards({ intents: Intents.GUILDS, totalShards: 'auto' });
shards.on('ready', (ready, shardId) => console.log(`shard ${shardId} ready`));
await shards.waitForReady();
shards.shardForGuild(guildId)?.requestGuildMembers({ guild_id: guildId, limit: 0 });
```

`'auto'` uses `shards` and `session_start_limit.max_concurrency` from `GET /gateway/bot`. Run a subset per process with `shardIds: [0, 1]` and a fixed `totalShards`. Guilds map to shards exactly like the server does: `(guild_id >> 22) % shards` for snowflakes, a stable hash for legacy UUID ids (`shardForGuild()`).

## Messages, files and components v2

```ts
import { ComponentType, ButtonStyle, MessageFlags, SeparatorSpacing } from '@serikadev/serika.js';

await client.bot.createMessage(channelId, {
  flags: MessageFlags.IsComponentsV2, // no content/embeds; up to 40 components
  components: [{
    type: ComponentType.Container,
    accent_color: 0xff66aa,
    components: [
      { type: ComponentType.TextDisplay, content: '## Weekly report' },
      {
        type: ComponentType.Section,
        components: [{ type: ComponentType.TextDisplay, content: '42 new members this week.' }],
        accessory: { type: ComponentType.Thumbnail, media: { url: 'attachment://chart.png' } },
      },
      { type: ComponentType.Separator, divider: true, spacing: SeparatorSpacing.Small },
      { type: ComponentType.MediaGallery, items: [{ media: { url: 'attachment://chart.png' }, description: 'Chart' }] },
      {
        type: ComponentType.ActionRow,
        components: [{ type: ComponentType.Button, style: ButtonStyle.Link, url: 'https://serika.chat', label: 'Open' }],
      },
    ],
  }],
  files: [{ name: 'chart.png', data: pngBytes, contentType: 'image/png' }],
});
```

- `files` (Blob, ArrayBuffer, typed array / Buffer, or string) switch the request to `multipart/form-data` with `payload_json` + `files[n]`; reference them as `attachment://<name>`. Works on `createMessage`, `editMessage`, `executeWebhook`, `startForumThread`, interaction replies and follow-ups.
- Replies and forwards: `client.bot.reply(channelId, messageId, 'text')`, `client.bot.forwardMessage(targetChannelId, sourceChannelId, messageId)`.
- Polls: `createMessage(channelId, { poll: { question: { text: 'Lunch?' }, answers: [{ poll_media: { text: 'Pizza' } }], duration: 24 } })`, then `getPollAnswerVoters` / `endPoll`.
- Reactions take `'👍'`, `'name:id'`, `'<:name:id>'` or `{ id, name }`.
- Modals use Label (18) wrappers around text inputs, selects, radio/checkbox groups and file uploads, or legacy action rows of text inputs.

## Bridged servers

A SerikaCord server can be bridged to a Discord server: Discord messages are relayed into the linked SerikaCord channel and the other way round. If your bot runs on both platforms and is in both servers, it would see a Discord user's message twice. Two SerikaCord extensions let it handle each message once:

- Messages relayed in from Discord carry `bridged_from` with the Discord guild, channel and message ids and the Discord author (`getBridgedFrom(message)` / `isBridgedMessage(message)`).
- `client.bot.getGuildBridge(guildId)` lists the bridged channels your bot can see: SerikaCord channel id, Discord channel id, and whether each direction (`inbound`, `outbound`) and bot relaying (`include_bots`) is on.

```ts
import { getBridgedFrom } from '@serikadev/serika.js';

const bridge = await client.bot.getGuildBridge(guildId);
const discordChannelFor = new Map(bridge.links.map((l) => [l.channel_id, l.discord_channel_id]));

gateway.on('MESSAGE_CREATE', (message) => {
  const origin = getBridgedFrom(message);
  if (origin) return; // your Discord copy already handled origin.message_id
  // ...native SerikaCord message
});
```

Only messages from people cross the bridge: your bot's own messages and interaction responses stay on the platform they were sent on. Discord ids in `bridged_from` and `discord_channel_id` are always Discord snowflakes, never translated.

## Rate limits

Every bot request counts against SerikaCord's Discord-style limits, and every response carries `X-RateLimit-Limit`, `-Remaining`, `-Reset`, `-Reset-After` and `-Bucket`. The HTTP client:

1. maps each route (method + path with ids normalized; channel, guild, webhook and application ids kept as major parameters) to the server's bucket hash,
2. tracks the remaining budget per bucket and waits before sending when it is exhausted,
3. on a 429 waits `retry_after` (body, seconds) or `Retry-After`, locking every route when the 429 is global (`X-RateLimit-Global` / scope `global`), then retries (up to `retries`, default 3).

Current server limits (read the headers, they may change): 50 requests/s per bot overall; 5 messages / 5 s per channel; reactions 4/s per channel; 5 deletes/s; 1 bulk delete/s; typing 5 / 5 s; other writes 30 / 10 s per route and channel/guild. Webhook execution is limited to 30 / 10 s per webhook.

```ts
const client = new SerikaClient({
  token,
  onRateLimit: (info) => console.warn(`rate limited on ${info.route} for ${info.timeToReset} ms (global: ${info.global})`),
  rejectOnRateLimit: (info) => info.timeToReset > 10_000, // throw HTTPError(429) instead of waiting long
});
```

Also: `maxConcurrency` (in-flight requests, default 10), `timeout` (default 15 s, HTTPError 408), retries with backoff on 5xx/network errors.

## Errors

```ts
import { HTTPError } from '@serikadev/serika.js';

try {
  await client.bot.createMessage(channelId, { content: 'Hello!' });
} catch (err) {
  if (err instanceof HTTPError) {
    err.status;          // 403
    err.code;            // 50013 Missing Permissions, 10003 Unknown Channel, 50035 Invalid Form Body...
    err.flattenErrors(); // [{ path: 'embeds.0.title', code: 'BASE_TYPE_MAX_LENGTH', message }]
    err.retryAfter;      // ms, on 429
  }
}
```

Moderation methods take a final `{ reason }` that goes to the audit log (`X-Audit-Log-Reason`): `client.bot.removeGuildMember(guildId, userId, { reason: 'spam' })`.

## Ids: snowflakes and legacy UUIDs

New applications see Discord-style snowflakes; applications created before snowflake ids existed keep seeing UUIDs until their owner turns on Developer Portal → Bot → Discord-style ids (that changes every id the bot sees). Requests accept both forms, and the SDK treats ids as opaque strings, so both work everywhere. Helpers that depend on the format handle both:

```ts
import { idFormat, snowflakeTimestamp, compareIds, idsEqual, shardForGuild, permissionsFromLegacy } from '@serikadev/serika.js';

idFormat(id);            // 'snowflake' | 'uuid' | null
snowflakeTimestamp(id);  // ms, or null for UUIDs
ids.sort(compareIds);    // creation order for snowflakes
idsEqual(a, b);          // case-insensitive for UUIDs
```

Legacy UUID-format apps also see image fields as full URLs (snowflake apps get Discord image hashes) and SerikaCord's original numbering for permission bits 42-46; `permissionsFromLegacy()` / `permissionsToLegacy()` convert, `hasPermission(bitfield, 'BanMembers')` checks.

## CDN

```ts
client.cdn.avatar(user.id, user.avatar, { size: 128 }); // https://api.serika.chat/cdn-compat/avatars/{id}/{hash}.png?size=128
client.cdn.displayAvatar(user);                         // falls back to the default avatar
client.cdn.guildIcon(guild.id, guild.icon);
client.cdn.emoji(emojiId, { animated: true });
```

Hashes become Discord CDN paths on `https://api.serika.chat/cdn-compat`; values that are already URLs (legacy apps) pass through unchanged.

## HTTP interactions endpoint

If your app sets an Interactions Endpoint URL, SerikaCord POSTs interactions to it, signed like Discord:

```ts
import { verifyInteractionSignature, InteractionType, InteractionResponseType } from '@serikadev/serika.js';

const ok = await verifyInteractionSignature(rawBody, req.headers.get('x-signature-ed25519'), req.headers.get('x-signature-timestamp'), APP_PUBLIC_KEY);
if (!ok) return new Response('invalid request signature', { status: 401 });
const interaction = JSON.parse(rawBody);
if (interaction.type === InteractionType.Ping) return Response.json({ type: InteractionResponseType.Pong });
```

## REST reference

All bot routes live on `client.bot` (Discord v10 paths under `/api/v10`):

- **Gateway / app**: `getGateway`, `getGatewayBot`, `getCurrentApplication`, `modifyCurrentApplication`, `getApplication`, `getCurrentBotApplicationInformation`
- **Users / DMs**: `getCurrentUser`, `modifyCurrentUser`, `getUser`, `getCurrentUserGuilds`, `getCurrentUserGuildMember`, `leaveGuild`, `getDMChannels`, `createDM`
- **Guilds**: `getGuild`, `modifyGuild`, `getGuildPreview`, `getGuildChannels`, `createGuildChannel`, `modifyGuildChannelPositions`, `getActiveGuildThreads`, `searchGuildMessages`, `getGuildBridge`, `getGuildVanityURL`, `getGuildVoiceRegions`, widget, onboarding, welcome screen, templates, integrations
- **Roles**: `getGuildRoles`, `getGuildRole`, `getGuildRoleMemberCounts`, `createGuildRole`, `modifyGuildRole`, `modifyGuildRolePositions`, `deleteGuildRole`
- **Members / bans**: `getGuildMembers`, `searchGuildMembers`, `getGuildMember`, `addGuildMember`, `modifyGuildMember`, `modifyCurrentMember`, `timeoutGuildMember`, `addGuildMemberRole`, `removeGuildMemberRole`, `removeGuildMember`, `getGuildPruneCount`, `beginGuildPrune`, `getGuildBans`, `getGuildBan`, `createGuildBan`, `bulkGuildBan`, `removeGuildBan`
- **Expressions**: guild and application emojis CRUD, stickers (`createGuildSticker` uploads a file), `getSticker`, `getStickerPacks`, soundboard sounds (list, create, modify, delete, `sendSoundboardSound`)
- **Channels**: `getChannel`, `modifyChannel`, `deleteChannel`, `editChannelPermissions`, `deleteChannelPermission`, `getChannelInvites`, `createChannelInvite`, `followAnnouncementChannel`, `setVoiceChannelStatus`, `triggerTyping`, group DM recipients
- **Messages**: `getMessages`, `getMessage`, `createMessage`, `reply`, `forwardMessage`, `editMessage`, `deleteMessage`, `bulkDeleteMessages`, `crosspostMessage`, `getPollAnswerVoters`, `endPoll`, `getChannelPins`, `pinMessage`, `unpinMessage`
- **Reactions**: `addReaction`, `removeOwnReaction`, `removeUserReaction`, `getReactions`, `removeAllReactions`, `removeAllReactionsForEmoji`
- **Threads / forums**: `startThreadFromMessage`, `startThreadWithoutMessage`, `startForumThread`, `joinThread`, `leaveThread`, `addThreadMember`, `removeThreadMember`, `getThreadMember(s)`, archived thread lists, `searchThreads`
- **Webhooks**: `getGuildWebhooks`, `getChannelWebhooks`, `createWebhook`, `getWebhook`, `modifyWebhook`, `deleteWebhook`, token variants, `executeWebhook` (`{ wait, thread_id }`), webhook message get/edit/delete
- **Commands**: global and guild CRUD + bulk overwrite, command permissions
- **Interactions**: `createInteractionResponse`, original response and follow-up get/edit/delete (or `client.interactions`)
- **Moderation / events**: `getGuildAuditLog`, auto moderation rules CRUD, scheduled events CRUD + users, stage instances, voice states
- **Monetization**: `getSKUs`, `getEntitlements` (always empty on SerikaCord)

Soundboard writes, `sendSoundboardSound`, `setVoiceChannelStatus` and `searchGuildMessages` need a SerikaCord server release that ships those routes (they answer 404 on older ones).

`client.http.request({ method, path, body, query, files, reason })` reaches anything not wrapped yet, with the same rate limiting.

### Client API (user sessions)

`client.client` wraps SerikaCord's own (non-Discord) API for user sessions: `new SerikaClient({ authToken })`, then `getCurrentUser`, `getCurrentUserServers`, `getNotifications`, friends, uploads, experiments, developer applications, GIF search, oEmbed and more.

## Migrating from 1.0.x

1.1.0 is backwards compatible; existing code keeps working. Things to know:

- **Fixed**: multipart uploads (`uploadAvatar` / `uploadBanner` set a `Content-Type` without a boundary and never worked), 429 handling (it locked every route on any 429 and ignored `retry_after` in the body), the gateway crashing on Node 18-21 with `ws` (`WebSocket.OPEN` was undefined), in browsers (`process` reference), never using `resume_gateway_url`, leaking the first-heartbeat timer, and reconnecting without resuming after op 7.
- `HTTPError` gained `code`, `errors`, `method`, `path` and `flattenErrors()`; `err.retryAfter` is still in milliseconds.
- `getMessages`, `getGuildMembers`, `getReactions` and `getGuildAuditLog` accept a query object; the old number form still means `limit`.
- `pinMessage` / `unpinMessage` use the current `/messages/pins` routes; `getPinnedMessages` (legacy array) is deprecated in favour of `getChannelPins` (`{ items, has_more }`).
- `createInteractionFollowup` resolves the created message instead of `void`; `createInteractionResponse` takes `{ withResponse, files }`.
- `createGuildBan(guildId, userId, { reason })` now sends the reason as `X-Audit-Log-Reason`; prefer the final `{ reason }` options argument.
- Intents: `GUILD_BANS` / `GUILD_EMOJIS_AND_STICKERS` are deprecated aliases of `GUILD_MODERATION` / `GUILD_EXPRESSIONS`; the AutoMod and poll intents were added.
- Gateway: prefer `gateway.on('MESSAGE_CREATE', ...)` (typed) over `onDispatch`; `sessionId_` and `client.gateway_` are deprecated aliases of `sessionId` / `client.gatewayClient`. `disconnect()` now also emits `close`.
- `modifyGuildChannel` / `deleteGuildChannel` (SerikaCord-only aliases) are deprecated; use `modifyChannel` / `deleteChannel`.

## Development

```bash
npm install
npm run build   # tsc → dist/
npm test        # compiles src + test with tsc, runs node:test (no network)
```

## License

MIT
