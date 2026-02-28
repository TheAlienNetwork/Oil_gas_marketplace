import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Organization, OrganizationMember } from '@/lib/types'

export default function OrganizationsList() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [memberships, setMemberships] = useState<(OrganizationMember & { organizations: Organization })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/sign-in', { replace: true })
      return
    }
    if (!user?.id) return
    supabase
      .from('organization_members')
      .select('org_id, user_id, role, joined_at, organizations(id, name, slug, description, logo_url, owner_id, created_at, updated_at)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const rows = (data || []).map((r: Record<string, unknown>) => ({
          org_id: r.org_id,
          user_id: r.user_id,
          role: r.role,
          joined_at: r.joined_at,
          organizations: r.organizations as Organization,
        }))
        setMemberships(rows as (OrganizationMember & { organizations: Organization })[])
        setLoading(false)
      })
  }, [user?.id, authLoading, user, navigate])

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-white">Organizations</h1>
        <Link
          to="/organizations/new"
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 transition-colors"
        >
          Create organization
        </Link>
      </div>
      <p className="mt-2 text-slate-400">
        Secure spaces for your team: share well info, files, and an internal feed.
      </p>
      {loading ? (
        <div className="mt-8 text-center text-slate-500">Loading your organizations…</div>
      ) : memberships.length === 0 ? (
        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center">
          <p className="text-slate-400">You’re not in any organizations yet.</p>
          <Link
            to="/organizations/new"
            className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500"
          >
            Create your first organization
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {memberships.map((m) => (
            <li key={m.org_id}>
              <Link
                to={`/organizations/${m.org_id}`}
                className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition-colors hover:bg-slate-800"
              >
                {m.organizations.logo_url ? (
                  <img
                    src={m.organizations.logo_url}
                    alt=""
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-700 text-lg font-semibold text-slate-400">
                    {m.organizations.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{m.organizations.name}</p>
                  {m.organizations.description && (
                    <p className="truncate text-sm text-slate-500">{m.organizations.description}</p>
                  )}
                </div>
                <span className="shrink-0 rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300 capitalize">
                  {m.role}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
