import type { BotAPI, InteractionRef } from './bot.js';
import { InteractionResponseType, MessageFlags } from '../types.js';
import type {
  APIInteractionResponseCallbackData, APIApplicationCommandOptionChoice, APIModal, EditMessageOptions,
  RawFile, Snowflake, APIMessage, APIInteractionCallbackResponse,
} from '../types.js';

export interface ReplyOptions extends APIInteractionResponseCallbackData {
  /** Shortcut for `flags |= MessageFlags.Ephemeral` (only the invoker sees it). */
  ephemeral?: boolean;
  files?: RawFile[];
  /** Return the created message (with_response=true). */
  withResponse?: boolean;
}

function withEphemeral<T extends { flags?: number; ephemeral?: boolean }>(data: T): Omit<T, 'ephemeral'> {
  const { ephemeral, ...rest } = data;
  if (!ephemeral) return rest;
  return { ...rest, flags: (rest.flags ?? 0) | MessageFlags.Ephemeral };
}

function asData(data: ReplyOptions | string): ReplyOptions {
  return typeof data === 'string' ? { content: data } : data;
}

/**
 * Ergonomic interaction responses. Every method takes the interaction (or any
 * `{ id, token, application_id }`) straight from INTERACTION_CREATE.
 *
 * The first response must arrive within 3 seconds; defer if you need longer,
 * then finish with `editReply`. Tokens stay valid for follow-ups for 15 minutes.
 */
export class InteractionsAPI {
  constructor(private readonly bot: BotAPI) {}

  /** Respond with a message (callback 4). */
  async reply(interaction: InteractionRef, data: ReplyOptions | string): Promise<APIInteractionCallbackResponse | undefined> {
    const { files, withResponse, ...rest } = asData(data);
    return this.bot.createInteractionResponse(interaction.id, interaction.token, {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: withEphemeral(rest),
    }, { files, withResponse });
  }

  /** Acknowledge now, show "thinking…", finish later with editReply (callback 5). */
  defer(interaction: InteractionRef, opts: { ephemeral?: boolean; withResponse?: boolean } = {}) {
    return this.bot.createInteractionResponse(interaction.id, interaction.token, {
      type: InteractionResponseType.DeferredChannelMessageWithSource,
      ...(opts.ephemeral ? { data: { flags: MessageFlags.Ephemeral } } : {}),
    }, { withResponse: opts.withResponse });
  }

  /** Components: acknowledge without changing the message yet (callback 6). */
  deferUpdate(interaction: InteractionRef) {
    return this.bot.createInteractionResponse(interaction.id, interaction.token, { type: InteractionResponseType.DeferredUpdateMessage });
  }

  /** Components: edit the message the component is on (callback 7). */
  update(interaction: InteractionRef, data: ReplyOptions | string) {
    const { files, withResponse, ephemeral: _ignored, ...rest } = asData(data);
    return this.bot.createInteractionResponse(interaction.id, interaction.token, {
      type: InteractionResponseType.UpdateMessage,
      data: rest,
    }, { files, withResponse });
  }

  /** Autocomplete: up to 25 choices (callback 8). */
  autocomplete(interaction: InteractionRef, choices: APIApplicationCommandOptionChoice[]) {
    return this.bot.createInteractionResponse(interaction.id, interaction.token, {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: { choices },
    });
  }

  /** Open a modal (callback 9). Not allowed in response to a modal submit. */
  showModal(interaction: InteractionRef, modal: APIModal) {
    return this.bot.createInteractionResponse(interaction.id, interaction.token, {
      type: InteractionResponseType.Modal,
      data: modal,
    });
  }

  /** HTTP-endpoint PING → PONG (callback 1). */
  pong(interaction: InteractionRef) {
    return this.bot.createInteractionResponse(interaction.id, interaction.token, { type: InteractionResponseType.Pong });
  }

  getReply(interaction: InteractionRef): Promise<APIMessage> {
    return this.bot.getOriginalInteractionResponse(interaction.application_id, interaction.token);
  }

  /** Edit the original response (also how a deferred reply is completed). */
  editReply(interaction: InteractionRef, data: EditMessageOptions | string): Promise<APIMessage> {
    return this.bot.editOriginalInteractionResponse(interaction.application_id, interaction.token, data);
  }

  deleteReply(interaction: InteractionRef): Promise<void> {
    return this.bot.deleteOriginalInteractionResponse(interaction.application_id, interaction.token);
  }

  /** Send a follow-up message. */
  followUp(interaction: InteractionRef, data: ReplyOptions | string): Promise<APIMessage> {
    const { withResponse: _w, ...rest } = asData(data);
    return this.bot.createInteractionFollowup(interaction.application_id, interaction.token, withEphemeral(rest));
  }

  editFollowUp(interaction: InteractionRef, messageId: Snowflake, data: EditMessageOptions | string): Promise<APIMessage> {
    return this.bot.editFollowupMessage(interaction.application_id, interaction.token, messageId, data);
  }

  deleteFollowUp(interaction: InteractionRef, messageId: Snowflake): Promise<void> {
    return this.bot.deleteFollowupMessage(interaction.application_id, interaction.token, messageId);
  }
}
