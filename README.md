# serika.js

A highly optimized TypeScript library for the SerikaCord API — Discord v10 compatible bot API + SerikaCord client API.

## Features

- **Full API coverage** — every endpoint in the SerikaCord API
- **Discord v10 compatible** — bot endpoints match Discord's REST API shape
- **Optimized HTTP client** — concurrency limiting, automatic retry with exponential backoff + jitter, global rate limit handling, keep-alive connection reuse
- **Gateway WebSocket client** — HELLO → IDENTIFY → READY lifecycle, heartbeat with zombie detection, RESUME on reconnect, exponential backoff
- **TypeScript-first** — full type definitions for all request/response payloads
- **Zero runtime dependencies** in Node 22+, Bun, Deno, and browsers. Optional `ws` peer dependency for Node 18-21 WebSocket support
- **Tree-shakeable** ESM

## Installation

```bash
npm install serika.js
# Node 18-21 also needs the optional ws peer dependency:
npm install serika.js ws
# or
bun add serika.js
```

## Quick Start

### Bot with REST + Gateway

```typescript
import { SerikaClient, Intents } from 'serika.js';

const client = new SerikaClient({
  token: 'your-bot-token',
  baseURL: 'https://api.serika.chat', // optional, this is the default
});

// REST: send a message
await client.bot.createMessage('channel-id', {
  content: 'Hello from serika.js!',
});

// Gateway: listen for events
const gw = await client.connectGateway({
  intents: Intents.GUILDS | Intents.GUILD_MESSAGES | Intents.MESSAGE_CONTENT,
});

gw.onDispatch((event, data) => {
  if (event === 'MESSAGE_CREATE') {
    console.log('New message:', (data as any).content);
  }
});

gw.onReady(() => {
  console.log('Bot is ready!');
});
```

### Client API (user session)

```typescript
import { SerikaClient } from 'serika.js';

const client = new SerikaClient({
  authToken: 'your-auth-token',
});

// Get current user
const me = await client.client.getCurrentUser();

// Send a friend request
await client.client.sendFriendRequest('username');

// Get notifications
const { notifications } = await client.client.getNotifications();
```

## API Reference

### `SerikaClient`

Main entry point. Creates an optimized HTTP client and exposes `bot` (Bot API v10) and `client` (SerikaCord Client API) namespaces.

#### Constructor options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseURL` | `string` | `https://api.serika.chat` | API base URL |
| `token` | `string` | — | Bot token (sets `Authorization: Bot <token>`) |
| `authToken` | `string` | — | User auth token (sets `Authorization: Bearer <token>`) |
| `timeout` | `number` | `15000` | Request timeout in ms |
| `maxConcurrency` | `number` | `10` | Max concurrent requests |
| `retries` | `number` | `3` | Retry attempts on 429/5xx |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation |
| `headers` | `Record<string, string>` | — | Additional default headers |

### Bot API (`client.bot`)

Discord v10 compatible endpoints under `/api/v10`:

- **Gateway**: `getGateway()`, `getGatewayBot()`
- **Users**: `getCurrentUser()`, `getUser(id)`, `getDMChannels()`, `createDM()`, `leaveGuild()`
- **Guilds**: `getGuild()`, `modifyGuild()`, `getGuildPreview()`, `getGuildChannels()`, `createGuildChannel()`, `modifyGuildChannel()`, `deleteGuildChannel()`, `getGuildRoles()`, `createGuildRole()`, `modifyGuildRole()`, `deleteGuildRole()`, `getGuildMembers()`, `getGuildMember()`, `modifyGuildMember()`, `modifyCurrentUserNick()`, `removeGuildMember()`
- **Bans**: `getGuildBans()`, `getGuildBan()`, `createGuildBan()`, `removeGuildBan()`
- **Emojis**: `getGuildEmojis()`, `getGuildEmoji()`, `createGuildEmoji()`, `modifyGuildEmoji()`, `deleteGuildEmoji()`
- **Stickers**: `getGuildStickers()`, `getGuildSticker()`
- **Channels**: `getChannel()`, `modifyChannel()`, `deleteChannel()`
- **Messages**: `getMessages()`, `getMessage()`, `createMessage()`, `editMessage()`, `deleteMessage()`, `bulkDeleteMessages()`
- **Pins**: `getPinnedMessages()`, `pinMessage()`, `unpinMessage()`
- **Reactions**: `addReaction()`, `removeOwnReaction()`, `removeUserReaction()`, `getReactions()`, `removeAllReactions()`
- **Typing**: `triggerTyping()`
- **Webhooks**: `getGuildWebhooks()`, `getChannelWebhooks()`, `createWebhook()`, `getWebhook()`, `deleteWebhook()`
- **Invites**: `getInvite()`, `deleteInvite()`, `getGuildInvites()`
- **Audit Log**: `getGuildAuditLog()`
- **Application Commands**: `getGlobalCommands()`, `getGlobalCommand()`, `createGlobalCommand()`, `modifyGlobalCommand()`, `deleteGlobalCommand()`, `bulkOverwriteGlobalCommands()`, `getGuildCommands()`, `bulkOverwriteGuildCommands()`
- **Interactions**: `createInteractionResponse()`, `createInteractionFollowup()`
- **Voice**: `getVoiceRegions()`

### Client API (`client.client`)

SerikaCord-specific endpoints:

- **Platform**: `health()`, `getPlatformAnnouncement()`, `getFileTypes()`, `getFileTypesAccept()`, `getTtsSounds()`, `getTtsVoices()`
- **Users**: `getCurrentUser()`, `getCurrentUserServers()`, `getCurrentUserGuilds()`, `getMentions()`, `getEmojis()`, `getStickers()`, `updateCurrentUser()`
- **Notifications**: `getNotifications()`, `markNotificationsRead()`
- **Friends**: `sendFriendRequest()`, `acceptFriendRequest()`, `cancelFriendRequest()`, `declineFriendRequest()`, `blockUser()`, `unblockUser()`, `removeFriend()`
- **Auth**: `register()`, `login()`, `logout()`
- **Uploads**: `uploadAvatar()`, `uploadBanner()`
- **Experiments**: `getExperimentVariant()`, `getActiveExperiments()`
- **Developers**: `getApplications()`, `getApplication()`, `createApplication()`, `updateApplication()`, `deleteApplication()`, `getTeams()`
- **IGDB**: `lookupGame()`
- **GIFs**: `searchGifs()`, `getTrendingGifs()`
- **OEmbed**: `getOEmbed()`
- **Webhooks**: `executeWebhook()`

### Gateway Client

```typescript
const gw = client.connectGateway({
  intents: Intents.GUILDS | Intents.GUILD_MESSAGES,
  shard: [0, 1],        // optional
  reconnect: true,       // default
  maxReconnectAttempts: 10,
  presence: {
    status: 'online',
    activities: [{ name: 'with serika.js', type: 0 }],
  },
});

// Event handlers
gw.onDispatch((event, data, seq) => { ... });
gw.onReady((data) => { ... });
gw.onError((err) => { ... });
gw.onClose((code, reason) => { ... });

// Send gateway commands
gw.sendPresenceUpdate({ status: 'dnd' });
gw.sendVoiceStateUpdate({ ... });
gw.requestGuildMembers({ ... });

// Disconnect
gw.disconnect(); // graceful
```

### Intents

```typescript
import { Intents } from 'serika.js';

Intents.GUILDS           // 1 << 0
Intents.GUILD_MEMBERS    // 1 << 1
Intents.GUILD_BANS       // 1 << 2
Intents.GUILD_MESSAGES   // 1 << 9
Intents.MESSAGE_CONTENT  // 1 << 15
// ... see types.ts for all flags
```

## Error Handling

```typescript
import { HTTPError } from 'serika.js';

try {
  await client.bot.createMessage('channel-id', { content: 'Hello!' });
} catch (err) {
  if (err instanceof HTTPError) {
    console.error(`HTTP ${err.status}:`, err.body);
    // err.retryAfter — ms until rate limit resets (if 429)
  }
}
```

## License

MIT
