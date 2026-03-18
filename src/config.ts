import "dotenv/config";

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("Missing BOT_TOKEN environment variable. See .env.example");
  process.exit(1);
}

export { BOT_TOKEN };
