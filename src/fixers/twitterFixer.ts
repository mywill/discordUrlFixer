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

    const language = request.serverConfig.twitter?.language ?? "en";
    if (language) {
      const url = new URL(fixedUrl);
      url.pathname = url.pathname.replace(/\/?$/, `/${language}`);
      fixedUrl = url.toString();
    }

    return { url: fixedUrl, source: "twitter" };
  }
}
