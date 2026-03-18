import { EmbedFixer, FixRequest, FixResult } from "./types";

export class XFixer implements EmbedFixer {
  private readonly pattern = /^https?:\/\/(www\.)?x\.com\//;

  canHandle(url: string): boolean {
    return this.pattern.test(url);
  }

  fix(request: FixRequest): FixResult {
    const parsed = new URL(request.url);
    parsed.hostname = "fixupx.com";

    let fixedUrl = parsed.toString();

    const language = request.serverConfig.twitter?.language;
    if (language) {
      fixedUrl = fixedUrl.replace(
        /^(https?:\/\/fixupx\.com)\//,
        `$1/${language}/`,
      );
    }

    return { url: fixedUrl, source: "x" };
  }
}
