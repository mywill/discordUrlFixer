import { Message } from "discord.js";
import { FixerRegistry } from "../fixers/registry";
import { ConfigRepository } from "../config-repo/types";
import { ReplyTracker } from "../reply-tracker/types";

const URL_REGEX = /https?:\/\/\S+/g;

export function createMessageHandler(registry: FixerRegistry, configRepo: ConfigRepository, replyTracker: ReplyTracker) {
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

    const botMember = message.guild?.members.me;
    const canSuppressEmbeds = botMember && message.channel.isTextBased() && 'permissionsFor' in message.channel
      ? message.channel.permissionsFor(botMember)?.has("ManageMessages")
      : false;

    if (!canSuppressEmbeds) {
      console.warn("Missing MANAGE_MESSAGES permission — cannot suppress embeds in", message.guild?.name);
    }

    const [suppressResult, replyResult] = await Promise.allSettled([
      canSuppressEmbeds ? message.suppressEmbeds(true) : Promise.resolve(null),
      message.reply({ content: reply, allowedMentions: { repliedUser: false } }),
    ]);

    if (suppressResult.status === "fulfilled" && suppressResult.value !== null) {
      console.log("Suppressed embeds for message", message.id);
    } else if (suppressResult.status === "rejected") {
      console.error("Failed to suppress embeds:", suppressResult.reason);
    }
    if (replyResult.status === "fulfilled") {
      replyTracker.track(message.id, replyResult.value.id);
    } else {
      console.error("Failed to reply:", replyResult.reason);
    }
  };
}
