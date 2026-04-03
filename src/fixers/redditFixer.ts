import { EmbedFixer, FixRequest, FixResult } from "./types";

export class RedditFixer implements EmbedFixer {
  private readonly pattern = /^https?:\/\/(www\.|old\.|new\.)?reddit\.com\//;
  private isShortlink = /\/s\/[A-Za-z0-9]+/;

  canHandle(url: string): boolean {
    return this.pattern.test(url);
  }

  fix(request: FixRequest): FixResult | Promise<FixResult> {
    if (this.isShortlink.test(new URL(request.url).pathname)) {
      return this.resolveAndFix(request.url);
    }

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

  private async resolveAndFix(url: string): Promise<FixResult> {
    // HEAD request to follow redirect
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual", // or use 'follow' and check finalURL
    });

    // Reddit returns 301/302 to the real permalink
    const realUrl = new URL(response.headers.get("location") || response.url);
    realUrl.search = "";
    // Now apply your transformations to the resolved URL
    const vxUrl = new URL(realUrl);
    vxUrl.hostname = "vxreddit.com";

    const oldUrl = new URL(realUrl);
    oldUrl.hostname = "old.reddit.com";

    return {
      url: vxUrl.toString(),
      source: "vxreddit",
      secondaryUrl: oldUrl.toString(),
      secondarySource: "oldReddit",
    };
  }
}
