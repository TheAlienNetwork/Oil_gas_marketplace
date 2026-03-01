import { createClient } from '@supabase/supabase-js'

export default async function handler(req: { method?: string; body?: unknown; headers?: { authorization?: string } }, res: { setHeader: (k: string, v: string) => void; status: (n: number) => { end: () => void; json: (b: object) => void } }) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase env' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const grantId = body.grantId
  const authHeader = req.headers.authorization
  const tokenFromHeader = authHeader?.replace(/^Bearer\s+/i, '').trim()
  const token = tokenFromHeader || body.access_token || ''
  if (!token) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (!grantId) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(400).json({ error: 'Grant ID required' })
  }

  const supabase = createClient(url, serviceRoleKey)
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data: grant, error: grantError } = await supabase
    .from('purchase_grants')
    .select('download_path, listing_id')
    .eq('id', grantId)
    .eq('user_id', user.id)
    .single()

  if (grantError || !grant?.download_path) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(404).json({ error: 'Grant not found or no file' })
  }

  const { data: signed } = await supabase.storage
    .from('listing-files')
    .createSignedUrl(grant.download_path, 3600)

  if (!signed?.signedUrl) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(500).json({ error: 'Failed to create download URL' })
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(200).json({ url: signed.signedUrl })
}
