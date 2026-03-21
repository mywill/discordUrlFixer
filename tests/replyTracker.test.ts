import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InMemoryReplyTracker } from "../src/reply-tracker/inMemoryReplyTracker";

describe("InMemoryReplyTracker", () => {
  let tracker: InMemoryReplyTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = new InMemoryReplyTracker(10_000);
  });

  afterEach(() => {
    tracker.destroy();
    vi.useRealTimers();
  });

  it("tracks and retrieves a reply", () => {
    tracker.track("orig-1", "reply-1");
    expect(tracker.get("orig-1")).toBe("reply-1");
  });

  it("returns undefined for unknown IDs", () => {
    expect(tracker.get("unknown")).toBeUndefined();
  });

  it("deletes entries", () => {
    tracker.track("orig-1", "reply-1");
    tracker.delete("orig-1");
    expect(tracker.get("orig-1")).toBeUndefined();
  });

  it("returns undefined for expired entries", () => {
    tracker.track("orig-1", "reply-1");
    vi.advanceTimersByTime(10_000);
    expect(tracker.get("orig-1")).toBeUndefined();
  });

  it("returns entry before TTL expires", () => {
    tracker.track("orig-1", "reply-1");
    vi.advanceTimersByTime(9_999);
    expect(tracker.get("orig-1")).toBe("reply-1");
  });

  it("sweep clears expired entries", () => {
    tracker.track("orig-1", "reply-1");
    tracker.track("orig-2", "reply-2");
    vi.advanceTimersByTime(5_000);
    tracker.track("orig-3", "reply-3");
    vi.advanceTimersByTime(5_000);

    tracker.sweep();

    expect(tracker.get("orig-1")).toBeUndefined();
    expect(tracker.get("orig-2")).toBeUndefined();
    expect(tracker.get("orig-3")).toBe("reply-3");
  });
});
