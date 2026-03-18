import { describe, it, expect } from "vitest";
import { TwitterFixer } from "../../src/fixers/twitterFixer";

describe("TwitterFixer", () => {
  const fixer = new TwitterFixer();

  describe("canHandle", () => {
    it("returns true for twitter.com URLs", () => {
      expect(fixer.canHandle("https://twitter.com/user/status/123")).toBe(true);
    });

    it("returns true for www.twitter.com URLs", () => {
      expect(fixer.canHandle("https://www.twitter.com/user/status/123")).toBe(true);
    });

    it("returns true for http twitter.com URLs", () => {
      expect(fixer.canHandle("http://twitter.com/user/status/123")).toBe(true);
    });

    it("returns false for fxtwitter.com URLs", () => {
      expect(fixer.canHandle("https://fxtwitter.com/user/status/123")).toBe(false);
    });

    it("returns false for x.com URLs", () => {
      expect(fixer.canHandle("https://x.com/user/status/123")).toBe(false);
    });

    it("returns false for random URLs", () => {
      expect(fixer.canHandle("https://google.com")).toBe(false);
    });
  });

  describe("fix", () => {
    it("swaps domain to fxtwitter.com", () => {
      const result = fixer.fix({
        url: "https://twitter.com/user/status/123",
        serverConfig: {},
      });
      expect(result.url).toBe("https://fxtwitter.com/user/status/123");
    });

    it("preserves the full URL path", () => {
      const result = fixer.fix({
        url: "https://twitter.com/elonmusk/status/1234567890?s=20",
        serverConfig: {},
      });
      expect(result.url).toBe("https://fxtwitter.com/elonmusk/status/1234567890?s=20");
    });

    it("handles www.twitter.com", () => {
      const result = fixer.fix({
        url: "https://www.twitter.com/user/status/123",
        serverConfig: {},
      });
      expect(result.url).toBe("https://fxtwitter.com/user/status/123");
    });

    it("inserts language prefix when configured", () => {
      const result = fixer.fix({
        url: "https://twitter.com/user/status/123",
        serverConfig: { twitter: { language: "en" } },
      });
      expect(result.url).toBe("https://fxtwitter.com/en/user/status/123");
    });

    it("inserts Japanese language prefix", () => {
      const result = fixer.fix({
        url: "https://twitter.com/user/status/123",
        serverConfig: { twitter: { language: "ja" } },
      });
      expect(result.url).toBe("https://fxtwitter.com/ja/user/status/123");
    });

    it("works without language config", () => {
      const result = fixer.fix({
        url: "https://twitter.com/user/status/123",
        serverConfig: { twitter: {} },
      });
      expect(result.url).toBe("https://fxtwitter.com/user/status/123");
    });

    it("sets source to twitter", () => {
      const result = fixer.fix({
        url: "https://twitter.com/user/status/123",
        serverConfig: {},
      });
      expect(result.source).toBe("twitter");
    });
  });
});
