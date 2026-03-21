export interface ReplyTracker {
  track(originalMessageId: string, replyMessageId: string): void;
  get(originalMessageId: string): string | undefined;
  delete(originalMessageId: string): void;
  destroy(): void;
}
