import { Message } from "discord.js";
import { FixerRegistry } from "../fixers/registry";
import { ConfigRepository } from "../config-repo/types";
import { ReplyTracker } from "../reply-tracker/types";

const URL_REGEX = /https?:\/\/\S+/g;
const SUPPRESS_DELAY_MS = 300;
const SUPPRESS_RETRY_DELAY_MS = 700;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatChannelContext(message: Message): string {
  const channel = message.channel;
  const channelName = "name" in channel ? channel.name : "DM";
  const threadLabel = channel.isThread() ? " (thread)" : "";
  return `#${channelName}${threadLabel} [${channel.id}] in ${message.guild?.name ?? "unknown guild"}`;
}

async function suppressEmbedsWithRetry(message: Message): Promise<void> {
  await delay(SUPPRESS_DELAY_MS);

  try {
    await message.suppressEmbeds(true);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === 50013) {
      await delay(SUPPRESS_RETRY_DELAY_MS);
      await message.suppressEmbeds(true);
    } else {
      throw error;
    }
  }
}

export function createMessageHandler(
  registry: FixerRegistry,
  configRepo: ConfigRepository,
  replyTracker: ReplyTracker,
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

    const [suppressResult, replyResult] = await Promise.allSettled([
      suppressEmbedsWithRetry(message),
      message.reply({ content: reply, allowedMentions: { repliedUser: false } }),
    ]);

    if (suppressResult.status === "fulfilled") {
      console.log(
        `Suppressed embeds for message ${message.id} in ${formatChannelContext(message)}`,
      );
    } else {
      console.error(
        `Failed to suppress embeds in ${formatChannelContext(message)}:`,
        suppressResult.reason,
      );
    }
    if (replyResult.status === "fulfilled") {
      replyTracker.track(message.id, replyResult.value.id);
    } else {
      console.error("Failed to reply:", replyResult.reason);
    }
  };
}
