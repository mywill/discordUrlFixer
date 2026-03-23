import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as path from "path";
import { DrizzleReplyTracker } from "../../src/reply-tracker/drizzleReplyTracker";

function createTestDb(): { db: BetterSQLite3Database; sqlite: Database.Database } {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return { db, sqlite };
}

describe("DrizzleReplyTracker", () => {
  let db: BetterSQLite3Database;
  let sqlite: Database.Database;
  let tracker: DrizzleReplyTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    ({ db, sqlite } = createTestDb());
    tracker = new DrizzleReplyTracker(db, 10_000);
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

  it("persists data across tracker instances", () => {
    tracker.track("orig-1", "reply-1");
    tracker.destroy();

    const tracker2 = new DrizzleReplyTracker(db, 10_000);
    expect(tracker2.get("orig-1")).toBe("reply-1");
    tracker2.destroy();
  });
});
