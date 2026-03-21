# Twitter Fixer

A Discord bot that automatically replaces Twitter, X, and Bluesky links with embed-friendly alternatives so previews actually show up in chat.

| Platform | Original | Replaced with |
|----------|----------|---------------|
| Twitter  | `twitter.com` | `fxtwitter.com` |
| X        | `x.com` | `fixupx.com` |
| Bluesky  | `bsky.app` | `fxbsky.app` |
| Instagram | `instagram.com` | `ddinstagram.com` |
| TikTok   | `tiktok.com` | `tnktok.com` |

## Features

- Automatically detects and fixes links in messages
- Suppresses the original broken embeds when the bot has `Manage Messages` permission
- Per-server language configuration for Twitter/X translation (defaults to `en`)
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

Or build the URL manually — replace `YOUR_CLIENT_ID` with your application's client ID (found on the **General Information** tab):

```
https://discord.com/oauth2/authorize?client_id=1483636877540982804&permissions=92160&scope=bot
```

### 3. Install and run

```bash
# Install dependencies
pnpm install

# Copy .env.example and add your bot token
cp .env.example .env

# Development
pnpm dev

# Production
pnpm build
pnpm start
```

### 4. Run with Docker/Podman

#### With podman-compose

```bash
# Build and start
podman-compose up -d

# View logs
podman logs -f twitter-fixer

# Rebuild after code changes
podman-compose up -d --build

# Stop
podman-compose down
```

#### Without compose

```bash
# Build
podman build -t twitter-fixer .

# Run
podman run -d \
  --name twitter-fixer \
  --restart unless-stopped \
  --env-file .env \
  -v ./server-config.json:/app/server-config.json \
  twitter-fixer

# View logs
podman logs -f twitter-fixer

# Restart without rebuilding
podman restart twitter-fixer

# Stop and remove
podman stop twitter-fixer && podman rm twitter-fixer
```

#### Updating with minimal downtime

Build the new image while the bot is still running, then swap quickly:

```bash
# Build first (bot stays running during this step)
podman build -t twitter-fixer .

# Swap — only a few seconds of downtime
podman stop twitter-fixer && podman rm twitter-fixer
podman run -d \
  --name twitter-fixer \
  --restart unless-stopped \
  --env-file .env \
  -v ./server-config.json:/app/server-config.json \
  twitter-fixer
```

The container auto-restarts on crash via `restart: unless-stopped`. Edit `server-config.json` on the host — it's mounted as a volume, so changes apply on next restart without rebuilding.

### 5. Run with pm2 (optional)

```bash
pnpm build
pm2 start dist/index.js --name twitter-fixer
pm2 save
pm2 startup
```

## Configuration

Per-server settings live in `server-config.json`, keyed by guild ID:

```json
{
  "123456789012345678": {
    "twitter": {
      "language": "ja"
    }
  }
}
```

- **`twitter.language`** — appended as a suffix to Twitter/X URLs for translation (e.g. `.../status/123/ja`). Defaults to `"en"`. Set to `""` to disable.

## Testing

```bash
pnpm test
```
