// Supabase Edge Function: generate signed download URL for a purchase grant
// Set env: SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const { grantId } = await req.json()
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { data: grant, error: grantError } = await supabase
      .from('purchase_grants')
      .select('download_path, listing_id')
      .eq('id', grantId)
      .eq('user_id', user.id)
      .single()
    if (grantError || !grant?.download_path) {
      return new Response(JSON.stringify({ error: 'Grant not found or no file' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { data: signed } = await supabase.storage
      .from('listing-files')
      .createSignedUrl(grant.download_path, 3600)
    if (!signed?.signedUrl) {
      return new Response(JSON.stringify({ error: 'Failed to create download URL' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ url: signed.signedUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
