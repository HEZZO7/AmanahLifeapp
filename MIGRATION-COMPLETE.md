# Atoms Dev → Hostinger VPS (Coolify) Migration — Complete

**Date:** 2026-07-04

## What was migrated

- Full web app source code (`app/frontend`) — exported directly from Atoms Dev's workspace and reconciled into `HEZZO7/AmanahLifeapp` on GitHub, replacing the previously out-of-sync mirror. This brought in all 5 features Atoms Dev had built directly (Data Backup & Restore, Motivational Quotes, Prayer-Time-Aware Reminders, Offline/PWA mode, Dark/Light auto-scheduling) plus the Google Sign-In iframe fix, none of which had previously made it into GitHub.
- One regression from the reconciliation was caught and fixed: the `/delete-account` page (built directly in GitHub in an earlier session, never present in Atoms Dev's workspace) was restored with its route.
- Hosting moved from Atoms Dev's infrastructure (UCloud, Hong Kong) to the existing Hostinger VPS (`72.60.186.183`) that already runs LinkoraNet's services, via Coolify.

## New hosting setup

- **Platform:** Coolify (self-hosted PaaS), running as Docker containers on the same VPS as LinkoraNet
- **Deploy method:** Manual redeploy from Coolify's dashboard (auto-deploy on push not yet configured — see `DEPLOYMENT.md`)
- **Build:** Custom Dockerfile (Node build stage → nginx serve stage), not Nixpacks, due to a Deno-app misdetection issue
- **Cost:** $0 additional — reuses existing VPS capacity already paid for

## DNS change made

| Record | Old value | New value |
|---|---|---|
| `A app.amanahlife.com` | `107.150.101.9` (Atoms Dev / UCloud) | `72.60.186.183` (Hostinger VPS) |

Confirmed propagated and resolving correctly via both local and Google (8.8.8.8) DNS as of 2026-07-04. `https://app.amanahlife.com` verified live with a valid Let's Encrypt SSL certificate, serving the correct app (landing page, SPA routing, About page all confirmed working).

## Repo visibility change

`HEZZO7/AmanahLifeapp` was changed from **private to public** to allow Coolify to clone it without additional credential setup. Confirmed the repo contains no secrets (Supabase keys are public anon keys intended for client-side use; no API secrets or `.env` files were present). If private visibility is required in the future, use an SSH Deploy Key in Coolify instead of reverting visibility.

## Remaining Atoms Dev access to revoke

- The Atoms Dev chat/workspace itself (`atoms.dev/chat/11941c8fecfe4fab8100b57dd1651ac5`) is no longer the deployment source but the account and workspace still exist. Its own usage quota was already exhausted ("0 credits remaining") at the time of this migration, so it was effectively already inactive for further changes.
- No API keys, tokens, or credentials specific to Atoms Dev were found embedded in the codebase — Supabase, Lemon Squeezy, and all other service credentials are independent of Atoms Dev and remain under LinkoraNet's own accounts.
- Recommended: cancel/downgrade the Atoms Dev subscription if no longer needed, once you've confirmed the new hosting is stable for a few days.

## Verification checklist

- [x] Landing page loads correctly (dark green/gold theme, bilingual EN/AR)
- [x] SPA client-side routing works (`/about` resolves correctly via nginx `try_files` fallback)
- [x] About/Founder content renders correctly
- [x] SSL/HTTPS active via Let's Encrypt
- [x] DNS resolves to new server
- [ ] Full auth flow (email + Google Sign-In) — not explicitly re-tested post-migration, recommended before considering this fully done
- [ ] Subscription checkout flow — not explicitly re-tested post-migration

## Summary

`app.amanahlife.com` is now fully independent of Atoms Dev, running on infrastructure LinkoraNet already owns and pays for, deployed from the same GitHub repo that Claude Code (or any future developer) can work with directly — no more manual chat-based requests to a third-party AI agent team required for web changes.
