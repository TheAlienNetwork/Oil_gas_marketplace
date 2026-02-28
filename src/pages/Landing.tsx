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
      <section className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 overflow-hidden">
        {/* Logo behind hero text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
          <img
            src="/The_Patch_Logo.png"
            alt=""
            className="w-full max-w-4xl opacity-20 object-contain object-center scale-110"
          />
        </div>
        <div className="relative text-center">
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            The oil & gas industry hub. Directional calculators, Excel tools, manuals,
            desktop apps & web tools. Buy what you need or sell what you build.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/marketplace"
              className="rounded-lg bg-primary-600 px-6 py-3 text-base font-medium text-white hover:bg-primary-500 transition-colors"
            >
              Marketplace
            </Link>
            <Link
              to="/dashboard"
              className="rounded-lg border border-slate-600 bg-slate-800/50 px-6 py-3 text-base font-medium text-slate-200 hover:bg-slate-700/50 transition-colors"
            >
              Sell tools & apps
            </Link>
          </div>
        </div>
      </section>
      <section className="border-t border-slate-800 bg-slate-900/50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-semibold text-white">
            Featured from the industry
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-slate-400">
            Directional tools, calculators, and apps from oil & gas professionals.
          </p>
          {featured.length === 0 ? (
            <p className="mt-8 text-center text-slate-500">
              No listings yet. List your first tool or app from the Seller Dashboard.
            </p>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
