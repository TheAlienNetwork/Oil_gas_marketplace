// Type declarations for Deno URL imports (Supabase Edge Functions run on Deno).
// This only satisfies the editor/TypeScript; the runtime is Deno.

declare namespace Deno {
  export const env: { get(key: string): string | undefined }
}

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export function createClient(supabaseUrl: string, supabaseKey: string): any
}

declare module 'npm:@supabase/supabase-js@2' {
  export function createClient(supabaseUrl: string, supabaseKey: string): any
}
