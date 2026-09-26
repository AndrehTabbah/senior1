import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfidenceMeter from '../components/ConfidenceMeter.jsx'
import ErrorState from '../components/ErrorState.jsx'
import TypeBadge from '../components/TypeBadge.jsx'
import { Icon } from '../components/Icons.jsx'
import { api } from '../api/index.js'
import { useApi } from '../hooks/useApi.js'
import { cx, fmtInt, fmtPct, fmtProb } from '../utils/format.js'
import './explain.css'

const SECTIONS = [
  { id: 'plain', n: '01', label: 'In plain language' },
  { id: 'contributions', n: '02', label: 'What moved the score' },
  { id: 'biology', n: '03', label: 'Shared biology' },
  { id: 'pathways', n: '04', label: 'Pathway overlap' },
  { id: 'neighbours', n: '05', label: 'Latent-space neighbours' },
  { id: 'evidence', n: '06', label: 'Evidence & sources' },
  { id: 'safety', n: '07', label: 'Safety profile' },
]

const SECTION_IDS = SECTIONS.map((s) => s.id)

const signed = (v, digits = 2) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(digits)}`

function resultsHref(entity) {
  if (!entity) return '/'
  if (entity.novel && entity.smiles) return `/results?q=${encodeURIComponent(entity.smiles)}&type=smiles`
  return `/results?q=${encodeURIComponent(entity.name)}&type=${entity.kind || 'disease'}`
}

/* ---------- small hooks --------------------------------------------- */

function useMediaQuery(query) {
  const read = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  const [matches, setMatches] = useState(read)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return matches
}

function useActiveSection(ids, ready) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    if (!ready || typeof IntersectionObserver === 'undefined') return undefined
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean)
    if (!els.length) return undefined
    const tops = new Map()
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) tops.set(e.target.id, e.boundingClientRect.top)
          else tops.delete(e.target.id)
        })
        const first = ids.find((id) => tops.has(id))
        if (first) setActive(first)
      },
      { rootMargin: '-12% 0px -70% 0px', threshold: 0 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [ids, ready])
  return active
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/* ---------- page ------------------------------------------------------ */

export default function Explain() {
  const { drugId, diseaseId } = useParams()
  const { data, error, loading, reload } = useApi((signal) => api.explain(drugId, diseaseId, { signal }), [drugId, diseaseId])
  const compact = useMediaQuery('(max-width: 640px)')
  const active = useActiveSection(SECTION_IDS, Boolean(data))

  useEffect(() => {
    document.title = data ? `${data.pair.drug.name} → ${data.pair.disease.name} · Dawa` : 'Explanation · Dawa'
  }, [data])

  if (loading) return <ExplainSkeleton />

  if (error || !data) {
    return (
      <div className="container">
        <ErrorState
          title="This pair could not be explained"
          text={error?.message || 'The explanation payload was empty.'}
          onRetry={reload}
          backTo="/"
        />
      </div>
    )
  }

  const { pair, confidence, threshold, aboveThreshold, verdict, calibration, trial, model } = data
  const drug = pair.drug
  const disease = pair.disease
  const verdictClass = verdict === 'Known indication' ? 'tag tag--ink' : verdict === 'Strong repurposing candidate' ? 'tag tag--accent' : 'tag'

  return (
    <div className="container explain">
      <header className="explain__head">
        <BackLink fallback={resultsHref(drug)} />
        <div className="explain__pair">
          <div className="explain__identity">
            <div className="eyebrow">
              Explanation · {model.name} v{model.version}
            </div>
            <h1 className="h1 explain__title">
              <span className="explain__name">{drug.name}</span>
              <TypeBadge kind={drug.kind} className="explain__badge" />
              <span className="explain__arrow" aria-hidden="true">
                →
              </span>
              <span className="sr-only">to</span>
              <span className="explain__name">{disease.name}</span>
              <TypeBadge kind="disease" className="explain__badge" />
            </h1>
            <div className="explain__ids mono">
              <span>{drug.id}</span>
              <span className="explain__ids-sep" aria-hidden="true">
                →
              </span>
              <span>{disease.id}</span>
            </div>
          </div>

          <div className="explain__score">
            <div className={cx('stat', aboveThreshold && 'stat--accent')}>
              <span className="stat__value num">{fmtProb(confidence)}</span>
              <span className="stat__label">
                confidence · threshold {fmtProb(threshold)} · {aboveThreshold ? 'above' : 'below'}
              </span>
            </div>
            <ConfidenceMeter value={confidence} threshold={threshold} showValue={false} className="explain__meter" />
            <div className="explain__verdict">
              <span className={verdictClass}>{verdict}</span>
            </div>
            <p className="small muted explain__calibration">
              Pairs in the <span className="mono">{calibration.bucket}</span> bucket were true positives{' '}
              {fmtPct(calibration.empiricalPrecision)} of the time on the held-out test set (n = {fmtInt(calibration.n)}).
            </p>
          </div>
        </div>
      </header>

      <div className="explain__body">
        <nav className="explain__toc" aria-label="On this page">
          <ol className="explain__toc-list">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={cx('explain__toc-link', active === s.id && 'is-active')} aria-current={active === s.id ? 'location' : undefined}>
                  <span className="explain__toc-num">{s.n}</span>
                  <span>{s.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="explain__content">
          {/* ---------------------------------------------- 01 plain language */}
          <Section id="plain" n="01" title="In plain language">
            <p className="lede explain__summary">{data.summary}</p>
            <div className="explain__mechanism">
              <span className="eyebrow">Mechanism</span>
              <p>{data.mechanism}</p>
            </div>
            <TrialLine trial={trial} />
          </Section>

          {/* ---------------------------------------------- 02 contributions */}
          <Section id="contributions" n="02" title="What moved the score">
            <p className="explain__intro">
              Each feature adds to or subtracts from the model's logit. Bars to the right raise the score, bars to the
              left lower it; the base rate is the prior before any evidence is seen.
            </p>
            {data.featureContributions.length ? (
              <ContributionChart items={data.featureContributions} compact={compact} />
            ) : (
              <p className="muted">No feature contributions were returned for this pair.</p>
            )}
            <p className="mono explain__formula">
              logit = Σ contributions = {signed(data.logit, 3)} → sigmoid → {fmtProb(confidence)}
            </p>
          </Section>

          {/* ---------------------------------------------- 03 shared biology */}
          <Section id="biology" n="03" title="Shared biology">
            <SharedBiology data={data} compact={compact} />
          </Section>

          {/* ---------------------------------------------- 04 pathways */}
          <Section id="pathways" n="04" title="Pathway overlap">
            <PathwayTable pathways={data.pathways} />
          </Section>

          {/* ---------------------------------------------- 05 neighbours */}
          <Section id="neighbours" n="05" title="Latent-space neighbours">
            <p className="explain__intro">
              Drugs that sit closest to {drug.name} in the model's latent space. Similarity here combines target-set
              Jaccard overlap with structural (SMILES) similarity; a neighbour that already treats the disease is a
              strong prior for the pair.
            </p>
            <Neighbours items={data.neighbors} disease={disease} />
          </Section>

          {/* ---------------------------------------------- 06 evidence */}
          <Section id="evidence" n="06" title="Evidence & sources">
            <Evidence items={data.evidence} />
          </Section>

          {/* ---------------------------------------------- 07 safety */}
          <Section id="safety" n="07" title="Safety profile">
            <SideEffects items={data.sideEffects} drug={drug} />
          </Section>

          <FooterActions data={data} drug={drug} disease={disease} />
        </div>
      </div>
    </div>
  )
}

/* ---------- header pieces --------------------------------------------- */

function BackLink({ fallback }) {
  const navigate = useNavigate()
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1
  if (canGoBack) {
    return (
      <button type="button" className="explain__back" onClick={() => navigate(-1)}>
        <Icon.ArrowLeft size={15} /> Back
      </button>
    )
  }
  return (
    <Link to={fallback} className="explain__back">
      <Icon.ArrowLeft size={15} /> Back to results
    </Link>
  )
}

function Section({ id, n, title, children }) {
  return (
    <section id={id} className="explain__section" aria-labelledby={`${id}-title`}>
      <div className="explain__section-head">
        <span className="explain__num" aria-hidden="true">
          {n}
        </span>
        <h2 id={`${id}-title`} className="h2">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

function TrialLine({ trial }) {
  if (!trial) {
    return <p className="small muted explain__trial-none">No registered clinical trial is linked to this pair in the graph.</p>
  }
  const negative = trial.outcome === 'negative'
  return (
    <div className="explain__trial">
      <span className="eyebrow">Clinical trial</span>
      <p className={cx('explain__trial-line', negative && 'explain__trial-line--negative')}>
        <span>{trial.phase}</span>
        <span className="explain__dot" aria-hidden="true">
          ·
        </span>
        <span className={negative ? '' : 'explain__trial-outcome'}>{trial.outcomeLabel}</span>
        <span className="explain__dot" aria-hidden="true">
          ·
        </span>
        <span>{trial.name}</span>
        <span className="explain__dot" aria-hidden="true">
          ·
        </span>
        <span className="num">{trial.year}</span>
      </p>
      {negative ? (
        <p className="small explain__trial-note">
          <span className="tag">negative trial</span> The registered study did not support this use. The score reflects
          graph and latent-space signal, not clinical proof; treat it with caution.
        </p>
      ) : null}
    </div>
  )
}

/* ---------- 02 contribution chart ------------------------------------ */

function ContributionChart({ items, compact }) {
  const sorted = useMemo(() => [...items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)), [items])
  const maxAbs = Math.max(0.5, ...sorted.map((i) => Math.abs(i.value)))
  const W = compact ? 360 : 760
  const rowH = compact ? 46 : 32
  const padT = 28
  const padB = 24
  const H = padT + sorted.length * rowH + padB
  const barX0 = compact ? 12 : 350
  const barX1 = compact ? 348 : 650
  const centre = (barX0 + barX1) / 2
  const half = (barX1 - barX0) / 2
  const barH = compact ? 12 : 16
  const scale = (v) => (Math.abs(v) / maxAbs) * half
  const top = sorted[0]
  const label = `Feature contributions to the logit, sorted by size. Largest: ${top.label}, ${signed(top.value)}.`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="explain__chart" role="img" aria-label={label}>
      <title>{label}</title>
      <text x={centre - 8} y={14} textAnchor="end" fontSize="10" fill="var(--ink-3)">
        ← lowers
      </text>
      <text x={centre + 8} y={14} textAnchor="start" fontSize="10" fill="var(--ink-3)">
        raises →
      </text>
      <line x1={centre} x2={centre} y1={padT - 6} y2={H - padB + 4} stroke="var(--line-strong)" />
      {sorted.map((it, i) => {
        const y = padT + i * rowH
        const w = scale(it.value)
        const x = it.value >= 0 ? centre : centre - w
        const barY = compact ? y + 26 : y + (rowH - barH) / 2
        const labelY = compact ? y + 15 : y + rowH / 2 + 4
        const positive = it.value >= 0
        return (
          <g key={it.key}>
            <title>{`${it.label}: ${signed(it.value, 3)}`}</title>
            <text
              x={compact ? barX0 : barX0 - 18}
              y={labelY}
              textAnchor={compact ? 'start' : 'end'}
              fontSize={compact ? 11 : 12}
              fill="var(--ink-2)"
            >
              {it.label}
            </text>
            {w >= 1 ? (
              <rect x={x} y={barY} width={w} height={barH} rx="2" fill={positive ? 'var(--accent)' : 'var(--ink-3)'} />
            ) : (
              <rect x={centre - 1} y={barY} width="2" height={barH} fill="var(--ink-4)" />
            )}
            <text
              x={compact ? barX1 : barX1 + 20}
              y={labelY}
              textAnchor={compact ? 'end' : 'start'}
              fontSize="12"
              fontFamily="var(--font-mono)"
              fill={positive ? 'var(--ink)' : 'var(--ink-3)'}
            >
              {signed(it.value)}
            </text>
          </g>
        )
      })}
      <text x={barX0} y={H - 6} fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-4)">
        −{maxAbs.toFixed(1)}
      </text>
      <text x={centre} y={H - 6} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-4)">
        0
      </text>
      <text x={barX1} y={H - 6} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-4)">
        +{maxAbs.toFixed(1)}
      </text>
    </svg>
  )
}

/* ---------- 03 shared biology ---------------------------------------- */

function SharedBiology({ data, compact }) {
  const { graph, sharedGenes, hopGenes, pair } = data
  const names = useMemo(() => {
    const m = new Map()
    ;[...sharedGenes, ...hopGenes].forEach((g) => m.set(g.symbol, g.name))
    return m
  }, [sharedGenes, hopGenes])
  const rows = [...sharedGenes, ...hopGenes]
  const hasGraph = graph.drugTargets.length || graph.diseaseGenes.length

  return (
    <>
      <p className="explain__intro">
        The bipartite view places the targets of {pair.drug.name} on the left and the genes linked to{' '}
        {pair.disease.name.toLowerCase()} on the right. A gene that appears on both sides is a direct shared target; a
        thin line is a protein–protein interaction between the two sets.
      </p>
      {hasGraph ? (
        <figure className="explain__figure">
          <BipartiteGraph graph={graph} names={names} compact={compact} />
          <figcaption className="explain__legend tiny">
            <span>
              <i className="explain__swatch explain__swatch--shared" /> shared target
            </span>
            <span>
              <i className="explain__swatch explain__swatch--hop" /> one PPI hop
            </span>
            <span>
              <i className="explain__swatch explain__swatch--plain" /> other gene
            </span>
            <span>
              <i className="explain__swatch explain__swatch--edge" /> PPI edge
            </span>
            <span>
              <i className="explain__swatch explain__swatch--link" /> shared
            </span>
          </figcaption>
        </figure>
      ) : (
        <p className="muted">The graph has no target or gene nodes for this pair.</p>
      )}

      {rows.length ? (
        <div className="table-wrap explain__table">
          <table className="table table--hover">
            <thead>
              <tr>
                <th scope="col">Symbol</th>
                <th scope="col">Entrez</th>
                <th scope="col">Name</th>
                <th scope="col">Relation</th>
                <th scope="col" className="num">
                  Sources
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={`${g.relation}-${g.symbol}`}>
                  <td className="mono">{g.symbol}</td>
                  <td className="mono muted">{g.entrez ?? '—'}</td>
                  <td>{g.name}</td>
                  <td>
                    <span className={g.relation === 'direct target' ? 'tag tag--accent' : 'tag'}>{g.relation}</span>
                  </td>
                  <td className="num">{fmtInt(g.sourceCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted explain__empty">
          There is no direct target overlap and no disease gene within one interaction hop of a target; the score rests on
          pathways, prior knowledge and the latent embedding.
        </p>
      )}
    </>
  )
}

function BipartiteGraph({ graph, names, compact }) {
  const left = graph.drugTargets
  const right = graph.diseaseGenes
  const shared = new Set(graph.shared)
  const hops = new Set(graph.hops)
  const rows = Math.max(left.length, right.length, 1)
  const rowH = compact ? 26 : 30
  const padT = 38
  const padB = 14
  const H = padT + rows * rowH + padB
  const W = compact ? 360 : 640
  const lx = compact ? 118 : 200
  const rx = compact ? 242 : 440
  const fontSize = compact ? 10.5 : 12
  const r = compact ? 5 : 5.5

  const yAt = (i, n) => padT + (rows - n) * (rowH / 2) + (i + 0.5) * rowH
  const ly = new Map(left.map((g, i) => [g, yAt(i, left.length)]))
  const ry = new Map(right.map((g, i) => [g, yAt(i, right.length)]))

  const ppi = []
  const seen = new Set()
  graph.ppiEdges.forEach(([a, b]) => {
    let pairing = null
    if (ly.has(a) && ry.has(b)) pairing = [a, b]
    else if (ly.has(b) && ry.has(a)) pairing = [b, a]
    if (!pairing) return
    const key = pairing.join('|')
    if (seen.has(key)) return
    seen.add(key)
    ppi.push(pairing)
  })
  const links = graph.shared.filter((g) => ly.has(g) && ry.has(g))

  const fillFor = (g) => (shared.has(g) ? 'var(--accent)' : hops.has(g) ? 'var(--accent-soft)' : 'var(--paper)')
  const strokeFor = (g) => (shared.has(g) ? 'var(--accent)' : hops.has(g) ? 'var(--accent)' : 'var(--ink-3)')
  const textFor = (g) => (shared.has(g) ? 'var(--accent-text)' : 'var(--ink)')
  const label = `Bipartite graph: ${left.length} drug targets on the left, ${right.length} disease genes on the right, ${links.length} shared, ${ppi.length} protein interactions.`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="explain__graph" role="img" aria-label={label}>
      <title>{label}</title>
      <text x={lx} y={16} textAnchor="end" fontSize="10" fontWeight="600" letterSpacing="0.1em" fill="var(--ink-3)">
        DRUG TARGETS · {left.length}
      </text>
      <text x={rx} y={16} textAnchor="start" fontSize="10" fontWeight="600" letterSpacing="0.1em" fill="var(--ink-3)">
        DISEASE GENES · {right.length}
      </text>
      <g stroke="var(--ink-3)" strokeWidth="1" strokeOpacity="0.55">
        {ppi.map(([a, b]) => (
          <line key={`${a}|${b}`} x1={lx + r + 2} y1={ly.get(a)} x2={rx - r - 2} y2={ry.get(b)} />
        ))}
      </g>
      <g stroke="var(--accent)" strokeWidth="1.75">
        {links.map((g) => (
          <line key={`s-${g}`} x1={lx + r + 2} y1={ly.get(g)} x2={rx - r - 2} y2={ry.get(g)} />
        ))}
      </g>
      {left.map((g) => (
        <g key={`l-${g}`}>
          <title>{names.get(g) || g}</title>
          <circle cx={lx} cy={ly.get(g)} r={r} fill={fillFor(g)} stroke={strokeFor(g)} strokeWidth="1.5" />
          <text x={lx - r - 8} y={ly.get(g) + 4} textAnchor="end" fontSize={fontSize} fontFamily="var(--font-mono)" fill={textFor(g)}>
            {g}
          </text>
        </g>
      ))}
      {right.map((g) => (
        <g key={`r-${g}`}>
          <title>{names.get(g) || g}</title>
          <circle cx={rx} cy={ry.get(g)} r={r} fill={fillFor(g)} stroke={strokeFor(g)} strokeWidth="1.5" />
          <text x={rx + r + 8} y={ry.get(g) + 4} textAnchor="start" fontSize={fontSize} fontFamily="var(--font-mono)" fill={textFor(g)}>
            {g}
          </text>
        </g>
      ))}
    </svg>
  )
}

/* ---------- 04 pathways ---------------------------------------------- */

function PathwayTable({ pathways }) {
  if (!pathways.length) {
    return (
      <p className="muted explain__empty">
        None of the drug's targets and the disease's genes share a pathway in the current graph.
      </p>
    )
  }
  return (
    <>
      <p className="explain__intro">
        Pathways in which at least one drug target and one disease gene co-occur. Highlighted genes are shared by both
        sets; Jaccard is the overlap of the two gene lists within that pathway.
      </p>
      <div className="table-wrap explain__table">
        <table className="table table--hover">
          <thead>
            <tr>
              <th scope="col">Pathway</th>
              <th scope="col">Drug targets in pathway</th>
              <th scope="col">Disease genes in pathway</th>
              <th scope="col" className="num">
                Overlap
              </th>
              <th scope="col" className="num">
                Jaccard
              </th>
            </tr>
          </thead>
          <tbody>
            {pathways.map((p) => {
              const overlap = new Set(p.overlap)
              return (
                <tr key={p.id}>
                  <td>
                    <span className="explain__pathway-name">{p.name}</span>
                    <span className="mono muted tiny explain__pathway-id">
                      {p.id} · {p.size} genes
                    </span>
                  </td>
                  <td>
                    <span className="explain__tags">
                      {p.drugGenes.map((g) => (
                        <span key={g} className="tag tag--mono">
                          {g}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td>
                    <span className="explain__tags">
                      {p.diseaseGenes.map((g) => (
                        <span key={g} className={cx('tag tag--mono', overlap.has(g) && 'tag--accent')}>
                          {g}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="num">{fmtInt(p.overlap.length)}</td>
                  <td className="num">{fmtProb(p.jaccard)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ---------- 05 neighbours -------------------------------------------- */

function Neighbours({ items, disease }) {
  if (!items.length) return <p className="muted explain__empty">No neighbours were returned for this drug.</p>
  return (
    <ul className="explain__neighbours">
      {items.map((n) => (
        <li key={n.id} className="explain__neighbour">
          <div className="explain__neighbour-id">
            <Link to={`/results?q=${encodeURIComponent(n.name)}&type=drug`} className="explain__neighbour-name">
              {n.name}
            </Link>
            <span className="tiny muted">
              <span className="mono">{n.id}</span> · {n.area}
            </span>
          </div>
          <span className="meter explain__sim" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={n.similarity} aria-label={`Similarity ${fmtProb(n.similarity)}`}>
            <span className="meter__track">
              <span className="meter__fill" style={{ width: `${Math.max(0, Math.min(1, n.similarity)) * 100}%` }} />
            </span>
            <span className="meter__value">{fmtProb(n.similarity)}</span>
          </span>
          <span className="explain__neighbour-tags">
            {n.treats ? <span className="tag tag--ink">treats {disease.name.toLowerCase()}</span> : null}
            {!n.treats && n.curated ? <span className="tag">trial: {n.curated}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ---------- 06 evidence ---------------------------------------------- */

function Evidence({ items }) {
  const groups = useMemo(() => {
    const order = []
    const bySource = new Map()
    items.forEach((it) => {
      if (!bySource.has(it.source)) {
        bySource.set(it.source, [])
        order.push(it.source)
      }
      bySource.get(it.source).push(it)
    })
    return order.map((source) => ({ source, items: bySource.get(source) }))
  }, [items])

  if (!items.length) return <p className="muted explain__empty">No source records are attached to this pair.</p>

  return (
    <>
      <div className="explain__evidence">
        {groups.map((g) => (
          <div key={g.source} className="explain__evidence-group">
            <h4 className="h4 explain__evidence-source">{g.source}</h4>
            <ul className="explain__evidence-items">
              {g.items.map((it, i) => (
                <li key={`${it.kind}-${i}`} className="explain__evidence-item">
                  <div className="explain__evidence-main">
                    <span className={cx('explain__evidence-label', it.outcome === 'negative' && 'muted')}>{it.label}</span>
                    {it.detail ? <span className="muted"> — {it.detail}</span> : null}
                  </div>
                  <EvidenceMeta item={it} />
                  {it.url ? (
                    <a href={it.url} target="_blank" rel="noopener noreferrer" className="explain__evidence-link">
                      Open <Icon.External size={12} />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="small muted explain__sources-line">Sources consulted: {groups.map((g) => g.source).join(', ')}.</p>
    </>
  )
}

function EvidenceMeta({ item }) {
  const parts = []
  if (item.year) parts.push(String(item.year))
  if (typeof item.count === 'number') parts.push(`${fmtInt(item.count)} ${item.count === 1 ? 'record' : 'records'}`)
  if (typeof item.score === 'number') parts.push(`score ${fmtProb(item.score)}`)
  if (item.kind) parts.push(item.kind.replace(/-/g, ' '))
  if (!parts.length) return null
  return <span className="tiny muted mono explain__evidence-meta">{parts.join(' · ')}</span>
}

/* ---------- 07 safety ------------------------------------------------ */

function SideEffects({ items, drug }) {
  if (!items.length) return <p className="muted explain__empty">No labelled side effects are recorded for {drug.name}.</p>
  const relevant = items.filter((s) => s.relevant).length
  return (
    <>
      <p className="explain__intro">
        Labelled side effects of {drug.name} from SIDER, with frequency where recorded.{' '}
        {relevant
          ? `${relevant} of ${items.length} overlap with the disease's organ system and would need monitoring in any trial.`
          : 'None overlaps with the organ system of the target disease.'}
      </p>
      <ul className="explain__se">
        {items.map((s) => (
          <li key={s.name} className={cx('explain__se-item', s.relevant && 'is-relevant')}>
            <span className="explain__se-name">
              {s.relevant ? <i className="explain__se-dot" aria-hidden="true" /> : null}
              {s.name}
            </span>
            <span className="small muted">{s.frequency}</span>
            {s.relevant ? <span className="tiny explain__se-note">relevant to this indication — monitor</span> : null}
          </li>
        ))}
      </ul>
    </>
  )
}

/* ---------- footer actions ------------------------------------------- */

function FooterActions({ data, drug, disease }) {
  const [copied, setCopied] = useState(null)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const flash = useCallback((what) => {
    setCopied(what)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), 1800)
  }, [])

  const onCopyLink = async () => {
    const ok = await copyText(window.location.href)
    flash(ok ? 'Link copied' : 'Could not copy the link')
  }
  const onCopyJson = async () => {
    const ok = await copyText(JSON.stringify(data, null, 2))
    flash(ok ? 'JSON copied' : 'Could not copy the JSON')
  }

  return (
    <div className="explain__footer">
      <div className="explain__actions">
        <Link to={resultsHref(drug)} className="btn btn--primary">
          Run {drug.name} → diseases <Icon.ArrowRight size={15} />
        </Link>
        <Link to={resultsHref(disease)} className="btn btn--ghost">
          Run {disease.name} → drugs
        </Link>
        <button type="button" className="btn btn--quiet" onClick={onCopyLink}>
          <Icon.Copy size={14} /> Copy link
        </button>
        <button type="button" className="btn btn--quiet" onClick={onCopyJson}>
          <Icon.Copy size={14} /> Copy JSON
        </button>
        <span className="small muted explain__copied" role="status" aria-live="polite">
          {copied || ''}
        </span>
      </div>
      <p className="notice explain__notice">
        Research use only. Dawa ranks hypotheses from a knowledge graph and a learned embedding; it does not establish
        efficacy or safety and is not medical advice. Confirm any candidate with the primary literature and appropriate
        clinical evaluation.
      </p>
    </div>
  )
}

/* ---------- loading skeleton ----------------------------------------- */

function ExplainSkeleton() {
  return (
    <div className="container explain" aria-busy="true" aria-label="Loading explanation">
      <header className="explain__head">
        <span className="explain__skel explain__skel--back skeleton" />
        <div className="explain__pair">
          <div className="explain__identity">
            <span className="explain__skel explain__skel--eyebrow skeleton" />
            <span className="explain__skel explain__skel--title skeleton" />
            <span className="explain__skel explain__skel--ids skeleton" />
          </div>
          <div className="explain__score">
            <span className="explain__skel explain__skel--stat skeleton" />
            <span className="explain__skel explain__skel--meter skeleton" />
            <span className="explain__skel explain__skel--tag skeleton" />
            <span className="explain__skel explain__skel--line skeleton" />
            <span className="explain__skel explain__skel--line explain__skel--short skeleton" />
          </div>
        </div>
      </header>
      <div className="explain__body">
        <div className="explain__toc" aria-hidden="true">
          <ol className="explain__toc-list">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <span className="explain__skel explain__skel--toc skeleton" />
              </li>
            ))}
          </ol>
        </div>
        <div className="explain__content">
          {SECTIONS.map((s, i) => (
            <div key={s.id} className="explain__section">
              <div className="explain__section-head">
                <span className="explain__skel explain__skel--num skeleton" />
                <span className="explain__skel explain__skel--h2 skeleton" />
              </div>
              <span className="explain__skel explain__skel--line skeleton" />
              <span className="explain__skel explain__skel--line explain__skel--short skeleton" />
              <span className={cx('explain__skel explain__skel--block skeleton', i % 2 ? 'explain__skel--block-tall' : '')} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
