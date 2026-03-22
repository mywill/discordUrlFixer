import { Client, GatewayIntentBits } from "discord.js";
import { BOT_TOKEN } from "./config";
import { JsonConfigRepository } from "./config-repo/jsonConfigRepository";
import { FixerRegistry } from "./fixers/registry";
import { TwitterFixer } from "./fixers/twitterFixer";
import { XFixer } from "./fixers/xFixer";
import { BlueskyFixer } from "./fixers/blueskyFixer";
import { TikTokFixer } from "./fixers/tiktokFixer";
import { createMessageHandler } from "./handlers/messageCreate";
import { createMessageDeleteHandler, createMessageDeleteBulkHandler } from "./handlers/messageDelete";
import { InMemoryReplyTracker } from "./reply-tracker/inMemoryReplyTracker";

const configRepo = new JsonConfigRepository();
const replyTracker = new InMemoryReplyTracker();

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

client.login(BOT_TOKEN);
