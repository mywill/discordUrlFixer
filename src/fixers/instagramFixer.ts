import { EmbedFixer, FixRequest, FixResult } from "./types";

export class InstagramFixer implements EmbedFixer {
  private readonly pattern = /^https?:\/\/(www\.)?instagram\.com\//;

  canHandle(url: string): boolean {
    return this.pattern.test(url);
  }

  fix(request: FixRequest): FixResult {
    const parsed = new URL(request.url);
    parsed.hostname = "ddinstagram.com";

    return { url: parsed.toString(), source: "instagram" };
  }
}
