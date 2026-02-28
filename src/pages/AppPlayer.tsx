import { useParams, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export default function AppPlayer() {
  const { grantId } = useParams<{ grantId: string }>()
  const { user } = useAuth()
  const [appUrl, setAppUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!grantId || !user?.id) return
    supabase
      .from('purchase_grants')
      .select('*, listings(app_bundle_path)')
      .eq('id', grantId)
      .eq('user_id', user.id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('Access denied or grant not found.')
          return
        }
        const grant = data as { app_access_path?: string; listings?: { app_bundle_path: string | null } }
        const path = grant.app_access_path || grant.listings?.app_bundle_path
        if (!path) {
          setError('No app content available.')
          return
        }
        const { data: urlData } = supabase.storage
          .from('listing-apps')
          .getPublicUrl(path)
        setAppUrl(urlData.publicUrl)
      })
  }, [grantId, user?.id])

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-slate-400">{error}</p>
      </div>
    )
  }
  if (!appUrl) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-slate-400">Loading app...</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col px-4 py-4">
      <iframe
        title="Purchased app"
        src={appUrl}
        className="flex-1 rounded-xl border border-slate-700 bg-white"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
