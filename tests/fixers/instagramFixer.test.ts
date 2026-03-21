import { describe, it, expect } from "vitest";
import { InstagramFixer } from "../../src/fixers/instagramFixer";

describe("InstagramFixer", () => {
  const fixer = new InstagramFixer();

  describe("canHandle", () => {
    it("returns true for instagram.com URLs", () => {
      expect(fixer.canHandle("https://instagram.com/p/abc123")).toBe(true);
    });

    it("returns true for www.instagram.com URLs", () => {
      expect(fixer.canHandle("https://www.instagram.com/p/abc123")).toBe(true);
    });

    it("returns false for ddinstagram.com URLs", () => {
      expect(fixer.canHandle("https://ddinstagram.com/p/abc123")).toBe(false);
    });

    it("returns false for random URLs", () => {
      expect(fixer.canHandle("https://google.com")).toBe(false);
    });
  });

  describe("fix", () => {
    it("swaps domain to ddinstagram.com", () => {
      const result = fixer.fix({
        url: "https://instagram.com/p/abc123",
        serverConfig: {},
      });
      expect(result.url).toBe("https://ddinstagram.com/p/abc123");
    });

    it("preserves the full URL path", () => {
      const result = fixer.fix({
        url: "https://instagram.com/reel/xyz789/",
        serverConfig: {},
      });
      expect(result.url).toBe("https://ddinstagram.com/reel/xyz789/");
    });

    it("handles www.instagram.com", () => {
      const result = fixer.fix({
        url: "https://www.instagram.com/p/abc123",
        serverConfig: {},
      });
      expect(result.url).toBe("https://ddinstagram.com/p/abc123");
    });

    it("sets source to instagram", () => {
      const result = fixer.fix({
        url: "https://instagram.com/p/abc123",
        serverConfig: {},
      });
      expect(result.source).toBe("instagram");
    });
  });
});
