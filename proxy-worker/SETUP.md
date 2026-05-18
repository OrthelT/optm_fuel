# Discord Webhook Proxy — Setup Guide

This guide is for users of `optm_fuel` who see persistent Discord delivery failures
in their Apps Script execution logs — usually `Retry-After` values measured in minutes,
or response bodies containing `error code: 1015`. Those errors mean Google Apps Script's
shared outbound IP pool has been throttled by Cloudflare's edge, regardless of *your*
script's request rate. You can't fix it from inside the script. Routing your webhook
calls through your own tiny Cloudflare Worker fixes it for good, because the Worker
runs from an IP that is not in GAS's shared pool.

If you only see this *occasionally* (once a week or so), the universal fixes in the
latest `fuel-tracker.gs` (sleep cap, request batching, better retry parsing) are
usually enough. Deploy a proxy only if Discord delivery is unreliable for you.

## What you'll need

- A free Cloudflare account (sign up at https://dash.cloudflare.com — no credit card
  required for the Workers free tier)
- Node.js 18+ installed locally (any modern version works)
- Your two Discord webhook URLs (fuel and moon), the same ones currently in Settings
  G2 and G3

## Deployment

### 1. Get the proxy code

Clone or download the repo, then `cd` into the `proxy-worker/` directory:

```bash
git clone https://github.com/OrthelT/optm_fuel.git
cd optm_fuel/proxy-worker
```

If you already have the repo, just `cd proxy-worker`.

### 2. Install wrangler (Cloudflare's deploy CLI)

```bash
npm install -g wrangler
```

`-g` installs it globally. If you don't want a global install, use `npx wrangler ...`
in place of `wrangler ...` in every command below.

### 3. Authenticate with Cloudflare

```bash
wrangler login
```

This opens a browser tab. Log in to your Cloudflare account and approve. After it
returns, you're authenticated for the rest of this guide.

### 4. Generate a proxy key

Pick a long random string. You'll send this in every request from Apps Script so
random people who guess your Worker URL can't post to your Discord channel through it.
A quick Python one-liner:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output. You'll paste it twice in the next step.

### 5. Set the three secrets

Each command prompts you for the value (so secrets stay out of your shell history):

```bash
wrangler secret put PROXY_KEY
# paste your generated key from step 4

wrangler secret put FUEL_WEBHOOK_URL
# paste your fuel-channel Discord webhook URL (the one currently in Settings G2)

wrangler secret put MOON_WEBHOOK_URL
# paste your moon-channel Discord webhook URL (Settings G3)
```

### 6. Deploy

```bash
wrangler deploy
```

First-time deploys prompt you to register a `workers.dev` subdomain. Pick anything
you're fine with being public — your Worker's URL will be
`https://optm-fuel-proxy.<your-subdomain>.workers.dev`.

When the command finishes, it prints the deployed URL. Save it.

## Wiring into the Spreadsheet

In the Settings sheet, replace the **values** of G2 and G3 with the proxy equivalents.
Keep the Discord webhook URLs handy as a backup, but you no longer use them directly
from Apps Script:

| Cell | Old value | New value |
|---|---|---|
| G2 | `https://discord.com/api/webhooks/.../fuel...` | `https://optm-fuel-proxy.<subdomain>.workers.dev/fuel?key=<PROXY_KEY>` |
| G3 | `https://discord.com/api/webhooks/.../moon...` | `https://optm-fuel-proxy.<subdomain>.workers.dev/moon?key=<PROXY_KEY>` |

`<PROXY_KEY>` is the random string you generated in step 4. `<subdomain>` is the
workers.dev subdomain you chose during first deploy.

That's it — no `fuel-tracker.gs` changes are needed. The script calls those URLs the
same way it called Discord directly; the Worker forwards them.

## Verification

You can verify the proxy works from your local machine with a one-liner before
swapping Settings, or just swap Settings and trigger a report from the Apps Script
menu.

### Local check

```bash
curl -i -X POST "https://optm-fuel-proxy.<subdomain>.workers.dev/fuel?key=<PROXY_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"embeds":[{"title":"Proxy test","description":"Hello from curl.","color":3447003}]}'
```

A working response looks like:

```
HTTP/2 204
x-ratelimit-limit: 5
x-ratelimit-remaining: 4
x-ratelimit-bucket: <hash>
```

A test message appears in your Discord channel. If you instead see `403 Forbidden`,
the `key=` value doesn't match the `PROXY_KEY` secret. `404 Unknown route` means the
path is mistyped (only `/fuel` and `/moon` are valid).

### Apps Script check

From the spreadsheet: Fuel Bot menu → "Report Fuel Status to Discord (Chunked)".
Open the Apps Script editor → Executions tab. The run should complete cleanly with
no `Retry-After` lines and no 1015 errors.

## Rotating webhooks

If you ever regenerate a Discord webhook URL (recommended any time you suspect it
leaked), update the Worker secret — **no redeploy required**:

```bash
wrangler secret put FUEL_WEBHOOK_URL
```

Settings G2/G3 stay the same. Only the Worker knows the actual Discord URLs now,
so rotating them is a single command instead of editing the spreadsheet.

## Costs

The Worker runs on Cloudflare's free tier: 100,000 requests per day. A typical fuel
bot makes 2–6 requests per day. You will never come close to the limit. No credit
card required.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `403 Forbidden` from proxy | `key=` param missing or wrong | Re-check the URL in Settings — make sure `?key=<value>` is appended and matches `PROXY_KEY` secret |
| `404 Unknown route: ...` | URL path is not `/fuel` or `/moon` | Fix the path in Settings G2/G3 |
| `502 Upstream fetch failed` | Worker couldn't reach Discord | Check Cloudflare status page; usually transient |
| Still seeing 1015 errors after switching | Settings G2/G3 not actually updated | Re-verify the values in the spreadsheet match the proxy URLs |
| Worker URL prints but DNS doesn't resolve yet | Cloudflare DNS propagation | Wait 1–2 minutes after first deploy |

## Live logs

To watch requests as they hit the Worker (useful when first switching over):

```bash
wrangler tail
```

Each request prints its route and the Discord status code, e.g.
`POST /fuel → discord 204 (0 bytes)`.
