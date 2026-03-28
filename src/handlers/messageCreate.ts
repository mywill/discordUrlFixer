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
    const results = registry.processUrls(urls, serverConfig);

    if (results.length === 0) return;

    const useMarkdown = serverConfig.useMarkdownLinksAsShortener !== false;
    const reply = results.map((r) => (useMarkdown ? `[${r.source}](${r.url})` : r.url)).join("\n");

    const [, replyResult] = await Promise.allSettled([
      suppressor.suppress(message),
      message.reply({ content: reply, allowedMentions: { repliedUser: false } }),
    ]);

    if (replyResult.status === "fulfilled") {
      replyTracker.track(message.id, replyResult.value.id);
    } else {
      console.error("Failed to reply:", replyResult.reason);
    }
  };
}
