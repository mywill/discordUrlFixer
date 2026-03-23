import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as path from "path";
import { DrizzleConfigRepository } from "../../src/config-repo/drizzleConfigRepository";
import { serverConfig } from "../../src/database/schema";

function createTestDb(): BetterSQLite3Database {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

describe("DrizzleConfigRepository", () => {
  let db: BetterSQLite3Database;
  let repo: DrizzleConfigRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new DrizzleConfigRepository(db);
  });

  it("returns config for a known server ID", () => {
    db.insert(serverConfig)
      .values({ serverId: "123", configJson: JSON.stringify({ twitter: { language: "en" } }) })
      .run();

    const config = repo.getServerConfig("123");
    expect(config.twitter?.language).toBe("en");
  });

  it("returns empty defaults for unknown server ID", () => {
    db.insert(serverConfig)
      .values({ serverId: "123", configJson: JSON.stringify({ twitter: { language: "en" } }) })
      .run();

    const config = repo.getServerConfig("999");
    expect(config).toEqual({});
  });

  it("handles empty database gracefully", () => {
    const config = repo.getServerConfig("123");
    expect(config).toEqual({});
  });

  it("handles malformed JSON gracefully", () => {
    db.insert(serverConfig).values({ serverId: "123", configJson: "not-valid-json" }).run();

    const config = repo.getServerConfig("123");
    expect(config).toEqual({});
  });
});
