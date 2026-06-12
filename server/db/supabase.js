import { createClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client.
 *
 * Uses the SECRET key (service role) — this bypasses Row Level Security, so it
 * must only ever run on the server, never in the browser. The browser should
 * use the PUBLISHABLE key instead.
 */
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

export const supabase =
  url && secret
    ? createClient(url, secret, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

export function assertSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in server/.env'
    )
  }
  return supabase
}
