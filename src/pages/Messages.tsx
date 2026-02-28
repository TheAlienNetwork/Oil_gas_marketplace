import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type ConversationRow = {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  updated_at: string
  listings?: { title: string } | null
}

export default function Messages() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ConversationRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    setError('')
    supabase
      .from('conversations')
      .select('id, listing_id, buyer_id, seller_id, updated_at, listings(title)')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('updated_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        setRows((data as ConversationRow[]) ?? [])
        setLoading(false)
      })
  }, [user?.id])

  const emptyText = useMemo(() => {
    if (!user?.id) return 'Sign in to view messages.'
    return 'No conversations yet. Use “Message seller” on a listing to start one.'
  }, [user?.id])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-white">Messages</h1>
      {error && (
        <div className="mt-4 rounded-lg bg-amber-900/30 px-4 py-2 text-sm text-amber-200">
          {error}
        </div>
      )}
      {loading ? (
        <div className="mt-8 text-slate-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center text-slate-400">
          {emptyText}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                to={`/messages/${c.id}`}
                className="block rounded-xl border border-slate-700 bg-slate-800/50 p-4 hover:bg-slate-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {c.listings?.title ?? 'Conversation'}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Updated {new Date(c.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm text-primary-400">Open</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

