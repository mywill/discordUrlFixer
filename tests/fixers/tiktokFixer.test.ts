import { describe, it, expect, afterEach } from "vitest";
import { TikTokFixer } from "../../src/fixers/tiktokFixer";

describe("TikTokFixer", () => {
  const fixer = new TikTokFixer();

  afterEach(() => {
    delete process.env.TIKTOK_EMBED_DOMAIN;
  });

  describe("canHandle", () => {
    it("returns true for tiktok.com URLs", () => {
      expect(fixer.canHandle("https://tiktok.com/@user/video/123")).toBe(true);
    });

    it("returns true for www.tiktok.com URLs", () => {
      expect(fixer.canHandle("https://www.tiktok.com/@user/video/123")).toBe(true);
    });

    it("returns true for vm.tiktok.com URLs", () => {
      expect(fixer.canHandle("https://vm.tiktok.com/abc123/")).toBe(true);
    });

    it("returns false for tnktok.com URLs", () => {
      expect(fixer.canHandle("https://tnktok.com/@user/video/123")).toBe(false);
    });

    it("returns false for random URLs", () => {
      expect(fixer.canHandle("https://google.com")).toBe(false);
    });
  });

  describe("fix", () => {
    it("swaps domain to tnktok.com", () => {
      const result = fixer.fix({
        url: "https://tiktok.com/@user/video/123",
        serverConfig: {},
      });
      expect(result.url).toBe("https://tnktok.com/@user/video/123");
    });

    it("handles vm.tiktok.com short links", () => {
      const result = fixer.fix({
        url: "https://vm.tiktok.com/abc123/",
        serverConfig: {},
      });
      expect(result.url).toBe("https://tnktok.com/abc123/");
    });

    it("handles www.tiktok.com", () => {
      const result = fixer.fix({
        url: "https://www.tiktok.com/@user/video/123",
        serverConfig: {},
      });
      expect(result.url).toBe("https://tnktok.com/@user/video/123");
    });

    it("sets source to tiktok", () => {
      const result = fixer.fix({
        url: "https://tiktok.com/@user/video/123",
        serverConfig: {},
      });
      expect(result.source).toBe("tiktok");
    });

    it("uses TIKTOK_EMBED_DOMAIN env var when set", () => {
      process.env.TIKTOK_EMBED_DOMAIN = "vxtiktok.com";
      const result = fixer.fix({
        url: "https://tiktok.com/@user/video/123",
        serverConfig: {},
      });
      expect(result.url).toBe("https://vxtiktok.com/@user/video/123");
    });
  });
});
