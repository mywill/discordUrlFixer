import { describe, it, expect, afterEach } from "vitest";
import { XFixer } from "../../src/fixers/xFixer";

describe("XFixer", () => {
  const fixer = new XFixer();

  afterEach(() => {
    delete process.env.X_EMBED_DOMAIN;
  });

  describe("canHandle", () => {
    it("returns true for x.com URLs", () => {
      expect(fixer.canHandle("https://x.com/user/status/123")).toBe(true);
    });

    it("returns true for www.x.com URLs", () => {
      expect(fixer.canHandle("https://www.x.com/user/status/123")).toBe(true);
    });

    it("returns false for fixupx.com URLs", () => {
      expect(fixer.canHandle("https://fixupx.com/user/status/123")).toBe(false);
    });

    it("returns false for twitter.com URLs", () => {
      expect(fixer.canHandle("https://twitter.com/user/status/123")).toBe(false);
    });

    it("returns false for random URLs", () => {
      expect(fixer.canHandle("https://google.com")).toBe(false);
    });
  });

  describe("fix", () => {
    it("swaps domain to fixupx.com with default en suffix", () => {
      const result = fixer.fix({
        url: "https://x.com/user/status/123",
        serverConfig: {},
      });
      expect(result.url).toBe("https://fixupx.com/user/status/123/en");
    });

    it("preserves query string with default en suffix", () => {
      const result = fixer.fix({
        url: "https://x.com/elonmusk/status/1234567890?s=20",
        serverConfig: {},
      });
      expect(result.url).toBe("https://fixupx.com/elonmusk/status/1234567890/en?s=20");
    });

    it("handles www.x.com", () => {
      const result = fixer.fix({
        url: "https://www.x.com/user/status/123",
        serverConfig: {},
      });
      expect(result.url).toBe("https://fixupx.com/user/status/123/en");
    });

    it("appends language suffix when configured", () => {
      const result = fixer.fix({
        url: "https://x.com/user/status/123",
        serverConfig: { twitter: { language: "en" } },
      });
      expect(result.url).toBe("https://fixupx.com/user/status/123/en");
    });

    it("defaults to en without language config", () => {
      const result = fixer.fix({
        url: "https://x.com/user/status/123",
        serverConfig: { twitter: {} },
      });
      expect(result.url).toBe("https://fixupx.com/user/status/123/en");
    });

    it("omits language prefix when opted out with empty string", () => {
      const result = fixer.fix({
        url: "https://x.com/user/status/123",
        serverConfig: { twitter: { language: "" } },
      });
      expect(result.url).toBe("https://fixupx.com/user/status/123");
    });

    it("sets source to x", () => {
      const result = fixer.fix({
        url: "https://x.com/user/status/123",
        serverConfig: {},
      });
      expect(result.source).toBe("twitter");
    });

    it("uses X_EMBED_DOMAIN env var when set", () => {
      process.env.X_EMBED_DOMAIN = "fixvx.com";
      const result = fixer.fix({
        url: "https://x.com/user/status/123",
        serverConfig: { twitter: { language: "" } },
      });
      expect(result.url).toBe("https://fixvx.com/user/status/123");
    });
  });
});
