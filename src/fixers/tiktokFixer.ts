import { EmbedFixer, FixRequest, FixResult } from "./types";

export class TikTokFixer implements EmbedFixer {
  private readonly pattern = /^https?:\/\/(www\.|vm\.)?tiktok\.com\//;

  canHandle(url: string): boolean {
    return this.pattern.test(url);
  }

  fix(request: FixRequest): FixResult {
    const parsed = new URL(request.url);
    parsed.hostname = "tnktok.com";

    return { url: parsed.toString(), source: "tiktok" };
  }
}
