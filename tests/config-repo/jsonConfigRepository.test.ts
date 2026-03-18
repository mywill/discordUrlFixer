import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { JsonConfigRepository } from "../../src/config-repo/jsonConfigRepository";

function createTempConfig(data: Record<string, unknown>): string {
  const filePath = path.join(os.tmpdir(), `test-config-${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data));
  return filePath;
}

describe("JsonConfigRepository", () => {
  it("returns config for a known server ID", () => {
    const filePath = createTempConfig({
      "123": { twitter: { language: "en" } },
    });
    const repo = new JsonConfigRepository(filePath);

    const config = repo.getServerConfig("123");
    expect(config.twitter?.language).toBe("en");

    fs.unlinkSync(filePath);
  });

  it("returns empty defaults for unknown server ID", () => {
    const filePath = createTempConfig({
      "123": { twitter: { language: "en" } },
    });
    const repo = new JsonConfigRepository(filePath);

    const config = repo.getServerConfig("999");
    expect(config).toEqual({});

    fs.unlinkSync(filePath);
  });

  it("handles missing file gracefully", () => {
    const repo = new JsonConfigRepository("/tmp/nonexistent-config-file.json");
    const config = repo.getServerConfig("123");
    expect(config).toEqual({});
  });

  it("handles empty JSON file gracefully", () => {
    const filePath = createTempConfig({});
    const repo = new JsonConfigRepository(filePath);

    const config = repo.getServerConfig("123");
    expect(config).toEqual({});

    fs.unlinkSync(filePath);
  });
});
