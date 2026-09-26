/* ------------------------------------------------------------------
   HTTP client.
   While the Flask backend is being built, every call is served by the
   in-browser mock (src/api/mock). Flip VITE_USE_MOCK=false in .env.local
   to hit the real API at VITE_API_BASE (default "/api", proxied by Vite
   to http://localhost:5000 — see vite.config.js).
   ------------------------------------------------------------------ */

export const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'
export const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

const TOKEN_KEY = 'dawa.token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable (private mode) — stay in memory only */
  }
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'error', details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function toQuery(params) {
  if (!params) return ''
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/**
 * request('GET', '/search', { query: { q: 'metformin' } })
 * request('POST', '/predict', { body: { query: 'metformin', type: 'drug' } })
 */
export async function request(method, path, { body, query, signal } = {}) {
  if (USE_MOCK) {
    const { handle } = await import('./mock/handlers.js')
    return handle(method, path, { body, query, signal })
  }

  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${API_BASE}${path}${toQuery(query)}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError('Could not reach the Dawa API. Is the backend running?', { code: 'network' })
  }

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { message: text }
  }

  if (!res.ok) {
    throw new ApiError(data?.message || data?.error || `Request failed (${res.status})`, {
      status: res.status,
      code: data?.code || 'http',
      details: data,
    })
  }
  return data
}
