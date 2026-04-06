import { Message, PartialMessage, ReadonlyCollection, Snowflake } from "discord.js";
import { ReplyTracker } from "../reply-tracker/types";
import { EmbedSuppressor } from "../embed-suppressor/types";

async function tryDeleteBotReply(
  message: Message | PartialMessage,
  replyTracker: ReplyTracker,
  suppressor: EmbedSuppressor,
): Promise<void> {
  suppressor.untrackIfPending(message.id);
  const replyId = replyTracker.get(message.id);
  if (!replyId) return;

  replyTracker.delete(message.id);

  try {
    const replyMessage = await message.channel.messages.fetch(replyId);
    await replyMessage.delete();
    console.log("Deleted bot reply", replyId, "for original message", message.id);
  } catch (error) {
    console.error("Failed to delete bot reply", replyId, ":", error);
  }
}

export function createMessageDeleteHandler(
  replyTracker: ReplyTracker,
  suppressor: EmbedSuppressor,
) {
  return async (message: Message | PartialMessage) => {
    await tryDeleteBotReply(message, replyTracker, suppressor);
  };
}

export function createMessageDeleteBulkHandler(
  replyTracker: ReplyTracker,
  suppressor: EmbedSuppressor,
) {
  return async (messages: ReadonlyCollection<Snowflake, Message | PartialMessage>) => {
    for (const message of messages.values()) {
      await tryDeleteBotReply(message, replyTracker, suppressor);
    }
  };
}
