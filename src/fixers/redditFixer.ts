import { EmbedFixer, FixRequest, FixResult } from "./types";
import { ServerConfig } from "../config-repo/types";

export class RedditFixer implements EmbedFixer {
  private readonly pattern = /^https?:\/\/(www\.|old\.|new\.)?reddit\.com\//;
  private isShortlink = /\/s\/[A-Za-z0-9]+/;

  canHandle(url: string): boolean {
    return this.pattern.test(url);
  }

  fix(request: FixRequest): FixResult | Promise<FixResult> {
    if (this.isShortlink.test(new URL(request.url).pathname)) {
      return this.resolveAndFix(request);
    }

    return this.fixUrl(request.url, request.serverConfig);
  }

  private async resolveAndFix(request: FixRequest): Promise<FixResult> {
    try {
      const response = await fetch(request.url, {
        method: "HEAD",
        redirect: "manual",
      });
      const location = response.headers.get("location");
      if (!location) {
        console.warn(
          `No redirect for ${request.url} (status ${response.status}), using original URL`,
        );
        return this.fixUrl(request.url, request.serverConfig);
      }
      const resolvedUrl = new URL(location);
      resolvedUrl.search = "";
      return this.fixUrl(resolvedUrl.toString(), request.serverConfig);
    } catch (error) {
      console.warn(`Failed to resolve redirect for ${request.url}:`, error);
      return this.fixUrl(request.url, request.serverConfig);
    }
  }

  private fixUrl(url: string, serverConfig: ServerConfig): FixResult {
    const parsed = new URL(url);
    parsed.hostname = "vxreddit.com";

    const result: FixResult = { url: parsed.toString(), source: "reddit" };

    if (serverConfig.reddit?.includeOldRedditLink !== false) {
      const oldParsed = new URL(url);
      oldParsed.hostname = "old.reddit.com";
      result.secondaryUrl = oldParsed.toString();
      result.secondarySource = "oldReddit";
    }

    return result;
  }
}
