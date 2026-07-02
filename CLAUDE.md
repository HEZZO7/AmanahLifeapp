# AmanahLife — CLAUDE.md

Developer guide for AI assistants working on this codebase.

---

## What This App Is

AmanahLife is a **subscription-based SaaS web app** for Muslim individuals and families. It combines Islamic lifestyle tools (prayer times, Quran, Dhikr, Adhkar, Ramadan planner) with productivity and finance features (task manager, goal tracker, family budget, Zakat calculator, halal investment tools) and AI-powered insights (life coach, AI planner, savings tips).

The production URL is `https://app.amanahlife.com`. The app supports English and Arabic, with full RTL layout for Arabic.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript + Vite 5 (SWC transpiler) |
| Routing | React Router DOM v6 |
| Styling | Tailwind CSS v3 + shadcn/ui (Radix UI primitives) |
| Server state | TanStack React Query v5 |
| Global state | React Context API (4 contexts) |
| Forms | React Hook Form + Zod |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Edge Functions | Deno/TypeScript (deployed to Supabase) |
| Icons | lucide-react |
| Charts | Recharts |
| Toasts | Sonner |
| Blog/SEO | vite-prerender-plugin + vite-plugin-sitemap + Markdown |
| Payments | Stripe, Lemon Squeezy, Paddle (all three coexist) |

TypeScript is configured with `strict: false`, `noImplicitAny: false`, and `strictNullChecks: false`.

---

## Repository Structure

```
/
├── app/
│   ├── frontend/          # Main React application (all active code lives here)
│   │   ├── src/           # Source code
│   │   ├── public/        # Static files (logos, landing.html)
│   │   ├── prerender/     # Blog prerender scripts for SSR/SEO
│   │   ├── seo/content/   # Blog post Markdown files (EN + AR)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── components.json  # shadcn/ui config
│   └── backend/
│       └── skills_docs/   # Reference docs for Supabase Edge Function patterns
├── assets/images/         # Hero images for blog SEO
├── public/assets/         # Public static assets
├── uploads/               # Design docs, screenshots, original proposals (not served)
└── .atoms/                # Platform build system internals (do not modify)
```

---

## Source Code Layout (`app/frontend/src/`)

```
src/
├── App.tsx                # Root component: all 40+ route definitions + provider tree
├── main.tsx               # Entry point: loads runtime config, mounts React
├── blog-routes.tsx        # Nested routes under /blog/*
│
├── contexts/              # Global state (React Context)
│   ├── AuthContext.tsx        # Supabase auth: user, session, signIn/signUp/signOut/Google
│   ├── SubscriptionContext.tsx # Tier (free/balanced/family), trial, payment provider
│   ├── LanguageContext.tsx    # AR/EN toggle, RTL, t() translation function
│   └── ThemeContext.tsx       # dark/light, persisted to localStorage
│
├── hooks/                 # Custom React hooks
│   ├── use-mobile.tsx         # Mobile breakpoint detection
│   ├── use-toast.ts           # Toast notification state
│   ├── useDailySavingsTip.ts  # Calls AI edge function; localStorage cache
│   ├── useSavingsNotifications.ts  # Browser Notification API for savings
│   └── useSearchHistory.ts    # CRUD for search history in Supabase
│
├── lib/
│   ├── supabase.ts        # Supabase client init (URL + anon key hardcoded here)
│   ├── utils.ts           # cn() — clsx + tailwind-merge
│   ├── config.ts          # Runtime config loader (/api/config endpoint)
│   ├── currency.ts        # 25+ currencies; live rates from edge function
│   ├── blog.ts            # Blog YAML frontmatter + markdown parsing
│   └── api.ts             # @metagptx/web-sdk client (legacy)
│
├── pages/                 # ~43 page components (one file per route)
├── components/            # Shared/reusable components
│   ├── ui/                    # ~50 shadcn/ui primitives (Button, Dialog, Tabs, etc.)
│   ├── AppLogo.tsx
│   ├── BottomNav.tsx          # Persistent 5-tab mobile navigation
│   ├── PremiumGate.tsx        # Blur overlay + upgrade CTA for gated features
│   ├── Onboarding.tsx         # 4-step first-run modal
│   ├── ErrorBoundary.tsx
│   └── ...
│
└── supabase/functions/    # 8 Supabase Edge Functions (Deno TypeScript)
```

---

## Routing

All routes are defined in `App.tsx`. The entry-point guard is `WelcomeGuard`: if no language preference exists in localStorage, the user is redirected to `/landing`; otherwise the main dashboard (`/`) renders.

Key routes:
- `/` — Main dashboard (Index.tsx)
- `/landing` — Public marketing landing page
- `/login` — Email/password + Google OAuth
- `/auth/callback` — OAuth redirect handler
- `/settings` — User settings + account management
- `/subscription` — Subscription management
- `/pricing` — Public pricing page
- `/blog/*` — Blog (nested routes in blog-routes.tsx)
- All feature pages: `/prayer-times`, `/quran`, `/dhikr`, `/finance`, `/goals`, etc.

---

## Global State & Contexts

Always wrap state access in the correct provider (already done in App.tsx). Use the `useXxx()` hooks to consume contexts:

```tsx
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
```

**SubscriptionContext** exposes `tier` (`'free' | 'balanced' | 'family'`). Gate premium features with `<PremiumGate requiredTier="balanced">…</PremiumGate>` or by checking `tier !== 'free'` directly.

**LanguageContext** exposes `t(key)` for translations, `language` (`'ar' | 'en'`), `isRTL` (`boolean`), and `setLanguage`. Translations live in an inline map inside LanguageContext.tsx — add new keys there.

---

## Supabase

### Client

The client is a singleton at `@/lib/supabase`. The URL and anon key are hardcoded in `src/lib/supabase.ts` (intentional — anon key is public-safe).

```ts
import { supabase } from '@/lib/supabase';
```

Call Supabase directly from components and hooks. There is no repository or service abstraction layer.

### Table Naming Convention

All tables follow: `app_11941c8fec_{entity_name}` (underscores, no camelCase).

Examples: `app_11941c8fec_subscriptions`, `app_11941c8fec_search_history`.

### Edge Functions

Located in `src/supabase/functions/`. Each function is a directory with an `index.ts` entry.

Naming convention: `app_11941c8fec_{function_name}`.

Invoke from the frontend:

```ts
const { data, error } = await supabase.functions.invoke('app_11941c8fec_savings_tips', {
  body: { challenges, language },
});
```

#### Edge Function Rules (mandatory)

- Use `Deno.serve` for the request handler entry point.
- Generate a UUID at the top of every handler: `const requestId = crypto.randomUUID();`
- Always handle `OPTIONS` preflight — return `204` with `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Headers: *`.
- Always wrap `await req.json()` in try/catch.
- Never hardcode API keys — use `Deno.env.get('KEY_NAME')`.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in edge function environments.
- Import the Supabase client as: `import { createClient } from 'npm:@supabase/supabase-js@2';`
- When using `upsert()`, always specify `onConflict` if a unique constraint exists.

Existing edge functions (all under `app_11941c8fec_*`):
- `stripe_checkout`, `stripe_webhook`, `stripe_coupon_checkout`, `stripe_portal`
- `lemonsqueezy_checkout`, `lemonsqueezy_webhook`
- `paddle_checkout`, `paddle_webhook`

---

## Payments / Subscriptions

Three payment providers coexist: **Stripe**, **Lemon Squeezy**, **Paddle**.

Subscription tiers (stored in `app_11941c8fec_subscriptions`):

| Tier | Monthly | Yearly |
|---|---|---|
| `free` | $0 | $0 |
| `balanced` | $6.99/mo | $4.99/mo |
| `family` | $12.99/mo | $9.99/mo |

**Trial:** 7-day free trial tracked via `localStorage` key `amanah-trial-start`.

Stripe price IDs and webhook secrets come from Supabase Edge Function secrets:
- `STRIPE_SECRET_KEY`
- `APP_11941c8fec_STRIPE_PRO_PRICE_ID` / `APP_11941c8fec_STRIPE_FAMILY_PRICE_ID` (etc.)
- `APP_11941c8fec_STRIPE_WEBHOOK_SECRET`

Always verify Stripe webhooks asynchronously with `stripe.webhooks.constructEventAsync()` and `Stripe.createSubtleCryptoProvider()`.

---

## Internationalisation

Language is stored in localStorage under `amanah_language`. RTL is toggled by setting `document.dir = 'rtl'` and a CSS class on `<html>`.

To add a new translation key:

1. Add it to the `translations` object in `src/contexts/LanguageContext.tsx`.
2. Call `t('yourKey')` in the component.

This is a homegrown i18n solution — not i18next. The translation map is the single source of truth.

---

## Theming

Dark/light mode uses Tailwind's `dark:` variant with the `class` strategy. Theme class is toggled on `<html>`. Custom color palette defined in `tailwind.config.ts`:

- **Forest green** (`forest-*`) — primary brand colour
- **Gold** (`gold-*`) — accent colour  
- **Teal** (`teal-*`) — secondary accent

Colors are exposed as CSS variables and consumed via shadcn/ui design tokens. Prefer the existing palette over arbitrary hex values.

---

## Component Conventions

- **shadcn/ui primitives** live in `src/components/ui/`. Do not modify these directly — they are generated from the shadcn CLI. Re-generate via `npx shadcn@latest add <component>`.
- Use the `cn()` utility from `@/lib/utils` to merge conditional Tailwind classes.
- Import path alias `@/` resolves to `src/`.
- `PremiumGate` component wraps any feature that requires a paid tier. Pass `requiredTier="balanced"` or `requiredTier="family"`.
- `PageHeader` provides a consistent heading with optional back button.
- `BottomNav` is rendered inside `Index.tsx` (dashboard) — it appears on most authenticated pages.

---

## Forms

Use React Hook Form with Zod schemas for all forms:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({ name: z.string().min(1) });
const form = useForm({ resolver: zodResolver(schema) });
```

---

## Blog / SEO

Blog posts are `.md` files in `app/frontend/seo/content/`. Each file uses YAML frontmatter (`title`, `description`, `date`, `slug`, `lang`, `author`).

At build time, `vite-prerender-plugin` pre-renders blog routes for SEO. `vite-plugin-sitemap` generates `sitemap.xml` pointed at `https://app.amanahlife.com`.

Do not create arbitrary new `.md` files in the `seo/content/` directory without also wiring them up in the prerender scripts under `app/frontend/prerender/`.

---

## localStorage Keys

| Key | Purpose |
|---|---|
| `amanah-theme` | `'dark'` or `'light'` |
| `amanah_language` / `al_lang` / `amanah_lang` | Language preference (`'ar'`/`'en'`) |
| `amanah-settings` | JSON: user settings including currency |
| `amanahlife_subscription` | Cached subscription tier |
| `amanah-trial-start` | ISO date when 7-day trial began |
| `amanah-onboarding-complete` | Boolean flag (onboarding shown) |
| `amanah-daily-savings-tip` | Cached AI tip JSON (date + language + tip) |

---

## Development Workflow

```bash
cd app/frontend
npm install
npm run dev        # Dev server at http://localhost:3000
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # ESLint
```

The dev server proxies `/api/*` to `http://localhost:8000`. There is no local backend server — this proxy is unused in standard development. Supabase calls go directly to the cloud project.

---

## Testing

No test files exist. `@playwright/test` is installed but unused. Do not add test boilerplate unless asked.

---

## CI/CD

No CI/CD pipelines exist in this repository. Deployment is managed by the MGX/Atoms platform.

---

## Key Conventions for AI Assistants

1. **No abstraction layers** — call `supabase` directly from components and hooks. Do not introduce service classes or repositories.
2. **Table names** always use the prefix `app_11941c8fec_`. Do not omit it.
3. **Edge function names** follow `app_11941c8fec_{function_name}`. Always use `Deno.serve`, handle `OPTIONS`, and use `crypto.randomUUID()` for request IDs.
4. **TypeScript is lenient** — `strict: false`. Avoid littering the code with unnecessary type assertions, but also don't invest effort in satisfying strict type checks that the project doesn't enforce.
5. **Tailwind over inline styles** — use Tailwind classes. Use `cn()` for conditional merging.
6. **Bilingual from the start** — any new user-facing text must have both `ar` and `en` entries in `LanguageContext.tsx`, and be rendered via `t('key')`.
7. **RTL-aware layout** — use `isRTL` from `useLanguage()` when layout direction matters (e.g., `flex-row-reverse` for RTL, icon placement, text alignment).
8. **Gate premium content** with `<PremiumGate>` or a tier check — never expose premium functionality to `free` tier users.
9. **Do not modify `.atoms/`** — platform internals only.
10. **Secrets never in source** — all API keys (Stripe, AI, email) belong in Supabase Edge Function secrets, not in the repo.
11. **No comments that explain what the code does** — only comment non-obvious WHY (workarounds, constraints, invariants).
