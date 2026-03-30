# Discord URL Fixer

A Discord bot that automatically replaces social media links with embed-friendly alternatives so previews actually show up in chat.

| Platform | Original | Replaced with |
|----------|----------|---------------|
| Twitter  | `twitter.com` | `fxtwitter.com` |
| X        | `x.com` | `fixupx.com` |
| Bluesky  | `bsky.app` | `fxbsky.app` |
| TikTok   | `tiktok.com` | `tnktok.com` |
| Reddit   | `reddit.com` | `vxreddit.com` |

## Features

- Automatically detects and fixes links in messages
- Suppresses the original broken embeds when the bot has `Manage Messages` permission
- Deletes bot replies when the original message is deleted (within 24 hours)
- Per-server language configuration for Twitter/X translation (defaults to `en`)
- Optional markdown masked links for shorter replies (`[source](url)`)
- Add `fxignore` anywhere in a message to skip processing

## Setup

### 1. Create a Discord bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, give it a name, and create it
3. Go to the **Bot** tab
4. Click **Reset Token**, copy the token, and save it — you won't see it again
5. Under **Privileged Gateway Intents**, enable **Message Content Intent**

### 2. Generate an invite link

1. In the Developer Portal, go to the **OAuth2** tab
2. Under **OAuth2 URL Generator**, select the scope: `bot`
3. Under **Bot Permissions**, select:
   - Send Messages
   - Manage Messages *(for suppressing original embeds)*
   - Read Message History
   - Embed Links
4. Copy the generated URL and open it in your browser to invite the bot to your server

### 3. Configure

Copy `.env.example` to `.env` and add your bot token:

```
BOT_TOKEN=your-bot-token-here
```

### 4. Run with podman Compose (recommended)

```bash
podman compose up -d
```

The compose file pulls from `ghcr.io/mywill/discordurlfixer:latest`.

Files and directories mounted into the container:
- `.env` — bot token (required)
- `server-config.json` — per-server settings, used for initial seed on first boot (optional)
- `data/` — SQLite database directory (persistent storage)

```bash
# View logs
podman compose logs -f

# Update to latest image
podman compose pull && podman compose up -d

# Stop
podman compose down
```

### 5. Run from source

```bash
pnpm install
pnpm build
pnpm start
```

### 6. Run with pm2 (optional)

```bash
pnpm build
pm2 start dist/index.js --name twitter-fixer
pm2 save
pm2 startup
```

## Configuration

Per-server settings are stored in SQLite (`data/bot.db`). On first boot, the database is seeded from `server-config.json` if present. After that, config lives in the database.

The config shape per server (JSON format for reference):

```json
{
  "123456789012345678": {
    "twitter": {
      "language": "ja"
    },
    "useMarkdownLinksAsShortener": false
  }
}
```

| Option | Default | Description |
|---|---|---|
| `twitter.language` | `"en"` | Suffix appended to Twitter/X URLs for translation. Set to `""` to disable. |
| `reddit.includeOldRedditLink` | `true` | Append an `old.reddit.com` link alongside the embed-fixed URL. Set to `false` to disable. |
| `useMarkdownLinksAsShortener` | `true` | Format replies as `[source](url)` for shorter messages. Set to `false` for raw URLs. |

## Development

```bash
pnpm dev          # Run with ts-node
pnpm test         # Run tests
pnpm lint         # Check formatting
pnpm format       # Fix formatting
pnpm db:generate  # Generate Drizzle migration after schema changes
```
