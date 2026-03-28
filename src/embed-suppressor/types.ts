import { Client, Message, PartialMessage } from "discord.js";

export interface EmbedSuppressor {
  suppress(message: Message): Promise<void>;
  handleMessageUpdate(
    oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage,
  ): Promise<void>;
  resumePending(client: Client): Promise<void>;
  destroy(): void;
}
