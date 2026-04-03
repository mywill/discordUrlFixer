import { EmbedFixer, FixResult } from "./types";
import { ServerConfig } from "../config-repo/types";

export class FixerRegistry {
  private fixers: EmbedFixer[] = [];

  register(fixer: EmbedFixer): void {
    this.fixers.push(fixer);
  }

  async processUrls(urls: string[], serverConfig: ServerConfig): Promise<FixResult[]> {
    const seen = new Set<string>();
    const results: FixResult[] = [];

    for (const url of urls) {
      if (seen.has(url)) continue;
      seen.add(url);

      for (const fixer of this.fixers) {
        if (fixer.canHandle(url)) {
          results.push(await fixer.fix({ url, serverConfig }));
          break;
        }
      }
    }

    return results;
  }
}
