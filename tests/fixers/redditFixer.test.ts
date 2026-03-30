import { describe, it, expect } from "vitest";
import { RedditFixer } from "../../src/fixers/redditFixer";

describe("RedditFixer", () => {
  const fixer = new RedditFixer();

  describe("canHandle", () => {
    it("returns true for reddit.com URLs", () => {
      expect(fixer.canHandle("https://reddit.com/r/funny/comments/abc123/title/")).toBe(true);
    });

    it("returns true for www.reddit.com URLs", () => {
      expect(fixer.canHandle("https://www.reddit.com/r/funny/comments/abc123/title/")).toBe(true);
    });

    it("returns true for old.reddit.com URLs", () => {
      expect(fixer.canHandle("https://old.reddit.com/r/funny/comments/abc123/title/")).toBe(true);
    });

    it("returns true for new.reddit.com URLs", () => {
      expect(fixer.canHandle("https://new.reddit.com/r/funny/comments/abc123/title/")).toBe(true);
    });

    it("returns false for redd.it shortlinks", () => {
      expect(fixer.canHandle("https://redd.it/abc123")).toBe(false);
    });

    it("returns false for vxreddit.com URLs", () => {
      expect(fixer.canHandle("https://vxreddit.com/r/funny/comments/abc123/title/")).toBe(false);
    });

    it("returns false for random URLs", () => {
      expect(fixer.canHandle("https://google.com")).toBe(false);
    });
  });

  describe("fix", () => {
    it("swaps domain to vxreddit.com", () => {
      const result = fixer.fix({
        url: "https://reddit.com/r/funny/comments/abc123/title/",
        serverConfig: {},
      });
      expect(result.url).toBe("https://vxreddit.com/r/funny/comments/abc123/title/");
    });

    it("strips www subdomain", () => {
      const result = fixer.fix({
        url: "https://www.reddit.com/r/funny/comments/abc123/title/",
        serverConfig: {},
      });
      expect(result.url).toBe("https://vxreddit.com/r/funny/comments/abc123/title/");
    });

    it("strips old subdomain", () => {
      const result = fixer.fix({
        url: "https://old.reddit.com/r/funny/comments/abc123/title/",
        serverConfig: {},
      });
      expect(result.url).toBe("https://vxreddit.com/r/funny/comments/abc123/title/");
    });

    it("strips new subdomain", () => {
      const result = fixer.fix({
        url: "https://new.reddit.com/r/funny/comments/abc123/title/",
        serverConfig: {},
      });
      expect(result.url).toBe("https://vxreddit.com/r/funny/comments/abc123/title/");
    });

    it("sets source to reddit", () => {
      const result = fixer.fix({
        url: "https://reddit.com/r/funny/comments/abc123/title/",
        serverConfig: {},
      });
      expect(result.source).toBe("reddit");
    });

    it("includes old.reddit.com secondary URL by default", () => {
      const result = fixer.fix({
        url: "https://reddit.com/r/funny/comments/abc123/title/",
        serverConfig: {},
      });
      expect(result.secondaryUrl).toBe("https://old.reddit.com/r/funny/comments/abc123/title/");
      expect(result.secondarySource).toBe("oldReddit");
    });

    it("excludes secondary URL when config explicitly disabled", () => {
      const result = fixer.fix({
        url: "https://reddit.com/r/funny/comments/abc123/title/",
        serverConfig: { reddit: { includeOldRedditLink: false } },
      });
      expect(result.secondaryUrl).toBeUndefined();
      expect(result.secondarySource).toBeUndefined();
    });

    it("converts www.reddit.com to old.reddit.com in secondary URL", () => {
      const result = fixer.fix({
        url: "https://www.reddit.com/r/funny/comments/abc123/title/",
        serverConfig: { reddit: { includeOldRedditLink: true } },
      });
      expect(result.secondaryUrl).toBe("https://old.reddit.com/r/funny/comments/abc123/title/");
    });

    it("preserves old.reddit.com in secondary URL when input was old", () => {
      const result = fixer.fix({
        url: "https://old.reddit.com/r/funny/comments/abc123/title/",
        serverConfig: { reddit: { includeOldRedditLink: true } },
      });
      expect(result.secondaryUrl).toBe("https://old.reddit.com/r/funny/comments/abc123/title/");
    });
  });
});
