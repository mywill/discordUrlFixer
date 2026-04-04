import { EmbedFixer, FixRequest, FixResult } from "./types";

const DEFAULT_EMBED_DOMAIN = "tnktok.com";

export class TikTokFixer implements EmbedFixer {
  private readonly pattern = /^https?:\/\/(www\.|vm\.)?tiktok\.com\//;

  canHandle(url: string): boolean {
    return this.pattern.test(url);
  }

  fix(request: FixRequest): FixResult {
    const parsed = new URL(request.url);
    parsed.hostname = process.env.TIKTOK_EMBED_DOMAIN ?? DEFAULT_EMBED_DOMAIN;

    return { url: parsed.toString(), source: "tiktok" };
  }
}
