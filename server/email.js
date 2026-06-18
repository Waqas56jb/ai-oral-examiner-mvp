/**
 * Automated session-summary emails (#14) via nodemailer (SMTP).
 *
 * Credentials come from the server .env:
 *   Owner_Email   = the sending mailbox (e.g. admin@passgp.au)
 *   App_Password  = its app password
 * Optional overrides: SMTP_HOST (default smtp.gmail.com), SMTP_PORT (default 465),
 * SMTP_SECURE ("true"/"false"), EMAIL_BCC_OWNER ("true" to also copy the owner).
 *
 * Each candidate who provides an email gets an elegant HTML email with a nicely
 * formatted PDF report attached. If credentials are missing, sending is a no-op.
 */
import nodemailer from 'nodemailer'
import { buildReportPdf } from './report-pdf.js'

const OWNER = process.env.Owner_Email || process.env.OWNER_EMAIL || ''
const PASS = process.env.App_Password || process.env.APP_PASSWORD || ''
// passgp.au is on Zoho Mail (AU region). Override with SMTP_HOST if that changes.
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.zoho.com.au'
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465
const SMTP_SECURE = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : SMTP_PORT === 465

let _transport = null
function getTransport() {
  if (!OWNER || !PASS) return null
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: OWNER, pass: PASS },
    })
  }
  return _transport
}

export function emailReady() {
  return Boolean(OWNER && PASS)
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function list(items, color = '#334155') {
  const a = Array.isArray(items) ? items.filter(Boolean) : []
  if (!a.length) return '<p style="color:#94a3b8;margin:4px 0">None recorded.</p>'
  return `<ul style="margin:6px 0 14px;padding-left:18px;color:${color}">${a.map((i) => `<li style="margin:4px 0">${esc(i)}</li>`).join('')}</ul>`
}

function buildHtml({ candidateName, examType, report, date }) {
  const overall = report?.overall_score ?? (report?.score != null ? Math.round(report.score / 10) : '—')
  const marks = report?.marks_awarded != null && report?.total_marks ? `${report.marks_awarded} / ${report.total_marks}` : null
  const passFail = report?.pass_fail || report?.result || ''
  const isFail = /fail|unsafe/i.test(passFail)
  const passColor = isFail ? '#dc2626' : '#16a34a'
  return `
  <div style="margin:0;background:#eef1f8;padding:28px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08)">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:30px 32px">
        <div style="color:#e0e2ff;font-size:12px;letter-spacing:.08em;font-weight:700">PASSGP · AI ORAL EXAMINER</div>
        <h1 style="color:#fff;font-size:23px;margin:8px 0 0">Your exam report</h1>
      </div>
      <div style="padding:28px 32px">
        <p style="color:#334155;margin:0 0 14px;font-size:15px">Hi ${esc(candidateName || 'there')},</p>
        <p style="color:#334155;margin:0 0 22px;font-size:14px;line-height:1.6">Thank you for completing your <strong>${esc(examType || 'clinical')}</strong> session with the PassGP AI examiner. Here's a summary — your full formatted report is attached as a PDF.</p>
        <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:10px 0;margin:0 0 22px">
          <tr>
            <td style="background:#f6f8fd;border-radius:12px;padding:16px;text-align:center;width:50%">
              <div style="font-size:28px;font-weight:800;color:#0f172a">${marks ? esc(marks) : `${overall}<span style="font-size:13px;color:#94a3b8">/10</span>`}</div>
              <div style="font-size:11px;color:#64748b;letter-spacing:.04em">${marks ? 'MARKS' : 'OVERALL'}</div>
            </td>
            ${passFail ? `<td style="background:#f6f8fd;border-radius:12px;padding:16px;text-align:center;width:50%">
              <div style="font-size:20px;font-weight:800;color:${passColor};margin-top:5px">${esc(passFail)}</div>
              <div style="font-size:11px;color:#64748b;letter-spacing:.04em">OUTCOME</div>
            </td>` : ''}
          </tr>
        </table>
        ${report?.killer_failed ? `<div style="background:#fee2e2;border:1px solid #fca5a5;color:#b91c1c;border-radius:10px;padding:10px 14px;font-weight:700;font-size:13px;margin:0 0 18px">⚠ Critical safety failure — automatic fail.</div>` : ''}
        ${report?.examiner_comments ? `<p style="color:#334155;line-height:1.65;margin:0 0 18px;font-size:14px">${esc(report.examiner_comments)}</p>` : ''}
        <h3 style="font-size:14px;color:#0f172a;margin:18px 0 2px">Strengths</h3>
        ${list(report?.strengths)}
        <h3 style="font-size:14px;color:#0f172a;margin:8px 0 2px">Areas to improve</h3>
        ${list(report?.weaknesses || report?.improvements)}
        ${(report?.unsafe_areas?.length) ? `<h3 style="font-size:14px;color:#b91c1c;margin:8px 0 2px">Unsafe / red-flag areas</h3>${list(report.unsafe_areas, '#b91c1c')}` : ''}
        <div style="margin-top:24px;padding:14px 16px;background:#f6f8fd;border-radius:10px;color:#64748b;font-size:13px">📄 Your detailed report is attached as <strong>a PDF</strong>.</div>
        <p style="color:#94a3b8;font-size:11px;margin-top:22px;border-top:1px solid #eef1f6;padding-top:14px">This report is a training aid and not a formal examination result.${date ? ` · ${esc(date)}` : ''}</p>
      </div>
    </div>
  </div>`
}

/**
 * Send a session-summary email with a PDF report attached. Never throws.
 * Returns { sent: boolean, reason?: string }.
 */
export async function sendSessionSummary({ candidateEmail, candidateName, examType, report, date }) {
  try {
    const transport = getTransport()
    if (!transport) return { sent: false, reason: 'not configured' }
    if (!candidateEmail) return { sent: false, reason: 'no recipient' }

    const when = date || new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    let attachments = []
    try {
      const pdf = await buildReportPdf({ candidateName, examType, date: when, report })
      const safeName = String(candidateName || 'candidate').replace(/[^a-z0-9]+/gi, '-').slice(0, 40)
      attachments = [{ filename: `PassGP-Report-${safeName}.pdf`, content: Buffer.from(pdf), contentType: 'application/pdf' }]
    } catch (e) {
      console.warn('PDF build failed, sending email without attachment:', e?.message)
    }

    const outcome = report?.pass_fail || report?.result || ''
    const bcc = process.env.EMAIL_BCC_OWNER === 'true' ? OWNER : undefined

    await transport.sendMail({
      from: `"PassGP Examiner" <${OWNER}>`,
      to: candidateEmail,
      bcc,
      subject: `Your PassGP exam report — ${examType || 'Clinical case'}${outcome ? ` (${outcome})` : ''}`,
      html: buildHtml({ candidateName, examType, report, date: when }),
      attachments,
    })
    return { sent: true }
  } catch (err) {
    console.warn('Email send failed:', err?.message)
    return { sent: false, reason: err?.message || 'error' }
  }
}
