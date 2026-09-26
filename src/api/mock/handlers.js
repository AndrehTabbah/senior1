/* ------------------------------------------------------------------
   In-browser stand-in for the Flask API. Routes mirror the contract
   in src/api/index.js and the Docs page. Each handler returns exactly
   the JSON the real endpoint is expected to return.
   ------------------------------------------------------------------ */
import { ApiError } from '../client.js'
import { search, predict, explain, entityPayload, MockError, COUNTS } from './engine.js'
import { SOURCES, TABLES, PREPROCESSING, STATS } from './sources.js'
import { MODEL } from './model.js'

const LATENCY = { search: [50, 140], predict: [450, 900], explain: [300, 550], default: [120, 260] }

function delay(range, signal) {
  const [lo, hi] = range
  const ms = lo + Math.random() * (hi - lo)
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    if (signal) {
      if (signal.aborted) {
        clearTimeout(t)
        reject(abortError())
        return
      }
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(t)
          reject(abortError())
        },
        { once: true },
      )
    }
  })
}

function abortError() {
  const e = new Error('The operation was aborted.')
  e.name = 'AbortError'
  return e
}

/* ---------- mock auth ---------------------------------------------- */
const USERS_KEY = 'dawa.mock.users'
const DEMO_USER = { name: 'Demo Researcher', email: 'demo@dawa.ae', password: 'demo1234', affiliation: 'University of Sharjah' }

function readUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return arr.length ? arr : [DEMO_USER]
  } catch {
    return [DEMO_USER]
  }
}
function writeUsers(users) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  } catch {
    /* ignore */
  }
}
function publicUser(u) {
  return { name: u.name, email: u.email, affiliation: u.affiliation || null, role: 'researcher', createdAt: u.createdAt || '2026-09-01T00:00:00.000Z' }
}
function tokenFor(email) {
  return `mock.${btoa(unescape(encodeURIComponent(email)))}`
}
function emailFromToken() {
  try {
    const t = localStorage.getItem('dawa.token')
    if (!t || !t.startsWith('mock.')) return null
    return decodeURIComponent(escape(atob(t.slice(5))))
  } catch {
    return null
  }
}

/* ---------- routes -------------------------------------------------- */
const ROUTES = [
  {
    method: 'GET', pattern: /^\/search$/, latency: LATENCY.search,
    handler: ({ query }) => ({ results: search(query?.q || '', Number(query?.limit) || 8) }),
  },
  {
    method: 'GET', pattern: /^\/entities\/([^/]+)$/, latency: LATENCY.default,
    handler: ({ params }) => entityPayload(decodeURIComponent(params[0])),
  },
  {
    method: 'POST', pattern: /^\/predict$/, latency: LATENCY.predict,
    handler: ({ body }) => predict(body || {}),
  },
  {
    method: 'GET', pattern: /^\/explain$/, latency: LATENCY.explain,
    handler: ({ query }) => {
      if (!query?.drug || !query?.disease) throw new MockError('Both "drug" and "disease" are required.', 400, 'bad_request')
      return explain(query.drug, query.disease)
    },
  },
  {
    method: 'GET', pattern: /^\/sources$/, latency: LATENCY.default,
    handler: () => ({ sources: SOURCES, tables: TABLES, preprocessing: PREPROCESSING }),
  },
  {
    method: 'GET', pattern: /^\/model$/, latency: LATENCY.default,
    handler: () => ({ model: MODEL }),
  },
  {
    method: 'GET', pattern: /^\/stats$/, latency: LATENCY.default,
    handler: () => ({ ...STATS, mockIndex: COUNTS }),
  },
  {
    method: 'POST', pattern: /^\/auth\/login$/, latency: LATENCY.default,
    handler: ({ body }) => {
      const email = String(body?.email || '').trim().toLowerCase()
      const user = readUsers().find((u) => u.email.toLowerCase() === email)
      if (!user || user.password !== body?.password) throw new MockError('Incorrect email or password.', 401, 'invalid_credentials')
      return { token: tokenFor(user.email), user: publicUser(user) }
    },
  },
  {
    method: 'POST', pattern: /^\/auth\/register$/, latency: LATENCY.default,
    handler: ({ body }) => {
      const email = String(body?.email || '').trim().toLowerCase()
      const name = String(body?.name || '').trim()
      const password = String(body?.password || '')
      if (!name) throw new MockError('Name is required.', 422, 'validation')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new MockError('Enter a valid email address.', 422, 'validation')
      if (password.length < 8) throw new MockError('Password must be at least 8 characters.', 422, 'validation')
      const users = readUsers()
      if (users.some((u) => u.email.toLowerCase() === email)) throw new MockError('An account with that email already exists.', 409, 'conflict')
      const user = { name, email, password, affiliation: body?.affiliation || null, createdAt: new Date().toISOString() }
      writeUsers([...users, user])
      return { token: tokenFor(user.email), user: publicUser(user) }
    },
  },
  {
    method: 'GET', pattern: /^\/auth\/me$/, latency: [40, 90],
    handler: () => {
      const email = emailFromToken()
      const user = email && readUsers().find((u) => u.email.toLowerCase() === email.toLowerCase())
      if (!user) throw new MockError('Not signed in.', 401, 'unauthenticated')
      return { user: publicUser(user) }
    },
  },
  {
    method: 'POST', pattern: /^\/auth\/logout$/, latency: [40, 90],
    handler: () => ({ ok: true }),
  },
]

export async function handle(method, path, { body, query, signal } = {}) {
  const route = ROUTES.find((r) => r.method === method && r.pattern.test(path))
  if (!route) throw new ApiError(`Mock API has no route for ${method} ${path}`, { status: 404, code: 'not_found' })
  await delay(route.latency, signal)
  try {
    const params = path.match(route.pattern).slice(1)
    const data = route.handler({ body, query, params })
    // Deep-clone so callers can't mutate mock state.
    return JSON.parse(JSON.stringify(data))
  } catch (err) {
    if (err instanceof MockError) throw new ApiError(err.message, { status: err.status, code: err.code })
    throw err
  }
}
