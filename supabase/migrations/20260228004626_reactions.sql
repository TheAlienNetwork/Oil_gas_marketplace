-- Reactions (like / dislike)
create type reaction_type as enum ('like', 'dislike');

create table if not exists public.reactions (
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  reaction reaction_type not null,
  created_at timestamptz default now(),
  primary key (user_id, listing_id)
);

create index if not exists reactions_listing_id on public.reactions (listing_id);
create index if not exists reactions_reaction on public.reactions (reaction);

alter table public.reactions enable row level security;

create policy "Reactions are viewable for published listings"
  on public.reactions for select
  using (
    exists (
      select 1
      from public.listings l
      where l.id = reactions.listing_id
        and l.is_published = true
    )
  );

create policy "Users can react"
  on public.reactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own reaction"
  on public.reactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own reaction"
  on public.reactions for delete
  using (auth.uid() = user_id);

