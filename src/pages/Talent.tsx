import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

export default function Talent() {
  const [profiles, setProfiles] = useState<(Profile & { work_count?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [openToWorkOnly, setOpenToWorkOnly] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let query = supabase
      .from('profiles')
      .select('id, display_name, avatar_url, headline, bio, open_to_work, location')
      .not('display_name', 'is', null)
    if (openToWorkOnly) {
      query = query.eq('open_to_work', true)
    }
    if (search.trim()) {
      query = query.or(
        `display_name.ilike.%${search.trim()}%,headline.ilike.%${search.trim()}%,bio.ilike.%${search.trim()}%,location.ilike.%${search.trim()}%`
      )
    }
    query.order('display_name').then(async ({ data }) => {
      const list = (data as Profile[]) ?? []
      const withCount = await Promise.all(
        list.map(async (p) => {
          const { count } = await supabase
            .from('work_experience')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', p.id)
          return { ...p, work_count: count ?? 0 }
        })
      )
      setProfiles(withCount)
      setLoading(false)
    })
  }, [openToWorkOnly, search])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Talent</h1>
        <p className="mt-1 text-slate-400">
          Find oil & gas professionals. Browse profiles and connect with potential hires.
        </p>
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, headline, location..."
          className="flex-1 min-w-[200px] rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <label className="flex items-center gap-2 text-slate-300">
          <input
            type="checkbox"
            checked={openToWorkOnly}
            onChange={(e) => setOpenToWorkOnly(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-primary-600 focus:ring-primary-500"
          />
          Open to work only
        </label>
      </div>
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading talent…</div>
      ) : profiles.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-12 text-center text-slate-500">
          No profiles match. Try adjusting filters or search.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p) => (
            <Link
              key={p.id}
              to={`/profile/${p.id}`}
              className="flex gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition hover:border-slate-600 hover:bg-slate-800"
            >
              {p.avatar_url ? (
                <img
                  src={p.avatar_url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-600 text-lg font-semibold text-slate-300">
                  {(p.display_name || p.id).slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white truncate">{p.display_name || 'Unnamed'}</p>
                {p.headline && (
                  <p className="text-sm text-slate-400 truncate">{p.headline}</p>
                )}
                {p.location && (
                  <p className="text-xs text-slate-500">{p.location}</p>
                )}
                {p.open_to_work && (
                  <span className="mt-1 inline-block rounded bg-primary-600/20 px-2 py-0.5 text-xs text-primary-400">
                    Open to work
                  </span>
                )}
                {(p as { work_count?: number }).work_count ? (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(p as { work_count?: number }).work_count} experience entries
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
