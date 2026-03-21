import { describe, it, expect } from "vitest";
import { ThreadsFixer } from "../../src/fixers/threadsFixer";

describe("ThreadsFixer", () => {
  const fixer = new ThreadsFixer();

  describe("canHandle", () => {
    it("returns true for threads.net URLs", () => {
      expect(fixer.canHandle("https://threads.net/@user/post/abc123")).toBe(true);
    });

    it("returns true for www.threads.net URLs", () => {
      expect(fixer.canHandle("https://www.threads.net/@user/post/abc123")).toBe(true);
    });

    it("returns false for fixthreads.net URLs", () => {
      expect(fixer.canHandle("https://fixthreads.net/@user/post/abc123")).toBe(false);
    });

    it("returns false for random URLs", () => {
      expect(fixer.canHandle("https://google.com")).toBe(false);
    });
  });

  describe("fix", () => {
    it("swaps domain to fixthreads.net", () => {
      const result = fixer.fix({
        url: "https://threads.net/@user/post/abc123",
        serverConfig: {},
      });
      expect(result.url).toBe("https://fixthreads.net/@user/post/abc123");
    });

    it("preserves the full URL path", () => {
      const result = fixer.fix({
        url: "https://threads.net/@user/post/abc123?igshid=xyz",
        serverConfig: {},
      });
      expect(result.url).toBe("https://fixthreads.net/@user/post/abc123?igshid=xyz");
    });

    it("handles www.threads.net", () => {
      const result = fixer.fix({
        url: "https://www.threads.net/@user/post/abc123",
        serverConfig: {},
      });
      expect(result.url).toBe("https://fixthreads.net/@user/post/abc123");
    });

    it("sets source to threads", () => {
      const result = fixer.fix({
        url: "https://threads.net/@user/post/abc123",
        serverConfig: {},
      });
      expect(result.source).toBe("threads");
    });
  });
});
