import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SearchBar from '../components/SearchBar.jsx'
import ConfidenceMeter from '../components/ConfidenceMeter.jsx'
import TypeBadge from '../components/TypeBadge.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { Icon } from '../components/Icons.jsx'
import { api } from '../api/index.js'
import { useApi } from '../hooks/useApi.js'
import { addHistoryEntry } from '../hooks/useQueryHistory.js'
import { cx, fmtInt, plural } from '../utils/format.js'
import './results.css'

/* ------------------------------------------------------------------
   Results — the ranked list for one query.
   /results?q=…&type=auto|drug|disease|compound|smiles[&id=…][&k=15][&t=0.79]
   Threshold changes are applied client-side; top-k changes refetch.
   ------------------------------------------------------------------ */

const DEFAULT_THRESHOLD = 0.79
const DEFAULT_K = 15
const K_OPTIONS = [10, 15, 25, 50]
const MIN_T = 0.5
const MAX_T = 0.95
const TYPES = ['auto', 'drug', 'disease', 'compound', 'smiles']
const GENE_PREVIEW = 12

const SORTS = [
  { value: 'rank', label: 'Confidence' },
  { value: 'name', label: 'Name' },
  { value: 'shared', label: 'Shared targets' },
  { value: 'evidence', label: 'Evidence' },
]

const SORTERS = {
  rank: (a, b) => a.rank - b.rank,
  name: (a, b) => a.name.localeCompare(b.name),
  shared: (a, b) => b.sharedGenes.length - a.sharedGenes.length || b.ppiHops.length - a.ppiHops.length || a.rank - b.rank,
  evidence: (a, b) => b.evidenceCount - a.evidenceCount || a.rank - b.rank,
}

const OUTCOME_LABEL = { positive: 'Positive', mixed: 'Mixed', negative: 'Negative', ongoing: 'Ongoing', approved: 'Approved' }

const EXAMPLES = [
  { label: 'Metformin', q: 'Metformin', type: 'drug' },
  { label: 'Sildenafil', q: 'Sildenafil', type: 'drug' },
  { label: 'Alzheimer Disease', q: 'Alzheimer Disease', type: 'disease' },
  { label: 'Colchicine', q: 'Colchicine', type: 'drug' },
  { label: 'CN(C)C(=N)NC(N)=N', q: 'CN(C)C(=N)NC(N)=N', type: 'smiles', mono: true },
]

const DESCRIPTORS = [
  ['molWt', 'MolWt', (v) => v.toFixed(1)],
  ['logP', 'LogP', (v) => v.toFixed(2)],
  ['tpsa', 'TPSA', (v) => `${v.toFixed(1)} Å²`],
  ['hbd', 'H-bond donors', (v) => String(v)],
  ['hba', 'H-bond acceptors', (v) => String(v)],
  ['rotB', 'Rotatable bonds', (v) => String(v)],
  ['rings', 'Rings', (v) => String(v)],
  ['aromaticRings', 'Aromatic rings', (v) => String(v)],
  ['heavyAtoms', 'Heavy atoms', (v) => String(v)],
  ['fracCsp3', 'Fsp3', (v) => v.toFixed(2)],
]

/* ---------- helpers ------------------------------------------------ */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const round2 = (v) => Math.round(v * 100) / 100

function parseThreshold(raw) {
  const n = parseFloat(raw)
  return Number.isFinite(n) ? clamp(round2(n), MIN_T, MAX_T) : DEFAULT_THRESHOLD
}

function parseK(raw) {
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? clamp(n, 1, 50) : DEFAULT_K
}

function queryLink(name, kind) {
  return `/results?q=${encodeURIComponent(name)}&type=${encodeURIComponent(kind)}`
}

function explainLink(pair) {
  return `/explain/${encodeURIComponent(pair.drugId)}/${encodeURIComponent(pair.diseaseId)}`
}

function trialLabel(trial) {
  return `${trial.phase} · ${OUTCOME_LABEL[trial.outcome] || trial.outcome}`
}

function trialTagClass(outcome) {
  if (outcome === 'positive' || outcome === 'approved') return 'tag tag--accent'
  if (outcome === 'negative') return 'tag results-tag--neg'
  return 'tag'
}

function csvFor(rows) {
  const header = ['rank', 'candidate', 'id', 'kind', 'confidence', 'known', 'shared_targets', 'pathways', 'trial', 'sources']
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = rows.map((r) =>
    [
      r.rank,
      r.name,
      r.id,
      r.kind,
      r.confidence.toFixed(3),
      r.known ? 'yes' : 'no',
      r.sharedGenes.join(';'),
      r.pathwayCount,
      r.trial ? `${trialLabel(r.trial)} (${r.trial.year})` : '',
      r.sources.join(';'),
    ]
      .map(esc)
      .join(','),
  )
  return [header.join(','), ...lines].join('\r\n')
}

/** Short-lived "Copied" feedback around navigator.clipboard. */
function useCopy(resetMs = 1800) {
  const [state, setState] = useState('idle')
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = useCallback(
    async (text) => {
      try {
        if (!navigator.clipboard) throw new Error('Clipboard unavailable')
        await navigator.clipboard.writeText(text)
        setState('copied')
      } catch {
        setState('failed')
      }
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setState('idle'), resetMs)
    },
    [resetMs],
  )
  return [state, copy]
}

/* ---------- page ---------------------------------------------------- */

export default function Results() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = (searchParams.get('q') || '').trim()
  const rawType = searchParams.get('type')
  const type = TYPES.includes(rawType) ? rawType : 'auto'
  const id = searchParams.get('id') || undefined
  const k = parseK(searchParams.get('k'))
  const t = parseThreshold(searchParams.get('t'))

  const setParams = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          Object.entries(patch).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') next.delete(key)
            else next.set(key, String(value))
          })
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  if (!q) return <EmptyQuery />
  return <ResultsView q={q} type={type} id={id} k={k} t={t} setParams={setParams} />
}

function ResultsView({ q, type, id, k, t, setParams }) {
  const { data, error, loading, reload } = useApi(
    (signal) => api.predict({ query: q, type, id, topK: k, threshold: t, signal }),
    [q, type, id, k],
  )

  const [onlyAbove, setOnlyAbove] = useState(false)
  const [hideKnown, setHideKnown] = useState(false)
  const [sort, setSort] = useState('rank')
  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const triggerRef = useRef(null)
  const [copyState, copy] = useCopy()

  const entity = data?.entity

  useEffect(() => {
    document.title = entity ? `${entity.name} — Results · Dawa` : 'Results · Dawa'
  }, [entity])

  /* one history entry per result payload */
  useEffect(() => {
    if (!data) return
    const first = data.predictions[0]
    addHistoryEntry({
      query: data.query.raw || q,
      type: data.query.type || type,
      direction: data.direction,
      entity: { id: data.entity.id, name: data.entity.name, kind: data.entity.kind },
      topK: data.topK,
      threshold: data.threshold,
      topResult: first ? { id: first.id, name: first.name, confidence: first.confidence } : null,
      count: data.predictions.length,
    })
    setSelectedId(null)
    setFilter('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  /* threshold is applied client-side */
  const rows = useMemo(
    () => (data ? data.predictions.map((p) => ({ ...p, aboveThreshold: p.confidence >= t })) : []),
    [data, t],
  )

  const term = filter.trim().toLowerCase()
  const visible = useMemo(() => {
    let list = rows
    if (onlyAbove) list = list.filter((r) => r.aboveThreshold)
    if (hideKnown) list = list.filter((r) => !r.known)
    if (term) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(term) ||
          r.id.toLowerCase().includes(term) ||
          (r.category || '').toLowerCase().includes(term) ||
          r.sharedGenes.some((g) => g.toLowerCase().includes(term)) ||
          r.topPathways.some((p) => p.toLowerCase().includes(term)),
      )
    }
    return [...list].sort(SORTERS[sort] || SORTERS.rank)
  }, [rows, onlyAbove, hideKnown, term, sort])

  const selected = selectedId ? rows.find((r) => r.id === selectedId) || null : null

  const openRow = useCallback((row, triggerEl) => {
    triggerRef.current = triggerEl || null
    setSelectedId(row.id)
  }, [])

  const closeDrawer = useCallback(() => {
    const el = triggerRef.current
    setSelectedId(null)
    if (el && document.contains(el)) requestAnimationFrame(() => el.focus())
  }, [])

  const setThreshold = (value) => {
    const v = clamp(round2(Number(value)), MIN_T, MAX_T)
    setParams({ t: v === DEFAULT_THRESHOLD ? null : v.toFixed(2) })
  }

  const setTopK = (value) => {
    const n = parseK(value)
    setParams({ k: n === DEFAULT_K ? null : n })
  }

  const downloadCsv = () => {
    if (!data) return
    const blob = new Blob([csvFor(visible)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dawa-${data.entity.id}-${data.direction}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const raw = data?.query?.raw || ''
  const showResolved = data && !entity.novel && raw && raw.trim().toLowerCase() !== entity.name.toLowerCase()

  return (
    <div className="container results">
      <div className="results__search">
        <SearchBar size="md" initialQuery={q} initialType={type} showHint={false} />
      </div>

      {showResolved ? (
        <p className="results__resolved">
          “{raw.trim()}” resolved to <strong>{entity.name}</strong> <span className="mono">{entity.id}</span>
        </p>
      ) : null}

      {error ? (
        <ResultsError error={error} onRetry={reload} />
      ) : (
        <div className="results__grid">
          <aside className="results__entity" aria-busy={loading}>
            {loading || !entity ? <EntitySkeleton /> : <EntityPanel entity={entity} />}
          </aside>

          <section className="results__main" aria-busy={loading}>
            {loading || !data ? (
              <>
                <ControlsSkeleton />
                <TableSkeleton />
              </>
            ) : (
              <>
                <Controls
                  data={data}
                  rows={rows}
                  visible={visible}
                  t={t}
                  k={k}
                  sort={sort}
                  filter={filter}
                  onlyAbove={onlyAbove}
                  hideKnown={hideKnown}
                  copyState={copyState}
                  onThreshold={setThreshold}
                  onTopK={setTopK}
                  onSort={setSort}
                  onFilter={setFilter}
                  onOnlyAbove={() => setOnlyAbove((v) => !v)}
                  onHideKnown={() => setHideKnown((v) => !v)}
                  onCopyJson={() => copy(JSON.stringify(data, null, 2))}
                  onDownloadCsv={downloadCsv}
                />
                {rows.length === 0 ? (
                  <p className="results-empty-rows">The model returned no candidates for this query.</p>
                ) : (
                  <ResultsTable rows={visible} entity={entity} threshold={t} onOpen={openRow} />
                )}
              </>
            )}
          </section>
        </div>
      )}

      {selected && data ? (
        <DetailDrawer row={selected} entity={entity} direction={data.direction} total={rows.length} threshold={t} onClose={closeDrawer} />
      ) : null}
    </div>
  )
}

/* ---------- empty query ------------------------------------------- */

function EmptyQuery() {
  useEffect(() => {
    document.title = 'Results · Dawa'
  }, [])
  return (
    <div className="container results-empty">
      <div className="eyebrow eyebrow--accent">Start a query</div>
      <h1 className="h1 results-empty__title">Enter a drug, a disease, a compound or a SMILES string.</h1>
      <p className="lede">
        Drugs and compounds return ranked diseases; diseases return ranked drugs. Every candidate carries a calibrated
        confidence and a link to its full explanation.
      </p>
      <div className="results-empty__search">
        <SearchBar size="lg" autoFocus />
      </div>
      <ExampleChips />
    </div>
  )
}

function ExampleChips() {
  return (
    <div className="results-try">
      <span className="eyebrow">Try</span>
      {EXAMPLES.map((ex) => (
        <Link key={ex.q} to={queryLink(ex.q, ex.type)} className={ex.mono ? 'chip chip--mono' : 'chip'}>
          {ex.label}
        </Link>
      ))}
    </div>
  )
}

/* ---------- error --------------------------------------------------- */

function ResultsError({ error, onRetry }) {
  const soft = error.code === 'not_found' || error.code === 'invalid_smiles' || error.code === 'empty_query'
  return (
    <div className="results-error">
      <ErrorState title={soft ? 'Nothing matched' : 'The prediction could not be run'} text={error.message} onRetry={onRetry} />
      {soft ? <ExampleChips /> : null}
    </div>
  )
}

/* ---------- entity column ---------------------------------------- */

function EntityPanel({ entity }) {
  const isDisease = entity.kind === 'disease'
  return (
    <div className="results-entity">
      <div className="entity-line">
        <TypeBadge kind={entity.kind} />
        {entity.novel ? <span className="badge badge--plain">Unregistered</span> : null}
      </div>
      <h1 className="h1 results-entity__name">{entity.name}</h1>
      <div className="results-entity__ids">
        <span className="tag tag--mono" title={isDisease ? 'MeSH id' : 'Canonical id'}>
          {isDisease ? `MeSH ${entity.id}` : entity.id}
        </span>
        {entity.atc ? (
          <span className="tag tag--mono" title="ATC code">
            ATC {entity.atc}
          </span>
        ) : null}
      </div>
      {entity.synonyms?.length ? <p className="small muted results-entity__syn">Also {entity.synonyms.join(' · ')}</p> : null}
      {entity.summary ? <p className="results-entity__summary">{entity.summary}</p> : null}
      {entity.novel ? <NovelNotice entity={entity} /> : null}
      {isDisease ? <DiseaseFacts entity={entity} /> : <DrugFacts entity={entity} />}
    </div>
  )
}

function NovelNotice({ entity }) {
  const neighbors = entity.neighbors || []
  return (
    <div className="notice notice--accent results-entity__notice">
      <p>
        This structure is not registered in DrugBank or ChEMBL. Its targets were inherited from the nearest neighbours in
        latent space, so every candidate below is marked <em>inherited</em> and its confidence is scaled down.
      </p>
      {neighbors.length ? (
        <ul className="results-neighbors" aria-label="Nearest registered neighbours">
          {neighbors.map((n) => (
            <li key={n.id}>
              <Link to={queryLink(n.name, 'drug')} className="link">
                {n.name}
              </Link>
              <span className="mono num">{n.similarity.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function DrugFacts({ entity }) {
  const [copyState, copy] = useCopy()
  const targets = entity.targets || []
  const d = entity.descriptors
  return (
    <>
      <dl className="dl results-entity__facts">
        {entity.approvedUse ? (
          <>
            <dt>Approved use</dt>
            <dd>{entity.approvedUse}</dd>
          </>
        ) : null}
        {entity.formula ? (
          <>
            <dt>Formula</dt>
            <dd className="mono">
              <Formula value={entity.formula} />
            </dd>
          </>
        ) : null}
        {entity.area ? (
          <>
            <dt>Therapeutic area</dt>
            <dd>{entity.area}</dd>
          </>
        ) : null}
        {entity.year ? (
          <>
            <dt>First approved</dt>
            <dd className="num">{entity.year}</dd>
          </>
        ) : null}
      </dl>

      {entity.smiles ? (
        <div className="results-entity__block">
          <div className="eyebrow">SMILES</div>
          <div className="results-smiles">
            <code className="results-smiles__code">{entity.smiles}</code>
            <button type="button" className="copy-btn results-smiles__copy" onClick={() => copy(entity.smiles)} aria-label="Copy SMILES to clipboard">
              {copyState === 'copied' ? (
                <>
                  <Icon.Check size={13} /> Copied
                </>
              ) : copyState === 'failed' ? (
                <>
                  <Icon.Alert size={13} /> Failed
                </>
              ) : (
                <>
                  <Icon.Copy size={13} /> Copy
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}

      <div className="results-entity__block">
        <div className="eyebrow">{entity.inferredTargets ? 'Targets · inherited' : 'Targets'}</div>
        {targets.length ? (
          <div className="results-tags">
            {targets.map((g) => (
              <span key={g} className="tag tag--mono">
                {g}
              </span>
            ))}
          </div>
        ) : (
          <p className="small muted">No annotated targets.</p>
        )}
      </div>

      <div className="results-entity__block">
        <div className="eyebrow">Descriptors</div>
        {d ? (
          <>
            <dl className="dl results-desc">
              {DESCRIPTORS.map(([key, label, fmt]) => (
                <div key={key} className="results-desc__item">
                  <dt>{label}</dt>
                  <dd className="mono num">{d[key] === null || d[key] === undefined ? '—' : fmt(d[key])}</dd>
                </div>
              ))}
            </dl>
            {d.estimated ? <p className="tiny muted results-note">Estimated from SMILES in the browser.</p> : null}
          </>
        ) : (
          <p className="small muted">No small-molecule SMILES; featurised from target and side-effect profile.</p>
        )}
      </div>
    </>
  )
}

function DiseaseFacts({ entity }) {
  const [showAll, setShowAll] = useState(false)
  const genes = entity.genes || []
  const shown = showAll ? genes : genes.slice(0, GENE_PREVIEW)
  const hidden = genes.length - GENE_PREVIEW
  return (
    <>
      <dl className="dl results-entity__facts">
        {entity.category ? (
          <>
            <dt>Category</dt>
            <dd>{entity.category}</dd>
          </>
        ) : null}
        {entity.prevalence ? (
          <>
            <dt>Prevalence</dt>
            <dd>{entity.prevalence}</dd>
          </>
        ) : null}
      </dl>
      <div className="results-entity__block">
        <div className="eyebrow">Associated genes · {genes.length}</div>
        {genes.length ? (
          <div className="results-tags">
            {shown.map((g) => (
              <span key={g} className="tag tag--mono">
                {g}
              </span>
            ))}
            {hidden > 0 ? (
              <button type="button" className="results-more" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show fewer' : `+${hidden} more`}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="small muted">No associated genes in the current graph.</p>
        )}
      </div>
    </>
  )
}

/** C4H11N5 → C₄H₁₁N₅ using real <sub> elements. */
function Formula({ value }) {
  const parts = String(value).match(/[A-Z][a-z]?|\d+|[^A-Za-z\d]+/g) || [String(value)]
  return (
    <>
      {parts.map((p, i) => (/^\d+$/.test(p) ? <sub key={`${p}-${i}`}>{p}</sub> : <span key={`${p}-${i}`}>{p}</span>))}
    </>
  )
}

/* ---------- controls ---------------------------------------------- */

function Controls({
  data,
  rows,
  visible,
  t,
  k,
  sort,
  filter,
  onlyAbove,
  hideKnown,
  copyState,
  onThreshold,
  onTopK,
  onSort,
  onFilter,
  onOnlyAbove,
  onHideKnown,
  onCopyJson,
  onDownloadCsv,
}) {
  const thrId = useId()
  const kId = useId()
  const sortId = useId()
  const filterId = useId()

  const toDisease = data.direction === 'drug_to_disease'
  const from = data.entity.kind === 'compound' ? 'Compound' : toDisease ? 'Drug' : 'Disease'
  const to = toDisease ? 'disease' : 'drug'
  const sameThreshold = Math.abs(t - data.threshold) < 1e-9
  const above = sameThreshold ? data.summary.above : rows.filter((r) => r.aboveThreshold).length
  const known = data.summary.known
  const knownNoun = toDisease ? plural(known, 'approved indication') : plural(known, 'approved drug')
  const kOptions = K_OPTIONS.includes(k) ? K_OPTIONS : [...K_OPTIONS, k].sort((a, b) => a - b)
  const sortLabel = SORTS.find((s) => s.value === sort)?.label || 'Confidence'

  const countText =
    visible.length !== rows.length
      ? `Showing ${visible.length} of ${rows.length}`
      : `${rows.length} ${plural(rows.length, 'candidate')} returned`

  return (
    <div className="results-controls">
      <div className="results-controls__summary">
        <p className="results-controls__direction">
          <span className="results-controls__dir">
            {from} <span aria-hidden="true">→</span>
            <span className="sr-only">to</span> {to}
          </span>
          <span className="results-controls__sep" aria-hidden="true">
            ·
          </span>
          <span>
            {fmtInt(data.summary.scored)} {toDisease ? 'diseases' : 'drugs'} scored
          </span>
          <span className="results-controls__sep" aria-hidden="true">
            ·
          </span>
          <span>
            <strong>{above}</strong> {sameThreshold ? 'above threshold' : `of ${rows.length} returned above ${t.toFixed(2)}`}
          </span>
          <span className="results-controls__sep" aria-hidden="true">
            ·
          </span>
          <span>
            {known === 0 ? 'no' : known} {knownNoun}
          </span>
        </p>
        <span className="tag tag--mono results-controls__model" title="Model · version · inference latency">
          {data.model.name} · v{data.model.version} · {data.model.latencyMs} ms
        </span>
      </div>

      <div className="results-controls__row">
        <div className="results-ctl results-ctl--threshold">
          <div className="results-ctl__head">
            <label className="results-ctl__label" htmlFor={thrId}>
              Threshold
            </label>
            <output className="results-ctl__value mono num" htmlFor={thrId} aria-live="off">
              {t.toFixed(2)}
            </output>
            <button
              type="button"
              className="btn btn--quiet btn--sm results-ctl__reset"
              onClick={() => onThreshold(DEFAULT_THRESHOLD)}
              disabled={t === DEFAULT_THRESHOLD}
            >
              Reset to 0.79 (F1-optimal)
            </button>
          </div>
          <input
            id={thrId}
            type="range"
            className="range"
            min={MIN_T}
            max={MAX_T}
            step="0.01"
            value={t}
            aria-valuetext={t.toFixed(2)}
            onChange={(e) => onThreshold(e.target.value)}
          />
        </div>

        <div className="results-ctl">
          <label className="results-ctl__label" htmlFor={kId}>
            Top-k
          </label>
          <select id={kId} className="select results-ctl__select" value={k} onChange={(e) => onTopK(e.target.value)}>
            {kOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="results-ctl">
          <label className="results-ctl__label" htmlFor={sortId}>
            Sort by
          </label>
          <select id={sortId} className="select results-ctl__select" value={sort} onChange={(e) => onSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="results-ctl results-ctl--filter">
          <label className="results-ctl__label" htmlFor={filterId}>
            Filter
          </label>
          <input
            id={filterId}
            type="search"
            className="input results-ctl__input"
            placeholder="Filter candidates…"
            value={filter}
            autoComplete="off"
            onChange={(e) => onFilter(e.target.value)}
          />
        </div>

        <div className="results-ctl">
          <span className="results-ctl__label">Show</span>
          <div className="results-chips" role="group" aria-label="Row filters">
            <button type="button" className={cx('chip', onlyAbove && 'chip--active')} aria-pressed={onlyAbove} onClick={onOnlyAbove}>
              Only above threshold
            </button>
            <button type="button" className={cx('chip', hideKnown && 'chip--active')} aria-pressed={hideKnown} onClick={onHideKnown}>
              Hide approved indications
            </button>
          </div>
        </div>
      </div>

      <div className="results-controls__foot">
        <span className="results-controls__count" aria-live="polite">
          {countText}
          {sort !== 'rank' ? ` · sorted by ${sortLabel.toLowerCase()}` : ''}
        </span>
        <div className="results-export">
          <button type="button" className="btn btn--quiet btn--sm" onClick={onCopyJson}>
            {copyState === 'copied' ? <Icon.Check size={14} /> : <Icon.Copy size={14} />}
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy JSON'}
          </button>
          <button type="button" className="btn btn--quiet btn--sm" onClick={onDownloadCsv}>
            <Icon.Download size={14} />
            Download CSV
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- table -------------------------------------------------- */

function ResultsTable({ rows, entity, threshold, onOpen }) {
  return (
    <div className="table-wrap results-table-wrap">
      <table className="table table--hover results-table">
        <caption className="sr-only">Ranked candidates for {entity.name}</caption>
        <thead>
          <tr>
            <th scope="col" className="num results-table__rank">
              #
            </th>
            <th scope="col" className="results-table__cand">
              Candidate
            </th>
            <th scope="col" className="results-table__conf">
              Confidence
            </th>
            <th scope="col">Shared targets</th>
            <th scope="col">Pathways</th>
            <th scope="col">Evidence</th>
            <th scope="col" className="results-table__action">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="results-table__empty">
                No candidates match the current filters.
              </td>
            </tr>
          ) : (
            rows.map((row) => <ResultRow key={row.id} row={row} threshold={threshold} onOpen={onOpen} />)
          )}
        </tbody>
      </table>
    </div>
  )
}

function ResultRow({ row, threshold, onOpen }) {
  const trial = row.trial
  const onRowClick = (e) => {
    if (e.target.closest('a, button')) return
    onOpen(row, e.currentTarget.querySelector('.results-cand__name'))
  }
  return (
    <tr className={cx('results-row', !row.aboveThreshold && 'results-row--below')} onClick={onRowClick}>
      <td className="num mono results-table__rank" data-label="Rank">
        {row.rank}
      </td>
      <td className="results-table__cand" data-label="Candidate">
        <button type="button" className="results-cand__name" aria-haspopup="dialog" onClick={(e) => onOpen(row, e.currentTarget)}>
          <span className="results-cand__rank mono num" aria-hidden="true">
            {row.rank}
          </span>
          {row.name}
        </button>
        <div className="results-cand__meta">
          {row.category ? <span className="results-cand__cat">{row.category}</span> : null}
          {row.known ? <span className="tag tag--ink">Approved indication</span> : null}
          {trial ? (
            <span className={trialTagClass(trial.outcome)} title={trial.name}>
              {trialLabel(trial)}
            </span>
          ) : null}
          {row.inherited ? <span className="tag">inherited</span> : null}
        </div>
      </td>
      <td className="results-table__conf" data-label="Confidence">
        <ConfidenceMeter value={row.confidence} threshold={threshold} className="results-meter" />
      </td>
      <td data-label="Shared targets">
        <GeneTags genes={row.sharedGenes} max={3} />
        {row.ppiHops.length ? <span className="results-hop">1-hop: {row.ppiHops.length}</span> : null}
      </td>
      <td data-label="Pathways">
        <span className="results-paths__count num">{row.pathwayCount}</span>
        {row.topPathways.length ? <span className="results-paths__list">{row.topPathways.slice(0, 2).join(' · ')}</span> : null}
      </td>
      <td data-label="Evidence">
        <span className="results-sources">{row.sources.length ? row.sources.join(' · ') : '—'}</span>
      </td>
      <td className="results-table__action">
        <Link to={explainLink(row.pair)} className="arrow-link" onClick={(e) => e.stopPropagation()}>
          Explain <Icon.ArrowRight size={14} />
        </Link>
      </td>
    </tr>
  )
}

function GeneTags({ genes, max }) {
  if (!genes.length) return <span className="muted">—</span>
  const shown = max ? genes.slice(0, max) : genes
  const rest = genes.length - shown.length
  return (
    <span className="results-genes">
      {shown.map((g) => (
        <span key={g} className="tag tag--mono">
          {g}
        </span>
      ))}
      {rest > 0 ? (
        <span className="results-genes__more" title={genes.slice(shown.length).join(', ')}>
          +{rest}
        </span>
      ) : null}
    </span>
  )
}

/* ---------- drawer ------------------------------------------------- */

function DetailDrawer({ row, entity, direction, total, threshold, onClose }) {
  const closeRef = useRef(null)
  const panelRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    closeRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!focusables.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const toDisease = direction === 'drug_to_disease'
  const pairLabel = toDisease ? `${entity.name} → ${row.name}` : `${row.name} → ${entity.name}`
  const trial = row.trial

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside ref={panelRef} className="drawer results-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="results-drawer__head">
          <div className="results-drawer__heading">
            <div className="entity-line">
              <TypeBadge kind={row.kind} />
              <span className="tag tag--mono">{row.id}</span>
            </div>
            <h2 id={titleId} className="h2 results-drawer__title">
              {row.name}
            </h2>
            <p className="small muted results-drawer__pair">
              {pairLabel}
              {row.category ? ` · ${row.category}` : ''}
            </p>
          </div>
          <button ref={closeRef} type="button" className="results-drawer__close" onClick={onClose} aria-label="Close details">
            <Icon.X size={18} />
          </button>
        </div>

        <ConfidenceMeter value={row.confidence} threshold={threshold} className="results-drawer__meter" />
        <p className="tiny muted results-drawer__verdict">
          Rank {row.rank} of {total} · {row.aboveThreshold ? 'above' : 'below'} the {threshold.toFixed(2)} threshold
        </p>
        {row.known || trial || row.inherited ? (
          <div className="results-drawer__tags">
            {row.known ? <span className="tag tag--ink">Approved indication</span> : null}
            {trial ? <span className={trialTagClass(trial.outcome)}>{trialLabel(trial)}</span> : null}
            {row.inherited ? <span className="tag">inherited targets</span> : null}
          </div>
        ) : null}

        <section className="results-drawer__section">
          <div className="eyebrow">Mechanism</div>
          <p className="results-drawer__mech">{row.mechanism}</p>
        </section>

        <section className="results-drawer__section">
          <div className="eyebrow">Shared targets</div>
          {row.sharedGenes.length ? <GeneTags genes={row.sharedGenes} /> : <p className="small muted">No direct target overlap.</p>}
          {row.ppiHops.length ? (
            <p className="small muted results-drawer__hops">
              One PPI hop from a target: <span className="mono">{row.ppiHops.join(', ')}</span>
            </p>
          ) : null}
        </section>

        <section className="results-drawer__section">
          <div className="eyebrow">
            Pathways · {row.pathwayCount} shared
          </div>
          {row.topPathways.length ? (
            <ol className="results-drawer__paths">
              {row.topPathways.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          ) : (
            <p className="small muted">No pathway co-membership in the current graph.</p>
          )}
        </section>

        {trial ? (
          <section className="results-drawer__section">
            <div className="eyebrow">Clinical evidence</div>
            <div className="notice results-drawer__trial">
              <strong>{trial.name}</strong>
              <span className="results-drawer__trial-meta">
                {trialLabel(trial)} · {trial.year}
              </span>
            </div>
          </section>
        ) : null}

        <section className="results-drawer__section">
          <div className="eyebrow">Evidence</div>
          <p className="small muted results-drawer__evidence">
            {row.evidenceCount} {plural(row.evidenceCount, 'record')} across {row.sources.length} {plural(row.sources.length, 'source')}
          </p>
          <div className="results-tags">
            {row.sources.map((s) => (
              <span key={s} className="tag">
                {s}
              </span>
            ))}
          </div>
        </section>

        <div className="results-drawer__actions">
          <Link to={explainLink(row.pair)} className="btn btn--primary">
            Full explanation <Icon.ArrowRight size={16} />
          </Link>
          <Link to={queryLink(row.name, row.kind)} className="link link--quiet small">
            Run {row.name} as its own query
          </Link>
        </div>
      </aside>
    </>
  )
}

/* ---------- skeletons ---------------------------------------------- */

function Skel({ className }) {
  return <span className={cx('skeleton results-skel', className)} aria-hidden="true" />
}

function EntitySkeleton() {
  return (
    <div className="results-entity" aria-hidden="true">
      <Skel className="results-skel--w4" />
      <Skel className="results-skel--title" />
      <div className="results-entity__ids">
        <Skel className="results-skel--w5" />
        <Skel className="results-skel--w6" />
      </div>
      <Skel className="results-skel--line results-skel--p70" />
      <div className="results-entity__block">
        <Skel className="results-skel--line results-skel--p100" />
        <Skel className="results-skel--line results-skel--p90" />
        <Skel className="results-skel--line results-skel--p60" />
      </div>
      <div className="results-entity__block">
        <Skel className="results-skel--w4" />
        <Skel className="results-skel--block" />
      </div>
      <div className="results-entity__block">
        <Skel className="results-skel--w4" />
        <div className="results-tags">
          <Skel className="results-skel--w4" />
          <Skel className="results-skel--w5" />
          <Skel className="results-skel--w4" />
        </div>
      </div>
    </div>
  )
}

function ControlsSkeleton() {
  return (
    <div className="results-controls" aria-hidden="true">
      <div className="results-controls__summary">
        <Skel className="results-skel--lg results-skel--p60" />
        <Skel className="results-skel--w8" />
      </div>
      <div className="results-controls__row">
        <Skel className="results-skel--ctl results-skel--w12" />
        <Skel className="results-skel--ctl results-skel--w5" />
        <Skel className="results-skel--ctl results-skel--w6" />
        <Skel className="results-skel--ctl results-skel--w8" />
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="table-wrap results-table-wrap" aria-hidden="true">
      <table className="table results-table">
        <thead>
          <tr>
            <th className="num results-table__rank">#</th>
            <th className="results-table__cand">Candidate</th>
            <th className="results-table__conf">Confidence</th>
            <th>Shared targets</th>
            <th>Pathways</th>
            <th>Evidence</th>
            <th className="results-table__action">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }, (_, i) => (
            <tr key={i} className="results-row results-row--skeleton">
              <td className="num results-table__rank">
                <Skel className="results-skel--w2" />
              </td>
              <td className="results-table__cand">
                <Skel className={i % 3 === 0 ? 'results-skel--p90' : i % 3 === 1 ? 'results-skel--p70' : 'results-skel--p60'} />
                <Skel className="results-skel--line results-skel--w5" />
              </td>
              <td className="results-table__conf">
                <Skel className="results-skel--p100" />
              </td>
              <td>
                <Skel className="results-skel--w6" />
              </td>
              <td>
                <Skel className="results-skel--w5" />
              </td>
              <td>
                <Skel className="results-skel--w8" />
              </td>
              <td className="results-table__action">
                <Skel className="results-skel--w4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
