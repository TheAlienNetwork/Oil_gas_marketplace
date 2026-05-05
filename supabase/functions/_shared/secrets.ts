/** Resolve secret API key for Edge Functions (legacy + SUPABASE_SECRET_KEYS JSON). */

export function getSupabaseUrl(): string {
  return Deno.env.get('SUPABASE_URL')?.trim() ?? ''
}

export function getSecretApiKey(): string | null {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (legacy) return legacy
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'string') return parsed.trim() || null
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as Record<string, unknown>
    const orderedKeys = ['default', 'service_role', 'secret', 'supabase']
    for (const k of orderedKeys) {
      const v = o[k]
      if (typeof v === 'string' && v.length > 32) return v
    }
    for (const v of Object.values(o)) {
      if (typeof v !== 'string') continue
      const s = v.trim()
      if (s.startsWith('eyJ') || s.startsWith('sb_')) return s
      if (s.length > 40) return s
    }
  } catch {
    return null
  }
  return null
}
