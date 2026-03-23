import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { ConfigRepository, ServerConfig } from "./types";
import { serverConfig } from "../database/schema";

export class DrizzleConfigRepository implements ConfigRepository {
  constructor(private db: BetterSQLite3Database) {}

  getServerConfig(serverId: string): ServerConfig {
    const rows = this.db
      .select({ configJson: serverConfig.configJson })
      .from(serverConfig)
      .where(eq(serverConfig.serverId, serverId))
      .all();

    if (rows.length === 0) return {};

    try {
      return JSON.parse(rows[0].configJson);
    } catch {
      return {};
    }
  }
}
