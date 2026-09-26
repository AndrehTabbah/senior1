import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/index.js'
import { useDebounce } from '../hooks/useDebounce.js'
import { detectInput, INPUT_TYPES } from '../utils/detectInput.js'
import TypeBadge from './TypeBadge.jsx'
import { Icon } from './Icons.jsx'
import { cx } from '../utils/format.js'

/**
 * The platform's single entry point: one box that accepts a drug name, a
 * disease name, a compound name or a SMILES string.
 *
 * - Autocompletes over the entity index (drugs, compounds, diseases).
 * - Detects SMILES automatically, validates it and switches to a mono font.
 * - Optional manual type override (Auto / Drug / Disease / Compound / SMILES).
 * - Submits to /results?q=…&type=…[&id=…], or calls onSubmit(params).
 */
export default function SearchBar({
  size = 'md',
  initialQuery = '',
  initialType = 'auto',
  autoFocus = false,
  showTypes = true,
  showHint = true,
  placeholder = 'Enter a drug, disease, compound or SMILES notation…',
  submitLabel = 'Analyze',
  onSubmit,
  className,
}) {
  const navigate = useNavigate()
  const listId = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  const [q, setQ] = useState(initialQuery)
  const [type, setType] = useState(initialType)
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)

  useEffect(() => setQ(initialQuery), [initialQuery])
  useEffect(() => setType(initialType), [initialType])

  const det = detectInput(q)
  const isSmiles = type === 'smiles' || (type === 'auto' && det.kind === 'smiles')
  const debounced = useDebounce(q, 160)

  /* fetch suggestions */
  useEffect(() => {
    const term = debounced.trim()
    if (isSmiles || term.length < 2) {
      setItems([])
      setLoading(false)
      return undefined
    }
    const ctrl = new AbortController()
    setLoading(true)
    api
      .search(term, { limit: 8, signal: ctrl.signal })
      .then((res) => {
        const kinds = type === 'auto' ? null : [type]
        const list = (res.results || []).filter((r) => !kinds || kinds.includes(r.kind))
        setItems(list)
        setActive(-1)
      })
      .catch((err) => err?.name !== 'AbortError' && setItems([]))
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [debounced, isSmiles, type])

  /* close on outside click */
  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const effectiveType = type !== 'auto' ? type : isSmiles ? 'smiles' : 'auto'

  const submit = useCallback(
    (picked) => {
      const query = (picked?.name || q).trim()
      if (!query) {
        inputRef.current?.focus()
        return
      }
      if (isSmiles && !det.valid && !picked) return
      const params = { q: query, type: picked ? picked.kind : effectiveType }
      if (picked?.id) params.id = picked.id
      setOpen(false)
      if (onSubmit) {
        onSubmit(params)
        return
      }
      const sp = new URLSearchParams(params)
      navigate(`/results?${sp.toString()}`)
    },
    [q, isSmiles, det.valid, effectiveType, onSubmit, navigate],
  )

  const choose = (item) => {
    setQ(item.name)
    submit(item)
  }

  const onKeyDown = (e) => {
    const n = items.length
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault()
      setOpen(true)
      setActive((a) => (a + 1) % n)
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault()
      setOpen(true)
      setActive((a) => (a - 1 + n) % n)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && active >= 0 && items[active]) choose(items[active])
      else submit()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showPop = open && q.trim().length >= 2 && (isSmiles || items.length || !loading)
  const hint = isSmiles
    ? det.valid
      ? 'Valid SMILES. A registered structure is matched to its drug; a new one is featurised on the fly.'
      : `SMILES looks incomplete — ${det.reason}.`
    : 'Drugs and compounds return ranked diseases; diseases return ranked drugs.'

  return (
    <div ref={rootRef} className={cx('search', size === 'lg' && 'search--lg', className)}>
      <form
        className="search__form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Icon.Search size={size === 'lg' ? 20 : 18} className="search__icon" />
        <input
          ref={inputRef}
          className={cx('search__input', isSmiles && 'search__input--mono')}
          type="text"
          value={q}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          role="combobox"
          aria-label="Search drugs, diseases, compounds or SMILES"
          aria-expanded={showPop}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={isSmiles && !det.valid && q.length > 3 ? 'true' : undefined}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {q && isSmiles ? (
          <span className={cx('search__detect', det.valid ? 'search__detect--ok' : 'search__detect--bad')}>
            {det.valid ? <Icon.Check size={12} /> : <Icon.Alert size={12} />}
            SMILES
          </span>
        ) : null}
        {q ? (
          <button
            type="button"
            className="search__clear"
            aria-label="Clear"
            onClick={() => {
              setQ('')
              setItems([])
              inputRef.current?.focus()
            }}
          >
            <Icon.X size={16} />
          </button>
        ) : null}
        <button type="submit" className={cx('btn btn--primary search__submit', size === 'lg' && 'btn--lg')}>
          {submitLabel}
          <Icon.ArrowRight size={16} />
        </button>
      </form>

      {(showTypes || showHint) && (
        <div className="search__meta">
          {showTypes ? (
            <div className="segmented" role="radiogroup" aria-label="Input type">
              {INPUT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={type === t.value}
                  className="segmented__btn"
                  onClick={() => {
                    setType(t.value)
                    inputRef.current?.focus()
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : (
            <span />
          )}
          {showHint ? <span className={cx('search__meta-note', isSmiles && !det.valid && 'search__meta-note--bad')}>{hint}</span> : null}
        </div>
      )}

      {showPop && (
        <div className="search__pop">
          <ul id={listId} role="listbox" className="search__list">
            {isSmiles ? (
              <li
                role="option"
                aria-selected="true"
                className="search__item search__item--smiles"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submit()}
              >
                <span className="search__item-name">{q.trim()}</span>
                <span className="search__item-sub">{det.valid ? 'Analyze this structure' : det.reason}</span>
                <TypeBadge kind="smiles" className="search__item-badge" />
              </li>
            ) : items.length ? (
              items.map((it, i) => (
                <li
                  key={it.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className="search__item"
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(it)}
                >
                  <span className="search__item-name">
                    <Highlight text={it.name} term={q} />
                    {it.matchedOn ? <span className="muted"> · {it.matchedOn}</span> : null}
                  </span>
                  <span className="search__item-sub">{it.subtitle}</span>
                  <TypeBadge kind={it.kind} className="search__item-badge" />
                </li>
              ))
            ) : (
              <li className="search__empty">
                {loading ? 'Searching…' : 'No match in the index. Press Enter to try it anyway, or paste a SMILES string.'}
              </li>
            )}
          </ul>
          <div className="search__foot">
            <span>
              <span className="kbd">↑</span> <span className="kbd">↓</span> navigate · <span className="kbd">↵</span> select
            </span>
            <span>
              <span className="kbd">esc</span> close
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function Highlight({ text, term }) {
  const t = term.trim()
  if (!t) return text
  const idx = text.toLowerCase().indexOf(t.toLowerCase())
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + t.length)}</mark>
      {text.slice(idx + t.length)}
    </>
  )
}
