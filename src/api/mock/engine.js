/* ------------------------------------------------------------------
   Mock inference engine.
   Deterministic (seeded by entity ids) so the same query always gives
   the same answer. Scores combine target overlap, pathway co-membership,
   PPI proximity, curated prior knowledge and a small hashed "model
   noise" term, then pass through a sigmoid — the same shape of signal
   the real VAE + MLP consumes.
   ------------------------------------------------------------------ */
import { GENES, PATHWAYS, PPI } from './genes.js'
import { DRUGS } from './drugs.js'
import { DISEASES } from './diseases.js'
import { CURATED } from './curated.js'
import { MODEL } from './model.js'
import { looksLikeSmiles, validateSmiles } from '../../utils/detectInput.js'

export const DEFAULT_THRESHOLD = MODEL.threshold

/* ---------- deterministic pseudo-random ---------------------------- */
export function hash32(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
/** Uniform in [0, 1) seeded by a string. */
export function rand(seed) {
  return (hash32(seed) % 100000) / 100000
}
const sigmoid = (x) => 1 / (1 + Math.exp(-x))
const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d

/* ---------- indexes ------------------------------------------------ */
const drugById = new Map(DRUGS.map((d) => [d.id, d]))
const diseaseById = new Map(DISEASES.map((d) => [d.id, d]))
const pathwayById = new Map(PATHWAYS.map((p) => [p.id, p]))

const pathwaysByGene = new Map()
PATHWAYS.forEach((p) =>
  p.genes.forEach((g) => {
    if (!pathwaysByGene.has(g)) pathwaysByGene.set(g, [])
    pathwaysByGene.get(g).push(p.id)
  }),
)

const ppiNeighbors = new Map()
PPI.forEach(([a, b]) => {
  if (!ppiNeighbors.has(a)) ppiNeighbors.set(a, new Set())
  if (!ppiNeighbors.has(b)) ppiNeighbors.set(b, new Set())
  ppiNeighbors.get(a).add(b)
  ppiNeighbors.get(b).add(a)
})

const curatedIndex = new Map(CURATED.map((c) => [`${c.drug}|${c.disease}`, c]))
const curatedByDisease = new Map()
CURATED.forEach((c) => {
  if (!curatedByDisease.has(c.disease)) curatedByDisease.set(c.disease, [])
  curatedByDisease.get(c.disease).push(c)
})

/* Novel (SMILES-only) compounds created during the session. */
const NOVEL = new Map()
const NOVEL_KEY = 'dawa.mock.novel'
try {
  const raw = sessionStorage.getItem(NOVEL_KEY)
  if (raw) JSON.parse(raw).forEach((e) => NOVEL.set(e.id, e))
} catch {
  /* ignore */
}
function persistNovel() {
  try {
    sessionStorage.setItem(NOVEL_KEY, JSON.stringify([...NOVEL.values()]))
  } catch {
    /* ignore */
  }
}

/* ---------- helpers ------------------------------------------------ */
export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function pathwaySet(genes) {
  const s = new Set()
  genes.forEach((g) => (pathwaysByGene.get(g) || []).forEach((p) => s.add(p)))
  return s
}

function bigrams(s) {
  const out = new Set()
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2))
  return out
}
function jaccardSets(a, b) {
  if (!a.size && !b.size) return 0
  let inter = 0
  a.forEach((x) => b.has(x) && inter++)
  return inter / (a.size + b.size - inter)
}
function smilesSimilarity(a, b) {
  if (!a || !b) return 0
  return jaccardSets(bigrams(a), bigrams(b))
}

export function getDrug(id) {
  return drugById.get(id) || NOVEL.get(id) || null
}
export function getDisease(id) {
  return diseaseById.get(id) || null
}
export function getEntity(id) {
  return getDrug(id) || getDisease(id)
}

function entitySummary(e) {
  if (!e) return null
  const base = { id: e.id, name: e.name, kind: e.kind || 'disease' }
  if (e.kind === 'disease' || !e.kind) return { ...base, category: e.category }
  return { ...base, area: e.area, approvedUse: e.approvedUse, novel: !!e.novel }
}

/* ---------- search / autocomplete ---------------------------------- */
export function search(q, limit = 8) {
  const nq = normalize(q)
  if (!nq) return []
  const scored = []
  const all = [...DRUGS, ...DISEASES]
  for (const e of all) {
    const names = [e.name, ...(e.synonyms || [])]
    let best = 0
    let matchedOn = null
    for (const n of names) {
      const nn = normalize(n)
      let s = 0
      if (nn === nq) s = 100
      else if (nn.startsWith(nq)) s = 80 - Math.min(20, (nn.length - nq.length) * 0.4)
      else if (nn.split(' ').some((w) => w.startsWith(nq))) s = 60
      else if (nn.includes(nq)) s = 40
      if (s > best) {
        best = s
        matchedOn = n === e.name ? null : n
      }
    }
    if (normalize(e.id) === nq) {
      best = 100
      matchedOn = e.id
    }
    if (best > 0) scored.push({ score: best, e, matchedOn })
  }
  scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
  return scored.slice(0, limit).map(({ e, matchedOn }) => ({
    id: e.id,
    name: e.name,
    kind: e.kind || 'disease',
    subtitle: e.kind ? `${e.id} · ${e.approvedUse || 'Compound'}` : `${e.id} · ${e.category}`,
    matchedOn,
  }))
}

/* ---------- SMILES featurisation (approximate, mock only) ---------- */
const ATOMIC_WEIGHT = { C: 12.011, N: 14.007, O: 15.999, S: 32.06, P: 30.974, F: 18.998, Cl: 35.45, Br: 79.904, I: 126.9, B: 10.81, Si: 28.085, Li: 6.94, Na: 22.99, K: 39.098 }

export function featurize(smiles) {
  const s = smiles.trim()
  const atoms = []
  let i = 0
  let rings = 0
  const ringLabels = new Map()
  let aromatic = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === '[') {
      const j = s.indexOf(']', i)
      const inner = s.slice(i + 1, j)
      const m = inner.match(/^(\d*)([A-Z][a-z]?|[a-z])/)
      if (m) {
        const sym = m[2]
        const isArom = /^[a-z]$/.test(sym)
        atoms.push({ sym: isArom ? sym.toUpperCase() : sym, aromatic: isArom, h: (inner.match(/H(\d*)/) || [])[1] === undefined ? (inner.includes('H') ? 1 : 0) : Number((inner.match(/H(\d*)/) || [])[1] || 1) })
        if (isArom) aromatic++
      }
      i = j + 1
      continue
    }
    if (ch === 'C' && s[i + 1] === 'l') {
      atoms.push({ sym: 'Cl', aromatic: false })
      i += 2
      continue
    }
    if (ch === 'B' && s[i + 1] === 'r') {
      atoms.push({ sym: 'Br', aromatic: false })
      i += 2
      continue
    }
    if (/[BCNOPSFI]/.test(ch)) {
      atoms.push({ sym: ch, aromatic: false })
      i++
      continue
    }
    if (/[bcnops]/.test(ch)) {
      atoms.push({ sym: ch.toUpperCase(), aromatic: true })
      aromatic++
      i++
      continue
    }
    if (ch === '%') {
      const lbl = s.slice(i + 1, i + 3)
      ringLabels.set(lbl, (ringLabels.get(lbl) || 0) + 1)
      i += 3
      continue
    }
    if (/\d/.test(ch)) {
      ringLabels.set(ch, (ringLabels.get(ch) || 0) + 1)
      i++
      continue
    }
    i++
  }
  ringLabels.forEach((count) => (rings += Math.floor(count / 2)))
  const heavy = atoms.length
  const count = (sym) => atoms.filter((a) => a.sym === sym).length
  const nC = count('C')
  const nN = count('N')
  const nO = count('O')
  const nHal = count('F') + count('Cl') + count('Br') + count('I')
  const nS = count('S')
  let molWt = atoms.reduce((acc, a) => acc + (ATOMIC_WEIGHT[a.sym] || 12), 0)
  // crude implicit hydrogen estimate
  const hEst = Math.max(0, Math.round(nC * 1.6 + nN * 0.8 + nO * 0.5 - rings * 2 - aromatic * 0.5))
  molWt += hEst * 1.008
  const aromaticRings = Math.round(aromatic / 5.5)
  const hbd = Math.min(nO + nN, (s.match(/O(?![=A-Za-z0-9(])|\[nH\]|N(?![=A-Za-z0-9(])/g) || []).length + (s.match(/\(O\)/g) || []).length)
  const hba = nN + nO
  const rotB = Math.max(0, Math.round(heavy / 4.5 - rings * 0.6))
  const logP = round(0.35 * nC - 0.85 * nN - 0.6 * nO + 0.55 * nHal + 0.4 * nS - 0.05 * heavy + 0.3, 2)
  const tpsa = round(nO * 17.1 + nN * 12.4 + (s.includes('[nH]') ? 3.5 : 0), 1)
  const sp3 = Math.max(0, nC - aromatic - (s.match(/=/g) || []).length)
  return {
    molWt: round(molWt, 2),
    logP,
    tpsa,
    hbd,
    hba,
    rotB,
    rings,
    aromaticRings,
    heavyAtoms: heavy,
    fracCsp3: nC ? round(sp3 / nC, 2) : 0,
    estimated: true,
  }
}

function nearestDrugs(smiles, descriptors, k = 6, excludeId = null) {
  const bg = bigrams(smiles)
  return DRUGS.filter((d) => d.smiles && d.id !== excludeId)
    .map((d) => {
      const strSim = jaccardSets(bg, bigrams(d.smiles))
      let descSim = 0
      if (d.descriptors && descriptors) {
        const dw = Math.abs(Math.log((d.descriptors.molWt + 1) / (descriptors.molWt + 1)))
        const dl = Math.abs(d.descriptors.logP - descriptors.logP) / 6
        const dt = Math.abs(d.descriptors.tpsa - descriptors.tpsa) / 150
        descSim = Math.max(0, 1 - (dw + dl + dt) / 3)
      }
      return { id: d.id, name: d.name, similarity: round(0.65 * strSim + 0.35 * descSim, 3) }
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
}

export function novelCompound(smiles) {
  const clean = smiles.trim()
  const id = `NOVEL-${hash32(clean).toString(16).toUpperCase().padStart(8, '0').slice(0, 8)}`
  if (NOVEL.has(id)) return NOVEL.get(id)
  const descriptors = featurize(clean)
  const neighbors = nearestDrugs(clean, descriptors, 6)
  // Inherit the most common targets of the nearest neighbours (weighted).
  const targetWeight = new Map()
  neighbors.forEach((n) => {
    const d = drugById.get(n.id)
    d.targets.forEach((t) => targetWeight.set(t, (targetWeight.get(t) || 0) + n.similarity))
  })
  const targets = [...targetWeight.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t)
  const entity = {
    id,
    kind: 'compound',
    novel: true,
    name: 'Unregistered compound',
    synonyms: [],
    smiles: clean,
    formula: null,
    atc: null,
    area: drugById.get(neighbors[0]?.id)?.area || 'Other',
    descriptors,
    targets,
    inferredTargets: true,
    indications: [],
    approvedUse: null,
    sideEffects: [],
    neighbors,
    summary: 'Not present in DrugBank or ChEMBL. Descriptors were computed from the SMILES string and the target profile was inherited from the nearest neighbours in latent space, so treat predictions as exploratory.',
  }
  NOVEL.set(id, entity)
  persistNovel()
  return entity
}

/* ---------- resolution --------------------------------------------- */
export class MockError extends Error {
  constructor(message, status = 400, code = 'bad_request') {
    super(message)
    this.status = status
    this.code = code
  }
}

export function resolve({ query, type = 'auto', id }) {
  if (id) {
    const e = getEntity(id)
    if (!e) throw new MockError(`No entity with id "${id}".`, 404, 'not_found')
    return e
  }
  const q = String(query || '').trim()
  if (!q) throw new MockError('Enter a drug, disease, compound or SMILES string.', 400, 'empty_query')

  const wantsSmiles = type === 'smiles' || (type === 'auto' && looksLikeSmiles(q))
  if (wantsSmiles) {
    const v = validateSmiles(q)
    if (!v.valid) throw new MockError(`That does not parse as SMILES: ${v.reason}.`, 422, 'invalid_smiles')
    const exact = DRUGS.find((d) => d.smiles === q)
    if (exact) return exact
    return novelCompound(q)
  }

  const kinds = type === 'auto' ? null : type === 'drug' ? ['drug'] : type === 'compound' ? ['compound'] : ['disease']
  const hits = search(q, 12).filter((h) => !kinds || kinds.includes(h.kind))
  if (!hits.length) {
    const hint = type === 'auto' ? '' : ` as a ${type}`
    throw new MockError(`Nothing in the index matches "${q}"${hint}. Try a generic drug name, a MeSH disease term or a SMILES string.`, 404, 'not_found')
  }
  return getEntity(hits[0].id)
}

/* ---------- scoring ------------------------------------------------ */
function pairFeatures(drug, disease) {
  const targets = new Set(drug.targets || [])
  const genes = new Set(disease.genes || [])
  const shared = [...targets].filter((g) => genes.has(g))
  const union = new Set([...targets, ...genes]).size
  const geneJ = union ? shared.length / union : 0

  const hop = new Set()
  targets.forEach((t) => (ppiNeighbors.get(t) || []).forEach((n) => genes.has(n) && !targets.has(n) && hop.add(n)))

  const dP = pathwaySet([...targets])
  const sP = pathwaySet([...genes])
  const sharedPathways = [...dP].filter((p) => sP.has(p))
  const pUnion = new Set([...dP, ...sP]).size
  const pathJ = pUnion ? sharedPathways.length / pUnion : 0

  const curated = curatedIndex.get(`${drug.id}|${disease.id}`) || null
  const known = (drug.indications || []).includes(disease.id)
  const areaMatch = drug.area && drug.area === disease.category
  const seed = `${drug.id}|${disease.id}`
  return { shared, hop: [...hop], sharedPathways, geneJ, pathJ, curated, known, areaMatch, seed }
}

function contributions(f) {
  const n1 = (rand(`${f.seed}|fp`) - 0.5) * 1.1
  const n2 = (rand(`${f.seed}|desc`) - 0.5) * 0.7
  const n3 = (rand(`${f.seed}|se`) - 0.5) * 0.5
  const parts = [
    { key: 'bias', label: 'Base rate (prior)', value: -3.0 },
    { key: 'targets', label: 'Shared targets (drug–target ∩ gene–disease)', value: 6.0 * f.geneJ + 0.3 * Math.min(f.shared.length, 4) },
    { key: 'pathways', label: 'Pathway co-membership', value: 2.0 * f.pathJ + 0.1 * Math.min(f.sharedPathways.length, 6) },
    { key: 'ppi', label: 'PPI network proximity (1-hop)', value: 0.3 * Math.min(f.hop.length, 4) },
    { key: 'prior', label: 'Curated knowledge-graph edges (CTD / literature)', value: f.curated ? f.curated.boost : 0 },
    { key: 'known', label: 'Approved indication (DrugBank)', value: f.known ? 3.8 : 0 },
    { key: 'area', label: 'Therapeutic-area affinity', value: f.areaMatch ? 0.5 : 0 },
    { key: 'fingerprint', label: 'Morgan fingerprint bits (latent z)', value: n1 },
    { key: 'descriptors', label: 'RDKit descriptors (latent z)', value: n2 },
    { key: 'sideEffects', label: 'Side-effect profile similarity', value: n3 },
  ].map((p) => ({ ...p, value: round(p.value) }))
  const logit = parts.reduce((a, p) => a + p.value, 0)
  return { parts, logit, confidence: round(sigmoid(logit)) }
}

const OUTCOME_LABEL = { positive: 'Positive', mixed: 'Mixed', negative: 'Negative', ongoing: 'Ongoing', approved: 'Approved' }

function evidenceFor(drug, disease, f) {
  const ev = []
  const seed = f.seed
  if (f.known) ev.push({ source: 'DrugBank', kind: 'approved', label: 'Approved indication', detail: drug.approvedUse })
  if (f.curated) {
    ev.push({ source: 'ClinicalTrials.gov', kind: 'trial', label: `${f.curated.phase} · ${OUTCOME_LABEL[f.curated.outcome]}`, detail: f.curated.trial, year: f.curated.year, outcome: f.curated.outcome, url: `https://clinicaltrials.gov/search?term=${encodeURIComponent(`${drug.name} ${disease.name}`)}` })
    f.curated.refs.forEach((r) => ev.push({ source: r.source, kind: 'literature', label: r.title, url: r.url }))
  }
  if (f.curated || f.shared.length) {
    const count = f.curated ? 8 + (hash32(`${seed}|ctd`) % 40) : f.shared.length * 3 + (hash32(`${seed}|ctd`) % 6)
    ev.push({ source: 'CTD', kind: f.curated ? 'curated' : 'inferred', label: `${count} ${f.curated ? 'curated' : 'inferred'} chemical–disease relationships`, count })
  }
  if (f.shared.length || f.hop.length) {
    const score = round(Math.min(0.97, 0.18 + f.geneJ * 2.2 + f.pathJ * 0.8 + f.hop.length * 0.05), 2)
    ev.push({ source: 'Open Targets', kind: 'association', label: `Gene–disease association score ${score.toFixed(2)}`, score })
  }
  if ((drug.targets || []).length) ev.push({ source: 'DGIdb', kind: 'drug-gene', label: `${drug.targets.length} drug–gene interaction${drug.targets.length === 1 ? '' : 's'}`, count: drug.targets.length })
  if (f.hop.length) ev.push({ source: 'STRING', kind: 'ppi', label: `${f.hop.length} disease gene${f.hop.length === 1 ? '' : 's'} one PPI hop from a target`, count: f.hop.length })
  if (drug.smiles && !drug.novel) {
    const count = 12 + (hash32(`${seed}|chembl`) % 400)
    ev.push({ source: 'ChEMBL', kind: 'bioactivity', label: `${count} bioactivity records`, count })
  }
  if ((drug.sideEffects || []).length) ev.push({ source: 'SIDER', kind: 'side-effects', label: `${drug.sideEffects.length} labelled side effects`, count: drug.sideEffects.length })
  return ev
}

function mechanismFor(drug, disease, f) {
  if (f.curated) return f.curated.mechanism
  if (f.known) return `${drug.name} is an approved treatment for ${disease.name.toLowerCase()} (${drug.approvedUse}).`
  const bits = []
  if (f.shared.length) bits.push(`shares ${f.shared.length} target gene${f.shared.length === 1 ? '' : 's'} (${f.shared.slice(0, 3).join(', ')}${f.shared.length > 3 ? '…' : ''}) with the disease gene set`)
  if (f.sharedPathways.length) bits.push(`co-occurs in ${f.sharedPathways.length} pathway${f.sharedPathways.length === 1 ? '' : 's'}, led by ${pathwayById.get(f.sharedPathways[0]).name}`)
  if (f.hop.length && !f.shared.length) bits.push(`its targets sit one PPI hop from ${f.hop.slice(0, 2).join(' and ')}`)
  if (!bits.length) return 'Weak signal: no direct target or pathway overlap; score is driven mainly by the latent embedding.'
  return `${drug.name} ${bits.join(' and ')}.`
}

function predictionRow(drug, disease, f, c, targetEntity) {
  const topPathways = f.sharedPathways.slice(0, 3).map((p) => pathwayById.get(p).name)
  const evidence = evidenceFor(drug, disease, f)
  return {
    id: targetEntity.id,
    name: targetEntity.name,
    kind: targetEntity.kind || 'disease',
    category: targetEntity.category || targetEntity.area,
    confidence: c.confidence,
    known: f.known,
    sharedGenes: f.shared,
    ppiHops: f.hop,
    pathwayCount: f.sharedPathways.length,
    topPathways,
    mechanism: mechanismFor(drug, disease, f),
    trial: f.curated ? { phase: f.curated.phase, outcome: f.curated.outcome, name: f.curated.trial, year: f.curated.year } : null,
    evidenceCount: evidence.length,
    sources: [...new Set(evidence.map((e) => e.source))],
    pair: { drugId: drug.id, diseaseId: disease.id },
  }
}

/* ---------- predict ------------------------------------------------ */
export function predict({ query, type = 'auto', id, top_k = 15, threshold = DEFAULT_THRESHOLD }) {
  const entity = resolve({ query, type, id })
  const isDisease = !entity.kind || entity.kind === 'disease'
  const direction = isDisease ? 'disease_to_drug' : 'drug_to_disease'
  const topK = Math.max(1, Math.min(50, Number(top_k) || 15))
  const thr = Math.max(0, Math.min(1, Number(threshold) || DEFAULT_THRESHOLD))

  let rows
  if (isDisease) {
    rows = DRUGS.map((drug) => {
      const f = pairFeatures(drug, entity)
      const c = contributions(f)
      return predictionRow(drug, entity, f, c, drug)
    })
  } else {
    rows = DISEASES.map((disease) => {
      const f = pairFeatures(entity, disease)
      const c = contributions(f)
      let row = predictionRow(entity, disease, f, c, disease)
      if (entity.novel) row = { ...row, confidence: round(row.confidence * 0.85), inherited: true }
      return row
    })
  }

  rows.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name))
  const predictions = rows.slice(0, topK).map((r, i) => ({ rank: i + 1, ...r, aboveThreshold: r.confidence >= thr }))

  return {
    direction,
    query: { raw: query || null, type, id: id || null },
    entity: { ...entity, kind: entity.kind || 'disease' },
    threshold: thr,
    topK,
    model: { name: MODEL.name, version: MODEL.version, latencyMs: 28 + (hash32(entity.id) % 40) },
    summary: {
      scored: rows.length,
      above: rows.filter((r) => r.confidence >= thr).length,
      known: rows.filter((r) => r.known).length,
      returned: predictions.length,
    },
    predictions,
  }
}

/* ---------- explain ------------------------------------------------ */
function neighborsFor(drug, disease, k = 6) {
  return DRUGS.filter((d) => d.id !== drug.id)
    .map((d) => {
      const tJ = jaccardSets(new Set(drug.targets || []), new Set(d.targets || []))
      const sSim = smilesSimilarity(drug.smiles, d.smiles)
      const similarity = round(0.6 * tJ + 0.4 * sSim)
      const treats = (d.indications || []).includes(disease.id)
      const curated = curatedIndex.get(`${d.id}|${disease.id}`)
      return { id: d.id, name: d.name, similarity, treats, curated: curated ? OUTCOME_LABEL[curated.outcome] : null, area: d.area }
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
}

function calibrationFor(confidence) {
  const b = MODEL.calibration.find((c) => {
    const [lo, hi] = c.bucket.split('–').map((x) => parseFloat(x))
    return confidence >= lo && (confidence < hi || hi === 1)
  })
  return b || MODEL.calibration[MODEL.calibration.length - 1]
}

const SE_KEYWORDS = {
  Cardiovascular: ['brady', 'tachy', 'hypertension', 'hypotension', 'oedema', 'thrombo', 'heart', 'QT', 'palpit'],
  Metabolic: ['weight', 'glyc', 'lipid', 'ketoacid', 'appetite'],
  Neurology: ['dizz', 'somnol', 'headache', 'confus', 'tremor', 'neuropath', 'seizure', 'ataxia'],
  Psychiatry: ['insomnia', 'mood', 'agitation', 'anxiety', 'dissoc', 'halluc', 'sedation'],
  Immunology: ['infection', 'immunosupp', 'zoster', 'myelosupp', 'neutrop'],
  Oncology: ['myelosupp', 'thrombocyt', 'anaemia', 'hepatotox'],
  Renal: ['renal', 'kalaemia', 'polyuria', 'urinary'],
  Dermatology: ['rash', 'photosens', 'pruritus', 'hypertrich'],
  Respiratory: ['broncho', 'respiratory', 'pneumon'],
  Infectious: ['infection', 'mycotic'],
  Endocrine: ['gynaeco', 'libido', 'thyroid', 'menstrual'],
  Reproductive: ['teratogen', 'libido', 'erectile'],
}

export function explain(drugId, diseaseId) {
  const drug = getDrug(drugId)
  const disease = getDisease(diseaseId)
  if (!drug) throw new MockError(`Unknown drug "${drugId}".`, 404, 'not_found')
  if (!disease) throw new MockError(`Unknown disease "${diseaseId}".`, 404, 'not_found')

  const f = pairFeatures(drug, disease)
  const c = contributions(f)
  const confidence = drug.novel ? round(c.confidence * 0.85) : c.confidence
  const targets = new Set(drug.targets || [])
  const genes = new Set(disease.genes || [])

  const pathways = f.sharedPathways
    .map((pid) => {
      const p = pathwayById.get(pid)
      const drugGenes = p.genes.filter((g) => targets.has(g))
      const diseaseGenes = p.genes.filter((g) => genes.has(g))
      const overlap = drugGenes.filter((g) => genes.has(g))
      return { id: pid, name: p.name, size: p.genes.length, drugGenes, diseaseGenes, overlap, jaccard: round(new Set([...drugGenes, ...diseaseGenes]).size ? (overlap.length || Math.min(drugGenes.length, diseaseGenes.length) * 0.5) / new Set([...drugGenes, ...diseaseGenes]).size : 0, 2) }
    })
    .sort((a, b) => b.overlap.length - a.overlap.length || b.jaccard - a.jaccard)

  const sharedGenes = f.shared.map((g) => ({ symbol: g, entrez: GENES[g]?.entrez ?? null, name: GENES[g]?.name ?? g, relation: 'direct target', sourceCount: 2 + (hash32(`${f.seed}|${g}`) % 5) }))
  const hopGenes = f.hop.map((g) => ({ symbol: g, entrez: GENES[g]?.entrez ?? null, name: GENES[g]?.name ?? g, relation: '1-hop PPI', sourceCount: 1 + (hash32(`${f.seed}|${g}`) % 3) }))

  // Bipartite graph for the pathway/target viewer.
  const drugTargets = [...targets].slice(0, 12)
  const diseaseGenes = [...genes].slice(0, 16)
  const nodeSet = new Set([...drugTargets, ...diseaseGenes])
  const ppiEdges = PPI.filter(([a, b]) => nodeSet.has(a) && nodeSet.has(b) && (targets.has(a) !== targets.has(b) || (targets.has(a) && genes.has(b)) || (targets.has(b) && genes.has(a))))

  const sideEffects = (drug.sideEffects || []).map((name) => {
    const kws = SE_KEYWORDS[disease.category] || []
    const relevant = kws.some((k) => name.toLowerCase().includes(k.toLowerCase()))
    const freq = ['very common', 'common', 'uncommon', 'rare'][hash32(`${drug.id}|${name}`) % 4]
    return { name, frequency: freq, relevant }
  })

  const evidence = evidenceFor(drug, disease, f)
  const calibration = calibrationFor(confidence)
  const trial = f.curated ? { phase: f.curated.phase, outcome: f.curated.outcome, outcomeLabel: OUTCOME_LABEL[f.curated.outcome], name: f.curated.trial, year: f.curated.year } : null

  const verdict = f.known
    ? 'Known indication'
    : confidence >= DEFAULT_THRESHOLD
      ? 'Strong repurposing candidate'
      : confidence >= 0.5
        ? 'Plausible — needs evidence'
        : 'Weak signal'

  const summary = [
    mechanismFor(drug, disease, f),
    f.shared.length
      ? `The pair shares ${f.shared.length} direct target${f.shared.length === 1 ? '' : 's'} and ${pathways.length} pathway${pathways.length === 1 ? '' : 's'}.`
      : pathways.length
        ? `There is no direct target overlap, but ${pathways.length} pathway${pathways.length === 1 ? '' : 's'} connect the drug's targets to the disease gene set.`
        : 'There is no direct target or pathway overlap in the current graph.',
    trial ? `Clinical evidence: ${trial.name} (${trial.phase}, ${trial.year}) — ${trial.outcomeLabel.toLowerCase()}.` : 'No registered clinical trial is linked to this pair in the graph.',
    `At a confidence of ${confidence.toFixed(2)}, pairs in the ${calibration.bucket} bucket were true positives ${Math.round(calibration.empiricalPrecision * 100)}% of the time on the held-out test set.`,
  ].join(' ')

  return {
    pair: { drug: { ...drug, kind: drug.kind }, disease: { ...disease, kind: 'disease' } },
    confidence,
    threshold: DEFAULT_THRESHOLD,
    aboveThreshold: confidence >= DEFAULT_THRESHOLD,
    known: f.known,
    verdict,
    summary,
    mechanism: mechanismFor(drug, disease, f),
    trial,
    calibration,
    featureContributions: c.parts,
    logit: round(c.logit),
    sharedGenes,
    hopGenes,
    pathways,
    graph: { drugTargets, diseaseGenes, shared: f.shared, hops: f.hop, ppiEdges },
    neighbors: neighborsFor(drug, disease),
    evidence,
    sideEffects,
    model: { name: MODEL.name, version: MODEL.version },
  }
}

/* ---------- misc ---------------------------------------------------- */
export function entityPayload(id) {
  const e = getEntity(id)
  if (!e) throw new MockError(`No entity with id "${id}".`, 404, 'not_found')
  const kind = e.kind || 'disease'
  const payload = { ...e, kind }
  if (kind !== 'disease') {
    payload.targetsDetail = (e.targets || []).map((g) => ({ symbol: g, entrez: GENES[g]?.entrez ?? null, name: GENES[g]?.name ?? g }))
    payload.indicationsDetail = (e.indications || []).map((d) => entitySummary(getDisease(d))).filter(Boolean)
    payload.pathways = [...pathwaySet(e.targets || [])].map((p) => pathwayById.get(p).name)
  } else {
    payload.genesDetail = (e.genes || []).map((g) => ({ symbol: g, entrez: GENES[g]?.entrez ?? null, name: GENES[g]?.name ?? g }))
    payload.pathways = [...pathwaySet(e.genes || [])].map((p) => pathwayById.get(p).name)
    payload.knownDrugs = DRUGS.filter((d) => (d.indications || []).includes(e.id)).map(entitySummary)
    payload.curatedDrugs = (curatedByDisease.get(e.id) || []).map((c) => ({ ...entitySummary(getDrug(c.drug)), outcome: c.outcome, phase: c.phase }))
  }
  return payload
}

export const COUNTS = { drugs: DRUGS.length, diseases: DISEASES.length, genes: Object.keys(GENES).length, pathways: PATHWAYS.length, ppi: PPI.length, curated: CURATED.length }
