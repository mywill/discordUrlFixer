import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const serverConfig = sqliteTable("server_config", {
  serverId: text("server_id").primaryKey(),
  configJson: text("config_json").notNull().default("{}"),
});

export const replyTracker = sqliteTable("reply_tracker", {
  originalMessageId: text("original_message_id").primaryKey(),
  replyMessageId: text("reply_message_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
