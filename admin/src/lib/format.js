export function fmtDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

export function fmtDateTime(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

export function fmtDuration(sec = 0) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function timeAgo(d) {
  if (!d) return '—'
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function initials(name = '', email = '') {
  const n = (name || '').trim()
  if (n) return n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (email || '?').slice(0, 2).toUpperCase()
}

export function resultBadge(result = '') {
  const r = String(result).toLowerCase()
  if (r.includes('excellent') || r.includes('clear') || r.includes('competent')) return 'green'
  if (r.includes('needs') || r.includes('below') || r.includes('fail')) return 'red'
  return 'amber'
}

export function toCsv(rows, headers) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = headers.map((h) => esc(h.label)).join(',')
  const body = rows.map((row) => headers.map((h) => esc(typeof h.get === 'function' ? h.get(row) : row[h.key])).join(',')).join('\n')
  return head + '\n' + body
}

export function downloadFile(name, content, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
