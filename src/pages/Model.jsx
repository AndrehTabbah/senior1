import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ErrorState from '../components/ErrorState.jsx'
import { Icon } from '../components/Icons.jsx'
import { api } from '../api/index.js'
import { useApi } from '../hooks/useApi.js'
import { fmtInt, fmtPct, fmtDate, fmtNum, cx } from '../utils/format.js'
import './model.css'

const SECTIONS = [
  { id: 'architecture', num: '01', label: 'Architecture' },
  { id: 'hyperparameters', num: '02', label: 'Hyper-parameters' },
  { id: 'training-data', num: '03', label: 'Training data' },
  { id: 'performance', num: '04', label: 'Performance' },
  { id: 'metrics', num: '05', label: 'Why these metrics' },
  { id: 'validation', num: '06', label: 'Validation and design' },
  { id: 'calibration', num: '07', label: 'Calibration' },
  { id: 'limitations', num: '08', label: 'Limitations' },
]
const SECTION_IDS = SECTIONS.map((s) => s.id)

const METRIC_ROWS = [
  { key: 'auroc', label: 'AUROC', thresholdFree: true },
  { key: 'auprc', label: 'AUPRC', thresholdFree: true },
  { key: 'f1', label: 'F1' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'precision', label: 'Precision' },
  { key: 'recall', label: 'Recall' },
  { key: 'rmse', label: 'RMSE', thresholdFree: true },
]

export default function Model() {
  const { data, error, loading, reload } = useApi((signal) => api.model({ signal }), [])
  const m = data?.model
  const active = useActiveSection(SECTION_IDS, Boolean(m))

  useEffect(() => {
    document.title = 'Model card · Dawa'
  }, [])

  if (loading) return <ModelSkeleton />

  if (error) {
    return (
      <div className="container">
        <ErrorState title="The model card could not be loaded" error={error} onRetry={reload} />
      </div>
    )
  }

  if (!m) {
    return (
      <div className="container">
        <ErrorState
          title="No model card is available"
          text="The API returned no model description. Try again once a model has been registered."
          onRetry={reload}
        />
      </div>
    )
  }

  const points = m.metrics?.at || []
  const best = points[1] || points[0] || {}
  const training = m.training || {}
  const totalPairs = (training.positives || 0) + (training.negatives || 0)

  return (
    <div className="container model">
      <header className="page-head model-head">
        <div className="eyebrow">
          Model card · {m.name} v{m.version} · trained {fmtDate(m.trainedOn)}
        </div>
        <h1 className="h1">
          A variational autoencoder that learns what a drug <em>is</em>, and a classifier that learns what it could{' '}
          <em>treat</em>.
        </h1>
        <p className="lede">{m.summary}</p>
        <div className="model-head__stats">
          <Stat value={fmtNum(best.auprc, 3)} label="AUPRC · primary metric" accent />
          <Stat value={fmtNum(best.auroc, 3)} label="AUROC" />
          <Stat value={fmtNum(best.f1, 3)} label={`F1 at threshold ${fmtNum(best.threshold ?? m.threshold, 2)}`} />
        </div>
      </header>

      <div className="model-layout">
        <nav className="model-toc" aria-label="On this page">
          <ol className="model-toc__list">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="model-toc__link" aria-current={active === s.id ? 'true' : undefined}>
                  <span className="model-toc__num">{s.num}</span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
          <dl className="model-toc__meta">
            <div>
              <dt>Framework</dt>
              <dd>{m.framework}</dd>
            </div>
            {m.latencyMs ? (
              <div>
                <dt>Inference</dt>
                <dd>
                  {m.latencyMs.p50} ms p50 · {m.latencyMs.p95} ms p95
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Decision threshold</dt>
              <dd className="mono">{fmtNum(m.threshold, 2)}</dd>
            </div>
          </dl>
        </nav>

        <div className="model-body">
          {/* ------------------------------------------------ 01 architecture */}
          <Section
            id="architecture"
            num="01"
            title="Architecture"
            heading="Compress the molecule to 128 numbers, then score the pair."
            intro="The encoder is trained to reconstruct its own input, so the latent vector z has to keep whatever makes one molecule differ from another. The classifier never sees raw features: it sees z together with the pair's position in the knowledge graph."
          >
            <div
              className="model-diagram"
              role="region"
              tabIndex={0}
              aria-label="Architecture diagram. Scrolls horizontally on small screens."
            >
              <ArchitectureDiagram input={m.input} />
            </div>
            <p className="model-diagram__note">
              Solid arrows carry data. Dashed lines mark the three loss terms: the KL divergence that keeps the latent
              distribution close to a unit Gaussian, the mean squared error between x and its reconstruction x̂, and a
              class-weighted binary cross-entropy on the classifier output.
            </p>

            <div className="model-arch">
              <div>
                <div className="eyebrow">Input features · {m.input?.dims}-d</div>
                <ul className="model-tags">
                  {m.input?.fingerprint ? (
                    <li>
                      <span className="tag tag--accent tag--mono">
                        {m.input.fingerprint.name} · {m.input.fingerprint.bits} bits · radius {m.input.fingerprint.radius}
                      </span>
                    </li>
                  ) : null}
                  {(m.input?.descriptors || []).map((d) => (
                    <li key={d}>
                      <span className="tag tag--mono">{d}</span>
                    </li>
                  ))}
                </ul>
                <p className="small muted">
                  The fingerprint captures which substructures are present; the RDKit descriptors add global physical
                  chemistry such as size, lipophilicity and polar surface area. A new SMILES string is featurised the same
                  way at request time, so unseen compounds get an embedding without retraining.
                </p>
              </div>
              <dl className="dl">
                <dt>Encoder</dt>
                <dd className="mono">{m.architecture?.encoder}</dd>
                <dt>Decoder</dt>
                <dd className="mono">{m.architecture?.decoder}</dd>
                <dt>Classifier</dt>
                <dd>{m.architecture?.classifier}</dd>
                <dt>Activation</dt>
                <dd>{m.architecture?.activation}</dd>
                <dt>Latent size</dt>
                <dd className="mono">{m.input?.latentDims}</dd>
                <dt>Framework</dt>
                <dd>{m.framework}</dd>
                {m.latencyMs ? (
                  <>
                    <dt>Inference latency</dt>
                    <dd>
                      <span className="mono">{m.latencyMs.p50} ms</span> median, <span className="mono">{m.latencyMs.p95} ms</span> p95, on
                      CPU
                    </dd>
                  </>
                ) : null}
              </dl>
            </div>
          </Section>

          {/* ------------------------------------------------ 02 hyper-parameters */}
          <Section
            id="hyperparameters"
            num="02"
            title="Hyper-parameters"
            heading="The settings behind the released checkpoint."
            intro="Chosen by cross-validation inside the training split. Nothing here was tuned against the held-out test drugs."
          >
            <div className="table-wrap">
              <table className="table table--hover">
                <thead>
                  <tr>
                    <th scope="col">Parameter</th>
                    <th scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {(m.hyperparameters || []).map((h) => (
                    <tr key={h.param}>
                      <td>{h.param}</td>
                      <td className="mono">{h.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ------------------------------------------------ 03 training data */}
          <Section
            id="training-data"
            num="03"
            title="Training data"
            heading={`${fmtInt(totalPairs)} labelled pairs, split by drug.`}
            band
          >
            <div className="model-train">
              <dl className="dl">
                <dt>Positive pairs</dt>
                <dd className="mono">{fmtInt(training.positives)}</dd>
                <dt>Negative pairs</dt>
                <dd className="mono">{fmtInt(training.negatives)}</dd>
                <dt>Ratio</dt>
                <dd className="mono">{training.ratio}</dd>
                <dt>Positive share</dt>
                <dd className="mono">{fmtPct(training.positiveShare, 1)}</dd>
                <dt>Split</dt>
                <dd>{training.split}</dd>
                <dt>Negative sampling</dt>
                <dd>{training.negativeSampling}</dd>
                <dt>Cross-validation</dt>
                <dd>{training.crossValidation}</dd>
              </dl>
              <div>
                <Proportion
                  title="Label balance"
                  detail={`${training.ratio || ''} positive to negative`}
                  segments={[
                    { label: 'Known indications (positive)', value: training.positives || 0, tone: 'accent' },
                    { label: 'Sampled non-indications (negative)', value: training.negatives || 0, tone: 'soft' },
                  ]}
                />
                <SplitBar split={training.split} />
                <p className="model-train__text small">
                  The split is made at drug level rather than pair level: every pair belonging to a drug lands in exactly one
                  of the training, validation or test partitions. No molecule scored at test time was seen during training,
                  which is the situation a repurposing query is in, and it prevents the classifier from memorising
                  drug-specific shortcuts.
                </p>
              </div>
            </div>
          </Section>

          {/* ------------------------------------------------ 04 performance */}
          <Section
            id="performance"
            num="04"
            title="Performance"
            heading="Two operating points on the held-out test drugs."
            intro={`Ranking metrics do not move with the threshold; precision, recall, F1 and accuracy do. The default threshold of ${fmtNum(m.threshold, 2)} maximises F1 on the validation set.`}
          >
            <MetricsTable points={points} primary={m.metrics?.primary} />

            <div className="model-charts">
              <CurveChart
                title={`ROC curve, area ${fmtNum(best.auroc, 3)}`}
                caption={
                  <>
                    <strong>ROC</strong> · true-positive rate against false-positive rate · AUROC{' '}
                    <span className="mono">{fmtNum(best.auroc, 3)}</span>
                  </>
                }
                points={m.curves?.roc}
                markers={(m.curves?.rocMarkers || []).map((mk) => ({
                  key: mk.label,
                  x: mk.fpr,
                  y: mk.tpr,
                  text: `${mk.label} · TPR ${fmtNum(mk.tpr, 2)} / FPR ${fmtNum(mk.fpr, 2)}`,
                }))}
                reference={{ kind: 'diagonal', label: 'chance' }}
                xLabel="False-positive rate"
                yLabel="True-positive rate"
                labelAnchor="start"
              />
              <CurveChart
                title={`Precision-recall curve, area ${fmtNum(best.auprc, 3)}`}
                caption={
                  <>
                    <strong>Precision–recall</strong> · base rate {fmtNum(m.metrics?.baseRate, 3)} · AUPRC{' '}
                    <span className="mono">{fmtNum(best.auprc, 3)}</span>
                  </>
                }
                points={m.curves?.pr}
                markers={(m.curves?.prMarkers || []).map((mk) => ({
                  key: mk.label,
                  x: mk.recall,
                  y: mk.precision,
                  text: `${mk.label} · P ${fmtNum(mk.precision, 2)} / R ${fmtNum(mk.recall, 2)}`,
                }))}
                reference={
                  typeof m.metrics?.baseRate === 'number'
                    ? { kind: 'hline', value: m.metrics.baseRate, label: `base rate ${fmtNum(m.metrics.baseRate, 3)}` }
                    : null
                }
                xLabel="Recall"
                yLabel="Precision"
                labelAnchor="end"
              />
            </div>

            {m.metrics?.confusion ? <ConfusionMatrix c={m.metrics.confusion} /> : null}
          </Section>

          {/* ------------------------------------------------ 05 metric definitions */}
          <Section
            id="metrics"
            num="05"
            title="Why these metrics"
            heading="Positives are rare, so the usual numbers mislead."
            intro={`Roughly one pair in six is a true indication. Accuracy and AUROC look strong on almost any imbalanced problem, so the model is judged on ${m.metrics?.primary || 'AUPRC'} first and the rest are reported for context.`}
          >
            <div className="model-defs">
              {(m.metrics?.definitions || []).map((d) => (
                <div key={d.name} className="model-def">
                  <div className="model-def__head">
                    <h3 className="h4">{d.name}</h3>
                    <span className="model-def__value">{typeof d.value === 'number' ? fmtNum(d.value, 3) : d.value}</span>
                  </div>
                  <div className="notice model-def__formula">{d.formula}</div>
                  <p className="model-def__why">{d.why}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ------------------------------------------------ 06 validation + design */}
          <Section
            id="validation"
            num="06"
            title="Validation and design"
            heading="How the model was checked, and why it looks the way it does."
            band
          >
            <div className="model-two">
              <div>
                <h3 className="h3">Validation strategy</h3>
                <ol className="model-list">
                  {(m.validation || []).map((v) => (
                    <li key={v.title}>
                      <strong>{v.title}</strong>
                      <span>{v.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="h3">Design decisions</h3>
                <ol className="model-list">
                  {(m.designDecisions || []).map((d) => (
                    <li key={d.title}>
                      <strong>{d.title}</strong>
                      <span>{d.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Section>

          {/* ------------------------------------------------ 07 calibration */}
          <Section
            id="calibration"
            num="07"
            title="Calibration"
            heading="A score of 0.85 should be right about 85% of the time."
            intro="Calibration matters for clinicians because the confidence is read as a probability rather than a rank: a well-calibrated score lets a threshold be set against the real cost of a wasted assay or a missed lead, instead of against an arbitrary cut-off."
          >
            <CalibrationBlock rows={m.calibration || []} threshold={m.threshold} rmse={best.rmse} />
          </Section>

          {/* ------------------------------------------------ 08 limitations */}
          <section id="limitations" className="model-section" aria-label="Limitations">
            <div className="notice model-limits">
              <p>
                <strong>Limitations.</strong> The public demo runs against a mock index that covers a subset of the full
                knowledge graph, so counts and rankings differ from the production model. Every prediction is a hypothesis
                generated from database associations, not clinical evidence; it needs wet-lab or trial confirmation before
                it means anything for a patient. Dawa is a research tool and is not intended for diagnosis or treatment
                decisions.
              </p>
            </div>
            <div className="model-links">
              <Link to="/" className="arrow-link">
                Run a query <Icon.ArrowRight size={16} />
              </Link>
              <Link to="/database" className="arrow-link">
                Browse the sources it was trained on <Icon.ArrowRight size={16} />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ pieces */

function Section({ id, num, title, heading, intro, band, children }) {
  return (
    <section id={id} className={cx('model-section', band && 'model-section--band')} aria-labelledby={`${id}-title`}>
      <div className="model-section__head">
        <div className="eyebrow">
          <span className="model-section__num">{num}</span>
          {title}
        </div>
        <h2 id={`${id}-title`} className="h2">
          {heading}
        </h2>
        {intro ? <p className="model-section__intro">{intro}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Stat({ value, label, accent }) {
  return (
    <div className={cx('stat', accent && 'stat--accent')}>
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  )
}

function MetricsTable({ points, primary }) {
  const primaryKey = String(primary || '').toLowerCase()
  return (
    <div className="table-wrap">
      <table className="table model-metrics">
        <thead>
          <tr>
            <th scope="col">Metric</th>
            {points.map((p) => (
              <th key={p.label} scope="col" className="model-metrics__value">
                {p.label}
              </th>
            ))}
            <th scope="col">
              <span className="sr-only">Note</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {METRIC_ROWS.map((row) => {
            const isPrimary = row.key === primaryKey
            return (
              <tr key={row.key} className={isPrimary ? 'model-metrics__primary' : undefined}>
                <td>
                  {row.label}
                  {isPrimary ? <span className="tag tag--accent">primary</span> : null}
                </td>
                {points.map((p) => (
                  <td key={p.label} className="model-metrics__value">
                    {fmtNum(p[row.key], 3)}
                  </td>
                ))}
                <td className="model-metrics__note">{row.thresholdFree ? 'threshold-free' : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ConfusionMatrix({ c }) {
  const total = c.tp + c.fp + c.fn + c.tn
  const precision = c.tp / (c.tp + c.fp || 1)
  const recall = c.tp / (c.tp + c.fn || 1)
  const specificity = c.tn / (c.tn + c.fp || 1)
  const cell = (n, k, tone) => (
    <td className={`model-cm--${tone}`}>
      <span className="model-cm__n">{fmtInt(n)}</span>
      <span className="model-cm__k">
        {k} · {fmtPct(n / total, 1)}
      </span>
    </td>
  )
  return (
    <div className="model-confusion">
      <div className="table-wrap">
        <table className="model-cm" aria-label={`Confusion matrix at threshold ${fmtNum(c.threshold, 2)}`}>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Actual class</span>
              </th>
              <th scope="col">Predicted negative</th>
              <th scope="col">Predicted positive</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">True negative</th>
              {cell(c.tn, 'TN', 'tn')}
              {cell(c.fp, 'FP', 'fp')}
            </tr>
            <tr>
              <th scope="row">True positive</th>
              {cell(c.fn, 'FN', 'fn')}
              {cell(c.tp, 'TP', 'tp')}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="model-confusion__text">
        <p>
          Counts on the test set at threshold <span className="mono">{fmtNum(c.threshold, 2)}</span>, {fmtInt(total)} pairs
          in total. Most of the error is on the false-positive side; the model rarely misses a known indication.
        </p>
        <dl className="dl">
          <dt>Precision</dt>
          <dd className="mono">{fmtNum(precision, 3)}</dd>
          <dt>Recall</dt>
          <dd className="mono">{fmtNum(recall, 3)}</dd>
          <dt>Specificity</dt>
          <dd className="mono">{fmtNum(specificity, 3)}</dd>
        </dl>
      </div>
    </div>
  )
}

function CalibrationBlock({ rows, threshold, rmse }) {
  const parsed = rows
    .map((r) => ({ ...r, range: parseBucket(r.bucket) }))
    .map((r) => ({ ...r, mid: r.range ? (r.range[0] + r.range[1]) / 2 : null, below: r.range ? r.range[0] < threshold : false }))
  const totalN = rows.reduce((s, r) => s + (r.n || 0), 0)
  const reliability = parsed
    .filter((r) => r.mid !== null)
    .map((r) => [r.mid, r.empiricalPrecision])
    .sort((a, b) => a[0] - b[0])

  if (!rows.length) {
    return <p className="muted small">No calibration table has been published for this checkpoint.</p>
  }

  return (
    <div className="model-cal">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Confidence bucket</th>
              <th scope="col">Empirical precision</th>
              <th scope="col" className="num">
                Pairs
              </th>
            </tr>
          </thead>
          <tbody>
            {parsed.map((r) => (
              <tr key={r.bucket} className={r.below ? 'model-cal__row--below' : undefined}>
                <td className="mono">{r.bucket}</td>
                <td>
                  <span className="model-cal__prec">
                    <span className={cx('model-bar', r.below && 'model-bar--below')} aria-hidden="true">
                      <span className="model-bar__fill" style={{ width: `${Math.round(r.empiricalPrecision * 100)}%` }} />
                    </span>
                    <span className="model-cal__pct">{fmtPct(r.empiricalPrecision)}</span>
                  </span>
                </td>
                <td className="num mono">{fmtInt(r.n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="model-cal__aside">
        <p>
          Across {fmtInt(totalN)} test pairs the empirical precision in each bucket tracks the predicted probability, with
          an RMSE of <span className="mono">{fmtNum(rmse, 2)}</span> on the probabilities. Buckets at or above the decision
          threshold of <span className="mono">{fmtNum(threshold, 2)}</span> are drawn in the accent colour, the same
          convention the results pages use.
        </p>
        {reliability.length >= 2 ? (
          <CurveChart
            title="Reliability diagram: empirical precision against predicted confidence"
            caption="Reliability diagram · points sit near the diagonal when the model is calibrated"
            points={reliability}
            reference={{ kind: 'diagonal', label: 'perfect calibration' }}
            vline={typeof threshold === 'number' ? { value: threshold, label: `threshold ${fmtNum(threshold, 2)}` } : null}
            xLabel="Predicted confidence (bucket midpoint)"
            yLabel="Empirical precision"
            area={false}
            dots
          />
        ) : null}
      </div>
    </div>
  )
}

function Proportion({ title, detail, segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  return (
    <div className="model-prop">
      <div className="model-prop__title">
        <span>{title}</span>
        <span className="mono">{detail}</span>
      </div>
      <div
        className="model-prop__bar"
        role="img"
        aria-label={segments.map((s) => `${s.label} ${fmtPct(s.value / total, 1)}`).join(', ')}
      >
        {segments.map((s) => (
          <span key={s.label} className={`model-prop__seg model-tone--${s.tone}`} style={{ width: `${(s.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="model-prop__legend">
        {segments.map((s) => (
          <li key={s.label} data-tone={s.tone}>
            {s.label} · {fmtPct(s.value / total, 1)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SplitBar({ split }) {
  const parts = parseSplit(split)
  if (!parts) return null
  const [train, val, test] = parts
  return (
    <Proportion
      title="Drug-level split"
      detail={`${train} / ${val} / ${test}`}
      segments={[
        { label: 'Training drugs', value: train, tone: 'ink' },
        { label: 'Validation drugs', value: val, tone: 'soft' },
        { label: 'Test drugs', value: test, tone: 'accent' },
      ]}
    />
  )
}

/* ------------------------------------------------------------------ charts */

/** Generic 0–1 by 0–1 curve chart (ROC, PR, reliability). Hand-written SVG. */
function CurveChart({ title, caption, points, markers = [], xLabel, yLabel, reference, vline, labelAnchor = 'start', area = true, dots = false }) {
  const W = 420
  const H = 300
  const pad = { l: 44, r: 18, t: 22, b: 44 }
  const x = (v) => pad.l + v * (W - pad.l - pad.r)
  const y = (v) => pad.t + (1 - v) * (H - pad.t - pad.b)
  const pts = Array.isArray(points) && points.length ? points : []
  const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${x(px).toFixed(1)},${y(py).toFixed(1)}`).join(' ')
  const areaD = pts.length
    ? `${d} L${x(pts[pts.length - 1][0]).toFixed(1)},${y(0).toFixed(1)} L${x(pts[0][0]).toFixed(1)},${y(0).toFixed(1)} Z`
    : ''
  const ticks = [0, 0.5, 1]
  const dx = labelAnchor === 'end' ? -10 : 10

  return (
    <figure className="model-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} fontFamily="var(--font-body)">
        <title>{title}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--line-strong)' : 'var(--line)'} />
            <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(1)} stroke={t === 0 ? 'var(--line-strong)' : 'var(--line)'} />
            <text x={x(0) - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">
              {t}
            </text>
            <text x={x(t)} y={y(0) + 18} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
              {t}
            </text>
          </g>
        ))}

        {reference?.kind === 'diagonal' ? (
          <g>
            <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--ink-4)" strokeDasharray="4 4" />
            <text
              x={x(0.6)}
              y={y(0.56)}
              fontSize="11"
              fill="var(--ink-3)"
              textAnchor="middle"
              transform={`rotate(-33 ${x(0.6)} ${y(0.56)})`}
            >
              {reference.label}
            </text>
          </g>
        ) : null}

        {reference?.kind === 'hline' ? (
          <g>
            <line x1={x(0)} x2={x(1)} y1={y(reference.value)} y2={y(reference.value)} stroke="var(--ink-4)" strokeDasharray="4 4" />
            <text x={x(1)} y={y(reference.value) - 6} textAnchor="end" fontSize="11" fill="var(--ink-3)">
              {reference.label}
            </text>
          </g>
        ) : null}

        {vline ? (
          <g>
            <line x1={x(vline.value)} x2={x(vline.value)} y1={y(0)} y2={y(1)} stroke="var(--accent-soft)" strokeDasharray="4 4" />
            <text x={x(vline.value) - 6} y={y(1) + 12} textAnchor="end" fontSize="11" fill="var(--accent-text)">
              {vline.label}
            </text>
          </g>
        ) : null}

        {area && areaD ? <path d={areaD} fill="var(--accent-tint)" opacity="0.85" /> : null}
        {d ? <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {dots
          ? pts.map(([px, py]) => <circle key={`${px}-${py}`} cx={x(px)} cy={y(py)} r="3.5" fill="var(--accent)" stroke="var(--paper)" strokeWidth="1.5" />)
          : null}

        {markers.map((mk) => (
          <g key={mk.key}>
            <circle cx={x(mk.x)} cy={y(mk.y)} r="4.5" fill="var(--ink)" stroke="var(--paper)" strokeWidth="1.5" />
            <text x={x(mk.x) + dx} y={y(mk.y) + 15} textAnchor={labelAnchor} fontSize="11" fill="var(--ink)">
              {mk.text}
            </text>
          </g>
        ))}

        <text x={x(0.5)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--ink-2)">
          {xLabel}
        </text>
        <text x={12} y={y(0.5)} textAnchor="middle" fontSize="11" fill="var(--ink-2)" transform={`rotate(-90 12 ${y(0.5)})`}>
          {yLabel}
        </text>
      </svg>
      {caption ? <figcaption className="model-chart__caption">{caption}</figcaption> : null}
    </figure>
  )
}

/* ------------------------------------------------------------------ diagram */

function ArchitectureDiagram({ input }) {
  const dims = input?.dims ?? 315
  const latent = input?.latentDims ?? 128
  const bits = input?.fingerprint?.bits ?? 300
  const nDesc = input?.descriptors?.length ?? 15
  const hidden = 256

  const ink = 'var(--ink)'
  const ink2 = 'var(--ink-2)'
  const ink3 = 'var(--ink-3)'

  return (
    <svg viewBox="0 0 960 360" role="img" aria-labelledby="model-diagram-title model-diagram-desc" fontFamily="var(--font-body)">
      <title id="model-diagram-title">VAE and classifier architecture</title>
      <desc id="model-diagram-desc">
        Drug features of {dims} dimensions pass through an encoder to a {latent}-dimensional latent vector z, which a decoder
        reconstructs. The same z, joined with graph features, feeds an MLP classifier whose sigmoid output is the probability
        that the drug treats the disease.
      </desc>
      <defs>
        <marker id="model-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill={ink3} />
        </marker>
      </defs>

      {/* loss terms (dashed accent) */}
      <g fill="none" stroke="var(--accent)" strokeWidth="1.25" strokeDasharray="4 4">
        <path d="M83 110 V30 H881 V110" />
        <path d="M404 64 V102" />
        <path d="M876 322 V338" />
      </g>
      <text x="482" y="22" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--accent)">
        Reconstruction loss · MSE(x, x̂)
      </text>
      <text x="404" y="56" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--accent)">
        KL divergence · KL( q(z | x) ‖ N(0, I) )
      </text>
      <text x="956" y="352" textAnchor="end" fontSize="12" fontWeight="600" fill="var(--accent)">
        Classification loss · weighted BCE
      </text>

      {/* data flow arrows */}
      <g fill="none" stroke={ink3} strokeWidth="1.5" markerEnd="url(#model-arrow)">
        <path d="M158 160 H194" />
        <path d="M320 160 L354 125" />
        <path d="M320 160 L354 195" />
        <path d="M452 124 L481 149" />
        <path d="M452 196 L481 171" />
        <path d="M513 160 H536" />
        <path d="M610 160 H648" />
        <path d="M774 160 H804" />
        <path d="M574 188 V270" />
        <path d="M490 300 H518" />
        <path d="M720 300 H743" />
        <path d="M775 300 H794" />
      </g>
      <text x="583" y="236" fontSize="12" fontFamily="var(--font-mono)" fill={ink3}>
        z
      </text>

      {/* encoder path */}
      <Box
        x={8}
        y={110}
        w={150}
        h={100}
        lines={[
          { text: 'Drug features', size: 13, weight: 600 },
          { text: `x · ${dims}-d`, mono: true, fill: ink2 },
          { text: `${bits}-bit Morgan FP`, fill: ink3 },
          { text: `+ ${nDesc} RDKit descriptors`, fill: ink3 },
        ]}
      />
      <Box
        x={196}
        y={122}
        w={124}
        h={76}
        fill="var(--paper-3)"
        lines={[
          { text: 'Encoder', size: 13, weight: 600 },
          { text: `${dims} → ${hidden} → ${latent}`, mono: true, fill: ink2 },
        ]}
      />
      <Box x={356} y={102} w={96} h={44} lines={[{ text: 'μ', size: 14, weight: 600 }, { text: `${latent}-d`, mono: true, fill: ink3 }]} />
      <Box x={356} y={174} w={96} h={44} lines={[{ text: 'log σ²', size: 14, weight: 600 }, { text: `${latent}-d`, mono: true, fill: ink3 }]} />

      {/* reparameterisation */}
      <circle cx="496" cy="160" r="17" fill="var(--paper)" stroke={ink2} strokeWidth="1.5" />
      <path d="M496 151 V169 M487 160 H505" stroke={ink} strokeWidth="1.75" strokeLinecap="round" />
      <text x="496" y="198" textAnchor="middle" fontSize="12" fill={ink3}>
        reparameterise
      </text>
      <text x="496" y="214" textAnchor="middle" fontSize="12" fontFamily="var(--font-mono)" fill={ink3}>
        z = μ + σ ⊙ ε, ε ~ N(0, I)
      </text>

      {/* latent */}
      <Box
        x={538}
        y={132}
        w={72}
        h={56}
        fill="var(--accent)"
        lines={[
          { text: 'z', size: 22, serif: true, italic: true, fill: 'var(--paper)' },
          { text: `${latent}-d`, mono: true, fill: 'var(--accent-soft)' },
        ]}
      />

      {/* decoder path */}
      <Box
        x={650}
        y={122}
        w={124}
        h={76}
        fill="var(--paper-3)"
        lines={[
          { text: 'Decoder', size: 13, weight: 600 },
          { text: `${latent} → ${hidden} → ${dims}`, mono: true, fill: ink2 },
        ]}
      />
      <Box
        x={806}
        y={110}
        w={150}
        h={100}
        lines={[
          { text: 'Reconstruction', size: 13, weight: 600 },
          { text: `x̂ · ${dims}-d`, mono: true, fill: ink2 },
          { text: 'predicted features', fill: ink3 },
        ]}
      />

      {/* classifier branch */}
      <Box
        x={300}
        y={272}
        w={190}
        h={56}
        lines={[
          { text: 'Graph features', size: 13, weight: 600 },
          { text: 'targets · pathways · PPI hops', fill: ink3 },
        ]}
      />
      <Box
        x={520}
        y={272}
        w={200}
        h={56}
        fill="var(--paper-3)"
        lines={[
          { text: 'MLP classifier', size: 13, weight: 600 },
          { text: '[ z ‖ graph features ]', mono: true, fill: ink2 },
        ]}
      />
      <circle cx="760" cy="300" r="15" fill="var(--paper)" stroke={ink2} strokeWidth="1.5" />
      <text x="760" y="305" textAnchor="middle" fontSize="15" fontFamily="var(--font-display)" fontStyle="italic" fill={ink}>
        σ
      </text>
      <Box x={796} y={278} w={160} h={44} fill="var(--accent)" lines={[{ text: 'p(drug treats disease)', size: 12, weight: 600, fill: 'var(--paper)' }]} />
    </svg>
  )
}

/** Rounded box with centred text lines, for the architecture diagram. */
function Box({ x, y, w, h, fill = 'var(--paper-2)', lines, r = 8 }) {
  const lh = 17
  const n = lines.length
  const first = y + h / 2 - ((n - 1) * lh) / 2 + 4.5
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} />
      {lines.map((l, i) => (
        <text
          key={l.text}
          x={x + w / 2}
          y={first + i * lh}
          textAnchor="middle"
          fontSize={l.size || 12}
          fontWeight={l.weight || 400}
          fontFamily={l.mono ? 'var(--font-mono)' : l.serif ? 'var(--font-display)' : undefined}
          fontStyle={l.italic ? 'italic' : undefined}
          fill={l.fill || 'var(--ink)'}
        >
          {l.text}
        </text>
      ))}
    </g>
  )
}

/* ------------------------------------------------------------------ skeleton */

function ModelSkeleton() {
  return (
    <div className="container model" aria-busy="true" aria-label="Loading the model card">
      <header className="page-head model-head">
        <span className="eyebrow skeleton model-skel__eyebrow">Model card</span>
        <span className="h1 skeleton model-skel__title">Loading</span>
        <span className="lede skeleton model-skel__lede">Loading</span>
        <div className="model-head__stats">
          {['AUPRC', 'AUROC', 'F1'].map((k) => (
            <div key={k} className="stat">
              <span className="stat__value skeleton">0.000</span>
              <span className="stat__label skeleton">{k}</span>
            </div>
          ))}
        </div>
      </header>
      <div className="model-layout">
        <div className="model-toc">
          <ol className="model-toc__list">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <span className="model-toc__link skeleton">{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="model-body">
          <div className="model-section">
            <div className="model-section__head">
              <span className="eyebrow skeleton model-skel__eyebrow">Architecture</span>
              <span className="h2 skeleton model-skel__h2">Loading</span>
            </div>
            <div className="skeleton model-skel__diagram" />
          </div>
          <div className="model-section">
            <div className="model-section__head">
              <span className="eyebrow skeleton model-skel__eyebrow">Hyper-parameters</span>
              <span className="h2 skeleton model-skel__h2">Loading</span>
            </div>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="skeleton model-skel__row" />
            ))}
          </div>
          <div className="model-section">
            <div className="model-section__head">
              <span className="eyebrow skeleton model-skel__eyebrow">Performance</span>
              <span className="h2 skeleton model-skel__h2">Loading</span>
            </div>
            <div className="model-charts">
              <div className="skeleton model-skel__chart" />
              <div className="skeleton model-skel__chart" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ helpers */

/** Track which section is under the reading line, for the contents column. */
function useActiveSection(ids, ready) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    if (!ready || typeof window === 'undefined' || !('IntersectionObserver' in window)) return undefined
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean)
    if (!els.length) return undefined
    const inView = new Set()
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) inView.add(e.target.id)
          else inView.delete(e.target.id)
        })
        const first = ids.find((id) => inView.has(id))
        if (first) setActive(first)
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [ids, ready])
  return active
}

/** "0.79 – 0.90" → [0.79, 0.9] */
function parseBucket(label) {
  const mt = String(label || '').match(/([\d.]+)\s*[–-]\s*([\d.]+)/)
  if (!mt) return null
  const lo = Number(mt[1])
  const hi = Number(mt[2])
  if (Number.isNaN(lo) || Number.isNaN(hi)) return null
  return [lo, hi]
}

/** "Drug-level 70 / 15 / 15" → [70, 15, 15] */
function parseSplit(text) {
  const mt = String(text || '').match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/)
  if (!mt) return null
  return [Number(mt[1]), Number(mt[2]), Number(mt[3])]
}
