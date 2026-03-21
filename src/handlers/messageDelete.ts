import { Message, PartialMessage, Collection, Snowflake } from "discord.js";
import { ReplyTracker } from "../reply-tracker/types";

async function tryDeleteBotReply(
  message: Message | PartialMessage,
  replyTracker: ReplyTracker,
): Promise<void> {
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

export function createMessageDeleteHandler(replyTracker: ReplyTracker) {
  return async (message: Message | PartialMessage) => {
    await tryDeleteBotReply(message, replyTracker);
  };
}

export function createMessageDeleteBulkHandler(replyTracker: ReplyTracker) {
  return async (messages: Collection<Snowflake, Message | PartialMessage>) => {
    for (const message of messages.values()) {
      await tryDeleteBotReply(message, replyTracker);
    }
  };
}
