import * as fs from "fs";
import * as path from "path";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { count } from "drizzle-orm";
import { serverConfig } from "./schema";
import { ServerConfig } from "../config-repo/types";

export function seedIfEmpty(db: BetterSQLite3Database, jsonPath?: string): void {
  const resolvedPath = jsonPath ?? path.join(process.cwd(), "server-config.json");

  const rows = db.select({ total: count() }).from(serverConfig).all();
  if (rows[0].total > 0) return;

  let configs: Record<string, ServerConfig>;
  try {
    const raw = fs.readFileSync(resolvedPath, "utf-8");
    configs = JSON.parse(raw);
  } catch {
    console.log("No server-config.json found or it's empty, skipping seed.");
    return;
  }

  const entries = Object.entries(configs);
  if (entries.length === 0) return;

  for (const [serverId, config] of entries) {
    db.insert(serverConfig)
      .values({ serverId, configJson: JSON.stringify(config) })
      .run();
  }

  console.log(`Seeded ${entries.length} server configs from JSON.`);
}
