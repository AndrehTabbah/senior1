/* ------------------------------------------------------------------
   Public API surface used by the pages/components.
   Keep this file as the single contract between frontend and backend:
   the endpoint list here is mirrored in the Docs page and README.
   ------------------------------------------------------------------ */
import { request, setToken, getToken } from './client.js'

export { ApiError, USE_MOCK } from './client.js'

export const api = {
  /** Autocomplete over drugs, compounds and diseases. */
  search(q, { limit = 8, signal } = {}) {
    return request('GET', '/search', { query: { q, limit }, signal })
  },

  /** Fetch a single entity (drug / compound / disease) by its canonical id. */
  entity(id, { signal } = {}) {
    return request('GET', `/entities/${encodeURIComponent(id)}`, { signal })
  },

  /**
   * Run the model.
   * query:     free text, an entity id, or a SMILES string
   * type:      'auto' | 'drug' | 'compound' | 'disease' | 'smiles'
   * id:        optional canonical id chosen from autocomplete
   * topK:      number of candidates to return (default 15)
   * threshold: decision threshold (default 0.79, the F1-optimal value)
   */
  predict({ query, type = 'auto', id, topK = 15, threshold = 0.79, signal }) {
    return request('POST', '/predict', {
      body: { query, type, id, top_k: topK, threshold },
      signal,
    })
  },

  /** Full explanation for one drug–disease pair. */
  explain(drugId, diseaseId, { signal } = {}) {
    return request('GET', '/explain', { query: { drug: drugId, disease: diseaseId }, signal })
  },

  /** The 11 harmonised sources and the 6 standardised tables. */
  sources({ signal } = {}) {
    return request('GET', '/sources', { signal })
  },

  /** Model card: architecture, hyper-parameters, metrics, curves. */
  model({ signal } = {}) {
    return request('GET', '/model', { signal })
  },

  /** Knowledge-graph entity and edge counts. */
  stats({ signal } = {}) {
    return request('GET', '/stats', { signal })
  },

  auth: {
    async signIn({ email, password }) {
      const data = await request('POST', '/auth/login', { body: { email, password } })
      setToken(data.token)
      return data.user
    },
    async signUp({ name, email, password, affiliation }) {
      const data = await request('POST', '/auth/register', { body: { name, email, password, affiliation } })
      setToken(data.token)
      return data.user
    },
    async me() {
      if (!getToken()) return null
      try {
        const data = await request('GET', '/auth/me')
        return data.user
      } catch {
        setToken(null)
        return null
      }
    },
    async signOut() {
      try {
        await request('POST', '/auth/logout')
      } finally {
        setToken(null)
      }
    },
  },
}

export default api
