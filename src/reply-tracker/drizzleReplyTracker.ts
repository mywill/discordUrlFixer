import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq, and, gt, lte } from "drizzle-orm";
import { ReplyTracker } from "./types";
import { replyTracker } from "../database/schema";

export class DrizzleReplyTracker implements ReplyTracker {
  private sweepInterval: ReturnType<typeof setInterval>;

  constructor(
    private db: BetterSQLite3Database,
    private ttlMs: number = 24 * 60 * 60 * 1000,
  ) {
    this.sweepInterval = setInterval(() => this.sweep(), 60_000);
    this.sweepInterval.unref();
  }

  track(originalMessageId: string, replyMessageId: string): void {
    this.db
      .insert(replyTracker)
      .values({
        originalMessageId,
        replyMessageId,
        expiresAt: Date.now() + this.ttlMs,
      })
      .onConflictDoUpdate({
        target: replyTracker.originalMessageId,
        set: {
          replyMessageId,
          expiresAt: Date.now() + this.ttlMs,
        },
      })
      .run();
  }

  get(originalMessageId: string): string | undefined {
    const rows = this.db
      .select({ replyMessageId: replyTracker.replyMessageId })
      .from(replyTracker)
      .where(
        and(
          eq(replyTracker.originalMessageId, originalMessageId),
          gt(replyTracker.expiresAt, Date.now()),
        ),
      )
      .all();

    return rows.length > 0 ? rows[0].replyMessageId : undefined;
  }

  delete(originalMessageId: string): void {
    this.db.delete(replyTracker).where(eq(replyTracker.originalMessageId, originalMessageId)).run();
  }

  sweep(): void {
    this.db.delete(replyTracker).where(lte(replyTracker.expiresAt, Date.now())).run();
  }

  destroy(): void {
    clearInterval(this.sweepInterval);
  }
}
