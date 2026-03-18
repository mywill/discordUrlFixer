import { EmbedFixer, FixRequest, FixResult } from "./types";

export class BlueskyFixer implements EmbedFixer {
  private readonly pattern = /^https?:\/\/(www\.)?bsky\.app\//;

  canHandle(url: string): boolean {
    return this.pattern.test(url);
  }

  fix(request: FixRequest): FixResult {
    const parsed = new URL(request.url);
    parsed.hostname = "fxbsky.app";

    return { url: parsed.toString(), source: "bluesky" };
  }
}
