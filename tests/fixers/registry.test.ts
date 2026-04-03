import { describe, it, expect } from "vitest";
import { FixerRegistry } from "../../src/fixers/registry";
import { EmbedFixer, FixRequest, FixResult } from "../../src/fixers/types";

function createMockFixer(domain: string, fixedDomain: string): EmbedFixer {
  return {
    canHandle(url: string) {
      return url.includes(domain);
    },
    fix(request: FixRequest): FixResult {
      return { url: request.url.replace(domain, fixedDomain), source: domain };
    },
  };
}

describe("FixerRegistry", async () => {
  it("returns empty results for empty registry", async () => {
    const registry = new FixerRegistry();
    const results = await registry.processUrls(["https://twitter.com/test"], {});
    expect(results).toEqual([]);
  });

  it("matches a URL to the correct fixer", async () => {
    const registry = new FixerRegistry();
    registry.register(createMockFixer("twitter.com", "fxtwitter.com"));

    const results = await registry.processUrls(["https://twitter.com/user/status/123"], {});
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://fxtwitter.com/user/status/123");
  });

  it("first matching fixer wins", async () => {
    const registry = new FixerRegistry();
    const fixer1 = createMockFixer("twitter.com", "first.com");
    const fixer2 = createMockFixer("twitter.com", "second.com");
    registry.register(fixer1);
    registry.register(fixer2);

    const results = await registry.processUrls(["https://twitter.com/test"], {});
    expect(results).toHaveLength(1);
    expect(results[0].url).toContain("first.com");
  });

  it("returns no results for non-matching URLs", async () => {
    const registry = new FixerRegistry();
    registry.register(createMockFixer("twitter.com", "fxtwitter.com"));

    const results = await registry.processUrls(["https://google.com"], {});
    expect(results).toEqual([]);
  });

  it("handles multiple URLs with mixed platforms", async () => {
    const registry = new FixerRegistry();
    registry.register(createMockFixer("twitter.com", "fxtwitter.com"));
    registry.register(createMockFixer("bsky.app", "fxbsky.app"));

    const results = await registry.processUrls(
      ["https://twitter.com/user/123", "https://bsky.app/profile/user/post/789"],
      {},
    );
    expect(results).toHaveLength(2);
    expect(results[0].url).toContain("fxtwitter.com");
    expect(results[1].url).toContain("fxbsky.app");
  });

  it("deduplicates identical URLs", async () => {
    const registry = new FixerRegistry();
    registry.register(createMockFixer("twitter.com", "fxtwitter.com"));

    const results = await registry.processUrls(
      ["https://twitter.com/user/123", "https://twitter.com/user/123"],
      {},
    );
    expect(results).toHaveLength(1);
  });
});
