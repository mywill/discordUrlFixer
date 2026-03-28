import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChannelType } from "discord.js";
import { InMemoryReplyTracker } from "../../src/reply-tracker/inMemoryReplyTracker";
import { createMessageHandler } from "../../src/handlers/messageCreate";

function createFakeMessage(
  id: string,
  overrides?: Partial<{
    content: string;
    guildId: string | null;
    isBot: boolean;
    channelName: string;
    channelId: string;
    guildName: string;
    isThread: boolean;
    suppressEmbeds: ReturnType<typeof vi.fn>;
    reply: ReturnType<typeof vi.fn>;
  }>,
) {
  const opts = {
    content: "check https://twitter.com/user/status/123",
    guildId: "guild-1",
    isBot: false,
    channelName: "general",
    channelId: "channel-1",
    guildName: "Test Server",
    isThread: false,
    suppressEmbeds: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue({ id: `reply-${id}` }),
    ...overrides,
  };

  return {
    id,
    content: opts.content,
    guildId: opts.guildId,
    author: { bot: opts.isBot },
    guild: opts.guildId ? { name: opts.guildName, members: { me: null } } : null,
    channel: {
      id: opts.channelId,
      name: opts.channelName,
      type: ChannelType.GuildText,
      isThread: () => opts.isThread,
    },
    suppressEmbeds: opts.suppressEmbeds,
    reply: opts.reply,
  } as any;
}

function createMockRegistry(hasResults = true) {
  return {
    processUrls: vi
      .fn()
      .mockReturnValue(
        hasResults ? [{ url: "https://fxtwitter.com/user/status/123", source: "twitter.com" }] : [],
      ),
  } as any;
}

function createMockConfigRepo() {
  return {
    getServerConfig: vi.fn().mockReturnValue({ useMarkdownLinksAsShortener: true }),
  } as any;
}

function createError50013(): Error {
  const error = new Error("Missing Permissions");
  (error as any).code = 50013;
  return error;
}

describe("messageCreate handler", () => {
  let tracker: InMemoryReplyTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = new InMemoryReplyTracker();
  });

  afterEach(() => {
    tracker.destroy();
    vi.useRealTimers();
  });

  it("suppresses embeds and replies on matching URL", async () => {
    const message = createFakeMessage("msg-1");
    const handler = createMessageHandler(createMockRegistry(), createMockConfigRepo(), tracker);

    const promise = handler(message);
    await vi.advanceTimersByTimeAsync(300);
    await promise;

    expect(message.suppressEmbeds).toHaveBeenCalledWith(true);
    expect(message.reply).toHaveBeenCalledWith({
      content: "[twitter.com](https://fxtwitter.com/user/status/123)",
      allowedMentions: { repliedUser: false },
    });
    expect(tracker.get("msg-1")).toBe("reply-msg-1");
  });

  it("ignores bot messages", async () => {
    const message = createFakeMessage("msg-1", { isBot: true });
    const handler = createMessageHandler(createMockRegistry(), createMockConfigRepo(), tracker);

    await handler(message);

    expect(message.suppressEmbeds).not.toHaveBeenCalled();
    expect(message.reply).not.toHaveBeenCalled();
  });

  it("ignores messages containing fxignore", async () => {
    const message = createFakeMessage("msg-1", {
      content: "https://twitter.com/user/status/123 fxignore",
    });
    const handler = createMessageHandler(createMockRegistry(), createMockConfigRepo(), tracker);

    await handler(message);

    expect(message.suppressEmbeds).not.toHaveBeenCalled();
    expect(message.reply).not.toHaveBeenCalled();
  });

  it("ignores messages with no URLs", async () => {
    const message = createFakeMessage("msg-1", { content: "hello world" });
    const handler = createMessageHandler(createMockRegistry(), createMockConfigRepo(), tracker);

    await handler(message);

    expect(message.suppressEmbeds).not.toHaveBeenCalled();
  });

  it("ignores DMs (no guildId)", async () => {
    const message = createFakeMessage("msg-1", { guildId: null });
    const handler = createMessageHandler(createMockRegistry(), createMockConfigRepo(), tracker);

    await handler(message);

    expect(message.suppressEmbeds).not.toHaveBeenCalled();
  });

  it("ignores messages with no fixer matches", async () => {
    const message = createFakeMessage("msg-1");
    const handler = createMessageHandler(
      createMockRegistry(false),
      createMockConfigRepo(),
      tracker,
    );

    await handler(message);

    expect(message.suppressEmbeds).not.toHaveBeenCalled();
    expect(message.reply).not.toHaveBeenCalled();
  });

  it("retries on first 50013 and succeeds on second attempt", async () => {
    const error = createError50013();
    const message = createFakeMessage("msg-1", {
      suppressEmbeds: vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(undefined),
    });
    const handler = createMessageHandler(createMockRegistry(), createMockConfigRepo(), tracker);

    const promise = handler(message);
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(700);
    await promise;

    expect(message.suppressEmbeds).toHaveBeenCalledTimes(2);
    expect(tracker.get("msg-1")).toBe("reply-msg-1");
  });

  it("retries up to three times on consecutive 50013 errors", async () => {
    const error = createError50013();
    const message = createFakeMessage("msg-1", {
      suppressEmbeds: vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined),
    });
    const handler = createMessageHandler(createMockRegistry(), createMockConfigRepo(), tracker);

    const promise = handler(message);
    await vi.advanceTimersByTimeAsync(300); // initial delay
    await vi.advanceTimersByTimeAsync(700); // first retry delay
    await vi.advanceTimersByTimeAsync(1000); // second retry delay
    await promise;

    expect(message.suppressEmbeds).toHaveBeenCalledTimes(3);
    expect(tracker.get("msg-1")).toBe("reply-msg-1");
  });

  it("logs warning with diagnostics when all three attempts fail with 50013", async () => {
    const error = createError50013();
    const message = createFakeMessage("msg-1", {
      suppressEmbeds: vi.fn().mockRejectedValue(error),
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const handler = createMessageHandler(createMockRegistry(), createMockConfigRepo(), tracker);

    const promise = handler(message);
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(700);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(message.suppressEmbeds).toHaveBeenCalledTimes(3);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("attempts failed"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Channel type: GuildText"));
    warnSpy.mockRestore();
  });

  it("includes permission details in diagnostics when bot member is cached", async () => {
    const error = createError50013();
    const message = createFakeMessage("msg-1", {
      suppressEmbeds: vi.fn().mockRejectedValue(error),
    });
    message.guild.members.me = {};
    message.channel.permissionsFor = vi.fn().mockReturnValue({
      has: (flag: bigint) => {
        const ManageMessages = 1n << 13n;
        return flag !== ManageMessages;
      },
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const handler = createMessageHandler(createMockRegistry(), createMockConfigRepo(), tracker);

    const promise = handler(message);
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(700);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("MISSING: ManageMessages"));
    warnSpy.mockRestore();
  });

  it("does not retry on non-50013 errors", async () => {
    const error = new Error("Unknown Message");
    (error as any).code = 10008;
    const message = createFakeMessage("msg-1", {
      suppressEmbeds: vi.fn().mockRejectedValue(error),
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createMessageHandler(createMockRegistry(), createMockConfigRepo(), tracker);

    const promise = handler(message);
    await vi.advanceTimersByTimeAsync(300);
    await promise;

    expect(message.suppressEmbeds).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it("tracks reply even when suppress fails", async () => {
    const message = createFakeMessage("msg-1", {
      suppressEmbeds: vi.fn().mockRejectedValue(new Error("fail")),
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createMessageHandler(createMockRegistry(), createMockConfigRepo(), tracker);

    const promise = handler(message);
    await vi.advanceTimersByTimeAsync(300);
    await promise;

    expect(tracker.get("msg-1")).toBe("reply-msg-1");
    consoleSpy.mockRestore();
  });

  it("does not track reply when reply fails", async () => {
    const message = createFakeMessage("msg-1", {
      reply: vi.fn().mockRejectedValue(new Error("Cannot send")),
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createMessageHandler(createMockRegistry(), createMockConfigRepo(), tracker);

    const promise = handler(message);
    await vi.advanceTimersByTimeAsync(300);
    await promise;

    expect(tracker.get("msg-1")).toBeUndefined();
    consoleSpy.mockRestore();
  });
});
