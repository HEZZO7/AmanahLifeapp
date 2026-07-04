# Deployment — AmanahLife Web App

## Current setup (post Atoms Dev migration, 2026-07-04)

The web app is hosted on **Hostinger VPS (`72.60.186.183`) via Coolify** — the same VPS that already runs LinkoraNet's other services. No dependency on Atoms Dev remains.

- **Coolify dashboard:** `http://72.60.186.183:8000`
- **Project:** AmanahLife → environment `production` → resource `amanahlife-web`
- **Repo:** `HEZZO7/AmanahLifeapp`, branch `main` (public repo — required for Coolify's public-repo git access; no deploy keys needed)
- **Build:** Dockerfile-based (`app/frontend/Dockerfile` + `app/frontend/nginx.conf`), not Nixpacks — Nixpacks auto-detection misidentifies the project as a Deno app (likely due to `supabase/functions/` containing Deno edge functions inside the same base directory), so an explicit multi-stage Dockerfile (Node build → nginx serve) is used instead.
- **Base Directory:** `/app/frontend`
- **Domains:** `app.amanahlife.com` (production) + a Coolify-generated `sslip.io` fallback domain for direct IP-based testing
- **SSL:** Automatic via Let's Encrypt, issued by Coolify

## How to deploy an update

**Auto-deploy is configured and verified working** (2026-07-04): a GitHub webhook (push events only, `application/json`) on `HEZZO7/AmanahLifeapp` triggers Coolify to build and redeploy automatically on every push to `main`. No manual steps needed — just push.

If you ever need to redeploy manually (e.g. re-trigger without a new commit): go to `http://72.60.186.183:8000` → AmanahLife project → `amanahlife-web` → click **Redeploy**.

## Pending / follow-up items

- **`VITE_SITE_URL` environment variable** — optional, would make blog canonical URLs resolve to `https://app.amanahlife.com` explicitly instead of relying on runtime detection. Not required for correct operation.
- **Lemon Squeezy checkout is broken** (pre-existing, unrelated to this migration) — `app_11941c8fec_lemonsqueezy_checkout` edge function returns 400 "Variant not configured" because Supabase secrets like `APP_11941c8fec_LEMONSQUEEZY_BALANCED_MONTHLY_VARIANT_ID` are missing. Needs Lemon Squeezy store ID, API key, and variant IDs for each tier/billing combo set as Supabase edge function secrets. Not a Google Play policy concern — this is the web checkout, a separate distribution channel from the Play Store.
- Repo visibility: made **public** to unblock Coolify's git access (previously private). If this needs to be private again in the future, switch to the Deploy Key approach instead (SSH key generated in Coolify, added as a read-only Deploy Key in GitHub repo settings) rather than making it public again.

## DNS

`app.amanahlife.com` — `A` record → `72.60.186.183` (Hostinger DNS panel, confirmed propagated and resolving as of 2026-07-04).

## Local development

```bash
cd app/frontend
npm install
npm run dev
```

Build for production locally (same as what Docker runs):
```bash
npm run build   # outputs to dist/, includes prerendering of 12 blog/landing pages
```
