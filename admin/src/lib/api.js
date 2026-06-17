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

async function send(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: body === undefined ? undefined : JSON.stringify(body || {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}

export const apiPost = (path, body) => send('POST', path, body)
export const apiPut = (path, body) => send('PUT', path, body)
export const apiPatch = (path, body) => send('PATCH', path, body)
export const apiDelete = (path) => send('DELETE', path, undefined)
