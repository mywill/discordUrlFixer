import { describe, it, expect, vi, afterEach } from "vitest";
import { RedditFixer } from "../../src/fixers/redditFixer";

describe("RedditFixer", () => {
  const fixer = new RedditFixer();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

    it("returns true for /s/ URLs", () => {
      expect(fixer.canHandle("https://www.reddit.com/r/MLS/s/2D9VJPDXNx")).toBe(true);
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
    it("swaps domain to vxreddit.com", async () => {
      const result = await fixer.fix({
        url: "https://reddit.com/r/funny/comments/abc123/title/",
        serverConfig: {},
      });
      expect(result.url).toBe("https://vxreddit.com/r/funny/comments/abc123/title/");
    });

    it("strips www subdomain", async () => {
      const result = await fixer.fix({
        url: "https://www.reddit.com/r/funny/comments/abc123/title/",
        serverConfig: {},
      });
      expect(result.url).toBe("https://vxreddit.com/r/funny/comments/abc123/title/");
    });

    it("strips old subdomain", async () => {
      const result = await fixer.fix({
        url: "https://old.reddit.com/r/funny/comments/abc123/title/",
        serverConfig: {},
      });
      expect(result.url).toBe("https://vxreddit.com/r/funny/comments/abc123/title/");
    });

    it("strips new subdomain", async () => {
      const result = await fixer.fix({
        url: "https://new.reddit.com/r/funny/comments/abc123/title/",
        serverConfig: {},
      });
      expect(result.url).toBe("https://vxreddit.com/r/funny/comments/abc123/title/");
    });

    it("sets source to reddit", async () => {
      const result = await fixer.fix({
        url: "https://reddit.com/r/funny/comments/abc123/title/",
        serverConfig: {},
      });
      expect(result.source).toBe("reddit");
    });

    it("includes old.reddit.com secondary URL by default", async () => {
      const result = await fixer.fix({
        url: "https://reddit.com/r/funny/comments/abc123/title/",
        serverConfig: {},
      });
      expect(result.secondaryUrl).toBe("https://old.reddit.com/r/funny/comments/abc123/title/");
      expect(result.secondarySource).toBe("oldReddit");
    });

    it("excludes secondary URL when config explicitly disabled", async () => {
      const result = await fixer.fix({
        url: "https://reddit.com/r/funny/comments/abc123/title/",
        serverConfig: { reddit: { includeOldRedditLink: false } },
      });
      expect(result.secondaryUrl).toBeUndefined();
      expect(result.secondarySource).toBeUndefined();
    });

    it("converts www.reddit.com to old.reddit.com in secondary URL", async () => {
      const result = await fixer.fix({
        url: "https://www.reddit.com/r/funny/comments/abc123/title/",
        serverConfig: { reddit: { includeOldRedditLink: true } },
      });
      expect(result.secondaryUrl).toBe("https://old.reddit.com/r/funny/comments/abc123/title/");
    });

    it("preserves old.reddit.com in secondary URL when input was old", async () => {
      const result = await fixer.fix({
        url: "https://old.reddit.com/r/funny/comments/abc123/title/",
        serverConfig: { reddit: { includeOldRedditLink: true } },
      });
      expect(result.secondaryUrl).toBe("https://old.reddit.com/r/funny/comments/abc123/title/");
    });

    it("resolves the correct URL for /s/ links and removes tracking", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          status: 301,
          headers: new Headers({
            location:
              "https://www.reddit.com/r/MLS/comments/1sajlvv/video_from_the_inter_miami_sth_tour_of_nu_stadium/?utm_source=share",
          }),
          url: "https://www.reddit.com/r/MLS/s/2D9VJPDXNx",
        }),
      );

      const result = await fixer.fix({
        url: "https://www.reddit.com/r/MLS/s/2D9VJPDXNx",
        serverConfig: { reddit: { includeOldRedditLink: true } },
      });

      expect(fetch).toHaveBeenCalledWith("https://www.reddit.com/r/MLS/s/2D9VJPDXNx", {
        method: "HEAD",
        redirect: "manual",
      });
      expect(result.url).toBe(
        "https://vxreddit.com/r/MLS/comments/1sajlvv/video_from_the_inter_miami_sth_tour_of_nu_stadium/",
      );
      expect(result.secondaryUrl).toBe(
        "https://old.reddit.com/r/MLS/comments/1sajlvv/video_from_the_inter_miami_sth_tour_of_nu_stadium/",
      );
      expect(result.source).toBe("reddit");
    });

    it("falls back to original URL when redirect returns no location", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          status: 403,
          headers: new Headers(),
          url: "https://www.reddit.com/r/MLS/s/2D9VJPDXNx",
        }),
      );
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await fixer.fix({
        url: "https://www.reddit.com/r/MLS/s/2D9VJPDXNx",
        serverConfig: { reddit: { includeOldRedditLink: true } },
      });

      expect(result.url).toBe("https://vxreddit.com/r/MLS/s/2D9VJPDXNx");
      expect(result.source).toBe("reddit");
      warnSpy.mockRestore();
    });

    it("falls back to original URL when fetch throws", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await fixer.fix({
        url: "https://www.reddit.com/r/MLS/s/2D9VJPDXNx",
        serverConfig: {},
      });

      expect(result.url).toBe("https://vxreddit.com/r/MLS/s/2D9VJPDXNx");
      warnSpy.mockRestore();
    });

    it("respects includeOldRedditLink config for /s/ links", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          status: 301,
          headers: new Headers({
            location: "https://www.reddit.com/r/MLS/comments/1sajlvv/title/",
          }),
          url: "https://www.reddit.com/r/MLS/s/2D9VJPDXNx",
        }),
      );

      const result = await fixer.fix({
        url: "https://www.reddit.com/r/MLS/s/2D9VJPDXNx",
        serverConfig: { reddit: { includeOldRedditLink: false } },
      });

      expect(result.url).toBe("https://vxreddit.com/r/MLS/comments/1sajlvv/title/");
      expect(result.secondaryUrl).toBeUndefined();
    });
  });
});
