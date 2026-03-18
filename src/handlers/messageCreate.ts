import { Message } from "discord.js";
import { FixerRegistry } from "../fixers/registry";
import { ConfigRepository } from "../config-repo/types";

const URL_REGEX = /https?:\/\/\S+/g;

export function createMessageHandler(registry: FixerRegistry, configRepo: ConfigRepository) {
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

    const reply = results.map((r) => r.url).join("\n");

    const [suppressResult, replyResult] = await Promise.allSettled([
      message.suppressEmbeds(true),
      message.reply(reply),
    ]);

    if (suppressResult.status === "rejected") {
      console.error("Failed to suppress embeds:", suppressResult.reason);
    }
    if (replyResult.status === "rejected") {
      console.error("Failed to reply:", replyResult.reason);
    }
  };
}
