/**
 * Automated session-summary emails (#14).
 *
 * Uses the Resend HTTP API (https://resend.com) via native fetch — no extra
 * dependency. Configuration is stored in app_settings under key 'email_config':
 *   {
 *     enabled: true,
 *     apiKey: 're_xxx',          // Resend API key
 *     from: 'PassGP <exams@yourdomain.com>',
 *     sendToCandidate: true,     // email the candidate their report
 *     ccAdmin: true,             // also notify the admin
 *     adminEmail: 'admin@passgp.com'
 *   }
 * If not enabled / not configured, sending is a silent no-op.
 */

import { supabase } from './db/supabase.js'

let _cache = { v: null, at: 0 }
async function getEmailConfig() {
  try {
    if (!supabase) return {}
    if (Date.now() - _cache.at < 60_000 && _cache.v) return _cache.v
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'email_config').maybeSingle()
    _cache = { v: data?.value || {}, at: Date.now() }
    return _cache.v
  } catch {
    return {}
  }
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function list(items) {
  const arr = Array.isArray(items) ? items.filter(Boolean) : []
  if (!arr.length) return '<p style="color:#64748b;margin:4px 0">None recorded.</p>'
  return `<ul style="margin:6px 0 14px;padding-left:18px;color:#334155">${arr.map((i) => `<li style="margin:3px 0">${esc(i)}</li>`).join('')}</ul>`
}

function buildHtml({ candidateName, examType, report }) {
  const overall = report?.overall_score ?? (report?.score != null ? Math.round(report.score / 10) : '—')
  const passFail = report?.pass_fail || ''
  const passColor = /fail/i.test(passFail) ? '#dc2626' : '#16a34a'
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;background:#fff">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:26px 28px;border-radius:14px 14px 0 0">
      <div style="color:#fff;font-size:13px;letter-spacing:.06em;opacity:.85">PASSGP · AI ORAL EXAMINER</div>
      <h1 style="color:#fff;font-size:22px;margin:6px 0 0">Your exam summary</h1>
    </div>
    <div style="border:1px solid #e8ecf3;border-top:none;border-radius:0 0 14px 14px;padding:26px 28px">
      <p style="color:#334155;margin:0 0 16px">Hi ${esc(candidateName || 'there')},</p>
      <p style="color:#334155;margin:0 0 18px">Here is the summary of your <strong>${esc(examType || 'clinical')}</strong> session.</p>
      <div style="display:flex;gap:16px;margin:0 0 20px">
        <div style="flex:1;background:#f8fafc;border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:30px;font-weight:800;color:#0f172a">${overall}<span style="font-size:14px;color:#94a3b8">/10</span></div>
          <div style="font-size:12px;color:#64748b">Overall score</div>
        </div>
        ${passFail ? `<div style="flex:1;background:#f8fafc;border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:${passColor};margin-top:6px">${esc(passFail)}</div>
          <div style="font-size:12px;color:#64748b">Outcome</div>
        </div>` : ''}
      </div>
      ${report?.examiner_comments ? `<p style="color:#334155;line-height:1.6;margin:0 0 18px">${esc(report.examiner_comments)}</p>` : ''}
      <h3 style="font-size:15px;color:#0f172a;margin:18px 0 4px">Strengths</h3>
      ${list(report?.strengths)}
      <h3 style="font-size:15px;color:#0f172a;margin:6px 0 4px">Areas to improve</h3>
      ${list(report?.weaknesses)}
      ${(report?.unsafe_areas?.length) ? `<h3 style="font-size:15px;color:#b91c1c;margin:6px 0 4px">Unsafe / red-flag areas</h3>${list(report.unsafe_areas)}` : ''}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;border-top:1px solid #eef1f6;padding-top:14px">
        This report is a training aid and not a formal examination result.
      </p>
    </div>
  </div>`
}

/**
 * Send a session-summary email. Best-effort: never throws.
 * Returns { sent: boolean, reason?: string }.
 */
export async function sendSessionSummary({ candidateEmail, candidateName, examType, report }) {
  try {
    const cfg = await getEmailConfig()
    if (!cfg?.enabled || !cfg?.apiKey || !cfg?.from) return { sent: false, reason: 'not configured' }

    const to = []
    if (cfg.sendToCandidate !== false && candidateEmail) to.push(candidateEmail)
    if (cfg.ccAdmin && cfg.adminEmail) to.push(cfg.adminEmail)
    if (!to.length) return { sent: false, reason: 'no recipients' }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: cfg.from,
        to,
        subject: `Your PassGP exam summary — ${examType || 'Clinical case'}`,
        html: buildHtml({ candidateName, examType, report }),
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.warn('Email send failed:', res.status, detail.slice(0, 200))
      return { sent: false, reason: `http ${res.status}` }
    }
    return { sent: true }
  } catch (err) {
    console.warn('Email send exception:', err?.message)
    return { sent: false, reason: 'exception' }
  }
}
