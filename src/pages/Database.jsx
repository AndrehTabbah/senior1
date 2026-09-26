import { useEffect } from 'react'
import SearchBar from '../components/SearchBar.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { Icon } from '../components/Icons.jsx'
import { api, USE_MOCK } from '../api/index.js'
import { useApi } from '../hooks/useApi.js'
import { fmtInt, fmtCompact, fmtPct, fmtDate, cx } from '../utils/format.js'
import './database.css'

/* Five shades for the five relation types, darkest emphasis first. */
const EDGE_COLOURS = ['var(--accent)', 'var(--accent-hover)', 'var(--ink)', 'var(--ink-3)', 'var(--ink-4)']

const SOURCE_COLUMNS = ['Source', 'Records', 'Role', 'Kind', 'Version', 'Licence']
const MATRIX_COLUMNS = ['Matrix', 'Shape', 'Type', 'Non-zero', 'Sparsity']

export default function Database() {
  const sources = useApi((signal) => api.sources({ signal }), [])
  const stats = useApi((signal) => api.stats({ signal }), [])

  useEffect(() => {
    document.title = 'Database · Dawa'
  }, [])

  const error = sources.error || stats.error
  const retry = () => {
    if (sources.error) sources.reload()
    if (stats.error) stats.reload()
  }

  const ent = stats.data?.entities
  const edges = stats.data?.edges
  const matrices = stats.data?.matrices
  const mockIndex = stats.data?.mockIndex

  return (
    <>
      {/* ------------------------------------------------ head */}
      <header className="container page-head db-head">
        <div className="eyebrow">Data</div>
        <h1 className="h1">Eleven sources, one graph.</h1>
        <p className="lede">
          Every record in the index is mapped to a canonical identifier: <span className="mono">drug_uid</span> for
          molecules, Entrez for genes, MeSH and UMLS CUI for diseases. A query resolved in one database can therefore
          hop across all of them, which is what lets a prediction cite the edges that produced it.
        </p>
        <div className="db-lookup" role="group" aria-labelledby="db-lookup-label">
          <div id="db-lookup-label" className="field__label db-lookup__label">
            Look up an entity
          </div>
          <SearchBar size="md" showTypes={false} showHint={false} placeholder="Drug, disease, compound or SMILES…" />
        </div>
      </header>

      {error ? (
        <div className="container">
          <ErrorState
            title="The index could not be loaded"
            text={error.message || 'The request to the data service failed.'}
            onRetry={retry}
          />
        </div>
      ) : (
        <>
          {/* ------------------------------------------------ index at a glance */}
          <section className="container db-index" aria-label="Index at a glance">
            <div className="db-index__grid">
              <Stat value={ent ? fmtInt(ent.drugs) : null} label="drugs" />
              <Stat value={ent ? fmtInt(ent.genes) : null} label="genes (Entrez)" />
              <Stat value={ent ? fmtInt(ent.diseases) : null} label="diseases (MeSH)" />
              <Stat value={ent ? fmtInt(ent.sideEffects) : null} label="side effects (MedDRA)" />
              <Stat value={edges ? fmtCompact(edges.total) : null} label="typed graph edges" accent />
              <p className={cx('db-index__built', !stats.data && 'skeleton')}>
                last built {stats.data ? fmtDate(stats.data.lastBuilt) : '00 Xxx 0000'}
              </p>
            </div>
          </section>

          {/* ------------------------------------------------ sources */}
          <section className="section section--tight db-sources" aria-labelledby="db-sources-title">
            <div className="container">
              <div className="db-sec__head">
                <div id="db-sources-title" className="eyebrow">
                  Sources
                </div>
                <p className="db-sec__lead">
                  Each database contributes one kind of edge or one kind of identifier; none of them is used for more
                  than it was curated for.
                </p>
              </div>
              <div className="table-wrap">
                <table className="table table--hover db-sources__table">
                  <thead>
                    <tr>
                      {SOURCE_COLUMNS.map((c) => (
                        <th key={c} scope="col">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sources.data
                      ? sources.data.sources.map((s) => (
                          <tr key={s.id}>
                            <td data-label="Source">
                              <a href={s.url} target="_blank" rel="noopener noreferrer" className="db-src__name">
                                {s.name}
                                <Icon.External size={12} />
                              </a>
                              <div className="small muted db-src__desc">{s.description}</div>
                            </td>
                            <td data-label="Records" className="mono num db-src__records">
                              {s.recordLabel}
                            </td>
                            <td data-label="Role">{s.role}</td>
                            <td data-label="Kind">
                              <span className="tag">{s.kind}</span>
                            </td>
                            <td data-label="Version" className="mono">
                              {s.version}
                            </td>
                            <td data-label="Licence" className="small muted">
                              {s.license}
                            </td>
                          </tr>
                        ))
                      : Array.from({ length: 11 }, (_, i) => (
                          <tr key={i}>
                            <td data-label="Source">
                              <Sk w="7rem" />
                              <br />
                              <Sk w="18rem" h="0.8em" />
                            </td>
                            <td data-label="Records">
                              <Sk w="6rem" />
                            </td>
                            <td data-label="Role">
                              <Sk w="7rem" />
                            </td>
                            <td data-label="Kind">
                              <Sk w="3.5rem" />
                            </td>
                            <td data-label="Version">
                              <Sk w="3rem" />
                            </td>
                            <td data-label="Licence">
                              <Sk w="6rem" />
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------ edge composition */}
          <section className="section section--paper-2 db-edges" aria-labelledby="db-edges-title">
            <div className="container db-edges__grid">
              <div className="db-edges__text">
                <div id="db-edges-title" className="eyebrow">
                  Edge composition
                </div>
                <h2 className="h2">Five relation types, one namespace.</h2>
                {edges ? <EdgeNote byType={edges.byType} /> : <SkParagraph lines={4} />}
              </div>
              <div className="db-edges__chart">
                {edges ? (
                  <>
                    <EdgeBar types={edges.byType} />
                    <ol className="db-legend">
                      {edges.byType.map((t, i) => (
                        <li key={t.type} className="db-legend__item">
                          <span className="db-legend__swatch" style={{ background: EDGE_COLOURS[i % EDGE_COLOURS.length] }} aria-hidden="true" />
                          <span className="db-legend__type">{t.type}</span>
                          <span className="mono num db-legend__count">{fmtInt(t.count)}</span>
                          <span className="mono num muted db-legend__pct">{fmtPct(t.share, 1)}</span>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <>
                    <div className="db-bar-wrap skeleton" aria-hidden="true" />
                    <ol className="db-legend" aria-hidden="true">
                      {Array.from({ length: 5 }, (_, i) => (
                        <li key={i} className="db-legend__item">
                          <span className="db-legend__swatch skeleton" />
                          <Sk w="8rem" />
                          <Sk w="5rem" />
                          <Sk w="3rem" />
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* ------------------------------------------------ feature matrices */}
          <section className="section section--tight db-matrices" aria-labelledby="db-matrices-title">
            <div className="container db-split">
              <div className="db-split__side">
                <div id="db-matrices-title" className="eyebrow">
                  Feature matrices
                </div>
                <p className="small db-split__text">
                  The graph is materialised as one dense descriptor block and four sparse adjacency matrices (CSR).
                  Sparsity is the fraction of cells that are zero; the model only ever touches the non-zero entries.
                </p>
              </div>
              <div className="db-split__main table-wrap">
                <table className="table table--hover db-matrices__table">
                  <thead>
                    <tr>
                      {MATRIX_COLUMNS.map((c, i) => (
                        <th key={c} scope="col" className={i >= 3 ? 'num' : undefined}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrices
                      ? matrices.map((m) => (
                          <tr key={m.name}>
                            <td className="db-matrices__name">{m.name}</td>
                            <td className="mono num">{m.shape}</td>
                            <td>{m.type}</td>
                            <td className="mono num">{m.nonZero}</td>
                            <td className="mono num">{m.sparsity === null || m.sparsity === undefined ? '—' : fmtPct(m.sparsity, 2)}</td>
                          </tr>
                        ))
                      : Array.from({ length: 5 }, (_, i) => (
                          <tr key={i}>
                            <td>
                              <Sk w="8rem" />
                            </td>
                            <td className="num">
                              <Sk w="7rem" />
                            </td>
                            <td>
                              <Sk w="5rem" />
                            </td>
                            <td className="num">
                              <Sk w="5rem" />
                            </td>
                            <td className="num">
                              <Sk w="4rem" />
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------ standardised tables */}
          <section className="section section--tight db-tables" aria-labelledby="db-tables-title">
            <div className="container db-split">
              <div className="db-split__side">
                <div id="db-tables-title" className="eyebrow">
                  Standardised tables
                </div>
                <p className="small db-split__text">
                  Six Parquet files are the only artefact the model reads. Every column is a canonical id or a value
                  derived from one, so a file can be rebuilt from any source that maps to the namespace.
                </p>
              </div>
              <ul className="db-split__main db-filelist">
                {sources.data
                  ? sources.data.tables.map((t) => (
                      <li key={t.file} className="db-file">
                        <div className="db-file__id">
                          <span className="h4 mono db-file__name">{t.file}</span>
                          <p className="small muted db-file__desc">{t.description}</p>
                        </div>
                        <ul className="db-file__cols" aria-label="Columns">
                          {t.columns.map((c) => (
                            <li key={c} className="tag tag--mono">
                              {c}
                            </li>
                          ))}
                        </ul>
                        <div className="db-file__rows">
                          <span className="mono num db-file__rows-n">{t.rowsLabel}</span>
                          <span className="tiny muted">rows</span>
                        </div>
                      </li>
                    ))
                  : Array.from({ length: 6 }, (_, i) => (
                      <li key={i} className="db-file" aria-hidden="true">
                        <div className="db-file__id">
                          <Sk w="14rem" h="1.2em" />
                          <br />
                          <Sk w="20rem" h="0.8em" />
                        </div>
                        <div className="db-file__cols">
                          <Sk w="4.5rem" />
                          <Sk w="4.5rem" />
                          <Sk w="4.5rem" />
                        </div>
                        <div className="db-file__rows">
                          <Sk w="3rem" />
                        </div>
                      </li>
                    ))}
              </ul>
            </div>
          </section>

          {/* ------------------------------------------------ preprocessing */}
          <section className="section section--ink db-prep" aria-labelledby="db-prep-title">
            <div className="container">
              <div className="db-prep__head">
                <div id="db-prep-title" className="eyebrow">
                  Preprocessing decisions
                </div>
                <h2 className="h2">Where the data was reshaped, and what that cost.</h2>
              </div>
              <ol className="db-prep__list">
                {sources.data
                  ? sources.data.preprocessing.map((p) => (
                      <li key={p.title} className="db-prep__item">
                        <strong>{p.title}</strong>
                        <span>{p.text}</span>
                      </li>
                    ))
                  : Array.from({ length: 4 }, (_, i) => (
                      <li key={i} className="db-prep__item" aria-hidden="true">
                        <Sk w="9rem" />
                        <SkParagraph lines={2} />
                      </li>
                    ))}
              </ol>
            </div>
          </section>

          {/* ------------------------------------------------ mock note */}
          {USE_MOCK ? (
            <section className="container db-note">
              <p className="notice">
                The in-browser index used while the backend is being built contains a curated subset (
                {mockIndex ? `${fmtInt(mockIndex.drugs)} drugs, ${fmtInt(mockIndex.diseases)} diseases` : '50 drugs, 62 diseases'}
                ); production numbers above come from the full dataset build.
              </p>
            </section>
          ) : null}
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

function Stat({ value, label, accent }) {
  return (
    <div className={cx('stat', accent && 'stat--accent')}>
      <span className={cx('stat__value', !value && 'skeleton')}>{value || '00,000'}</span>
      <span className="stat__label">{label}</span>
    </div>
  )
}

/** Inline skeleton bar sized to the text it stands in for. */
function Sk({ w, h }) {
  return <span className="skeleton db-sk" style={{ width: w, height: h }} aria-hidden="true" />
}

function SkParagraph({ lines }) {
  const widths = ['100%', '92%', '96%', '70%']
  return (
    <div className="db-sk-para" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Sk key={i} w={widths[i % widths.length]} h="0.85em" />
      ))}
    </div>
  )
}

/** Single horizontal stacked bar of edge shares. Widths are proportional to share. */
function EdgeBar({ types }) {
  const total = types.reduce((sum, t) => sum + t.share, 0) || 1
  let x = 0
  const segments = types.map((t, i) => {
    const w = (t.share / total) * 1000
    const seg = { x, w, colour: EDGE_COLOURS[i % EDGE_COLOURS.length], type: t.type }
    x += w
    return seg
  })
  const label = `Edge composition: ${types.map((t) => `${t.type} ${fmtPct(t.share, 1)}`).join(', ')}`
  return (
    <div className="db-bar-wrap">
      <svg className="db-bar" viewBox="0 0 1000 36" preserveAspectRatio="none" role="img" aria-label={label}>
        <title>{label}</title>
        {segments.map((s) => (
          <rect key={s.type} x={s.x.toFixed(2)} y="0" width={Math.max(s.w - 2, 1).toFixed(2)} height="36" fill={s.colour} />
        ))}
      </svg>
    </div>
  )
}

function EdgeNote({ byType }) {
  const sorted = [...byType].sort((a, b) => b.share - a.share)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]
  return (
    <div className="db-edges__note">
      <p>
        The graph is heavily skewed. {capitalise(top.type)} edges alone account for {fmtPct(top.share, 1)} of all
        edges, while {bottom.type} edges account for {fmtPct(bottom.share, 1)}. Read naively, a classifier would learn
        the shape of the largest relation rather than the drug–disease signal it is asked to predict.
      </p>
      <p>
        Training therefore uses weighted negative sampling: negatives are drawn in proportion to each relation type's
        information, not its size, so the sparse relations are not drowned out by the dense ones.
      </p>
    </div>
  )
}

function capitalise(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}
