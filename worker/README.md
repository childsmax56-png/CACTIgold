# Sheet Watch Worker

Polls the YZYgold Google Sheet every 5 minutes and sends a Discord notification when new rows are detected.

## Setup

### 1. Create the KV namespace

```bash
cd worker
npx wrangler kv namespace create SHEET_WATCH
```

Copy the `id` from the output and paste it into `wrangler.toml` under `[[kv_namespaces]]`.

### 2. Set the Discord webhook secret

```bash
npx wrangler secret put DISCORD_WEBHOOK_URL
```

Paste your Discord webhook URL when prompted.  
Create one in Discord: **Server Settings → Integrations → Webhooks → New Webhook**.

### 3. Deploy

```bash
npx wrangler deploy
```

The worker will fire every 5 minutes. On the first run it silently snapshots the sheet (no alert). After that, any new rows trigger a Discord message.

## Customizing watched tabs

Edit `WATCHED_TABS` in `index.ts`. Each entry needs a `label` (shown in Discord) and a `gid` (the `gid=` value from the sheet URL — leave empty for the first tab).

## Testing locally

```bash
npx wrangler dev --test-scheduled
# then in another terminal:
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```
