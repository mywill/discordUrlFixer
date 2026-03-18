import { describe, it, expect } from "vitest";
import { BlueskyFixer } from "../../src/fixers/blueskyFixer";

describe("BlueskyFixer", () => {
  const fixer = new BlueskyFixer();

  describe("canHandle", () => {
    it("returns true for bsky.app URLs", () => {
      expect(fixer.canHandle("https://bsky.app/profile/user/post/789")).toBe(true);
    });

    it("returns true for www.bsky.app URLs", () => {
      expect(fixer.canHandle("https://www.bsky.app/profile/user/post/789")).toBe(true);
    });

    it("returns false for fxbsky.app URLs", () => {
      expect(fixer.canHandle("https://fxbsky.app/profile/user/post/789")).toBe(false);
    });

    it("returns false for random URLs", () => {
      expect(fixer.canHandle("https://google.com")).toBe(false);
    });
  });

  describe("fix", () => {
    it("swaps domain to fxbsky.app", () => {
      const result = fixer.fix({
        url: "https://bsky.app/profile/user/post/789",
        serverConfig: {},
      });
      expect(result.url).toBe("https://fxbsky.app/profile/user/post/789");
    });

    it("preserves the full URL path", () => {
      const result = fixer.fix({
        url: "https://bsky.app/profile/user.bsky.social/post/abc123",
        serverConfig: {},
      });
      expect(result.url).toBe("https://fxbsky.app/profile/user.bsky.social/post/abc123");
    });

    it("handles www.bsky.app", () => {
      const result = fixer.fix({
        url: "https://www.bsky.app/profile/user/post/789",
        serverConfig: {},
      });
      expect(result.url).toBe("https://fxbsky.app/profile/user/post/789");
    });

    it("sets source to bluesky", () => {
      const result = fixer.fix({
        url: "https://bsky.app/profile/user/post/789",
        serverConfig: {},
      });
      expect(result.source).toBe("bluesky");
    });
  });
});
