import { useCallback, useEffect, useState } from 'react'

/* ------------------------------------------------------------------
   Query history, stored locally for now (localStorage). When accounts
   land on the backend this becomes GET/POST /api/history; the shape of
   an entry is kept API-friendly on purpose.
   ------------------------------------------------------------------ */

const KEY = 'dawa.history.v1'
const EVENT = 'dawa:history'
const MAX = 50

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function write(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}

/**
 * entry = {
 *   id, at (ISO), query, type, direction, entity: {id,name,kind},
 *   topK, threshold, topResult: {id,name,confidence}, count
 * }
 */
export function addHistoryEntry(entry) {
  const items = read()
  const key = `${entry.entity?.id || entry.query}|${entry.direction}`
  const deduped = items.filter((e) => `${e.entity?.id || e.query}|${e.direction}` !== key)
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  write([{ id, at: new Date().toISOString(), ...entry }, ...deduped])
}

export function useQueryHistory() {
  const [items, setItems] = useState(read)

  useEffect(() => {
    const sync = () => setItems(read())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const remove = useCallback((id) => write(read().filter((e) => e.id !== id)), [])
  const clear = useCallback(() => write([]), [])

  return { items, remove, clear, add: addHistoryEntry }
}
