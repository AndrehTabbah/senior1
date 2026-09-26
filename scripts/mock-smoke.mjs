import { predict, explain, search, COUNTS } from '../src/api/mock/engine.js'
import { GENES } from '../src/api/mock/genes.js'
import { DRUGS } from '../src/api/mock/drugs.js'
import { DISEASES } from '../src/api/mock/diseases.js'
import { CURATED } from '../src/api/mock/curated.js'
const missing = new Set()
DRUGS.forEach(d => d.targets.forEach(g => !GENES[g] && missing.add(g)))
DISEASES.forEach(d => d.genes.forEach(g => !GENES[g] && missing.add(g)))
console.log('COUNTS', COUNTS, 'missing genes:', [...missing])
const dz = new Set(DISEASES.map(d=>d.id)), dr = new Set(DRUGS.map(d=>d.id))
CURATED.forEach(c => { if(!dz.has(c.disease)) console.log('curated bad disease', c.disease); if(!dr.has(c.drug)) console.log('curated bad drug', c.drug) })
DRUGS.forEach(d => d.indications.forEach(i => !dz.has(i) && console.log('indication missing', d.name, i)))
const show = (r) => { console.log(`\n== ${r.entity.name} (${r.direction}) above=${r.summary.above} known=${r.summary.known}`); r.predictions.slice(0,10).forEach(p => console.log(`${String(p.rank).padStart(2)} ${p.confidence.toFixed(2)} ${p.known?'K':' '} ${p.name.padEnd(38)} shared=${p.sharedGenes.length} path=${p.pathwayCount} ${p.trial? p.trial.phase+'/'+p.trial.outcome:''}`)) }
show(predict({ query: 'metformin' }))
show(predict({ query: 'sildenafil' }))
show(predict({ query: 'Alzheimer' }))
show(predict({ query: 'ketamine' }))
show(predict({ query: 'CN(C)C(=N)NC(N)=N' }))
show(predict({ query: 'CC(=O)Oc1ccccc1C(=O)N' }))
// distribution of all confidences for drug->disease
let all=[]; DRUGS.forEach(d => predict({ id: d.id, top_k: 50 }).predictions.forEach(p => all.push(p.confidence)))
all.sort((a,b)=>a-b); const q = (x)=>all[Math.floor(x*(all.length-1))]
console.log('\nconfidence quantiles', {min:q(0), p25:q(.25), p50:q(.5), p75:q(.75), p90:q(.9), p95:q(.95), max:q(1)}, 'n=', all.length)
const ex = explain('DB00331','D015179'); console.log('\nexplain', ex.verdict, ex.confidence, 'shared', ex.sharedGenes.map(g=>g.symbol), 'pathways', ex.pathways.slice(0,3).map(p=>p.name), 'edges', ex.graph.ppiEdges.length, 'neighbors', ex.neighbors.map(n=>n.name+':'+n.similarity))
console.log('search "met"', search('met').map(s=>s.name), 'search "alz"', search('alz').map(s=>s.name))
