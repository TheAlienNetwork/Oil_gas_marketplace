// Supabase Edge Function: generate signed download URL for a purchase grant
// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Deno loads ambient URL module types from ../deno.d.ts
/// <reference path="../deno.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getSecretApiKey, getSupabaseUrl } from '../_shared/secrets.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function json(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = getSupabaseUrl()
  const secretKey = getSecretApiKey()
  if (!supabaseUrl || !secretKey) {
    return json(
      {
        error:
          'Function misconfigured: missing SUPABASE_URL or secret API key. In Dashboard → Edge Functions → Secrets, set SUPABASE_SERVICE_ROLE_KEY (Project Settings → API → service_role).',
      },
      503
    )
  }

  const supabase = createClient(supabaseUrl, secretKey)

  try {
    const body = (await req.json()) as { grantId?: string; access_token?: string }
    const grantId = body?.grantId
    const authHeader = req.headers.get('Authorization')
    const tokenFromHeader = authHeader?.replace(/^Bearer\s+/i, '')?.trim()
    const token = tokenFromHeader || body?.access_token || ''
    if (!token) {
      return json({ error: 'Unauthorized' }, 401)
    }
    if (!grantId) {
      return json({ error: 'Grant ID required' }, 400)
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const { data: grant, error: grantError } = await supabase
      .from('purchase_grants')
      .select('download_path, app_access_path')
      .eq('id', grantId)
      .eq('user_id', user.id)
      .single()

    if (grantError || !grant) {
      return json({ error: 'Grant not found' }, 404)
    }

    const filePath = typeof grant.download_path === 'string' ? grant.download_path.trim() : ''
    const appPath = typeof grant.app_access_path === 'string' ? grant.app_access_path.trim() : ''

    let bucket: string
    let objectPath: string
    if (filePath) {
      bucket = 'listing-files'
      objectPath = filePath
    } else if (appPath) {
      bucket = 'listing-apps'
      objectPath = appPath
    } else {
      return json({ error: 'No file attached to this purchase. Contact support if this is wrong.' }, 404)
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 3600)

    if (signError) {
      console.error('createSignedUrl', bucket, signError)
      return json(
        {
          error:
            signError.message ||
            'Failed to create download URL. Confirm the file exists in storage.',
        },
        500
      )
    }
    if (!signed?.signedUrl) {
      return json({ error: 'Failed to create download URL' }, 500)
    }

    return json({ url: signed.signedUrl }, 200)
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})
