import { Client, GatewayIntentBits } from "discord.js";
import { BOT_TOKEN } from "./config";
import { JsonConfigRepository } from "./config-repo/jsonConfigRepository";
import { FixerRegistry } from "./fixers/registry";
import { TwitterFixer } from "./fixers/twitterFixer";
import { XFixer } from "./fixers/xFixer";
import { BlueskyFixer } from "./fixers/blueskyFixer";
import { createMessageHandler } from "./handlers/messageCreate";

const configRepo = new JsonConfigRepository();

const registry = new FixerRegistry();
registry.register(new TwitterFixer());
registry.register(new XFixer());
registry.register(new BlueskyFixer());

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

client.on("messageCreate", createMessageHandler(registry, configRepo));

client.login(BOT_TOKEN);
