import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChannelType, MessageFlags } from "discord.js";
import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as path from "path";
import { DrizzleEmbedSuppressor } from "../../src/embed-suppressor/drizzleEmbedSuppressor";
import { failedSuppresses } from "../../src/database/schema";

function createTestDb(): { db: BetterSQLite3Database; sqlite: Database.Database } {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return { db, sqlite };
}

function createFakeMessage(
  id: string,
  overrides?: Partial<{
    channelId: string;
    channelName: string;
    guildName: string;
    isThread: boolean;
    suppressEmbeds: ReturnType<typeof vi.fn>;
    hasEmbeds: boolean;
    hasSuppressFlag: boolean;
    isPartial: boolean;
  }>,
) {
  const opts = {
    channelId: "channel-1",
    channelName: "general",
    guildName: "Test Server",
    isThread: false,
    suppressEmbeds: vi.fn().mockResolvedValue(undefined),
    hasEmbeds: true,
    hasSuppressFlag: false,
    isPartial: false,
    ...overrides,
  };

  const message: any = {
    id,
    channelId: opts.channelId,
    partial: opts.isPartial,
    embeds: opts.hasEmbeds ? [{ url: "https://twitter.com/user/status/123" }] : [],
    flags: {
      has: (flag: number) => (flag === MessageFlags.SuppressEmbeds ? opts.hasSuppressFlag : false),
    },
    author: { bot: false },
    guild: { name: opts.guildName, members: { me: null } },
    channel: {
      id: opts.channelId,
      name: opts.channelName,
      type: ChannelType.GuildText,
      isThread: () => opts.isThread,
    },
    suppressEmbeds: opts.suppressEmbeds,
    fetch: vi.fn(),
  };

  message.fetch.mockResolvedValue({ ...message, partial: false });

  return message;
}

function createError50013(): Error {
  const error = new Error("Missing Permissions");
  (error as any).code = 50013;
  return error;
}

describe("DrizzleEmbedSuppressor", () => {
  let db: BetterSQLite3Database;
  let sqlite: Database.Database;
  let suppressor: DrizzleEmbedSuppressor;

  beforeEach(() => {
    vi.useFakeTimers();
    ({ db, sqlite } = createTestDb());
    suppressor = new DrizzleEmbedSuppressor(db);
  });

  afterEach(() => {
    suppressor.destroy();
    vi.useRealTimers();
  });

  describe("suppress", () => {
    it("sets suppress flag immediately", async () => {
      const message = createFakeMessage("msg-1");
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await suppressor.suppress(message);

      expect(message.suppressEmbeds).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Suppress flag set"));
      logSpy.mockRestore();
    });

    it("persists to DB immediately when suppress starts", async () => {
      const message = createFakeMessage("msg-1");
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await suppressor.suppress(message);

      const rows = db.select().from(failedSuppresses).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].messageId).toBe("msg-1");
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Tracking suppress"));
      logSpy.mockRestore();
    });

    it("keeps DB entry on 50013 error", async () => {
      const error = createError50013();
      const message = createFakeMessage("msg-1", {
        suppressEmbeds: vi.fn().mockRejectedValue(error),
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await suppressor.suppress(message);

      const rows = db.select().from(failedSuppresses).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].messageId).toBe("msg-1");
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("logs diagnostics on 50013 error", async () => {
      const error = createError50013();
      const message = createFakeMessage("msg-1", {
        suppressEmbeds: vi.fn().mockRejectedValue(error),
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await suppressor.suppress(message);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Missing Permissions"));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Channel type: GuildText"));
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("removes DB entry on non-50013 errors", async () => {
      const error = new Error("Unknown Message");
      (error as any).code = 10008;
      const message = createFakeMessage("msg-1", {
        suppressEmbeds: vi.fn().mockRejectedValue(error),
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await suppressor.suppress(message);

      expect(message.suppressEmbeds).toHaveBeenCalledTimes(1);
      const rows = db.select().from(failedSuppresses).all();
      expect(rows).toHaveLength(0);
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("keeps DB entry after suppress flag set (awaits messageUpdate confirmation)", async () => {
      const message = createFakeMessage("msg-1");
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await suppressor.suppress(message);

      const rows = db.select().from(failedSuppresses).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].messageId).toBe("msg-1");
      logSpy.mockRestore();
    });

    it("does not throw", async () => {
      const error = createError50013();
      const message = createFakeMessage("msg-1", {
        suppressEmbeds: vi.fn().mockRejectedValue(error),
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(suppressor.suppress(message)).resolves.toBeUndefined();
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("fires insurance suppress after delay", async () => {
      const message = createFakeMessage("msg-1");
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await suppressor.suppress(message);
      expect(message.suppressEmbeds).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1500);

      // Insurance call fires because message is still pending
      expect(message.suppressEmbeds).toHaveBeenCalledTimes(2);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Insurance suppress fired"));
      logSpy.mockRestore();
    });

    it("skips insurance suppress if already confirmed", async () => {
      const message = createFakeMessage("msg-1");
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await suppressor.suppress(message);
      expect(message.suppressEmbeds).toHaveBeenCalledTimes(1);

      // Confirm via messageUpdate before insurance fires
      const updated = createFakeMessage("msg-1", { hasSuppressFlag: true, hasEmbeds: true });
      await suppressor.handleMessageUpdate({} as any, updated);

      await vi.advanceTimersByTimeAsync(1500);

      // Insurance should not have fired — only the initial call + the defensive re-suppress
      expect(message.suppressEmbeds).toHaveBeenCalledTimes(1);
      logSpy.mockRestore();
    });

    it("does not schedule insurance on non-50013 error", async () => {
      const error = new Error("Unknown Message");
      (error as any).code = 10008;
      const message = createFakeMessage("msg-1", {
        suppressEmbeds: vi.fn().mockRejectedValue(error),
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await suppressor.suppress(message);

      await vi.advanceTimersByTimeAsync(1500);

      // Only the initial failed call, no insurance
      expect(message.suppressEmbeds).toHaveBeenCalledTimes(1);
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe("handleMessageUpdate", () => {
    it("suppresses embeds for messages in pending set", async () => {
      const error = createError50013();
      const original = createFakeMessage("msg-1", {
        suppressEmbeds: vi.fn().mockRejectedValue(error),
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await suppressor.suppress(original);

      const updated = createFakeMessage("msg-1");

      await suppressor.handleMessageUpdate({} as any, updated);

      expect(updated.suppressEmbeds).toHaveBeenCalledWith(true);
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("skips messages not in pending set", async () => {
      const message = createFakeMessage("msg-unknown");

      await suppressor.handleMessageUpdate({} as any, message);

      expect(message.suppressEmbeds).not.toHaveBeenCalled();
    });

    it("removes entry from DB after processing", async () => {
      const error = createError50013();
      const original = createFakeMessage("msg-1", {
        suppressEmbeds: vi.fn().mockRejectedValue(error),
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await suppressor.suppress(original);

      const updated = createFakeMessage("msg-1");

      await suppressor.handleMessageUpdate({} as any, updated);

      const rows = db.select().from(failedSuppresses).all();
      expect(rows).toHaveLength(0);
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("re-suppresses defensively and untracks when flag and embeds are set", async () => {
      const error = createError50013();
      const original = createFakeMessage("msg-1", {
        suppressEmbeds: vi.fn().mockRejectedValue(error),
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await suppressor.suppress(original);

      const updated = createFakeMessage("msg-1", { hasSuppressFlag: true });

      await suppressor.handleMessageUpdate({} as any, updated);

      expect(updated.suppressEmbeds).toHaveBeenCalledWith(true);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Confirmed embeds suppressed"));
      const rows = db.select().from(failedSuppresses).all();
      expect(rows).toHaveLength(0);
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("keeps tracking when flag set but no embeds yet", async () => {
      const original = createFakeMessage("msg-1");
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await suppressor.suppress(original);

      const updated = createFakeMessage("msg-1", { hasSuppressFlag: true, hasEmbeds: false });

      await suppressor.handleMessageUpdate({} as any, updated);

      expect(updated.suppressEmbeds).not.toHaveBeenCalled();
      const rows = db.select().from(failedSuppresses).all();
      expect(rows).toHaveLength(1);
      logSpy.mockRestore();
    });

    it("confirms after late embed appears with flag preserved", async () => {
      const original = createFakeMessage("msg-1");
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await suppressor.suppress(original);

      // First update: flag set, no embeds yet — keep tracking
      const update1 = createFakeMessage("msg-1", { hasSuppressFlag: true, hasEmbeds: false });
      await suppressor.handleMessageUpdate({} as any, update1);
      expect(db.select().from(failedSuppresses).all()).toHaveLength(1);

      // Second update: flag set AND embeds present — re-suppress defensively and confirm
      const update2 = createFakeMessage("msg-1", { hasSuppressFlag: true, hasEmbeds: true });
      await suppressor.handleMessageUpdate({} as any, update2);

      expect(update2.suppressEmbeds).toHaveBeenCalledWith(true);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Confirmed embeds suppressed"));
      expect(db.select().from(failedSuppresses).all()).toHaveLength(0);
      logSpy.mockRestore();
    });

    it("re-suppresses after late embed appears without flag", async () => {
      const original = createFakeMessage("msg-1");
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await suppressor.suppress(original);

      // First update: flag set, no embeds yet — keep tracking
      const update1 = createFakeMessage("msg-1", { hasSuppressFlag: true, hasEmbeds: false });
      await suppressor.handleMessageUpdate({} as any, update1);
      expect(db.select().from(failedSuppresses).all()).toHaveLength(1);

      // Second update: embeds appeared but flag no longer set — re-suppress
      const update2 = createFakeMessage("msg-1", { hasSuppressFlag: false, hasEmbeds: true });
      await suppressor.handleMessageUpdate({} as any, update2);

      expect(update2.suppressEmbeds).toHaveBeenCalledWith(true);
      expect(db.select().from(failedSuppresses).all()).toHaveLength(0);
      logSpy.mockRestore();
    });

    it("keeps pending when no embeds yet (waits for URL parsing)", async () => {
      const error = createError50013();
      const original = createFakeMessage("msg-1", {
        suppressEmbeds: vi.fn().mockRejectedValue(error),
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await suppressor.suppress(original);

      const updated = createFakeMessage("msg-1", { hasEmbeds: false });

      await suppressor.handleMessageUpdate({} as any, updated);

      expect(updated.suppressEmbeds).not.toHaveBeenCalled();
      const rows = db.select().from(failedSuppresses).all();
      expect(rows).toHaveLength(1);
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("re-suppresses when embeds appear after initial suppress succeeded", async () => {
      const original = createFakeMessage("msg-1");
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await suppressor.suppress(original);

      expect(db.select().from(failedSuppresses).all()).toHaveLength(1);

      // Discord fires messageUpdate with new embeds (URL parsing completed)
      const updated = createFakeMessage("msg-1");

      await suppressor.handleMessageUpdate({} as any, updated);

      expect(updated.suppressEmbeds).toHaveBeenCalledWith(true);
      expect(db.select().from(failedSuppresses).all()).toHaveLength(0);
      logSpy.mockRestore();
    });

    it("fetches full message when partial", async () => {
      const error = createError50013();
      const original = createFakeMessage("msg-1", {
        suppressEmbeds: vi.fn().mockRejectedValue(error),
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await suppressor.suppress(original);

      const updated = createFakeMessage("msg-1", { isPartial: true });

      await suppressor.handleMessageUpdate({} as any, updated);

      expect(updated.fetch).toHaveBeenCalled();
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("stays tracked when suppress via messageUpdate fails", async () => {
      const error50013 = createError50013();
      const original = createFakeMessage("msg-1", {
        suppressEmbeds: vi.fn().mockRejectedValue(error50013),
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await suppressor.suppress(original);

      const updateError = new Error("Still no permissions");
      const updated = createFakeMessage("msg-1", {
        suppressEmbeds: vi.fn().mockRejectedValue(updateError),
      });

      await suppressor.handleMessageUpdate({} as any, updated);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to suppress embeds via messageUpdate"),
        expect.anything(),
      );
      // Stays tracked for next messageUpdate or sweep cleanup
      const rows = db.select().from(failedSuppresses).all();
      expect(rows).toHaveLength(1);
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe("resumePending", () => {
    it("processes entries from DB on startup", async () => {
      db.insert(failedSuppresses)
        .values({ messageId: "msg-1", channelId: "channel-1", createdAt: Date.now() })
        .run();

      const mockMessage: any = {
        id: "msg-1",
        flags: { has: () => false },
        suppressEmbeds: vi.fn().mockResolvedValue(undefined),
      };
      const mockChannel: any = {
        id: "channel-1",
        name: "general",
        isTextBased: () => true,
        messages: { fetch: vi.fn().mockResolvedValue(mockMessage) },
      };
      const mockClient: any = {
        channels: { fetch: vi.fn().mockResolvedValue(mockChannel) },
      };

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await suppressor.resumePending(mockClient);

      expect(mockMessage.suppressEmbeds).toHaveBeenCalledWith(true);
      const rows = db.select().from(failedSuppresses).all();
      expect(rows).toHaveLength(0);
      logSpy.mockRestore();
    });

    it("skips already-suppressed messages", async () => {
      db.insert(failedSuppresses)
        .values({ messageId: "msg-1", channelId: "channel-1", createdAt: Date.now() })
        .run();

      const mockMessage: any = {
        id: "msg-1",
        flags: {
          has: (flag: number) => flag === MessageFlags.SuppressEmbeds,
        },
        suppressEmbeds: vi.fn(),
      };
      const mockChannel: any = {
        id: "channel-1",
        isTextBased: () => true,
        messages: { fetch: vi.fn().mockResolvedValue(mockMessage) },
      };
      const mockClient: any = {
        channels: { fetch: vi.fn().mockResolvedValue(mockChannel) },
      };
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await suppressor.resumePending(mockClient);

      expect(mockMessage.suppressEmbeds).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it("does nothing with empty DB", async () => {
      const mockClient: any = {
        channels: { fetch: vi.fn() },
      };

      await suppressor.resumePending(mockClient);

      expect(mockClient.channels.fetch).not.toHaveBeenCalled();
    });

    it("logs warning on fetch failure", async () => {
      db.insert(failedSuppresses)
        .values({ messageId: "msg-1", channelId: "channel-1", createdAt: Date.now() })
        .run();

      const mockClient: any = {
        channels: { fetch: vi.fn().mockRejectedValue(new Error("Unknown Channel")) },
      };
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await suppressor.resumePending(mockClient);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to resume suppression"),
        expect.anything(),
      );
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe("sweep", () => {
    it("cleans expired entries and logs", async () => {
      const error = createError50013();
      const message = createFakeMessage("msg-1", {
        suppressEmbeds: vi.fn().mockRejectedValue(error),
      });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await suppressor.suppress(message);

      expect(db.select().from(failedSuppresses).all()).toHaveLength(1);

      vi.advanceTimersByTime(5 * 60 * 1000);
      suppressor.sweep();

      expect(db.select().from(failedSuppresses).all()).toHaveLength(0);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Sweep: removed 1"));
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("logs when no entries expired", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      suppressor.sweep();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Sweep: no expired entries"));
      logSpy.mockRestore();
    });
  });
});
