import { ReplyTracker } from "./types";

interface TrackedReply {
  replyMessageId: string;
  expiresAt: number;
}

export class InMemoryReplyTracker implements ReplyTracker {
  private cache = new Map<string, TrackedReply>();
  private sweepInterval: ReturnType<typeof setInterval>;

  constructor(private ttlMs: number = 10 * 60 * 1000) {
    this.sweepInterval = setInterval(() => this.sweep(), 60_000);
    this.sweepInterval.unref();
  }

  track(originalMessageId: string, replyMessageId: string): void {
    this.cache.set(originalMessageId, {
      replyMessageId,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  get(originalMessageId: string): string | undefined {
    const entry = this.cache.get(originalMessageId);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(originalMessageId);
      return undefined;
    }
    return entry.replyMessageId;
  }

  delete(originalMessageId: string): void {
    this.cache.delete(originalMessageId);
  }

  sweep(): void {
    const now = Date.now();
    for (const [id, entry] of this.cache) {
      if (now >= entry.expiresAt) {
        this.cache.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.sweepInterval);
    this.cache.clear();
  }
}
