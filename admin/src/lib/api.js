import { supabase } from './supabase'

// Defaults to the live backend; override with VITE_API_BASE (e.g. http://localhost:5050)
const BASE = (import.meta.env.VITE_API_BASE || 'https://ai-oral-examiner-mvp-backend.vercel.app').replace(/\/$/, '')

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${data.session?.access_token || ''}` }
}

export async function apiGet(path) {
  const res = await fetch(BASE + path, { headers: { ...(await authHeader()) } })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}

export async function apiPost(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body || {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}
