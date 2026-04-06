import { Message } from "discord.js";
import { FixerRegistry } from "../fixers/registry";
import { ConfigRepository } from "../config-repo/types";
import { ReplyTracker } from "../reply-tracker/types";
import { EmbedSuppressor } from "../embed-suppressor/types";

const URL_REGEX = /https?:\/\/\S+/g;

export function createMessageHandler(
  registry: FixerRegistry,
  configRepo: ConfigRepository,
  replyTracker: ReplyTracker,
  suppressor: EmbedSuppressor,
) {
  return async (message: Message) => {
    if (message.author.bot) return;
    if (message.content.toLowerCase().includes("fxignore")) return;

    const urls = message.content.match(URL_REGEX);
    if (!urls || urls.length === 0) return;

    const serverId = message.guildId;
    if (!serverId) return;

    const serverConfig = configRepo.getServerConfig(serverId);
    const results = await registry.processUrls(urls, serverConfig);

    if (results.length === 0) return;

    const useMarkdown = serverConfig.useMarkdownLinksAsShortener !== false;
    const reply = results
      .map((r) => {
        if (!useMarkdown) return r.url;
        let text = `[${r.source}](${r.url})`;
        if (r.secondaryUrl) {
          text += ` - [${r.secondarySource}](<${r.secondaryUrl}>)`;
        }
        return text;
      })
      .join("\n");

    // Reply first, then suppress — avoids Discord bug where replying to a
    // suppress-flagged message inherits SUPPRESS_EMBEDS on the reply
    try {
      const botReply = await message.reply({
        content: reply,
        allowedMentions: { repliedUser: false },
      });
      replyTracker.track(message.id, botReply.id);
    } catch (error) {
      console.error("Failed to reply:", error);
    }

    try {
      await suppressor.suppress(message);
    } catch (error) {
      console.error("Failed to suppress:", error);
    }
  };
}
