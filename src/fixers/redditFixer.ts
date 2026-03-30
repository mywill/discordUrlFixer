import { EmbedFixer, FixRequest, FixResult } from "./types";

export class RedditFixer implements EmbedFixer {
  private readonly pattern = /^https?:\/\/(www\.|old\.|new\.)?reddit\.com\//;

  canHandle(url: string): boolean {
    return this.pattern.test(url);
  }

  fix(request: FixRequest): FixResult {
    const parsed = new URL(request.url);
    parsed.hostname = "vxreddit.com";

    const result: FixResult = { url: parsed.toString(), source: "reddit" };

    if (request.serverConfig.reddit?.includeOldRedditLink !== false) {
      const oldParsed = new URL(request.url);
      oldParsed.hostname = "old.reddit.com";
      result.secondaryUrl = oldParsed.toString();
      result.secondarySource = "oldReddit";
    }

    return result;
  }
}
