import { Link } from 'react-router-dom'
import SearchBar from '../components/SearchBar.jsx'
import NetworkCanvas from '../components/NetworkCanvas.jsx'
import ConfidenceMeter from '../components/ConfidenceMeter.jsx'
import { Icon } from '../components/Icons.jsx'
import { api } from '../api/index.js'
import { useApi } from '../hooks/useApi.js'
import { fmtInt } from '../utils/format.js'
import './home.css'

const EXAMPLES = [
  { label: 'Metformin', q: 'Metformin', type: 'drug' },
  { label: 'Sildenafil', q: 'Sildenafil', type: 'drug' },
  { label: 'Alzheimer Disease', q: 'Alzheimer Disease', type: 'disease' },
  { label: 'Colchicine', q: 'Colchicine', type: 'drug' },
  { label: 'CN(C)C(=N)NC(N)=N', q: 'CN(C)C(=N)NC(N)=N', type: 'smiles', mono: true },
]

const STEPS = [
  { n: '01', title: 'Query', text: 'A drug name, disease, compound or SMILES string. Autocomplete resolves it to a canonical id.' },
  { n: '02', title: 'Standardise', text: 'Ids are harmonised (drug_uid, Entrez, MeSH) and the molecule is featurised into a 315-d vector.' },
  { n: '03', title: 'Graph lookup', text: 'The neighbourhood is pulled from the knowledge graph: targets, pathways, interactions, side effects.' },
  { n: '04', title: 'Encode + classify', text: 'A VAE compresses the drug to a 128-d embedding; an MLP scores each drug–disease pair on CPU.' },
  { n: '05', title: 'Rank + explain', text: 'Top-k candidates return with a calibrated confidence, the overlapping pathways and source citations.' },
]

const PRINCIPLES = [
  { title: 'Decoupled architecture', text: 'ML inference, web layer and data layer evolve independently.' },
  { title: 'Inference at request time', text: 'Drug embeddings are precomputed; the classifier runs in milliseconds on CPU.' },
  { title: 'Explainability built in', text: 'Every prediction carries a pathway-overlap reason and source citations.' },
]

const PILLARS = [
  { title: 'Advancing healthcare', text: 'AI-driven tools help local researchers find targeted treatments faster and cheaper.' },
  { title: 'AI and innovation', text: 'Applies the National AI Strategy 2031 to a concrete health problem.' },
  { title: 'Disease burden', text: 'Chronic disease is one of the UAE\'s biggest health challenges; cheaper discovery reaches patients sooner.' },
  { title: 'Knowledge economy', text: 'Builds local machine-learning and bioinformatics expertise that stays in the country.' },
]

export default function Home() {
  const stats = useApi((signal) => api.stats({ signal }), [])
  const model = useApi((signal) => api.model({ signal }), [])
  const sources = useApi((signal) => api.sources({ signal }), [])

  const ent = stats.data?.entities
  const m = model.data?.model
  const best = m?.metrics?.at?.[1]

  return (
    <>
      {/* ------------------------------------------------ hero */}
      <section className="hero">
        <NetworkCanvas />
        <div className="container hero__inner">
          <div className="eyebrow eyebrow--accent">Drug repurposing · VAE + knowledge graph</div>
          <h1 className="display hero__title">
            Discover new uses
            <br />
            for <em>existing</em> molecules.
          </h1>
          <p className="lede hero__lede">
            Type a drug, a disease, a compound or a SMILES string. Dawa encodes it, walks a 5.3-million-edge
            biomedical knowledge graph and returns ranked candidates with the reasoning behind each one.
          </p>
          <div className="hero__search">
            <SearchBar size="lg" autoFocus />
          </div>
          <div className="hero__try">
            <span className="eyebrow">Try</span>
            {EXAMPLES.map((ex) => (
              <Link
                key={ex.q}
                to={`/results?q=${encodeURIComponent(ex.q)}&type=${ex.type}`}
                className={ex.mono ? 'chip chip--mono' : 'chip'}
              >
                {ex.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ stats */}
      <section className="stats">
        <div className="container stats__grid">
          <p className="stats__lead">
            Eleven biomedical databases, harmonised into one graph. The numbers below are the current index; every
            prediction is traced back to them.
          </p>
          <Stat value={ent ? fmtInt(ent.drugs) : null} label="drugs indexed" />
          <Stat value={ent ? fmtInt(ent.diseases) : null} label="diseases (MeSH)" />
          <Stat value={ent ? fmtInt(ent.genes) : null} label="genes" />
          <Stat value={stats.data ? `${(stats.data.edges.total / 1e6).toFixed(1)}M` : null} label="typed graph edges" accent />
        </div>
      </section>

      {/* ------------------------------------------------ problem */}
      <section className="section problem">
        <div className="container problem__grid">
          <div>
            <div className="eyebrow">The problem</div>
            <h2 className="h2 problem__title">
              De novo drug design takes 10–15 years and one to two billion dollars per approved molecule.
            </h2>
          </div>
          <div className="problem__text">
            <p>
              Repurposing, finding new uses for compounds we already understand, is faster and cheaper because the
              safety profile already exists. The bottleneck is not the science: state-of-the-art repurposing models
              exist, but they live as Python scripts in GitHub repositories that a wet-lab researcher cannot run
              without machine-learning expertise.
            </p>
            <p>
              Dawa hides that pipeline behind a clinical interface. You describe what you have, a molecule or a
              disease, and get back a ranked list with a confidence score, the shared biology that justifies it and
              the databases that support it.
            </p>
            <Link to="/model" className="arrow-link">
              How the model works <Icon.ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ pipeline */}
      <section className="section section--paper-2 pipeline">
        <div className="container">
          <div className="pipeline__head">
            <div className="eyebrow">From query to ranked list</div>
            <h2 className="h2">Five steps, one request, milliseconds of inference.</h2>
          </div>
          <ol className="pipeline__steps">
            {STEPS.map((s) => (
              <li key={s.n} className="step">
                <span className="step__num">{s.n}</span>
                <span className="step__title">{s.title}</span>
                <span className="step__text">{s.text}</span>
              </li>
            ))}
          </ol>
          <ul className="principles">
            {PRINCIPLES.map((p) => (
              <li key={p.title}>
                <strong>{p.title}.</strong> {p.text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------ bento */}
      <section className="section ways">
        <div className="container">
          <div className="ways__head">
            <div className="eyebrow">Three ways in</div>
            <h2 className="h2">Start from a molecule, from a disease, or from a pair you already suspect.</h2>
          </div>
          <div className="bento">
            <Link to="/results?q=Metformin&type=drug" className="bento__cell bento__cell--wide">
              <div className="bento__label">
                <span className="badge badge--drug">Drug</span>
                <Icon.ArrowRight size={14} />
                <span className="badge badge--disease">Disease</span>
              </div>
              <h3 className="h3">Which diseases could this drug treat?</h3>
              <p className="small muted">
                Enter an approved drug or any compound. Approved indications are marked; the rest are candidates
                ranked by calibrated confidence.
              </p>
              <div className="mini">
                <MiniRow name="Polycystic Ovary Syndrome" value={0.94} />
                <MiniRow name="Colorectal Neoplasms" value={0.91} />
                <MiniRow name="Alzheimer Disease" value={0.82} />
                <MiniRow name="Non-alcoholic Fatty Liver Disease" value={0.71} />
              </div>
            </Link>

            <Link to="/results?q=Alzheimer%20Disease&type=disease" className="bento__cell bento__cell--narrow bento__cell--ink">
              <div className="bento__label">
                <span className="badge badge--disease" style={{ color: 'var(--paper)' }}>
                  Disease
                </span>
                <Icon.ArrowRight size={14} />
                <span className="badge badge--drug" style={{ color: 'var(--accent-soft)' }}>
                  Drug
                </span>
              </div>
              <h3 className="h3">Which existing drugs could treat this disease?</h3>
              <p className="small" style={{ color: 'var(--ink-4)' }}>
                Start from a MeSH disease term and rank the whole approved-drug index against it.
              </p>
              <div className="bento__foot">
                Try Alzheimer disease <Icon.ArrowRight size={14} />
              </div>
            </Link>

            <Link to="/explain/DB00203/D012021" className="bento__cell bento__cell--narrow">
              <div className="bento__label">
                <span className="badge badge--plain">Explain a pair</span>
              </div>
              <h3 className="h3">Why sildenafil for Raynaud disease?</h3>
              <p className="small muted">
                Every pair opens into shared targets, pathway overlap, latent-space neighbours, trial evidence and a
                feature-contribution breakdown.
              </p>
              <div className="bento__foot">
                Open the explanation <Icon.ArrowRight size={14} />
              </div>
            </Link>

            <Link to="/database" className="bento__cell bento__cell--wide bento__cell--graph">
              <div className="bento__label">
                <span className="badge badge--plain">Knowledge graph</span>
              </div>
              <h3 className="h3">Five relation types, one namespace.</h3>
              <p className="small muted">
                Gene–disease, drug–target, protein–protein, drug–disease and drug–side-effect edges, mapped to
                canonical ids so a query can hop across sources.
              </p>
              <GraphSketch />
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ evidence */}
      <section className="section section--ink evidence">
        <div className="container evidence__grid">
          <div>
            <div className="eyebrow">Evidence</div>
            <h2 className="h2">Every prediction carries its receipts.</h2>
            <p className="evidence__text">
              Sources are cited per pair: which database contributed the edge, how many records support it, and
              whether a registered trial has already tested the idea.
            </p>
            <Link to="/database" className="arrow-link" style={{ color: 'var(--paper)' }}>
              Browse the database <Icon.ArrowRight size={16} />
            </Link>
          </div>
          <ul className="sources">
            {(sources.data?.sources || Array.from({ length: 11 }, () => null)).map((s, i) => (
              <li key={s?.id || i} className="sources__item">
                <span className={s ? 'sources__name' : 'sources__name skeleton'}>{s?.name || 'Source name'}</span>
                <span className={s ? 'sources__records' : 'sources__records skeleton'}>{s?.recordLabel || '000'}</span>
                <span className={s ? 'sources__role' : 'sources__role skeleton'}>{s?.role || 'role'}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------ performance */}
      <section className="section perf">
        <div className="container perf__grid">
          <div className="perf__numbers">
            <div className="eyebrow">Held-out test set · drug-level split</div>
            <div className="perf__row">
              <Stat value={best ? best.auprc.toFixed(3) : null} label="AUPRC (primary metric)" accent />
              <Stat value={best ? best.auroc.toFixed(3) : null} label="AUROC" />
              <Stat value={best ? best.f1.toFixed(3) : null} label="F1 at threshold 0.79" />
            </div>
            <p className="perf__text">
              Precision and recall are reported as a pair (0.79 / 0.87) so you can move the threshold to suit your
              risk tolerance: lower it to surface more candidates, raise it to reduce wet-lab waste. Probabilities
              are calibrated, not just ranked.
            </p>
            <Link to="/model" className="arrow-link">
              Read the model card <Icon.ArrowRight size={16} />
            </Link>
          </div>
          <div className="perf__curve">
            <PrCurve points={m?.curves?.pr} marker={m?.curves?.prMarkers?.[0]} baseRate={m?.metrics?.baseRate} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ pillars */}
      <section className="section section--tight pillars">
        <div className="container">
          <ul className="pillars__list">
            {PILLARS.map((p) => (
              <li key={p.title}>
                <strong>{p.title}</strong>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------ cta */}
      <section className="section cta">
        <div className="container cta__inner">
          <h2 className="h1">Start with a molecule.</h2>
          <div className="cta__search">
            <SearchBar showTypes={false} showHint={false} placeholder="Drug, disease, compound or SMILES…" />
          </div>
        </div>
      </section>
    </>
  )
}

function Stat({ value, label, accent }) {
  return (
    <div className={accent ? 'stat stat--accent' : 'stat'}>
      <span className={value ? 'stat__value' : 'stat__value skeleton'}>{value || '0,000'}</span>
      <span className="stat__label">{label}</span>
    </div>
  )
}

function MiniRow({ name, value }) {
  return (
    <div className="mini__row">
      <span className="mini__name">{name}</span>
      <ConfidenceMeter value={value} threshold={0.79} className="mini__meter" />
    </div>
  )
}

/** Small decorative bipartite graph: drug → targets → disease. */
function GraphSketch() {
  const left = [40, 80, 120]
  const right = [30, 60, 90, 120, 150]
  return (
    <svg className="graph-sketch" viewBox="0 0 320 180" role="img" aria-label="Drug to targets to disease graph sketch">
      <g stroke="var(--line-strong)" strokeWidth="1">
        {left.map((y) => (
          <line key={`a${y}`} x1="30" y1="90" x2="130" y2={y} />
        ))}
        {left.flatMap((y, i) =>
          right.filter((_, j) => (i + j) % 2 === 0).map((ry) => <line key={`b${y}${ry}`} x1="130" y1={y} x2="230" y2={ry} />),
        )}
        {right.map((y) => (
          <line key={`c${y}`} x1="230" y1={y} x2="300" y2="90" stroke="var(--accent-soft)" />
        ))}
      </g>
      <circle cx="30" cy="90" r="9" fill="var(--accent)" />
      {left.map((y) => (
        <circle key={y} cx="130" cy={y} r="5" fill="var(--ink)" />
      ))}
      {right.map((y, i) => (
        <circle key={y} cx="230" cy={y} r="4.5" fill={i % 2 ? 'var(--accent)' : 'var(--ink-3)'} />
      ))}
      <circle cx="300" cy="90" r="9" fill="var(--ink)" />
      <text x="30" y="118" textAnchor="middle" fontSize="10" fill="var(--ink-3)">drug</text>
      <text x="130" y="145" textAnchor="middle" fontSize="10" fill="var(--ink-3)">targets</text>
      <text x="230" y="172" textAnchor="middle" fontSize="10" fill="var(--ink-3)">disease genes</text>
      <text x="300" y="118" textAnchor="middle" fontSize="10" fill="var(--ink-3)">disease</text>
    </svg>
  )
}

/** Hand-drawn precision–recall curve (SVG). */
function PrCurve({ points, marker, baseRate = 0.167 }) {
  const W = 360
  const H = 260
  const pad = { l: 40, r: 14, t: 14, b: 34 }
  const x = (v) => pad.l + v * (W - pad.l - pad.r)
  const y = (v) => pad.t + (1 - v) * (H - pad.t - pad.b)
  const pts = points && points.length ? points : [[0, 1], [1, baseRate]]
  const d = pts.map(([r, p], i) => `${i ? 'L' : 'M'}${x(r).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  const area = `${d} L${x(1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pr-curve" role="img" aria-label="Precision-recall curve, area 0.897">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={x(0) - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--ink-3)">{t.toFixed(2)}</text>
          <text x={x(t)} y={H - pad.b + 16} textAnchor="middle" fontSize="10" fill="var(--ink-3)">{t.toFixed(2)}</text>
        </g>
      ))}
      <line x1={x(0)} x2={x(1)} y1={y(baseRate)} y2={y(baseRate)} stroke="var(--ink-4)" strokeDasharray="4 4" />
      <text x={x(1)} y={y(baseRate) - 5} textAnchor="end" fontSize="10" fill="var(--ink-3)">
        random ({baseRate.toFixed(3)})
      </text>
      <path d={area} fill="var(--accent-tint)" opacity="0.8" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {marker ? (
        <g>
          <circle cx={x(marker.recall)} cy={y(marker.precision)} r="4.5" fill="var(--ink)" />
          <text x={x(marker.recall) - 8} y={y(marker.precision) - 8} textAnchor="end" fontSize="10" fill="var(--ink)">
            {marker.label} · P {marker.precision.toFixed(2)} / R {marker.recall.toFixed(2)}
          </text>
        </g>
      ) : null}
      <text x={x(0.5)} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--ink-2)">Recall</text>
      <text x={12} y={y(0.5)} textAnchor="middle" fontSize="10" fill="var(--ink-2)" transform={`rotate(-90 12 ${y(0.5)})`}>
        Precision
      </text>
    </svg>
  )
}
