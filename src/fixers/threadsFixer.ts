import { EmbedFixer, FixRequest, FixResult } from "./types";

export class ThreadsFixer implements EmbedFixer {
  private readonly pattern = /^https?:\/\/(www\.)?threads\.net\//;

  canHandle(url: string): boolean {
    return this.pattern.test(url);
  }

  fix(request: FixRequest): FixResult {
    const parsed = new URL(request.url);
    parsed.hostname = "fixthreads.net";

    return { url: parsed.toString(), source: "threads" };
  }
}
