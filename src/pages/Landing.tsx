import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Listing } from '@/lib/types'
import ListingCard from '@/components/ListingCard'

export default function Landing() {
  const [featured, setFeatured] = useState<Listing[]>([])

  useEffect(() => {
    supabase
      .from('listings')
      .select('*, profiles(id, display_name, avatar_url)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setFeatured((data as Listing[]) ?? []))
  }, [])

  return (
    <div className="relative">
      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-20 lg:px-10 lg:pb-32 lg:pt-24">
        <div
          className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-primary-500/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-slate-500/10 blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto max-w-[1400px]">
          <div className="mx-auto max-w-4xl text-center animate-fade-up">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-primary-400/90">
              Oil & gas digital marketplace
            </p>
            <h1 className="mt-6 font-display text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.05] tracking-tight text-balance text-white">
              Tools and apps,
              <span className="block italic text-primary-200/95">built by the field.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-400">
              Discover calculators, manuals, spreadsheets, and software from industry specialists.
              List your work, reach buyers worldwide, and checkout securely with Stripe.
            </p>
            <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
              <Link
                to="/marketplace"
                className="inline-flex min-w-[200px] items-center justify-center rounded-full bg-primary-600 px-8 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:bg-primary-500"
              >
                Explore marketplace
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex min-w-[200px] items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-8 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/[0.06]"
              >
                Become a seller
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-6 border-y border-white/[0.06] py-10 sm:mt-20 sm:gap-8">
            {[
              ['Verified checkout', 'Stripe-powered payments'],
              ['Instant delivery', 'Files & web apps'],
              ['Seller payouts', 'Connect Express'],
            ].map(([title, sub]) => (
              <div key={title} className="text-center">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs text-slate-500">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] bg-slate-950/40 py-20 backdrop-blur-[2px]">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary-400/80">
                Featured
              </p>
              <h2 className="mt-2 font-display text-3xl font-normal tracking-tight text-white sm:text-4xl">
                New & notable
              </h2>
              <p className="mt-3 max-w-lg text-slate-500">
                Hand-picked listings from the community. Updated as sellers publish new tools.
              </p>
            </div>
            <Link
              to="/marketplace"
              className="shrink-0 text-sm font-semibold text-primary-400 transition hover:text-primary-300"
            >
              View all →
            </Link>
          </div>

          {featured.length === 0 ? (
            <div className="mt-14 rounded-2xl border border-dashed border-white/10 bg-slate-900/20 py-20 text-center">
              <p className="font-display text-xl text-slate-500">The showcase is ready for your first listing.</p>
              <p className="mt-2 text-sm text-slate-600">
                Open the seller dashboard to publish a product.
              </p>
              <Link
                to="/dashboard"
                className="mt-8 inline-flex rounded-full bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-500"
              >
                Go to dashboard
              </Link>
            </div>
          ) : (
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {featured.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
