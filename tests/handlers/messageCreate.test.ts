import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChannelType } from "discord.js";
import { InMemoryReplyTracker } from "../../src/reply-tracker/inMemoryReplyTracker";
import { createMessageHandler } from "../../src/handlers/messageCreate";
import { EmbedSuppressor } from "../../src/embed-suppressor/types";

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

function createMockSuppressor(): EmbedSuppressor & { suppress: ReturnType<typeof vi.fn> } {
  return {
    suppress: vi.fn().mockResolvedValue(undefined),
    handleMessageUpdate: vi.fn().mockResolvedValue(undefined),
    resumePending: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  };
}

describe("messageCreate handler", () => {
  let tracker: InMemoryReplyTracker;
  let suppressor: ReturnType<typeof createMockSuppressor>;

  beforeEach(() => {
    tracker = new InMemoryReplyTracker();
    suppressor = createMockSuppressor();
  });

  afterEach(() => {
    tracker.destroy();
  });

  it("calls suppressor and replies on matching URL", async () => {
    const message = createFakeMessage("msg-1");
    const handler = createMessageHandler(
      createMockRegistry(),
      createMockConfigRepo(),
      tracker,
      suppressor,
    );

    await handler(message);

    expect(suppressor.suppress).toHaveBeenCalledWith(message);
    expect(message.reply).toHaveBeenCalledWith({
      content: "[twitter.com](https://fxtwitter.com/user/status/123)",
      allowedMentions: { repliedUser: false },
    });
    expect(tracker.get("msg-1")).toBe("reply-msg-1");
  });

  it("ignores bot messages", async () => {
    const message = createFakeMessage("msg-1", { isBot: true });
    const handler = createMessageHandler(
      createMockRegistry(),
      createMockConfigRepo(),
      tracker,
      suppressor,
    );

    await handler(message);

    expect(suppressor.suppress).not.toHaveBeenCalled();
    expect(message.reply).not.toHaveBeenCalled();
  });

  it("ignores messages containing fxignore", async () => {
    const message = createFakeMessage("msg-1", {
      content: "https://twitter.com/user/status/123 fxignore",
    });
    const handler = createMessageHandler(
      createMockRegistry(),
      createMockConfigRepo(),
      tracker,
      suppressor,
    );

    await handler(message);

    expect(suppressor.suppress).not.toHaveBeenCalled();
    expect(message.reply).not.toHaveBeenCalled();
  });

  it("ignores messages with no URLs", async () => {
    const message = createFakeMessage("msg-1", { content: "hello world" });
    const handler = createMessageHandler(
      createMockRegistry(),
      createMockConfigRepo(),
      tracker,
      suppressor,
    );

    await handler(message);

    expect(suppressor.suppress).not.toHaveBeenCalled();
  });

  it("ignores DMs (no guildId)", async () => {
    const message = createFakeMessage("msg-1", { guildId: null });
    const handler = createMessageHandler(
      createMockRegistry(),
      createMockConfigRepo(),
      tracker,
      suppressor,
    );

    await handler(message);

    expect(suppressor.suppress).not.toHaveBeenCalled();
  });

  it("ignores messages with no fixer matches", async () => {
    const message = createFakeMessage("msg-1");
    const handler = createMessageHandler(
      createMockRegistry(false),
      createMockConfigRepo(),
      tracker,
      suppressor,
    );

    await handler(message);

    expect(suppressor.suppress).not.toHaveBeenCalled();
    expect(message.reply).not.toHaveBeenCalled();
  });

  it("tracks reply even when suppressor rejects", async () => {
    suppressor.suppress.mockRejectedValue(new Error("suppress failed"));
    const message = createFakeMessage("msg-1");
    const handler = createMessageHandler(
      createMockRegistry(),
      createMockConfigRepo(),
      tracker,
      suppressor,
    );

    await handler(message);

    expect(tracker.get("msg-1")).toBe("reply-msg-1");
  });

  it("formats secondary URL with middle dot separator", async () => {
    const registry = {
      processUrls: vi.fn().mockReturnValue([
        {
          url: "https://vxreddit.com/r/funny/comments/abc/title/",
          source: "reddit",
          secondaryUrl: "https://old.reddit.com/r/funny/comments/abc/title/",
          secondarySource: "old",
        },
      ]),
    } as any;

    const message = createFakeMessage("msg-1", {
      content: "https://reddit.com/r/funny/comments/abc/title/",
    });
    const handler = createMessageHandler(registry, createMockConfigRepo(), tracker, suppressor);
    await handler(message);

    expect(message.reply).toHaveBeenCalledWith({
      content:
        "[reddit](https://vxreddit.com/r/funny/comments/abc/title/) - [old](<https://old.reddit.com/r/funny/comments/abc/title/>)",
      allowedMentions: { repliedUser: false },
    });
  });

  it("does not track reply when reply fails", async () => {
    const message = createFakeMessage("msg-1", {
      reply: vi.fn().mockRejectedValue(new Error("Cannot send")),
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createMessageHandler(
      createMockRegistry(),
      createMockConfigRepo(),
      tracker,
      suppressor,
    );

    await handler(message);

    expect(tracker.get("msg-1")).toBeUndefined();
    consoleSpy.mockRestore();
  });
});
