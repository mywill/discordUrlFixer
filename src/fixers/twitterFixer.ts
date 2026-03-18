import { EmbedFixer, FixRequest, FixResult } from "./types";

export class TwitterFixer implements EmbedFixer {
  private readonly pattern = /^https?:\/\/(www\.)?twitter\.com\//;

  canHandle(url: string): boolean {
    return this.pattern.test(url);
  }

  fix(request: FixRequest): FixResult {
    const parsed = new URL(request.url);
    parsed.hostname = "fxtwitter.com";
    if (parsed.hostname === "fxtwitter.com" && parsed.host.startsWith("www.")) {
      parsed.hostname = "fxtwitter.com";
    }

    let fixedUrl = parsed.toString();

    const language = request.serverConfig.twitter?.language;
    if (language) {
      fixedUrl = fixedUrl.replace(
        /^(https?:\/\/fxtwitter\.com)\//,
        `$1/${language}/`,
      );
    }

    return { url: fixedUrl, source: "twitter" };
  }
}
