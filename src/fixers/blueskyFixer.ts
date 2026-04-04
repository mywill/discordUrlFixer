import { EmbedFixer, FixRequest, FixResult } from "./types";

const DEFAULT_EMBED_DOMAIN = "fxbsky.app";

export class BlueskyFixer implements EmbedFixer {
  private readonly pattern = /^https?:\/\/(www\.)?bsky\.app\//;

  canHandle(url: string): boolean {
    return this.pattern.test(url);
  }

  fix(request: FixRequest): FixResult {
    const parsed = new URL(request.url);
    parsed.hostname = process.env.BLUESKY_EMBED_DOMAIN ?? DEFAULT_EMBED_DOMAIN;

    return { url: parsed.toString(), source: "bluesky" };
  }
}
