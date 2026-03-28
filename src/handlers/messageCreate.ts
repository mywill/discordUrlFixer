import { ChannelType, Message, PermissionFlagsBits } from "discord.js";
import { FixerRegistry } from "../fixers/registry";
import { ConfigRepository } from "../config-repo/types";
import { ReplyTracker } from "../reply-tracker/types";

const URL_REGEX = /https?:\/\/\S+/g;
const SUPPRESS_DELAY_MS = 300;
const SUPPRESS_RETRY_DELAY_MS = 700;
const LAST_SUPPRESS_RETRY_DELAY_MS = 1000;

const CHANNEL_TYPE_NAMES: Partial<Record<ChannelType, string>> = {
  [ChannelType.GuildText]: "GuildText",
  [ChannelType.GuildVoice]: "GuildVoice",
  [ChannelType.GuildCategory]: "GuildCategory",
  [ChannelType.GuildAnnouncement]: "GuildAnnouncement",
  [ChannelType.PublicThread]: "PublicThread",
  [ChannelType.PrivateThread]: "PrivateThread",
  [ChannelType.GuildStageVoice]: "GuildStageVoice",
  [ChannelType.GuildForum]: "GuildForum",
  [ChannelType.GuildMedia]: "GuildMedia",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatChannelContext(message: Message): string {
  const channel = message.channel;
  const channelName = "name" in channel ? channel.name : "DM";
  const threadLabel = channel.isThread() ? " (thread)" : "";
  return `#${channelName}${threadLabel} [${channel.id}] in ${message.guild?.name ?? "unknown guild"}`;
}

function getPermissionDiagnostics(message: Message): string {
  const channel = message.channel;
  const typeName = CHANNEL_TYPE_NAMES[channel.type] ?? `Unknown(${channel.type})`;
  const lines: string[] = [`  Channel type: ${typeName}`];

  if (channel.isThread()) {
    const archived = "archived" in channel ? channel.archived : undefined;
    const locked = "locked" in channel ? channel.locked : undefined;
    lines.push(`  Thread state: archived=${archived ?? "unknown"}, locked=${locked ?? "unknown"}`);
  }

  const botMember = message.guild?.members.me;
  if (!botMember) {
    lines.push("  Bot permissions: unknown (member not cached)");
    return lines.join("\n");
  }

  if (!("permissionsFor" in channel)) {
    lines.push("  Bot permissions: unknown (channel type has no permissionsFor)");
    return lines.join("\n");
  }

  const perms = channel.permissionsFor(botMember);
  if (!perms) {
    lines.push("  Bot permissions: unknown (permissionsFor returned null)");
    return lines.join("\n");
  }

  const checks = [
    ["ManageMessages", PermissionFlagsBits.ManageMessages],
    ["ViewChannel", PermissionFlagsBits.ViewChannel],
    ["SendMessages", PermissionFlagsBits.SendMessages],
    ["ManageThreads", PermissionFlagsBits.ManageThreads],
  ] as const;

  const granted = checks.filter(([, flag]) => perms.has(flag)).map(([name]) => name);
  const denied = checks.filter(([, flag]) => !perms.has(flag)).map(([name]) => name);
  lines.push(`  Bot permissions — granted: ${granted.join(", ") || "none"}`);
  if (denied.length > 0) {
    lines.push(`  Bot permissions — MISSING: ${denied.join(", ")}`);
  }

  return lines.join("\n");
}

async function suppressEmbedsWithRetry(message: Message): Promise<void> {
  await delay(SUPPRESS_DELAY_MS);

  try {
    await message.suppressEmbeds(true);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === 50013) {
      try {
        await delay(SUPPRESS_RETRY_DELAY_MS);
        await message.suppressEmbeds(true);
      } catch (error) {
        if (error instanceof Error && "code" in error && (error as any).code === 50013) {
          await delay(LAST_SUPPRESS_RETRY_DELAY_MS);
          await message.suppressEmbeds(true);
        } else {
          throw error;
        }
      }
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
      const is50013 =
        suppressResult.reason instanceof Error &&
        "code" in suppressResult.reason &&
        (suppressResult.reason as any).code === 50013;

      if (is50013) {
        const diagnostics = getPermissionDiagnostics(message);
        console.warn(
          `Failed to suppress embeds in ${formatChannelContext(message)}: Missing Permissions (both attempts failed)\n${diagnostics}`,
        );
      } else {
        console.error(
          `Failed to suppress embeds in ${formatChannelContext(message)}:`,
          suppressResult.reason,
        );
      }
    }
    if (replyResult.status === "fulfilled") {
      replyTracker.track(message.id, replyResult.value.id);
    } else {
      console.error("Failed to reply:", replyResult.reason);
    }
  };
}
