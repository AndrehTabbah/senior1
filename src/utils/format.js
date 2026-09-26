export function fmtInt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}

export function fmtCompact(n) {
  if (n === null || n === undefined) return '—'
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`
  return String(n)
}

export function fmtPct(x, digits = 0) {
  if (x === null || x === undefined) return '—'
  return `${(x * 100).toFixed(digits)}%`
}

export function fmtProb(x, digits = 2) {
  if (x === null || x === undefined) return '—'
  return x.toFixed(digits)
}

export function fmtNum(x, digits = 1) {
  if (x === null || x === undefined) return '—'
  return Number(x).toFixed(digits)
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtRelative(iso) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const days = Math.round(h / 24)
  if (days < 7) return `${days} d ago`
  return fmtDate(iso)
}

export function plural(n, one, many = `${one}s`) {
  return n === 1 ? one : many
}

export function truncate(s, n = 60) {
  if (!s) return ''
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}
