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

const INSURANCE_SUPPRESS_DELAY_MS = 2000;
const FAILED_SUPPRESS_TTL_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

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
  private client: Client | null = null;

  constructor(private db: BetterSQLite3Database) {
    this.sweepInterval = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweepInterval.unref();
  }

  setClient(client: Client): void {
    this.client = client;
  }

  async suppress(message: Message): Promise<void> {
    this.track(message);

    try {
      await message.suppressEmbeds(true);
      console.log(
        `Suppress flag set for message ${message.id} in ${formatChannelContext(message)}, awaiting confirmation`,
      );
    } catch (error) {
      if (is50013(error)) {
        const diagnostics = getPermissionDiagnostics(message);
        console.warn(
          `Failed to suppress embeds in ${formatChannelContext(message)}: Missing Permissions\n${diagnostics}`,
        );
      } else {
        this.untrack(message.id);
        console.error(`Failed to suppress embeds in ${formatChannelContext(message)}:`, error);
        return;
      }
    }

    // Delayed insurance: re-assert suppress after Discord's embed resolver has likely finished
    delay(INSURANCE_SUPPRESS_DELAY_MS).then(async () => {
      if (!this.pending.has(message.id)) return;
      try {
        await message.suppressEmbeds(true);
        this.untrack(message.id);
        console.log(`Insurance suppress confirmed for ${message.id}`);
      } catch (error) {
        console.warn(`Insurance suppress failed for ${message.id}:`, error);
      }
    });
  }

  async handleMessageUpdate(
    _oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage,
  ): Promise<void> {
    if (!this.pending.has(newMessage.id)) return;

    const channelName = "name" in newMessage.channel ? newMessage.channel.name : "unknown";

    // Flag set — re-suppress defensively once embeds are present (Discord race #4442)
    if (newMessage.flags?.has(MessageFlags.SuppressEmbeds)) {
      if (newMessage.embeds && newMessage.embeds.length > 0) {
        try {
          const full = newMessage.partial ? await newMessage.fetch() : newMessage;
          await full.suppressEmbeds(true);
        } catch (error) {
          console.warn(
            `Defensive re-suppress failed for ${newMessage.id} in #${channelName}:`,
            error,
          );
        }
        this.untrack(newMessage.id);
        console.log(`Confirmed embeds suppressed for ${newMessage.id} in #${channelName}`);
      }
      // Flag set but no embeds yet — keep tracking
      return;
    }

    // No embeds yet — keep waiting for Discord to finish parsing URLs
    if (!newMessage.embeds || newMessage.embeds.length === 0) return;

    // Embeds appeared without the suppress flag — suppress them now
    try {
      const full = newMessage.partial ? await newMessage.fetch() : newMessage;
      if (full.flags.has(MessageFlags.SuppressEmbeds)) {
        console.log(
          `Flag already set on fetch for ${newMessage.id} in #${channelName}, untracking`,
        );
        this.untrack(newMessage.id);
        return;
      }
      await full.suppressEmbeds(true);
      this.untrack(newMessage.id);
      console.log(
        `Suppressed embeds via messageUpdate for ${full.id} in #${channelName} [${full.channel.id}]`,
      );
    } catch (error) {
      // Stay tracked — next messageUpdate or sweep will handle cleanup
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

  async sweep(): Promise<void> {
    const before = this.pending.size;
    const cutoff = Date.now() - FAILED_SUPPRESS_TTL_MS;
    const expired = this.db
      .select()
      .from(failedSuppresses)
      .where(lte(failedSuppresses.createdAt, cutoff))
      .all();

    if (expired.length === 0) {
      console.log(`Sweep: no expired entries (${before} pending)`);
      return;
    }

    for (const entry of expired) {
      if (this.client) {
        try {
          const channel = await this.client.channels.fetch(entry.channelId);
          if (channel?.isTextBased()) {
            const message = await channel.messages.fetch(entry.messageId);
            if (!message.flags.has(MessageFlags.SuppressEmbeds)) {
              await message.suppressEmbeds(true);
              console.log(`Sweep: last-ditch suppress succeeded for ${entry.messageId}`);
            } else {
              console.log(`Sweep: embeds already suppressed for ${entry.messageId}`);
            }
          }
        } catch (error) {
          console.warn(`Sweep: last-ditch suppress failed for ${entry.messageId}:`, error);
        }
      }

      this.db.delete(failedSuppresses).where(eq(failedSuppresses.messageId, entry.messageId)).run();
      this.pending.delete(entry.messageId);
    }

    console.log(
      `Sweep: removed ${expired.length} expired entry/entries [${expired.map((e) => e.messageId).join(", ")}] (${before} → ${this.pending.size} pending)`,
    );
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
