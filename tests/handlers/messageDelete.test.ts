import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Collection } from "discord.js";
import { InMemoryReplyTracker } from "../../src/reply-tracker/inMemoryReplyTracker";
import { EmbedSuppressor } from "../../src/embed-suppressor/types";
import {
  createMessageDeleteHandler,
  createMessageDeleteBulkHandler,
} from "../../src/handlers/messageDelete";

function createMockSuppressor(): EmbedSuppressor {
  return {
    suppress: vi.fn().mockResolvedValue(undefined),
    handleMessageUpdate: vi.fn().mockResolvedValue(undefined),
    setClient: vi.fn(),
    untrackIfPending: vi.fn(),
    resumePending: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  };
}

function createFakeMessage(
  id: string,
  options?: { fetchThrows?: boolean; deleteThrows?: boolean },
) {
  const replyMessage = {
    delete: options?.deleteThrows
      ? vi.fn().mockRejectedValue(new Error("Missing Permissions"))
      : vi.fn().mockResolvedValue(undefined),
  };

  return {
    id,
    channel: {
      messages: {
        fetch: options?.fetchThrows
          ? vi.fn().mockRejectedValue(new Error("Unknown Message"))
          : vi.fn().mockResolvedValue(replyMessage),
      },
    },
  } as any;
}

describe("messageDelete handler", () => {
  let tracker: InMemoryReplyTracker;
  let suppressor: EmbedSuppressor;

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = new InMemoryReplyTracker();
    suppressor = createMockSuppressor();
  });

  afterEach(() => {
    tracker.destroy();
    vi.useRealTimers();
  });

  it("deletes bot reply when original is deleted and tracked", async () => {
    tracker.track("orig-1", "reply-1");
    const message = createFakeMessage("orig-1");
    const handler = createMessageDeleteHandler(tracker, suppressor);

    await handler(message);

    expect(message.channel.messages.fetch).toHaveBeenCalledWith("reply-1");
    const replyMsg = await message.channel.messages.fetch.mock.results[0].value;
    expect(replyMsg.delete).toHaveBeenCalled();
  });

  it("is a no-op when message is not tracked", async () => {
    const message = createFakeMessage("unknown");
    const handler = createMessageDeleteHandler(tracker, suppressor);

    await handler(message);

    expect(message.channel.messages.fetch).not.toHaveBeenCalled();
  });

  it("does not crash when messages.fetch() throws", async () => {
    tracker.track("orig-1", "reply-1");
    const message = createFakeMessage("orig-1", { fetchThrows: true });
    const handler = createMessageDeleteHandler(tracker, suppressor);

    await expect(handler(message)).resolves.toBeUndefined();
  });

  it("does not crash when delete() throws", async () => {
    tracker.track("orig-1", "reply-1");
    const message = createFakeMessage("orig-1", { deleteThrows: true });
    const handler = createMessageDeleteHandler(tracker, suppressor);

    await expect(handler(message)).resolves.toBeUndefined();
  });

  it("removes entry from tracker after processing", async () => {
    tracker.track("orig-1", "reply-1");
    const message = createFakeMessage("orig-1");
    const handler = createMessageDeleteHandler(tracker, suppressor);

    await handler(message);

    expect(tracker.get("orig-1")).toBeUndefined();
  });
});

describe("messageDeleteBulk handler", () => {
  let tracker: InMemoryReplyTracker;
  let suppressor: EmbedSuppressor;

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = new InMemoryReplyTracker();
    suppressor = createMockSuppressor();
  });

  afterEach(() => {
    tracker.destroy();
    vi.useRealTimers();
  });

  it("processes multiple messages", async () => {
    tracker.track("orig-1", "reply-1");
    tracker.track("orig-2", "reply-2");

    const msg1 = createFakeMessage("orig-1");
    const msg2 = createFakeMessage("orig-2");
    const msg3 = createFakeMessage("orig-3");

    const collection = new Collection<string, any>();
    collection.set("orig-1", msg1);
    collection.set("orig-2", msg2);
    collection.set("orig-3", msg3);

    const handler = createMessageDeleteBulkHandler(tracker, suppressor);
    await handler(collection);

    expect(msg1.channel.messages.fetch).toHaveBeenCalledWith("reply-1");
    expect(msg2.channel.messages.fetch).toHaveBeenCalledWith("reply-2");
    expect(msg3.channel.messages.fetch).not.toHaveBeenCalled();
  });
});
