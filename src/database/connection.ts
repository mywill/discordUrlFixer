import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as path from "path";
import * as fs from "fs";

export interface DatabaseConnection {
  db: BetterSQLite3Database;
  sqlite: Database.Database;
}

export function createDatabase(dbPath?: string): DatabaseConnection {
  const resolvedPath = dbPath ?? path.join(process.cwd(), "data", "bot.db");

  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(resolvedPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite);

  const migrationsFolder = path.join(process.cwd(), "drizzle");
  migrate(db, { migrationsFolder });

  return { db, sqlite };
}
