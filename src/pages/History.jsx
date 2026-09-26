import { useEffect, useId, useMemo, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SearchBar from '../components/SearchBar.jsx'
import ConfidenceMeter from '../components/ConfidenceMeter.jsx'
import TypeBadge from '../components/TypeBadge.jsx'
import { Icon } from '../components/Icons.jsx'
import { useQueryHistory } from '../hooks/useQueryHistory.js'
import { useAuth } from '../context/AuthContext.jsx'
import { fmtRelative, plural } from '../utils/format.js'
import './history.css'

const DEFAULT_TOP_K = 15
const DEFAULT_THRESHOLD = 0.79
const MAX_ENTRIES = 50

const EXAMPLES = [
  { q: 'Metformin', type: 'drug', sub: 'Which diseases could this drug treat?' },
  { q: 'Alzheimer Disease', type: 'disease', sub: 'Which existing drugs could treat this disease?' },
  { q: 'Sildenafil', type: 'drug', sub: 'Which diseases could this drug treat?' },
]

const GROUPS = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['earlier', 'Earlier'],
]

/* ---------- helpers -------------------------------------------------- */

function timestamp(entry) {
  const t = new Date(entry.at).getTime()
  return Number.isNaN(t) ? 0 : t
}

function dayBucket(iso, now) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'earlier'
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (d >= startOfToday) return 'today'
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (d >= startOfYesterday) return 'yesterday'
  return 'earlier'
}

function entryThreshold(entry) {
  return typeof entry.threshold === 'number' && entry.threshold >= 0 && entry.threshold <= 1 ? entry.threshold : DEFAULT_THRESHOLD
}

function entryTopK(entry) {
  return Number.isInteger(entry.topK) && entry.topK > 0 ? entry.topK : DEFAULT_TOP_K
}

function rerunHref(entry) {
  const sp = new URLSearchParams()
  sp.set('q', entry.entity?.name || entry.query || '')
  sp.set('type', entry.entity?.kind || entry.type || 'auto')
  if (entry.entity?.id) sp.set('id', entry.entity.id)
  sp.set('k', String(entryTopK(entry)))
  sp.set('t', String(entryThreshold(entry)))
  return `/results?${sp.toString()}`
}

function explainHref(entry) {
  const own = entry.entity?.id
  const top = entry.topResult?.id
  if (!own || !top) return null
  const [drug, disease] = entry.direction === 'disease_to_drug' ? [top, own] : [own, top]
  return `/explain/${encodeURIComponent(drug)}/${encodeURIComponent(disease)}`
}

function matches(entry, term) {
  const hay = [entry.entity?.name, entry.entity?.id, entry.query, entry.topResult?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(term)
}

/* ---------- page ------------------------------------------------------ */

export default function History() {
  const { items, remove, clear } = useQueryHistory()
  const { user } = useAuth()
  const [filter, setFilter] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [, tick] = useReducer((n) => n + 1, 0)
  const filterId = useId()
  const filterRef = useRef(null)
  const clearBtnRef = useRef(null)
  const keepBtnRef = useRef(null)
  const restoreFocus = useRef(false)

  useEffect(() => {
    document.title = 'Query history · Dawa'
  }, [])

  /* keep the relative timestamps honest while the tab stays open */
  useEffect(() => {
    const t = setInterval(tick, 60000)
    return () => clearInterval(t)
  }, [])

  /* focus management for the inline confirm */
  useEffect(() => {
    if (confirming) {
      keepBtnRef.current?.focus()
    } else if (restoreFocus.current) {
      restoreFocus.current = false
      clearBtnRef.current?.focus()
    }
  }, [confirming])

  useEffect(() => {
    if (!items.length) setConfirming(false)
  }, [items.length])

  const term = filter.trim().toLowerCase()

  const sorted = useMemo(() => [...items].sort((a, b) => timestamp(b) - timestamp(a)), [items])
  const shown = useMemo(() => (term ? sorted.filter((e) => matches(e, term)) : sorted), [sorted, term])

  const groups = useMemo(() => {
    const now = new Date()
    const by = { today: [], yesterday: [], earlier: [] }
    shown.forEach((e) => by[dayBucket(e.at, now)].push(e))
    return GROUPS.map(([key, label]) => ({ key, label, items: by[key] })).filter((g) => g.items.length)
  }, [shown])

  const total = items.length
  const countLabel = term
    ? `${shown.length} of ${total} ${plural(total, 'query', 'queries')}`
    : `${total} ${plural(total, 'query', 'queries')}`

  const keep = () => {
    restoreFocus.current = true
    setConfirming(false)
  }

  const clearAll = () => {
    clear()
    setConfirming(false)
    setFilter('')
  }

  const clearFilter = () => {
    setFilter('')
    filterRef.current?.focus()
  }

  return (
    <div className="container history">
      <header className="page-head history__head">
        <div className="eyebrow">History</div>
        <h1 className="h1">Everything you have asked so far.</h1>
        <p className="lede">
          {user
            ? `Signed in as ${user.name} — server-side history is coming; for now this list lives in this browser.`
            : 'History is kept in this browser for now. It will sync to your account once sign-in is wired to the backend.'}
        </p>
      </header>

      {total === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="history__bar">
            <span className="history__count" aria-live="polite">
              {countLabel}
            </span>

            <div className="history__filter">
              <label htmlFor={filterId} className="sr-only">
                Filter by name
              </label>
              <Icon.Search size={16} className="history__filter-icon" />
              <input
                ref={filterRef}
                id={filterId}
                className="input"
                type="text"
                value={filter}
                placeholder="Filter by name…"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && filter) {
                    e.preventDefault()
                    setFilter('')
                  }
                }}
              />
              {filter ? (
                <button type="button" className="history__filter-clear" aria-label="Clear filter" onClick={clearFilter}>
                  <Icon.X size={14} />
                </button>
              ) : null}
            </div>

            {confirming ? (
              <div
                className="history__confirm"
                role="group"
                aria-label="Confirm clearing history"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    keep()
                  }
                }}
              >
                <span className="history__confirm-text">Clear all {total}?</span>
                <button type="button" className="btn btn--accent btn--sm" onClick={clearAll}>
                  Clear
                </button>
                <button ref={keepBtnRef} type="button" className="btn btn--quiet btn--sm" onClick={keep}>
                  Keep
                </button>
              </div>
            ) : (
              <button
                ref={clearBtnRef}
                type="button"
                className="btn btn--quiet btn--sm history__clear"
                onClick={() => setConfirming(true)}
              >
                Clear history
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <p className="history__none">
              No queries match “{filter.trim()}”.{' '}
              <button type="button" className="link link--quiet" onClick={clearFilter}>
                Clear the filter
              </button>
            </p>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="history__group" aria-label={g.label}>
                <h2 className="eyebrow history__group-label">{g.label}</h2>
                <ul className="history__list">
                  {g.items.map((entry) => (
                    <Row key={entry.id} entry={entry} onRemove={remove} />
                  ))}
                </ul>
              </section>
            ))
          )}

          <p className="history__note">
            The last {MAX_ENTRIES} queries are kept. Running the same query in the same direction again moves it to the top
            rather than adding a duplicate.
          </p>
        </>
      )}
    </div>
  )
}

/* ---------- one history row ------------------------------------------- */

function Row({ entry, onRemove }) {
  const name = entry.entity?.name || entry.query || 'Unknown query'
  const kind = entry.entity?.kind || entry.type || 'auto'
  const id = entry.entity?.id
  const direction = entry.direction === 'disease_to_drug' ? 'disease → drug' : 'drug → disease'
  const topK = entryTopK(entry)
  const threshold = entryThreshold(entry)
  const top = entry.topResult
  const explain = explainHref(entry)
  const at = new Date(entry.at)
  const validAt = !Number.isNaN(at.getTime())

  return (
    <li className="history__row">
      <time
        className="history__time"
        dateTime={validAt ? entry.at : undefined}
        title={validAt ? at.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : undefined}
      >
        {validAt ? fmtRelative(entry.at) : '—'}
      </time>

      <div className="history__entity">
        <TypeBadge kind={kind} />
        <div className="history__entity-line">
          <span className="history__name">{name}</span>
          {id ? <span className="history__id mono muted">{id}</span> : null}
        </div>
      </div>

      <div className="history__meta">
        <span className="history__dir">{direction}</span>
        <span className="history__settings mono">
          top {topK} · threshold {threshold.toFixed(2)}
        </span>
      </div>

      <div className="history__top">
        {top && top.name ? (
          <>
            {explain ? (
              <Link to={explain} className="history__top-name history__top-link" title="Open the explanation for this pair">
                {top.name}
              </Link>
            ) : (
              <span className="history__top-name">{top.name}</span>
            )}
            <ConfidenceMeter value={top.confidence} threshold={threshold} showValue className="history__meter" />
          </>
        ) : (
          <span className="muted">—</span>
        )}
      </div>

      <div className="history__actions">
        <Link to={rerunHref(entry)} className="btn btn--ghost btn--sm">
          Re-run
        </Link>
        <button type="button" className="history__remove" aria-label="Remove" onClick={() => onRemove(entry.id)}>
          <Icon.X size={16} />
        </button>
      </div>
    </li>
  )
}

/* ---------- empty state ------------------------------------------------- */

function EmptyState() {
  return (
    <section className="history__empty">
      <div>
        <h2 className="h2">No queries yet.</h2>
        <p className="history__empty-text">
          Each prediction you run is recorded here with its settings and top candidate, so it can be re-run or compared
          later.
        </p>
        <div className="history__empty-search">
          <SearchBar size="md" showTypes={false} />
        </div>
      </div>

      <div>
        <div className="eyebrow history__examples-label">Try</div>
        <ul className="history__examples">
          {EXAMPLES.map((ex) => (
            <li key={ex.q}>
              <Link to={`/results?q=${encodeURIComponent(ex.q)}&type=${ex.type}`} className="history__example">
                <TypeBadge kind={ex.type} />
                <span className="h3 history__example-name">{ex.q}</span>
                <span className="history__example-sub">{ex.sub}</span>
                <Icon.ArrowRight size={18} className="history__example-arrow" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
