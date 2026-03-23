import { Client, GatewayIntentBits } from "discord.js";
import { BOT_TOKEN } from "./config";
import { createDatabase } from "./database/connection";
import { seedIfEmpty } from "./database/seed";
import { DrizzleConfigRepository } from "./config-repo/drizzleConfigRepository";
import { DrizzleReplyTracker } from "./reply-tracker/drizzleReplyTracker";
import { FixerRegistry } from "./fixers/registry";
import { TwitterFixer } from "./fixers/twitterFixer";
import { XFixer } from "./fixers/xFixer";
import { BlueskyFixer } from "./fixers/blueskyFixer";
import { TikTokFixer } from "./fixers/tiktokFixer";
import { createMessageHandler } from "./handlers/messageCreate";
import {
  createMessageDeleteHandler,
  createMessageDeleteBulkHandler,
} from "./handlers/messageDelete";

const { db, sqlite } = createDatabase();
seedIfEmpty(db);

const configRepo = new DrizzleConfigRepository(db);
const replyTracker = new DrizzleReplyTracker(db);

const registry = new FixerRegistry();
registry.register(new TwitterFixer());
registry.register(new XFixer());
registry.register(new BlueskyFixer());
registry.register(new TikTokFixer());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("clientReady", (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.on("messageCreate", createMessageHandler(registry, configRepo, replyTracker));
client.on("messageDelete", createMessageDeleteHandler(replyTracker));
client.on("messageDeleteBulk", createMessageDeleteBulkHandler(replyTracker));

process.on("SIGTERM", () => {
  replyTracker.destroy();
  sqlite.close();
  client.destroy();
});

client.login(BOT_TOKEN);
