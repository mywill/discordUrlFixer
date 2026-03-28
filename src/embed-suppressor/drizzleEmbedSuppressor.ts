import {
  ChannelType,
  Client,
  Message,
  MessageFlags,
  PartialMessage,
  PermissionFlagsBits,
} from "discord.js";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq, lte } from "drizzle-orm";
import { EmbedSuppressor } from "./types";
import { failedSuppresses } from "../database/schema";

const RETRY_DELAYS = [300, 700, 1000];
const FAILED_SUPPRESS_TTL_MS = 5 * 60 * 1000;

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

function is50013(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as any).code === 50013;
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

export class DrizzleEmbedSuppressor implements EmbedSuppressor {
  private pending = new Set<string>();
  private sweepInterval: ReturnType<typeof setInterval>;

  constructor(private db: BetterSQLite3Database) {
    this.sweepInterval = setInterval(() => this.sweep(), 5 * 60 * 1000);
    this.sweepInterval.unref();
  }

  async suppress(message: Message): Promise<void> {
    this.track(message);

    try {
      await this.attemptSuppress(message, [...RETRY_DELAYS]);
      this.untrack(message.id);
      console.log(
        `Suppressed embeds for message ${message.id} in ${formatChannelContext(message)}`,
      );
    } catch (error) {
      if (is50013(error)) {
        const diagnostics = getPermissionDiagnostics(message);
        console.warn(
          `Failed to suppress embeds in ${formatChannelContext(message)}: Missing Permissions (all attempts failed)\n${diagnostics}`,
        );
      } else {
        this.untrack(message.id);
        console.error(`Failed to suppress embeds in ${formatChannelContext(message)}:`, error);
      }
    }
  }

  private async attemptSuppress(message: Message, delays: number[]): Promise<void> {
    await delay(delays[0]);
    try {
      await message.suppressEmbeds(true);
    } catch (error) {
      if (is50013(error) && delays.length > 1) {
        return this.attemptSuppress(message, delays.slice(1));
      }
      throw error;
    }
  }

  async handleMessageUpdate(
    _oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage,
  ): Promise<void> {
    if (!this.pending.has(newMessage.id)) return;

    this.untrack(newMessage.id);

    if (newMessage.flags?.has(MessageFlags.SuppressEmbeds)) return;
    if (!newMessage.embeds || newMessage.embeds.length === 0) return;

    try {
      const full = newMessage.partial ? await newMessage.fetch() : newMessage;
      if (full.flags.has(MessageFlags.SuppressEmbeds)) return;
      await full.suppressEmbeds(true);
      const channelName = "name" in full.channel ? full.channel.name : "unknown";
      console.log(
        `Suppressed embeds via messageUpdate for ${full.id} in #${channelName} [${full.channel.id}]`,
      );
    } catch (error) {
      const channelName = "name" in newMessage.channel ? newMessage.channel.name : "unknown";
      console.warn(
        `Failed to suppress embeds via messageUpdate for ${newMessage.id} in #${channelName} [${newMessage.channel.id}]:`,
        error,
      );
    }
  }

  async resumePending(client: Client): Promise<void> {
    const entries = this.db.select().from(failedSuppresses).all();
    if (entries.length === 0) return;

    console.log(`Resuming suppress for ${entries.length} pending message(s)`);
    this.db.delete(failedSuppresses).run();

    for (const entry of entries) {
      try {
        const channel = await client.channels.fetch(entry.channelId);
        if (!channel || !channel.isTextBased()) continue;
        const message = await channel.messages.fetch(entry.messageId);
        if (message.flags.has(MessageFlags.SuppressEmbeds)) continue;
        await message.suppressEmbeds(true);
        console.log(
          `Resumed suppression for ${entry.messageId} in #${"name" in channel ? channel.name : "unknown"} [${channel.id}]`,
        );
      } catch (error) {
        console.warn(`Failed to resume suppression for ${entry.messageId}:`, error);
      }
    }
  }

  sweep(): void {
    const before = this.pending.size;
    const cutoff = Date.now() - FAILED_SUPPRESS_TTL_MS;
    const deleted = this.db
      .delete(failedSuppresses)
      .where(lte(failedSuppresses.createdAt, cutoff))
      .run();
    if (deleted.changes > 0) {
      this.pending.clear();
      const remaining = this.db.select().from(failedSuppresses).all();
      for (const row of remaining) {
        this.pending.add(row.messageId);
      }
      console.log(
        `Sweep: removed ${deleted.changes} expired entry/entries (${before} → ${this.pending.size} pending)`,
      );
    } else {
      console.log(`Sweep: no expired entries (${before} pending)`);
    }
  }

  destroy(): void {
    clearInterval(this.sweepInterval);
  }

  private track(message: Message): void {
    this.pending.add(message.id);
    this.db
      .insert(failedSuppresses)
      .values({
        messageId: message.id,
        channelId: message.channelId,
        createdAt: Date.now(),
      })
      .onConflictDoUpdate({
        target: failedSuppresses.messageId,
        set: { createdAt: Date.now() },
      })
      .run();
    console.log(`Tracking suppress for message ${message.id} (${this.pending.size} pending)`);
  }

  private untrack(messageId: string): void {
    this.pending.delete(messageId);
    this.db.delete(failedSuppresses).where(eq(failedSuppresses.messageId, messageId)).run();
    console.log(`Untracked suppress for message ${messageId} (${this.pending.size} pending)`);
  }
}
