-- Purchases
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  stripe_payment_intent_id text,
  amount_paid_cents integer not null default 0,
  platform_fee_cents integer not null default 0,
  seller_payout_cents integer not null default 0,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create index if not exists purchases_buyer_id on public.purchases (buyer_id);
create index if not exists purchases_listing_id on public.purchases (listing_id);

alter table public.purchases enable row level security;

create policy "Buyers can view own purchases"
  on public.purchases for select
  using (auth.uid() = buyer_id);

create policy "Buyers can insert own purchases (for free flow)"
  on public.purchases for insert
  with check (auth.uid() = buyer_id);
