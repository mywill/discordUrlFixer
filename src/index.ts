import { Client, GatewayIntentBits, Partials } from "discord.js";
import { BOT_TOKEN } from "./config";
import { createDatabase } from "./database/connection";
import { seedIfEmpty } from "./database/seed";
import { DrizzleConfigRepository } from "./config-repo/drizzleConfigRepository";
import { DrizzleReplyTracker } from "./reply-tracker/drizzleReplyTracker";
import { DrizzleEmbedSuppressor } from "./embed-suppressor/drizzleEmbedSuppressor";
import { FixerRegistry } from "./fixers/registry";
import { TwitterFixer } from "./fixers/twitterFixer";
import { XFixer } from "./fixers/xFixer";
import { BlueskyFixer } from "./fixers/blueskyFixer";
import { TikTokFixer } from "./fixers/tiktokFixer";
import { RedditFixer } from "./fixers/redditFixer";
import { createMessageHandler } from "./handlers/messageCreate";
import {
  createMessageDeleteHandler,
  createMessageDeleteBulkHandler,
} from "./handlers/messageDelete";

const { db, sqlite } = createDatabase();
seedIfEmpty(db);

const configRepo = new DrizzleConfigRepository(db);
const replyTracker = new DrizzleReplyTracker(db);
const embedSuppressor = new DrizzleEmbedSuppressor(db);

const registry = new FixerRegistry();
registry.register(new TwitterFixer());
registry.register(new XFixer());
registry.register(new BlueskyFixer());
registry.register(new TikTokFixer());
registry.register(new RedditFixer());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.once("clientReady", async (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  embedSuppressor.setClient(c);
  await embedSuppressor.resumePending(c);
});

client.on(
  "messageCreate",
  createMessageHandler(registry, configRepo, replyTracker, embedSuppressor),
);
client.on("messageUpdate", (old, updated) => embedSuppressor.handleMessageUpdate(old, updated));
client.on("messageDelete", createMessageDeleteHandler(replyTracker, embedSuppressor));
client.on("messageDeleteBulk", createMessageDeleteBulkHandler(replyTracker, embedSuppressor));

process.on("SIGTERM", () => {
  embedSuppressor.destroy();
  replyTracker.destroy();
  sqlite.close();
  client.destroy();
});

client.login(BOT_TOKEN);
