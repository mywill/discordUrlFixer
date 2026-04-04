import { EmbedFixer, FixRequest, FixResult } from "./types";

const DEFAULT_EMBED_DOMAIN = "fxtwitter.com";

export class TwitterFixer implements EmbedFixer {
  private readonly pattern = /^https?:\/\/(www\.)?twitter\.com\//;

  canHandle(url: string): boolean {
    return this.pattern.test(url);
  }

  fix(request: FixRequest): FixResult {
    const parsed = new URL(request.url);
    const embedDomain = process.env.TWITTER_EMBED_DOMAIN ?? DEFAULT_EMBED_DOMAIN;
    parsed.hostname = embedDomain;
    if (parsed.host.startsWith("www.")) {
      parsed.hostname = embedDomain;
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
