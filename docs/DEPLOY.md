# Deploying CutCheck

This guide lists names and steps only. Never put a secret value in a file, a commit or a screenshot.

Production refuses to start without the services below, on purpose:

| Missing | What happens |
|---|---|
| `SESSION_SECRET` | Every page fails |
| `CARD_SECRET` | Stylist card links fail |
| Upstash Redis | Every API route fails, because in-memory counters can't be shared between serverless instances |
| `TURNSTILE_SECRET` | Every photo upload is refused |

## 1. Upstash Redis

Create a Redis database, either in the Upstash console or through the Vercel Marketplace. The app reads `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or the `KV_REST_API_URL` and `KV_REST_API_TOKEN` names that the Marketplace integration sets. Pick a region near your YouCam API host.

## 2. Random secrets

Generate three long random values for `SESSION_SECRET`, `CARD_SECRET` and `JUDGE_CODE`. For example, this copies one to the clipboard on macOS without printing it:

```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" | pbcopy
```

## 3. Vercel project and environment variables

Create the project (Framework: Next.js) and add these variables:

| Name | Production | Preview |
|---|---|---|
| `YOUCAM_API_KEY` | ✓ | **never** |
| `YOUCAM_BASE_URL` | ✓ | |
| `JUDGE_CODE` | ✓ | |
| `SESSION_SECRET` | ✓ | ✓ |
| `CARD_SECRET` | ✓ | ✓ |
| Upstash URL and token | ✓ | ✓ |
| `PUBLIC_DAILY_UNIT_CAP` | ✓ | ✓ |
| `JUDGE_UNIT_CAP` | ✓ | ✓ |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ✓ | ✓ |
| `TURNSTILE_SECRET` | ✓ | ✓ |

Preview deployments get no YouCam key, so they always run in demo mode and can't spend units. Mark the secrets as sensitive, for example with `vercel env add NAME production --sensitive`.

## 4. Function settings

`/api/scan` sets `maxDuration = 60`, because the three hair readings can take up to about 50 s. Check that your plan allows it. Putting the functions in a region near the YouCam host and Redis cuts latency.

## 5. Cloudflare Turnstile

Add a Turnstile widget in Managed mode for your production hostname. Put the site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the secret key in `TURNSTILE_SECRET`, then redeploy. The site key is built into the page, so it needs a fresh build.

## 6. Smoke test

- `/api/health` returns `{"ok":true}`.
- `/` responds with a `Content-Security-Policy` header that carries a nonce, plus HSTS and `X-Frame-Options: DENY`, and the console shows no CSP errors.
- As a public visitor, "See a demo" works, and "Check my hair" falls back to demo mode while the public cap is 0.
- `/?k=<JUDGE_CODE>` redirects to a clean URL and sets the `cc_judge` cookie. Type the code yourself; don't paste it into shared tools.
- One real journey on an Android phone and on an iPhone in Safari. It spends about 12 units.
- A Preview deployment shows demo mode, even with a judge link.
