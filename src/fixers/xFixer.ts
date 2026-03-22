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

    const language = request.serverConfig.twitter?.language ?? "en";
    if (language) {
      const url = new URL(fixedUrl);
      url.pathname = url.pathname.replace(/\/?$/, `/${language}`);
      fixedUrl = url.toString();
    }
    return { url: fixedUrl, source: "twitter" };
  }
}
