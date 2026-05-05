# The Patch

A web-based oil & gas marketplace where users can sell and buy apps, tools, manuals, Excel files, and desktop (.exe) apps for the industry. Built with React, Supabase, and Stripe Connect.

## Features

- **Browse & search** listings by category and keyword
- **Seller dashboard**: Create listings (file, web app, or desktop app), connect Stripe for payouts
- **Purchases**: Free (one-click) or paid (Stripe Checkout); platform takes a configurable fee
- **Delivery**: File download (signed URL) or in-browser web app (iframe)
- **PWA**: Install on mobile or desktop (Add to Home Screen / Install app)

## PWA (install on mobile)

The app is a Progressive Web App. After you build and deploy it (or run `npm run build` and `npm run preview` over HTTPS), users can:

- **Android (Chrome)**: Use “Add to Home screen” or the install banner.
- **iOS (Safari)**: Share → “Add to Home Screen”.
- **Desktop (Chrome/Edge)**: Use the install icon in the address bar.

The manifest and service worker are generated at build time. For the best install experience on Android, add PNG icons (192×192 and 512×512) to `public/` and reference them in `vite.config.ts` in the PWA manifest `icons` array.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Run without database or Stripe (test the UI)

You can run the app with no `.env` file (or with only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` missing). The app will start and you can:

- Open the landing page, browse, sign-in/sign-up forms, and all routes
- See empty states where data would come from the database (e.g. “No listings found”)
- A yellow “Test mode” banner at the top indicates you’re not connected to Supabase

```bash
npm run dev
```

When you’re ready to use real data and Stripe, add the env vars below.

### 3. Environment variables (for real backend)

Copy `.env.example` to `.env` and set:

- `VITE_SUPABASE_URL` – your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` – your Supabase anon/public key

### 4. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Run migrations (Supabase Dashboard → SQL Editor, or CLI):

   - Run the SQL in `supabase/migrations/` in order (000001 through 000005).
   - If `storage.buckets` insert in 000005 fails, create three buckets in Dashboard → Storage: `listing-assets` (public), `listing-files` (private), `listing-apps` (public).

3. In Authentication → Providers, enable Email (and optionally confirm email off for dev).

### 5. Stripe (for payments — your account + Connect sellers)

Money flow: buyers pay through **Stripe Checkout**; your platform keeps **`STRIPE_CONNECT_PLATFORM_FEE_PERCENT`** of each paid sale; the rest goes to the **seller’s connected account** (minus Stripe’s own processing fees).

#### A. Your Stripe account (platform)

1. Create or log in at [stripe.com](https://stripe.com).
2. **Activate Connect (required)** — Dashboard → [**Connect**](https://dashboard.stripe.com/connect) → complete platform onboarding. Until this is done, seller onboarding will error with *“signed up for Connect”*. Express accounts match this app’s `stripe.accounts.create({ type: 'express' })`.
3. Stay in **Test mode** until everything works; then repeat with **Live** keys for production.
4. **Developers → API keys**: copy the **Secret key** (`sk_test_…` / `sk_live_…`). This is your platform key — never put it in frontend code.

#### B. Supabase secrets for Edge Functions

Set these for your Supabase project (same values apply to all functions):

| Secret | Purpose |
|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase → Project Settings → API → `service_role` |
| `SUPABASE_URL` | Project URL (if not auto-set) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | From webhook endpoint (below) |
| `STRIPE_CONNECT_PLATFORM_FEE_PERCENT` | e.g. `10` = 10% to the platform per sale |
| `FRONTEND_URL` | App origin, no trailing slash: `http://localhost:5173` (dev) or `https://your-domain.com` (prod). Used for Checkout **success/cancel** redirects and Connect return URLs. |

Using the CLI (from project root, after `npx supabase link`):

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx STRIPE_WEBHOOK_SECRET=whsec_xxx STRIPE_CONNECT_PLATFORM_FEE_PERCENT=10 FRONTEND_URL=http://localhost:5173 SUPABASE_SERVICE_ROLE_KEY=your-service-role-jwt --project-ref YOUR_PROJECT_REF
```

#### C. Stripe webhook

1. **Developers → Webhooks → Add endpoint** (or **Create an event destination** in newer Stripe UIs — you must **select at least one event** or **All events** before Continue enables).
2. URL: `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`
3. Events (minimum): **`checkout.session.completed`**, **`account.updated`**
4. Copy the endpoint **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.

**Automate (recommended on Windows):** from the repo root, set your Stripe secret key, then run the script. It can **delete** any existing endpoint with the same URL (`-ReplaceExisting`), create a fresh one, and **push** `whsec_…` to Supabase (`-SyncSupabase`).

```powershell
# Use quotes — without them PowerShell treats sk_test_... as a command name.
$env:STRIPE_SECRET_KEY = 'sk_test_xxx'   # must match test vs live mode
.\scripts\register-stripe-webhook.ps1 -ProjectRef your_project_ref -ReplaceExisting -SyncSupabase
```

Or: `npm run stripe:webhook` (after `STRIPE_SECRET_KEY` is set in the shell, or `STRIPE_SECRET_KEY=sk_test_...` in local `.env`).

The signing secret is only shown once at creation time; use `-ReplaceExisting` if you need a new `whsec_` for Supabase.

If Stripe shows **401** from Supabase, the function is rejecting requests without a user JWT. This repo sets **`verify_jwt = false`** for `stripe-webhook` in `supabase/config.toml`; redeploy after pulling that file, or disable JWT verification for that function in the Supabase Dashboard.

#### D. Deploy payment-related Edge Functions

```bash
npx supabase functions deploy create-checkout
npx supabase functions deploy stripe-connect-onboard
npx supabase functions deploy stripe-webhook
```

`stripe-connect-onboard` accepts JSON `intent`: `onboarding` (default), `update` (bank/identity via Account Link), or `express_dashboard` (Express Dashboard login for onboarded sellers).

#### E. You as a seller (optional test)

1. Run the app, sign in, open **Sell** (Seller Dashboard).
2. **Connect Stripe** — this creates *your* Express connected account as if you were any seller; complete onboarding in Test mode.
3. Create a listing with a price & file, then buy it from another test user with [Stripe test cards](https://stripe.com/docs/testing).

Your **platform** fees appear under Connect / Payments in the Stripe Dashboard; seller payouts follow Express settlement rules.

#### F. Stripe MCP in Cursor (optional)

If you connect the **Stripe MCP** in Cursor, tools like **retrieve balance** confirm the API key is valid. If the response shows **`livemode: true`**, that MCP key is a **live** secret — use the same mode everywhere:

- Supabase **`STRIPE_SECRET_KEY`** must be **`sk_live_…`** for live traffic (and **`sk_test_…`** for test).
- Webhooks: separate endpoints or signing secrets for test vs live if you use both.

The MCP’s generic API search may not list **Connect** endpoints; your marketplace logic stays in this repo’s Edge Functions (`create-checkout`, `stripe-connect-onboard`, `stripe-webhook`). Paid checkouts include **`metadata.marketplace = the_patch`** on the PaymentIntent and product for easier filtering in the Dashboard.

### 5b. Deploy Edge Functions (required for downloads)

Purchased file downloads use the `generate-download-url` Edge Function. Deploy it (and any other functions) from the project root:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy generate-download-url
```

Hosted Edge Functions already receive **default secrets** (`SUPABASE_URL` plus either legacy `SUPABASE_SERVICE_ROLE_KEY` or newer `SUPABASE_SECRET_KEYS`). If downloads still fail with a configuration error:

1. Dashboard → **Edge Functions** → **Secrets** — confirm defaults are present (or add **`SUPABASE_SERVICE_ROLE_KEY`** from **Project Settings → API → service_role**).
2. Redeploy: `npx supabase functions deploy generate-download-url --use-api`

CLI (optional):

```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=paste_service_role_here --project-ref <your-ref>
```

Without this function deployed, the “Download” button on My Purchases will show: *Download link could not be generated. Ensure the Edge Function is deployed.*

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Project structure

- `src/` – React app (pages, components, context, lib)
- `supabase/migrations/` – Postgres schema and RLS
- `supabase/functions/` – Edge Functions: create-checkout, stripe-webhook, generate-download-url, stripe-connect-onboard

## Troubleshooting (Vercel & Supabase)

### Manifest / PWA: 401 on `manifest.webmanifest`

If the browser reports *Manifest fetch failed, code 401*, Vercel is likely blocking unauthenticated requests:

1. Open **Vercel** → your project → **Settings** → **Deployment Protection**.
2. For **Production** (and Preview if you want PWA to work on preview URLs), either disable protection or set it so that the deployment is **public**.  
   (Preview deployments are often “Protected” by default, which returns 401 for the manifest and breaks PWA install.)

### Profile: 404 on `work_experience` or `profile_projects`

If the profile page shows empty Experience/Projects and the console shows 404 for those tables, the schema is missing:

1. Run **all** Supabase migrations in order (including `20260228004629_profile_extended.sql`, which creates `work_experience` and `profile_projects`).
2. In the Dashboard: **SQL Editor** → run each migration file, or use `npx supabase db push` if the project is linked.

### Download: 401, CORS, or could not reach download service

The app calls the **`generate-download-url` Edge Function** via `supabase.functions.invoke` (no `/api` route required for `npm run dev`).

1. Deploy: `npx supabase functions deploy generate-download-url`
2. Set the function secret **`SUPABASE_SERVICE_ROLE_KEY`** (and `SUPABASE_URL` if not inherited) for that function in the Supabase Dashboard.
3. If you still use the optional Vercel route `api/generate-download-url.ts`, set the same env vars on Vercel and run `vercel dev` for local `/api` access — the React app no longer depends on it by default.

## License

Private / use as needed.
