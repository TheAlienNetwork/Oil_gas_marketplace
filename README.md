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

### 5. Stripe (for payments)

1. Enable [Stripe Connect](https://stripe.com/docs/connect) and get API keys.
2. For Edge Functions, set secrets:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET` (from Stripe webhook for your endpoint)
   - `STRIPE_CONNECT_PLATFORM_FEE_PERCENT` (e.g. 15 for 15% — set to whatever cut you want)
   - `FRONTEND_URL` (e.g. http://localhost:5173)

3. Deploy Edge Functions and register the webhook URL (e.g. `https://<project>.supabase.co/functions/v1/stripe-webhook`) in Stripe for events: `checkout.session.completed`, `account.updated`.

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Project structure

- `src/` – React app (pages, components, context, lib)
- `supabase/migrations/` – Postgres schema and RLS
- `supabase/functions/` – Edge Functions: create-checkout, stripe-webhook, generate-download-url, stripe-connect-onboard

## License

Private / use as needed.
