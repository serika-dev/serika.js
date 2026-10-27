// Type-checked (never executed) copies of the README examples, so the docs
// can't drift from the API. Compiled by `npm test` via tsconfig.test.json.

import {
  SerikaClient, Intents, InteractionType, ComponentType, ButtonStyle, MessageFlags, ApplicationCommandOptionType,
  SeparatorSpacing, HTTPError, getBridgedFrom, verifyInteractionSignature, InteractionResponseType,
  type APIInteraction,
} from '../src/index.js';

export async function quickStart() {
  const client = new SerikaClient({ token: process.env.SERIKA_BOT_TOKEN! });

  const gateway = await client.connectGateway({
    intents: Intents.GUILDS | Intents.GUILD_MESSAGES,
    waitForReady: true,
  });
  const appId = gateway.readyData!.application.id;

  // Register a global slash command (overwrites the whole list).
  await client.bot.bulkOverwriteGlobalCommands(appId, [
    {
      name: 'ping',
      description: 'Replies with pong and a button',
      options: [{ type: ApplicationCommandOptionType.String, name: 'note', description: 'Optional note' }],
    },
  ]);

  gateway.on('INTERACTION_CREATE', async (interaction) => {
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

    if (interaction.type === InteractionType.MessageComponent && interaction.data.custom_id === 'again') {
      const user = interaction.member?.user ?? interaction.user;
      await client.interactions.update(interaction, { content: `Pong again, ${user?.username}!` });
    }
  });

  gateway.on('MESSAGE_CREATE', async (message) => {
    if (message.author.bot) return;
    if (message.content === '!hello') await client.bot.reply(message.channel_id, message.id, 'Hello!');
  });
}

export async function componentsV2(client: SerikaClient, channelId: string, png: Uint8Array) {
  await client.bot.createMessage(channelId, {
    flags: MessageFlags.IsComponentsV2,
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
    files: [{ name: 'chart.png', data: png, contentType: 'image/png' }],
  });
}

export async function bridge(client: SerikaClient, guildId: string) {
  const bridgeInfo = await client.bot.getGuildBridge(guildId);
  const bridgedChannels = new Map(bridgeInfo.links.map((l) => [l.channel_id, l.discord_channel_id]));

  const gateway = client.gatewayClient!;
  gateway.on('MESSAGE_CREATE', (message) => {
    const origin = getBridgedFrom(message);
    if (origin) {
      // Relayed in from Discord: your Discord copy already handled origin.message_id.
      return;
    }
    if (bridgedChannels.has(message.channel_id)) {
      // Native SerikaCord message in a bridged channel.
    }
  });
}

export async function errors(client: SerikaClient) {
  try {
    await client.bot.createMessage('123', { content: 'Hello!' });
  } catch (err) {
    if (err instanceof HTTPError) {
      console.error(err.status, err.code, err.message, err.flattenErrors());
    }
  }
}

export async function httpEndpoint(rawBody: string, headers: Headers, publicKey: string) {
  const ok = await verifyInteractionSignature(rawBody, headers.get('x-signature-ed25519'), headers.get('x-signature-timestamp'), publicKey);
  if (!ok) return new Response('invalid request signature', { status: 401 });
  const interaction = JSON.parse(rawBody) as APIInteraction;
  if (interaction.type === InteractionType.Ping) return Response.json({ type: InteractionResponseType.Pong });
  return Response.json({ type: InteractionResponseType.ChannelMessageWithSource, data: { content: 'Hi!' } });
}

export async function sharded(client: SerikaClient) {
  const shards = await client.connectShards({ intents: Intents.GUILDS, totalShards: 'auto' });
  shards.on('ready', (_data, shardId) => console.log(`shard ${shardId} ready`));
  await shards.waitForReady();
}
