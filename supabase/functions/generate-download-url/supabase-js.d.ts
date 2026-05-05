// Type declaration for Deno npm specifier (Supabase Edge Functions runtime).
declare module 'npm:@supabase/supabase-js@2' {
  import type { SupabaseClient } from '@supabase/supabase-js'
  export function createClient(supabaseUrl: string, supabaseKey: string): SupabaseClient
}
