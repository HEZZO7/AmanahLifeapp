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

Auto-deploy on push is **not yet configured** (see Pending below) — for now, trigger a manual redeploy:

1. Push changes to `main` on `HEZZO7/AmanahLifeapp`
2. Go to `http://72.60.186.183:8000` → AmanahLife project → `amanahlife-web` → click **Redeploy**

## Pending / follow-up items

- **Auto-deploy on push** — Coolify supports GitHub webhooks for this; needs a webhook configured on the GitHub repo pointing at Coolify's webhook URL (found under the resource's **Webhooks** tab in Coolify). Not yet set up.
- **`VITE_SITE_URL` environment variable** — optional, would make blog canonical URLs resolve to `https://app.amanahlife.com` explicitly instead of relying on runtime detection. Not required for correct operation.
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
