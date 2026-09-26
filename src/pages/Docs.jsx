import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { USE_MOCK } from '../api/index.js'
import { Icon } from '../components/Icons.jsx'
import { cx } from '../utils/format.js'
import './docs.css'

/* Mirrors the default in src/api/client.js; only used for the mode indicator. */
const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')
const HOST = 'http://localhost:5000/api'

/* ------------------------------------------------------------------
   Example payloads. Generated against the in-browser mock engine and
   trimmed by hand; "// … n more" marks elided array items.
   ------------------------------------------------------------------ */

const ENV_EXAMPLE = `# .env.local — restart the dev server after changing it
VITE_USE_MOCK=false
VITE_API_BASE=/api`

const ERROR_EXAMPLE = `HTTP/1.1 422 Unprocessable Content
Content-Type: application/json

{
  "message": "That does not parse as SMILES: Unbalanced parentheses.",
  "code": "invalid_smiles"
}`

const SEARCH_REQ = `curl "${HOST}/search?q=alz&limit=3"`

const SEARCH_RES = `{
  "results": [
    {
      "id": "D000544",
      "name": "Alzheimer Disease",
      "kind": "disease",
      "subtitle": "D000544 · Neurology",
      "matchedOn": "Alzheimer's"
    }
  ]
}`

const ENTITY_REQ = `curl ${HOST}/entities/DB00331`

const ENTITY_RES = `{
  "id": "DB00331",
  "kind": "drug",
  "name": "Metformin",
  "synonyms": ["Glucophage", "Dimethylbiguanide"],
  "smiles": "CN(C)C(=N)NC(N)=N",
  "formula": "C4H11N5",
  "atc": "A10BA02",
  "area": "Metabolic",
  "year": 1995,
  "descriptors": {
    "molWt": 129.17, "logP": -1.4, "tpsa": 91.5, "hbd": 3, "hba": 1,
    "rotB": 2, "rings": 0, "aromaticRings": 0, "heavyAtoms": 9, "fracCsp3": 0.5
  },
  "targets": ["PRKAA1", "PRKAA2", "MTOR", "SIRT1"],
  "indications": ["D003924"],
  "approvedUse": "Type 2 diabetes mellitus",
  "sideEffects": ["Diarrhoea", "Nausea", "Abdominal discomfort", "Vitamin B12 deficiency", "Lactic acidosis (rare)"],
  "summary": "First-line oral antihyperglycaemic. Activates AMPK and inhibits hepatic gluconeogenesis; one of the most studied repurposing candidates in oncology and ageing.",
  "targetsDetail": [
    { "symbol": "PRKAA1", "entrez": 5562, "name": "AMP-activated protein kinase catalytic subunit alpha-1" },
    { "symbol": "PRKAA2", "entrez": 5563, "name": "AMP-activated protein kinase catalytic subunit alpha-2" }
    // … 2 more
  ],
  "indicationsDetail": [
    { "id": "D003924", "name": "Diabetes Mellitus, Type 2", "kind": "disease", "category": "Metabolic" }
  ],
  "pathways": [
    "AMPK signaling pathway",
    "mTOR signaling pathway",
    "Insulin signaling pathway"
    // … 11 more
  ]
}`

const ENTITY_DISEASE_RES = `{
  "id": "D000544",
  "kind": "disease",
  "name": "Alzheimer Disease",
  "synonyms": ["AD", "Alzheimer's"],
  "category": "Neurology",
  "genes": [
    "APP", "MAPT", "PSEN1", "APOE"
    // … 12 more
  ],
  "prevalence": "~55M people worldwide",
  "summary": "Progressive neurodegeneration with amyloid-beta plaques, tau tangles and neuroinflammation.",
  "genesDetail": [
    { "symbol": "APP", "entrez": 351, "name": "Amyloid-beta precursor protein" }
    // … 15 more
  ],
  "pathways": [
    "Alzheimer disease",
    "Parkinson disease"
    // … 36 more
  ],
  "knownDrugs": [
    { "id": "DB01043", "name": "Memantine", "kind": "drug", "area": "Neurology", "approvedUse": "Moderate-to-severe Alzheimer disease", "novel": false }
    // … 1 more
  ],
  "curatedDrugs": [
    { "id": "DB00331", "name": "Metformin", "kind": "drug", "area": "Metabolic", "approvedUse": "Type 2 diabetes mellitus", "novel": false, "outcome": "ongoing", "phase": "Phase 2" }
    // … 6 more
  ]
}`

const PREDICT_REQ = `curl -X POST ${HOST}/predict \\
  -H "Content-Type: application/json" \\
  -d '{ "query": "Metformin", "type": "drug", "top_k": 3, "threshold": 0.79 }'`

const PREDICT_RES = `{
  "direction": "drug_to_disease",
  "query": { "raw": "Metformin", "type": "drug", "id": null },
  "entity": {
    "id": "DB00331",
    "kind": "drug",
    "name": "Metformin",
    "area": "Metabolic",
    "targets": ["PRKAA1", "PRKAA2", "MTOR", "SIRT1"],
    "indications": ["D003924"],
    "approvedUse": "Type 2 diabetes mellitus"
    // … the full entity (see GET /entities/:id, without the *Detail fields)
  },
  "threshold": 0.79,
  "topK": 3,
  "model": { "name": "Dawa VAE-128 + MLP", "version": "0.9.2", "latencyMs": 36 },
  "summary": { "scored": 62, "above": 7, "known": 1, "returned": 3 },
  "predictions": [
    {
      "rank": 1,
      "id": "D003924",
      "name": "Diabetes Mellitus, Type 2",
      "kind": "disease",
      "category": "Metabolic",
      "confidence": 0.994,
      "known": true,
      "sharedGenes": ["PRKAA1", "PRKAA2"],
      "ppiHops": ["ADIPOQ"],
      "pathwayCount": 11,
      "topPathways": ["AMPK signaling pathway", "mTOR signaling pathway", "Insulin signaling pathway"],
      "mechanism": "Metformin is an approved treatment for diabetes mellitus, type 2 (Type 2 diabetes mellitus).",
      "trial": null,
      "evidenceCount": 7,
      "sources": ["DrugBank", "CTD", "Open Targets", "DGIdb", "STRING", "ChEMBL", "SIDER"],
      "pair": { "drugId": "DB00331", "diseaseId": "D003924" },
      "aboveThreshold": true
    },
    {
      "rank": 2,
      "id": "D011085",
      "name": "Polycystic Ovary Syndrome",
      "kind": "disease",
      "category": "Endocrine",
      "confidence": 0.886,
      "known": false,
      "sharedGenes": [],
      "ppiHops": [],
      "pathwayCount": 11,
      "topPathways": ["AMPK signaling pathway", "mTOR signaling pathway", "Insulin signaling pathway"],
      "mechanism": "Improves peripheral insulin sensitivity, lowering hyperinsulinaemia-driven ovarian androgen synthesis and restoring ovulation.",
      "trial": { "phase": "Guideline off-label", "outcome": "positive", "name": "Multiple RCTs; international PCOS guideline 2023", "year": 2023 },
      "evidenceCount": 6,
      "sources": ["ClinicalTrials.gov", "PubMed", "CTD", "DGIdb", "ChEMBL", "SIDER"],
      "pair": { "drugId": "DB00331", "diseaseId": "D011085" },
      "aboveThreshold": true
    }
    // … 1 more (rank 3, Colorectal Neoplasms, 0.86)
  ]
}`

const PREDICT_SMILES_REQ = `curl -X POST ${HOST}/predict \\
  -H "Content-Type: application/json" \\
  -d '{ "query": "CC(=O)Oc1ccccc1C(=O)N", "type": "smiles", "top_k": 2, "threshold": 0.79 }'`

const PREDICT_SMILES_RES = `{
  "direction": "drug_to_disease",
  "query": { "raw": "CC(=O)Oc1ccccc1C(=O)N", "type": "smiles", "id": null },
  "entity": {
    "id": "NOVEL-55F850D1",
    "kind": "compound",
    "novel": true,
    "name": "Unregistered compound",
    "synonyms": [],
    "smiles": "CC(=O)Oc1ccccc1C(=O)N",
    "formula": null,
    "atc": null,
    "area": "Cardiovascular",
    "descriptors": {
      "molWt": 182.2, "logP": 0.15, "tpsa": 63.7, "hbd": 3, "hba": 4, "rotB": 2,
      "rings": 1, "aromaticRings": 1, "heavyAtoms": 13, "fracCsp3": 0.11, "estimated": true
    },
    "targets": ["PTGS2", "PTGS1", "NFKB1", "PRKAA1", "IKBKB", "PPARG"],
    "inferredTargets": true,
    "indications": [],
    "approvedUse": null,
    "sideEffects": [],
    "neighbors": [
      { "id": "DB00945", "name": "Aspirin", "similarity": 0.924 },
      { "id": "DB01050", "name": "Ibuprofen", "similarity": 0.558 }
      // … 4 more
    ],
    "summary": "Not present in DrugBank or ChEMBL. Descriptors were computed from the SMILES string and the target profile was inherited from the nearest neighbours in latent space, so treat predictions as exploratory."
  },
  "threshold": 0.79,
  "topK": 2,
  "model": { "name": "Dawa VAE-128 + MLP", "version": "0.9.2", "latencyMs": 34 },
  "summary": { "scored": 62, "above": 0, "known": 0, "returned": 2 },
  "predictions": [
    {
      "rank": 1,
      "id": "D003327",
      "name": "Coronary Disease",
      "kind": "disease",
      "category": "Cardiovascular",
      "confidence": 0.687,
      "known": false,
      "sharedGenes": ["PTGS1"],
      "ppiHops": ["TNF", "IL1B", "IL6"],
      "pathwayCount": 21,
      "topPathways": ["NF-kappa B signaling pathway", "TNF signaling pathway", "IL-17 signaling pathway"],
      "mechanism": "Unregistered compound shares 1 target gene (PTGS1) with the disease gene set and co-occurs in 21 pathways, led by NF-kappa B signaling pathway.",
      "trial": null,
      "evidenceCount": 4,
      "sources": ["CTD", "Open Targets", "DGIdb", "STRING"],
      "pair": { "drugId": "NOVEL-55F850D1", "diseaseId": "D003327" },
      "inherited": true,
      "aboveThreshold": false
    }
    // … 1 more
  ]
}`

const EXPLAIN_REQ = `curl "${HOST}/explain?drug=DB00203&disease=D012021"`

const EXPLAIN_RES = `{
  "pair": {
    "drug": { "id": "DB00203", "kind": "drug", "name": "Sildenafil", "targets": ["PDE5A"], "area": "Cardiovascular" /* … full entity */ },
    "disease": { "id": "D012021", "kind": "disease", "name": "Raynaud Disease", "category": "Cardiovascular", "genes": ["PDE5A", "NOS3", "EDN1", "ADRA1A", "ADRA2A", "CACNA1C", "EDNRA"] /* … full entity */ }
  },
  "confidence": 0.748,
  "threshold": 0.79,
  "aboveThreshold": false,
  "known": false,
  "verdict": "Plausible — needs evidence",
  "summary": "PDE5 inhibition raises cGMP in digital arterial smooth muscle, reducing vasospasm frequency. The pair shares 1 direct target and 1 pathway. Clinical evidence: Meta-analysis of PDE5 inhibitors in secondary Raynaud (Phase 2/3, 2013) — positive. At a confidence of 0.75, pairs in the 0.60 – 0.79 bucket were true positives 58% of the time on the held-out test set.",
  "mechanism": "PDE5 inhibition raises cGMP in digital arterial smooth muscle, reducing vasospasm frequency.",
  "trial": { "phase": "Phase 2/3", "outcome": "positive", "outcomeLabel": "Positive", "name": "Meta-analysis of PDE5 inhibitors in secondary Raynaud", "year": 2013 },
  "calibration": { "bucket": "0.60 – 0.79", "empiricalPrecision": 0.58, "n": 6930 },
  "featureContributions": [
    { "key": "bias", "label": "Base rate (prior)", "value": -3 },
    { "key": "targets", "label": "Shared targets (drug–target ∩ gene–disease)", "value": 1.157 },
    { "key": "pathways", "label": "Pathway co-membership", "value": 0.225 },
    { "key": "prior", "label": "Curated knowledge-graph edges (CTD / literature)", "value": 2.4 }
    // … 6 more (ppi, known, area, fingerprint, descriptors, sideEffects)
  ],
  "logit": 1.089,
  "sharedGenes": [
    { "symbol": "PDE5A", "entrez": 8654, "name": "cGMP-specific 3',5'-cyclic phosphodiesterase", "relation": "direct target", "sourceCount": 5 }
  ],
  "hopGenes": [
    { "symbol": "NOS3", "entrez": 4846, "name": "Nitric oxide synthase, endothelial", "relation": "1-hop PPI", "sourceCount": 2 }
  ],
  "pathways": [
    {
      "id": "hsa04022",
      "name": "cGMP-PKG signaling pathway",
      "size": 22,
      "drugGenes": ["PDE5A"],
      "diseaseGenes": ["PDE5A", "NOS3", "EDN1", "EDNRA", "ADRA1A", "ADRA2A", "CACNA1C"],
      "overlap": ["PDE5A"],
      "jaccard": 0.14
    }
  ],
  "graph": {
    "drugTargets": ["PDE5A"],
    "diseaseGenes": ["PDE5A", "NOS3", "EDN1", "ADRA1A", "ADRA2A", "CACNA1C", "EDNRA"],
    "shared": ["PDE5A"],
    "hops": ["NOS3"],
    "ppiEdges": [["PDE5A", "NOS3"]]
  },
  "neighbors": [
    { "id": "DB11817", "name": "Baricitinib", "similarity": 0.2, "treats": false, "curated": null, "area": "Immunology" },
    { "id": "DB00643", "name": "Mebendazole", "similarity": 0.169, "treats": false, "curated": null, "area": "Infectious" }
    // … 4 more
  ],
  "evidence": [
    { "source": "ClinicalTrials.gov", "kind": "trial", "label": "Phase 2/3 · Positive", "detail": "Meta-analysis of PDE5 inhibitors in secondary Raynaud", "year": 2013, "outcome": "positive", "url": "https://clinicaltrials.gov/search?term=Sildenafil%20Raynaud%20Disease" },
    { "source": "PubMed", "kind": "literature", "label": "Sildenafil Raynaud phenomenon", "url": "https://pubmed.ncbi.nlm.nih.gov/?term=sildenafil%20raynaud%20phenomenon" },
    { "source": "CTD", "kind": "curated", "label": "31 curated chemical–disease relationships", "count": 31 },
    { "source": "Open Targets", "kind": "association", "label": "Gene–disease association score 0.59", "score": 0.59 }
    // … 4 more (DGIdb, STRING, ChEMBL, SIDER)
  ],
  "sideEffects": [
    { "name": "Headache", "frequency": "rare", "relevant": false },
    { "name": "Flushing", "frequency": "very common", "relevant": false }
    // … 3 more
  ],
  "model": { "name": "Dawa VAE-128 + MLP", "version": "0.9.2" }
}`

const SOURCES_RES = `{
  "sources": [
    {
      "id": "drugbank",
      "name": "DrugBank",
      "records": 19842,
      "recordLabel": "19,842 drugs",
      "role": "Drug metadata + IDs",
      "kind": "Drug",
      "url": "https://go.drugbank.com",
      "license": "Academic (CC BY-NC 4.0)",
      "version": "5.1.12",
      "description": "Canonical drug identifiers, SMILES, targets, ATC codes and approved indications."
    }
    // … 10 more
  ],
  "tables": [
    {
      "file": "drug_target_std.parquet",
      "columns": ["drug_uid", "entrez_id", "activity"],
      "rows": 437000,
      "rowsLabel": "437K",
      "description": "Drug → protein target edges with bioactivity class."
    }
    // … 5 more
  ],
  "preprocessing": [
    { "title": "ID harmonisation", "text": "All entities mapped to canonical ids: drug_uid, Entrez, MeSH, UMLS CUI." }
    // … 3 more
  ]
}`

const MODEL_RES = `{
  "model": {
    "name": "Dawa VAE-128 + MLP",
    "version": "0.9.2",
    "trainedOn": "2026-08-14",
    "framework": "PyTorch 2.4",
    "threshold": 0.79,
    "latencyMs": { "p50": 38, "p95": 71 },
    "summary": "A variational autoencoder compresses a 315-dimensional drug vector (Morgan fingerprint + RDKit descriptors) into a 128-dimensional latent embedding. …",
    "input": {
      "fingerprint": { "name": "Morgan fingerprint", "bits": 300, "radius": 2 },
      "descriptors": [
        "MolWt", "LogP", "TPSA"
        // … 12 more
      ],
      "dims": 315,
      "latentDims": 128
    },
    "architecture": {
      "encoder": "315 → 256 → 128 (μ, log σ²)",
      "decoder": "128 → 256 → 315",
      "classifier": "MLP on [z_drug ‖ graph features] → sigmoid",
      "activation": "ReLU + BatchNorm + Dropout(0.2)"
    },
    "hyperparameters": [
      { "param": "Latent dim", "value": "128" },
      { "param": "Hidden layers", "value": "315 → 256 → 128 (encoder); 128 → 256 → 315 (decoder)" }
      // … 6 more
    ],
    "training": {
      "positives": 100000,
      "negatives": 500000,
      "ratio": "1:5",
      "split": "Drug-level 70 / 15 / 15",
      "positiveShare": 0.167,
      "negativeSampling": "Negatives sampled with Jaccard gene-overlap < 50% to avoid near-positives",
      "crossValidation": "5-fold within the training split for hyper-parameter selection"
    },
    "metrics": {
      "primary": "AUPRC",
      "at": [
        { "threshold": 0.5, "label": "@ 0.5", "auroc": 0.98, "auprc": 0.897, "f1": 0.799, "accuracy": 0.92, "precision": 0.686, "recall": 0.956, "rmse": 0.24 },
        { "threshold": 0.79, "label": "@ best F1 (0.79)", "auroc": 0.98, "auprc": 0.897, "f1": 0.83, "accuracy": 0.94, "precision": 0.791, "recall": 0.874, "rmse": 0.24 }
      ],
      "baseRate": 0.167,
      "confusion": { "threshold": 0.5, "tp": 12866, "fp": 5876, "fn": 590, "tn": 61404 },
      "definitions": [
        { "name": "AUPRC", "value": 0.897, "formula": "AUPRC = ∫ Precision(r) dRecall(r)", "why": "Primary metric. Sensitive to minority-class performance; …" }
        // … 4 more
      ]
    },
    "curves": {
      "roc": [
        [0, 0], [0.005, 0.32], [0.01, 0.48]
        // … 12 more [fpr, tpr] points
      ],
      "rocMarkers": [
        { "label": "@ 0.5", "fpr": 0.09, "tpr": 0.956 },
        { "label": "@ best F1 (0.79)", "fpr": 0.045, "tpr": 0.874 }
      ],
      "pr": [
        [0, 1], [0.05, 0.995], [0.1, 0.99]
        // … 15 more [recall, precision] points
      ],
      "prMarkers": [
        { "label": "@ best F1", "recall": 0.874, "precision": 0.791 },
        { "label": "@ 0.5", "recall": 0.956, "precision": 0.686 }
      ]
    },
    "validation": [
      { "title": "5-fold cross-validation", "text": "Within the training split, for hyper-parameter selection." }
      // … 3 more
    ],
    "designDecisions": [
      { "title": "VAE over plain autoencoder", "text": "The KL regulariser keeps the latent space smooth, which generalises better to unseen drugs — the repurposing case." }
      // … 4 more
    ],
    "calibration": [
      { "bucket": "0.90 – 1.00", "empiricalPrecision": 0.93, "n": 4120 },
      { "bucket": "0.79 – 0.90", "empiricalPrecision": 0.81, "n": 5810 }
      // … 4 more
    ]
  }
}`

const STATS_RES = `{
  "entities": { "drugs": 10395, "genes": 28642, "diseases": 33506, "sideEffects": 4759 },
  "edges": {
    "total": 5324697,
    "byType": [
      { "type": "gene–disease", "share": 0.842, "count": 4482972 },
      { "type": "drug–target", "share": 0.08, "count": 427386 },
      { "type": "PPI", "share": 0.044, "count": 234000 },
      { "type": "drug–disease", "share": 0.019, "count": 103000 },
      { "type": "drug–side effect", "share": 0.015, "count": 80410 }
    ]
  },
  "matrices": [
    { "name": "Drug molecular", "shape": "10,395 × 15", "type": "Dense", "nonZero": "all (z-scored)", "sparsity": null },
    { "name": "Drug–Target", "shape": "10,395 × 28,642", "type": "Sparse CSR", "nonZero": "427,386", "sparsity": 0.9986 }
    // … 3 more
  ],
  "sources": 11,
  "tables": 6,
  "lastBuilt": "2026-08-14"
}`

const LOGIN_REQ = `curl -X POST ${HOST}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "demo@dawa.ae", "password": "demo1234" }'`

const LOGIN_RES = `{
  "token": "mock.ZGVtb0BkYXdhLmFl",
  "user": {
    "name": "Demo Researcher",
    "email": "demo@dawa.ae",
    "affiliation": "University of Sharjah",
    "role": "researcher",
    "createdAt": "2026-09-01T00:00:00.000Z"
  }
}`

const REGISTER_REQ = `curl -X POST ${HOST}/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Aisha Rashid", "email": "a.rashid@sharjah.ac.ae", "password": "correct-horse-42", "affiliation": "University of Sharjah" }'`

const REGISTER_RES = `{
  "token": "mock.YS5yYXNoaWRAc2hhcmphaC5hYy5hZQ==",
  "user": {
    "name": "Aisha Rashid",
    "email": "a.rashid@sharjah.ac.ae",
    "affiliation": "University of Sharjah",
    "role": "researcher",
    "createdAt": "2026-09-23T09:14:02.511Z"
  }
}`

const ME_REQ = `curl ${HOST}/auth/me \\
  -H "Authorization: Bearer mock.ZGVtb0BkYXdhLmFl"`

const ME_RES = `{
  "user": {
    "name": "Demo Researcher",
    "email": "demo@dawa.ae",
    "affiliation": "University of Sharjah",
    "role": "researcher",
    "createdAt": "2026-09-01T00:00:00.000Z"
  }
}`

const LOGOUT_REQ = `curl -X POST ${HOST}/auth/logout \\
  -H "Authorization: Bearer mock.ZGVtb0BkYXdhLmFl"`

const LOGOUT_RES = `{ "ok": true }`

const USE_API_EXAMPLE = `import { api } from '../api/index.js'
import { useApi } from '../hooks/useApi.js'

// Re-runs when any dependency changes; aborts the in-flight request on change or unmount.
const { data, error, loading, reload } = useApi(
  (signal) => api.predict({ query, type, id, topK, threshold, signal }),
  [query, type, id, topK, threshold],
)

// Errors arrive as ApiError { message, status, code, details }.
if (error?.code === 'invalid_smiles') showSmilesHelp(error.message)`

const CORS_EXAMPLE = `# Only needed when VITE_API_BASE points straight at Flask (no Vite proxy).
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"], supports_credentials=False)`

const HISTORY_ENTRY = `{
  "id": "mfvq3k1x8a2b",
  "at": "2026-09-23T09:20:41.120Z",
  "query": "Metformin",
  "type": "drug",
  "direction": "drug_to_disease",
  "entity": { "id": "DB00331", "name": "Metformin", "kind": "drug" },
  "topK": 15,
  "threshold": 0.79,
  "topResult": { "id": "D003924", "name": "Diabetes Mellitus, Type 2", "confidence": 0.994 },
  "count": 15
}`

/* ------------------------------------------------------------------
   Reference data
   ------------------------------------------------------------------ */

const ERROR_CODES = [
  { code: 'empty_query', status: 400, where: 'POST /predict', when: 'query is blank and no id was given.' },
  { code: 'bad_request', status: 400, where: 'GET /explain', when: 'drug or disease is missing from the query string.' },
  { code: 'invalid_smiles', status: 422, where: 'POST /predict', when: 'type is smiles (or SMILES was auto-detected) and the string does not parse; message names the reason.' },
  { code: 'not_found', status: 404, where: 'GET /entities/:id · POST /predict · GET /explain · unknown routes', when: 'No entity with that id, or nothing in the index matches the query.' },
  { code: 'invalid_credentials', status: 401, where: 'POST /auth/login', when: 'Wrong email or password (one message for both).' },
  { code: 'validation', status: 422, where: 'POST /auth/register', when: 'Missing name, malformed email or a password shorter than 8 characters.' },
  { code: 'conflict', status: 409, where: 'POST /auth/register', when: 'An account with that email already exists.' },
  { code: 'unauthenticated', status: 401, where: 'GET /auth/me', when: 'Missing, unknown or expired bearer token.' },
  { code: 'network', status: '—', where: 'client only', when: 'fetch failed before any response arrived; the interface shows "Could not reach the Dawa API".' },
  { code: 'http', status: 'any', where: 'client only', when: 'A non-2xx response whose body carried no code field.' },
]

const ID_ROWS = [
  { prefix: 'DB + 5 digits', ns: 'DrugBank', example: 'DB00331', use: 'Approved drugs (kind: drug).' },
  { prefix: 'CHEMBL + digits', ns: 'ChEMBL', example: 'CHEMBL113', use: 'Compounds without a marketing approval (kind: compound).' },
  { prefix: 'D + 6 digits', ns: 'MeSH', example: 'D000544', use: 'Diseases (kind: disease). MeSH is the only disease namespace the API exposes.' },
  { prefix: 'NOVEL- + 8 hex', ns: 'Dawa, per session', example: 'NOVEL-55F850D1', use: 'A SMILES string that is not in the index, featurised at request time. The suffix is a hash of the SMILES, so the same structure always gets the same id.' },
  { prefix: 'HGNC symbol', ns: 'HGNC / Entrez', example: 'PRKAA1 (5562)', use: 'Genes. Bare symbols in arrays; { symbol, entrez, name } where detail is needed.' },
  { prefix: 'hsa + 5 digits', ns: 'KEGG', example: 'hsa04022', use: 'Pathways, in GET /explain only. Elsewhere pathways are named.' },
]

const TYPE_ROWS = [
  { value: 'auto', text: 'Default. If the string looks like SMILES it is parsed as one; otherwise the best autocomplete hit of any kind is used.' },
  { value: 'drug', text: 'Restrict the lookup to DrugBank drugs.' },
  { value: 'disease', text: 'Restrict the lookup to MeSH diseases.' },
  { value: 'compound', text: 'Restrict the lookup to ChEMBL compounds.' },
  { value: 'smiles', text: 'Force SMILES parsing: an exact match to an indexed structure returns that drug, anything else becomes a NOVEL- compound, and an unparsable string is a 422.' },
]

const DRUG_FIELDS = [
  ['id', 'string', 'DBxxxxx, CHEMBLxxxx or NOVEL-xxxxxxxx.'],
  ['kind', "'drug' | 'compound'", 'Always present.'],
  ['name', 'string', '"Unregistered compound" for NOVEL entities.'],
  ['synonyms', 'string[]', 'Brand names and alternative names; may be empty.'],
  ['smiles', 'string | null', 'Canonical SMILES; null for drugs without a small-molecule structure.'],
  ['formula', 'string | null', 'Molecular formula.'],
  ['atc', 'string | null', 'ATC code; null for compounds.'],
  ['area', 'string', 'Therapeutic area, same vocabulary as disease.category.'],
  ['year', 'integer', 'First approval year. Absent for NOVEL entities.'],
  ['descriptors', 'object | null', 'molWt, logP, tpsa, hbd, hba, rotB, rings, aromaticRings, heavyAtoms, fracCsp3 as numbers; estimated: true when computed from SMILES at request time. null when there is no structure.'],
  ['targets', 'string[]', 'HGNC symbols of protein targets.'],
  ['indications', 'string[]', 'MeSH ids of approved indications.'],
  ['approvedUse', 'string | null', 'Display text for the approved indication(s).'],
  ['sideEffects', 'string[]', 'SIDER side-effect names.'],
  ['summary', 'string', 'One or two sentences.'],
  ['novel', 'boolean', 'Optional; true only for NOVEL entities.'],
  ['inferredTargets', 'boolean', 'Optional; targets were inherited from nearest neighbours.'],
  ['neighbors', '{ id, name, similarity }[]', 'Optional, NOVEL only; the six nearest indexed drugs in latent space.'],
  ['targetsDetail', '{ symbol, entrez, name }[]', 'GET /entities only. entrez is null when unmapped.'],
  ['indicationsDetail', '{ id, name, kind, category }[]', 'GET /entities only.'],
  ['pathways', 'string[]', 'GET /entities only; pathway names touched by any target.'],
]

const DISEASE_FIELDS = [
  ['id', 'string', 'MeSH descriptor id, Dxxxxxx.'],
  ['kind', "'disease'", 'Always present.'],
  ['name', 'string', 'MeSH preferred term.'],
  ['synonyms', 'string[]', 'Entry terms and abbreviations.'],
  ['category', 'string', 'Therapeutic area.'],
  ['genes', 'string[]', 'Associated gene symbols.'],
  ['prevalence', 'string', 'Display string, e.g. "~55M people worldwide".'],
  ['summary', 'string', 'One sentence.'],
  ['genesDetail', '{ symbol, entrez, name }[]', 'GET /entities only.'],
  ['pathways', 'string[]', 'GET /entities only; pathway names touched by any gene.'],
  ['knownDrugs', '{ id, name, kind, area, approvedUse, novel }[]', 'GET /entities only; drugs approved for this disease.'],
  ['curatedDrugs', 'knownDrugs shape + { outcome, phase }', 'GET /entities only; drugs with trial or literature evidence.'],
]

const PREDICTION_FIELDS = [
  ['rank', 'integer', '1-based position after sorting by confidence descending, then name.'],
  ['id', 'string', 'The candidate: a disease id for drug_to_disease, a drug or compound id for disease_to_drug.'],
  ['name', 'string', 'Candidate name.'],
  ['kind', "'disease' | 'drug' | 'compound'", 'Candidate kind.'],
  ['category', 'string', 'Disease category or drug area.'],
  ['confidence', 'number', 'Calibrated probability in [0, 1], three decimals.'],
  ['known', 'boolean', 'The pair is an approved indication in DrugBank.'],
  ['sharedGenes', 'string[]', 'Drug targets that are also disease genes.'],
  ['ppiHops', 'string[]', 'Disease genes one STRING hop from a target, excluding targets themselves.'],
  ['pathwayCount', 'integer', 'Pathways containing at least one target and one disease gene.'],
  ['topPathways', 'string[]', 'Up to three of those pathway names.'],
  ['mechanism', 'string', 'One-sentence rationale; curated text when available, otherwise generated from the overlap.'],
  ['trial', '{ phase, outcome, name, year } | null', 'Curated clinical evidence for the pair.'],
  ['evidenceCount', 'integer', 'Number of evidence records GET /explain returns for the pair.'],
  ['sources', 'string[]', 'Distinct source names among that evidence.'],
  ['pair', '{ drugId, diseaseId }', 'The ids to pass to GET /explain, whatever the direction.'],
  ['aboveThreshold', 'boolean', 'confidence ≥ the threshold sent with the request.'],
  ['inherited', 'boolean', 'Optional; true when the query entity was a NOVEL compound whose targets were inherited.'],
]

const EXPLANATION_FIELDS = [
  ['pair', '{ drug: Entity, disease: Entity }', 'Base entity objects without the *Detail fields.'],
  ['confidence', 'number', 'Calibrated probability for the pair.'],
  ['threshold', 'number', 'The model default (0.79); this route takes no threshold parameter.'],
  ['aboveThreshold', 'boolean', 'confidence ≥ threshold.'],
  ['known', 'boolean', 'Approved indication.'],
  ['verdict', 'string', 'One of the four verdict labels listed below.'],
  ['summary', 'string', 'Three or four sentences: mechanism, overlap, trial, calibration.'],
  ['mechanism', 'string', 'Same text as the prediction row.'],
  ['trial', '{ phase, outcome, outcomeLabel, name, year } | null', 'outcomeLabel is the capitalised display form of outcome.'],
  ['calibration', '{ bucket, empiricalPrecision, n }', 'The test-set bucket the confidence falls in.'],
  ['featureContributions', '{ key, label, value }[]', 'Ten additive logit terms in a fixed order; keys listed below.'],
  ['logit', 'number', 'Sum of the contributions; sigmoid(logit) = confidence.'],
  ['sharedGenes', '{ symbol, entrez, name, relation, sourceCount }[]', 'relation is "direct target".'],
  ['hopGenes', 'same shape', 'relation is "1-hop PPI".'],
  ['pathways', '{ id, name, size, drugGenes, diseaseGenes, overlap, jaccard }[]', 'Sorted by overlap size, then jaccard.'],
  ['graph', '{ drugTargets, diseaseGenes, shared, hops, ppiEdges }', 'At most 12 targets and 16 genes; ppiEdges are [a, b] symbol pairs.'],
  ['neighbors', '{ id, name, similarity, treats, curated, area }[]', 'Six nearest drugs; treats is an approved indication for the disease, curated is an outcome label or null.'],
  ['evidence', '{ source, kind, label, detail?, url?, count?, score?, year?, outcome? }[]', 'source, kind and label are always present; the rest only where they apply.'],
  ['sideEffects', '{ name, frequency, relevant }[]', 'relevant flags an overlap with the disease area.'],
  ['model', '{ name, version }', 'Model that produced the score.'],
]

const PAGE_USAGE = [
  ['/', 'Home', 'GET /stats · GET /model · GET /sources'],
  ['/results', 'Results', 'POST /predict (plus GET /search from the search box)'],
  ['/explain/:drugId/:diseaseId', 'Explain', 'GET /explain'],
  ['/database', 'Database', 'GET /sources · GET /stats'],
  ['/model', 'Model card', 'GET /model'],
  ['/history', 'History', 'localStorage only (see below)'],
  ['/signin, /signup', 'Sign in', 'POST /auth/login · POST /auth/register · GET /auth/me · POST /auth/logout'],
]

const ENDPOINTS = [
  {
    id: 'search',
    method: 'GET',
    path: '/search',
    purpose: 'Autocomplete over drugs, compounds and diseases. Matches names, synonyms and ids; the search box calls it on every keystroke after a 160 ms debounce.',
    params: [
      { name: 'q', in: 'query', type: 'string', required: true, desc: 'Free text. Matched case-insensitively against the primary name, every synonym and the id (an exact id match ranks first). A blank q returns an empty list, not an error.' },
      { name: 'limit', in: 'query', type: 'integer', required: false, desc: 'Maximum number of results. Default 8, which is what the client sends.' },
    ],
    request: SEARCH_REQ,
    response: SEARCH_RES,
    notes: [
      <>
        Results are ordered by match quality (exact name, prefix, word prefix, substring), then by name. <code>matchedOn</code> is the
        synonym or id that matched, or <code>null</code> when the primary name matched.
      </>,
      <>
        <code>subtitle</code> is a ready-made display string: <code>id · approved use</code> (or <code>Compound</code>) for drugs and
        compounds, <code>id · category</code> for diseases.
      </>,
      <>
        There is no server-side kind filter. When the user picks Drug, Disease or Compound the client filters <code>results</code> by{' '}
        <code>kind</code>.
      </>,
      <>Never errors on input: an unknown term returns <code>{'{ "results": [] }'}</code>.</>,
    ],
  },
  {
    id: 'entities',
    method: 'GET',
    path: '/entities/:id',
    purpose: 'One entity by canonical id, expanded with the detail fields the entity panels render: resolved targets or genes, pathway names and, for diseases, the drugs already linked to them.',
    params: [
      { name: 'id', in: 'path', type: 'string', required: true, desc: 'DBxxxxx (drug), CHEMBLxxxx (compound), Dxxxxxx (MeSH disease) or NOVEL-xxxxxxxx (a SMILES-only compound from an earlier POST /predict). The client URL-encodes it.' },
    ],
    request: ENTITY_REQ,
    response: ENTITY_RES,
    extra: [{ label: 'Response · 200 (disease)', code: ENTITY_DISEASE_RES }],
    notes: [
      <>
        <code>404 not_found</code> when the id is unknown. NOVEL- ids exist only for the session that created them (the mock keeps them in{' '}
        <code>sessionStorage</code>), so the backend should either persist featurised compounds or expect a 404 after a restart.
      </>,
      <>
        Drugs and compounds add <code>targetsDetail</code>, <code>indicationsDetail</code> and <code>pathways</code>; diseases add{' '}
        <code>genesDetail</code>, <code>pathways</code>, <code>knownDrugs</code> (approved indications) and <code>curatedDrugs</code> (trial
        or literature evidence, with <code>outcome</code> and <code>phase</code>). Base fields are listed under Schemas.
      </>,
      <>
        <code>entrez</code> is <code>null</code> when a symbol has no Entrez mapping in the gene table.
      </>,
    ],
  },
  {
    id: 'predict',
    method: 'POST',
    path: '/predict',
    purpose: 'Resolve the input to one entity and score it against the whole index in the opposite direction: a drug or compound against every disease, a disease against every drug. Returns the top-k rows with a calibrated confidence and the shared biology behind each one.',
    params: [
      { name: 'query', in: 'body', type: 'string', required: true, desc: 'Free text, an id or a SMILES string. Required unless id is given; blank raises 400 empty_query. Echoed back as query.raw.' },
      { name: 'type', in: 'body', type: "'auto' | 'drug' | 'compound' | 'disease' | 'smiles'", required: false, desc: 'How to read query. Default auto. See Conventions for what each value does.' },
      { name: 'id', in: 'body', type: 'string', required: false, desc: 'Canonical id chosen from autocomplete. When present it wins over query, which is only echoed. An unknown id raises 404 not_found.' },
      { name: 'top_k', in: 'body', type: 'integer', required: false, desc: 'Rows to return, 1–50. Out-of-range values are clamped, non-numbers fall back to the default 15. Echoed as topK.' },
      { name: 'threshold', in: 'body', type: 'number', required: false, desc: 'Decision threshold in [0, 1], default 0.79. Only affects aboveThreshold and summary.above; ranking is unchanged.' },
    ],
    request: PREDICT_REQ,
    response: PREDICT_RES,
    extra: [
      { label: 'Request (SMILES)', code: PREDICT_SMILES_REQ },
      { label: 'Response · 200 (unregistered compound)', code: PREDICT_SMILES_RES },
    ],
    notes: [
      <>
        <code>400 empty_query</code>: query blank and no id. <code>422 invalid_smiles</code>: type is smiles (or SMILES was
        auto-detected) and the string does not parse; the message names the reason. <code>404 not_found</code>: nothing in the index
        matches, or the id is unknown.
      </>,
      <>
        A SMILES string that exactly matches an indexed drug resolves to that drug. Any other valid SMILES is featurised on the fly into a
        compound with a NOVEL- id, <code>novel: true</code>, <code>descriptors.estimated: true</code>, targets inherited from its nearest
        neighbours (<code>inferredTargets: true</code>) and a <code>neighbors</code> list. Its rows carry <code>inherited: true</code> and a
        discounted confidence.
      </>,
      <>
        <code>summary</code> counts the whole index: rows scored, rows at or above the threshold, rows that are approved indications
        (<code>known: true</code>) and rows actually returned. <code>model.latencyMs</code> is inference time in milliseconds.
      </>,
      <>
        The client always sends all five body fields (<code>id</code> is dropped when undefined). <code>confidence</code> is rounded to
        three decimals.
      </>,
    ],
  },
  {
    id: 'explain',
    method: 'GET',
    path: '/explain',
    purpose: 'Everything behind one drug–disease score: feature contributions, shared and one-hop genes, pathway overlap, a bipartite graph for the viewer, latent-space neighbours, evidence records and side effects.',
    params: [
      { name: 'drug', in: 'query', type: 'string', required: true, desc: 'Drug or compound id (DBxxxxx, CHEMBLxxxx or NOVEL-…).' },
      { name: 'disease', in: 'query', type: 'string', required: true, desc: 'MeSH disease id (Dxxxxxx).' },
    ],
    request: EXPLAIN_REQ,
    response: EXPLAIN_RES,
    notes: [
      <>
        <code>400 bad_request</code> when either parameter is missing; <code>404 not_found</code> when an id is unknown.
      </>,
      <>
        There is no threshold parameter: <code>threshold</code> echoes the model default (0.79) and <code>aboveThreshold</code> is judged
        against it.
      </>,
      <>
        <code>featureContributions</code> are additive logits: their sum is <code>logit</code> and <code>sigmoid(logit)</code> is{' '}
        <code>confidence</code>. <code>calibration</code> is the held-out bucket the confidence falls in, with its empirical precision and
        size.
      </>,
      <>
        <code>graph.ppiEdges</code> lists <code>[a, b]</code> gene-symbol pairs between <code>drugTargets</code> and{' '}
        <code>diseaseGenes</code> (STRING, score ≥ 700). <code>evidence</code> entries always carry <code>source</code>, <code>kind</code>{' '}
        and <code>label</code>; <code>detail</code>, <code>url</code>, <code>count</code>, <code>score</code>, <code>year</code> and{' '}
        <code>outcome</code> appear only where they apply.
      </>,
    ],
  },
  {
    id: 'sources',
    method: 'GET',
    path: '/sources',
    purpose: 'The eleven harmonised databases, the six standardised tables built from them and the preprocessing decisions. Static for a given dataset build.',
    params: [],
    request: `curl ${HOST}/sources`,
    response: SOURCES_RES,
    notes: [
      <>
        <code>records</code> is <code>null</code> when a source contributes annotations rather than countable rows (LINCS L1000);{' '}
        <code>recordLabel</code> is always a display string.
      </>,
      <>Cacheable for the life of a deployment; the client fetches it once per page that needs it.</>,
    ],
  },
  {
    id: 'model',
    method: 'GET',
    path: '/model',
    purpose: 'The model card: architecture, hyper-parameters, training set, held-out metrics at two operating points, ROC and PR curve points, validation protocol, design decisions and the calibration table that GET /explain cites.',
    params: [],
    request: `curl ${HOST}/model`,
    response: MODEL_RES,
    notes: [
      <>
        <code>curves.roc</code> points are <code>[fpr, tpr]</code>; <code>curves.pr</code> points are <code>[recall, precision]</code>.
        Both are drawn as-is, so keep them sorted along the x axis.
      </>,
      <>
        <code>metrics.at[1]</code> is the F1-optimal operating point and <code>model.threshold</code> is the same 0.79 that POST /predict
        defaults to. Keep the two in step.
      </>,
      <>
        <code>calibration</code> buckets are half-open: <code>"0.79 – 0.90"</code> covers 0.79 ≤ p &lt; 0.90; the top bucket includes
        1.00. <code>bucket</code> is a display label; <code>empiricalPrecision</code> and <code>n</code> are the numbers.
      </>,
    ],
  },
  {
    id: 'stats',
    method: 'GET',
    path: '/stats',
    purpose: 'Knowledge-graph counts for the home and database pages: entities, typed edges with their share of the total, and the feature matrices with their sparsity.',
    params: [],
    request: `curl ${HOST}/stats`,
    response: STATS_RES,
    notes: [
      <>
        <code>edges.byType[].share</code> values sum to 1. <code>matrices[].sparsity</code> is <code>null</code> for the dense descriptor
        matrix.
      </>,
      <>
        The in-browser mock adds a <code>mockIndex</code> object with the size of its small sample index. It is not part of the contract
        and the client ignores it.
      </>,
    ],
  },
  {
    id: 'auth-login',
    method: 'POST',
    path: '/auth/login',
    purpose: 'Exchange an email and password for a bearer token and the public user record.',
    params: [
      { name: 'email', in: 'body', type: 'string', required: true, desc: 'Compared case-insensitively after trimming.' },
      { name: 'password', in: 'body', type: 'string', required: true, desc: 'Plain text over HTTPS; never logged or echoed.' },
    ],
    request: LOGIN_REQ,
    response: LOGIN_RES,
    notes: [
      <>
        <code>401 invalid_credentials</code> for a wrong email or password, with one generic message for both.
      </>,
      <>
        The client stores <code>token</code> under the localStorage key <code>dawa.token</code> and sends it as{' '}
        <code>Authorization: Bearer</code> on every later request. The format is opaque to the client: the mock issues{' '}
        <code>mock.</code> plus the base64 email; a real backend should issue a signed JWT or an opaque session id.
      </>,
      <>
        <code>user</code> is <code>{'{ name, email, affiliation, role, createdAt }'}</code>; <code>affiliation</code> may be{' '}
        <code>null</code>.
      </>,
    ],
  },
  {
    id: 'auth-register',
    method: 'POST',
    path: '/auth/register',
    purpose: 'Create an account and sign it in immediately. Returns the same shape as login.',
    params: [
      { name: 'name', in: 'body', type: 'string', required: true, desc: 'Non-empty after trimming.' },
      { name: 'email', in: 'body', type: 'string', required: true, desc: 'A syntactically valid address, unique across accounts.' },
      { name: 'password', in: 'body', type: 'string', required: true, desc: 'At least 8 characters.' },
      { name: 'affiliation', in: 'body', type: 'string', required: false, desc: 'Institution; stored as null when absent.' },
    ],
    request: REGISTER_REQ,
    response: REGISTER_RES,
    notes: [
      <>
        <code>422 validation</code> with a field-specific message for a missing name, malformed email or short password;{' '}
        <code>409 conflict</code> when the email is already registered.
      </>,
      <>
        <code>user.role</code> is <code>"researcher"</code> for self-registered accounts; <code>createdAt</code> is an ISO 8601 UTC
        timestamp.
      </>,
    ],
  },
  {
    id: 'auth-me',
    method: 'GET',
    path: '/auth/me',
    purpose: 'Return the user behind a bearer token. Called once on page load to restore a session.',
    params: [{ name: 'Authorization', in: 'header', type: 'string', required: true, desc: 'Bearer <token> from login or register.' }],
    request: ME_REQ,
    response: ME_RES,
    notes: [
      <>
        <code>401 unauthenticated</code> for a missing, unknown or expired token. The client treats any failure here as signed out and
        discards the stored token, so a merely stale token must produce a 401, never a 5xx.
      </>,
    ],
  },
  {
    id: 'auth-logout',
    method: 'POST',
    path: '/auth/logout',
    purpose: 'Invalidate the bearer token server-side. No request body.',
    params: [{ name: 'Authorization', in: 'header', type: 'string', required: true, desc: 'The token to revoke.' }],
    request: LOGOUT_REQ,
    response: LOGOUT_RES,
    notes: [
      <>
        The client clears its stored token whether or not this call succeeds, so the body is informational. Return 200 with{' '}
        <code>ok: true</code> even when the token was already invalid.
      </>,
    ],
  },
]

const TOC = [
  { id: 'overview', label: 'Overview' },
  { id: 'conventions', label: 'Conventions' },
  { id: 'endpoints', label: 'Endpoints', children: ENDPOINTS.map((e) => ({ id: e.id, method: e.method, path: e.path })) },
  { id: 'schemas', label: 'Schemas' },
  { id: 'integration', label: 'Frontend integration' },
]

/* Priority order for the active-section observer: an endpoint wins over its parent section. */
const OBSERVED_IDS = ['overview', 'conventions', ...ENDPOINTS.map((e) => e.id), 'endpoints', 'schemas', 'integration']

/* ------------------------------------------------------------------
   Hooks and sub-components
   ------------------------------------------------------------------ */

function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined
    const visible = new Map()
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => visible.set(entry.target.id, entry.isIntersecting))
        const first = ids.find((id) => visible.get(id))
        if (first) setActive(first)
      },
      { rootMargin: '-12% 0px -68% 0px', threshold: 0 },
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    // At the very bottom of the page the last section may never reach the band.
    const onScroll = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (atBottom) setActive(ids[ids.length - 1])
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [ids])

  return active
}

function fallbackCopy(text) {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(area)
  if (!ok) throw new Error('Copy command was refused')
}

function renderCode(code) {
  const lines = code.split('\n')
  return lines.map((line, i) => {
    const comment = line.trimStart().startsWith('// ')
    return (
      <span key={i} className={comment ? 'docs-code__comment' : undefined}>
        {line}
        {i < lines.length - 1 ? '\n' : ''}
      </span>
    )
  })
}

function CodeBlock({ code, label }) {
  const [state, setState] = useState('idle')
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const flash = (next) => {
    setState(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1800)
  }

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code)
      else fallbackCopy(code)
      flash('copied')
    } catch {
      flash('failed')
    }
  }

  return (
    <figure className="docs-snippet">
      <figcaption className="docs-snippet__bar">
        <span className="docs-snippet__label">{label}</span>
        <button type="button" className="copy-btn" onClick={copy} aria-label={`Copy ${label.toLowerCase()} to clipboard`}>
          {state === 'copied' ? (
            <>
              <Icon.Check size={12} /> Copied
            </>
          ) : state === 'failed' ? (
            <>
              <Icon.Alert size={12} /> Not copied
            </>
          ) : (
            <>
              <Icon.Copy size={12} /> Copy
            </>
          )}
        </button>
        <span className="sr-only" role="status">
          {state === 'copied' ? 'Copied to clipboard' : state === 'failed' ? 'Copy failed; select the text instead' : ''}
        </span>
      </figcaption>
      <pre className="docs-code" tabIndex={0} aria-label={label}>
        <code>{renderCode(code)}</code>
      </pre>
    </figure>
  )
}

function ParamTable({ rows }) {
  return (
    <div className="table-wrap docs-table">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">In</th>
            <th scope="col">Type</th>
            <th scope="col">Required</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>
                <code>{r.name}</code>
              </td>
              <td>{r.in}</td>
              <td className="mono small">{r.type}</td>
              <td>{r.required ? <span className="docs-req">required</span> : <span className="docs-opt">optional</span>}</td>
              <td>{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FieldTable({ rows, caption }) {
  return (
    <div className="table-wrap docs-table">
      <table className="table">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Type</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([field, type, desc]) => (
            <tr key={field}>
              <td>
                <code>{field}</code>
              </td>
              <td className="mono small">{type}</td>
              <td>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Endpoint({ ep }) {
  const isGet = ep.method === 'GET'
  return (
    <article id={ep.id} className="docs-endpoint" aria-labelledby={`${ep.id}-title`}>
      <h3 id={`${ep.id}-title`} className="docs-endpoint__title">
        <span className={cx('tag', isGet ? 'tag--ink' : 'tag--accent')}>{ep.method}</span>
        <code className="docs-endpoint__path">/api{ep.path}</code>
      </h3>
      <p className="docs-endpoint__purpose">{ep.purpose}</p>

      <div className="eyebrow docs-sub">Parameters</div>
      {ep.params.length ? <ParamTable rows={ep.params} /> : <p className="small muted">None.</p>}

      <CodeBlock label="Request" code={ep.request} />
      <CodeBlock label="Response · 200" code={ep.response} />
      {ep.extra?.map((x) => (
        <CodeBlock key={x.label} label={x.label} code={x.code} />
      ))}

      {ep.notes?.length ? (
        <>
          <div className="eyebrow docs-sub">Errors and notes</div>
          <ul className="docs-notes">
            {ep.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </>
      ) : null}
    </article>
  )
}

function Toc({ active }) {
  const parentActive = ENDPOINTS.some((e) => e.id === active)
  return (
    <nav className="docs__toc" aria-label="On this page">
      <div className="eyebrow docs__toc-title">On this page</div>
      <ol className="docs__toc-list">
        {TOC.map((item) => {
          const isActive = active === item.id
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={cx('docs__toc-link', isActive && 'is-active', item.children && parentActive && 'is-parent')}
                aria-current={isActive ? 'location' : undefined}
              >
                {item.label}
              </a>
              {item.children ? (
                <ol className="docs__toc-sub">
                  {item.children.map((c) => (
                    <li key={c.id}>
                      <a
                        href={`#${c.id}`}
                        className={cx('docs__toc-link', active === c.id && 'is-active')}
                        aria-current={active === c.id ? 'location' : undefined}
                      >
                        <span className="docs__toc-method">{c.method}</span>
                        {c.path}
                      </a>
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ------------------------------------------------------------------
   Page
   ------------------------------------------------------------------ */

export default function Docs() {
  const active = useActiveSection(OBSERVED_IDS)

  useEffect(() => {
    document.title = 'API docs · Dawa'
    const hash = window.location.hash.slice(1)
    if (!hash) return undefined
    const el = document.getElementById(hash)
    if (!el) return undefined
    const frame = requestAnimationFrame(() => el.scrollIntoView())
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="docs container">
      <header className="docs__head">
        <div>
          <div className="eyebrow">API reference · v1</div>
          <h1 className="h1">
            One contract, <em>eleven</em> endpoints.
          </h1>
          <p className="lede">
            Everything the interface reads or writes goes through <code>/api</code>. This page is the specification the Flask backend
            implements and the React client already consumes; the in-browser mock returns exactly these payloads.
          </p>
        </div>
        <div className={cx('docs__mode', !USE_MOCK && 'docs__mode--live')} role="status">
          <span className="docs__mode-dot" aria-hidden="true" />
          {USE_MOCK ? (
            'Mock mode (in-browser)'
          ) : (
            <>
              Live: <code>{API_BASE}</code>
            </>
          )}
        </div>
      </header>

      <div className="docs__layout">
        <Toc active={active} />

        <div className="docs__content">
          {/* ------------------------------------------------ 01 overview */}
          <section id="overview" className="docs-section" aria-labelledby="overview-title">
            <div className="eyebrow">01</div>
            <h2 id="overview-title" className="h2">
              Overview
            </h2>
            <div className="docs-prose">
              <p>
                The API is JSON over HTTP under a single prefix, <code>/api</code>. In development the Vite server proxies that prefix to
                the Flask process on <code>http://localhost:5000</code> (see <code>vite.config.js</code>), so the browser only ever talks
                to its own origin. The proxy does not rewrite paths: Flask must mount every route under <code>/api</code> as well.
              </p>
              <p>
                Requests with a body send <code>Content-Type: application/json</code>; every response, including an error, is JSON. Once a
                user has signed in the client adds <code>Authorization: Bearer &lt;token&gt;</code> to every request, not only to the
                auth routes, so unauthenticated routes must tolerate the header.
              </p>
            </div>

            <dl className="dl docs-facts">
              <dt>Base URL</dt>
              <dd>
                <code>/api</code>, overridable with <code>VITE_API_BASE</code>
              </dd>
              <dt>Dev proxy</dt>
              <dd>
                <code>/api/*</code> → <code>http://localhost:5000/api/*</code>
              </dd>
              <dt>Format</dt>
              <dd>JSON request bodies, JSON responses, UTF-8</dd>
              <dt>Auth</dt>
              <dd>
                <code>Authorization: Bearer &lt;token&gt;</code> when signed in
              </dd>
              <dt>Mock</dt>
              <dd>
                Served in-browser while <code>VITE_USE_MOCK</code> is not <code>false</code>
              </dd>
            </dl>

            <h3 className="h3 docs-h3">Switching from the mock to Flask</h3>
            <div className="docs-prose">
              <p>
                By default every call is answered by <code>src/api/mock</code> without touching the network. Create <code>.env.local</code>{' '}
                at the project root to point the client at the real server; <code>.env.example</code> documents both variables. With{' '}
                <code>VITE_API_BASE=/api</code> the Vite proxy forwards to Flask; set it to a full origin such as{' '}
                <code>http://localhost:5000/api</code> to bypass the proxy, in which case Flask needs CORS (see Frontend integration).
              </p>
            </div>
            <CodeBlock label=".env.local" code={ENV_EXAMPLE} />

            <h3 className="h3 docs-h3">Errors</h3>
            <div className="docs-prose">
              <p>
                Every non-2xx response carries the same envelope: a human-readable <code>message</code> the interface shows verbatim and a
                stable <code>code</code> the client branches on. The HTTP status carries the class of failure. The client wraps both in an{' '}
                <code>ApiError</code> with <code>message</code>, <code>status</code>, <code>code</code> and the parsed body as{' '}
                <code>details</code>.
              </p>
            </div>
            <CodeBlock label="Error envelope" code={ERROR_EXAMPLE} />
            <div className="table-wrap docs-table">
              <table className="table">
                <caption className="sr-only">Error codes</caption>
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col" className="num">
                      HTTP
                    </th>
                    <th scope="col">Raised by</th>
                    <th scope="col">When</th>
                  </tr>
                </thead>
                <tbody>
                  {ERROR_CODES.map((e) => (
                    <tr key={e.code}>
                      <td>
                        <code>{e.code}</code>
                      </td>
                      <td className="num mono">{e.status}</td>
                      <td className="small">{e.where}</td>
                      <td>{e.when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------------------------ 02 conventions */}
          <section id="conventions" className="docs-section" aria-labelledby="conventions-title">
            <div className="eyebrow">02</div>
            <h2 id="conventions-title" className="h2">
              Conventions
            </h2>
            <div className="docs-prose">
              <p>
                Every entity has exactly one canonical id and the id alone tells you its kind. The client shows ids in monospace and passes
                them around unchanged; the backend must accept them verbatim, including the NOVEL- ids it minted itself.
              </p>
            </div>

            <h3 className="h3 docs-h3">Identifiers</h3>
            <div className="table-wrap docs-table">
              <table className="table">
                <caption className="sr-only">Identifier namespaces</caption>
                <thead>
                  <tr>
                    <th scope="col">Pattern</th>
                    <th scope="col">Namespace</th>
                    <th scope="col">Example</th>
                    <th scope="col">Used for</th>
                  </tr>
                </thead>
                <tbody>
                  {ID_ROWS.map((r) => (
                    <tr key={r.example}>
                      <td className="mono small">{r.prefix}</td>
                      <td>{r.ns}</td>
                      <td>
                        <code>{r.example}</code>
                      </td>
                      <td>{r.use}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="h3 docs-h3">Input types</h3>
            <div className="docs-prose">
              <p>
                <code>POST /predict</code> takes a <code>type</code> that says how to read <code>query</code>. The search box exposes the
                same five values as a segmented control and defaults to <code>auto</code>.
              </p>
            </div>
            <div className="table-wrap docs-table">
              <table className="table">
                <caption className="sr-only">Input types</caption>
                <thead>
                  <tr>
                    <th scope="col">type</th>
                    <th scope="col">Behaviour</th>
                  </tr>
                </thead>
                <tbody>
                  {TYPE_ROWS.map((r) => (
                    <tr key={r.value}>
                      <td>
                        <code>{r.value}</code>
                      </td>
                      <td>{r.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="h3 docs-h3">Confidence and threshold</h3>
            <div className="docs-prose">
              <p>
                <code>confidence</code> is a calibrated probability in [0, 1] with three decimals, not a raw score: on the held-out test
                set, pairs scored 0.79–0.90 were true positives 81% of the time. The default decision threshold is <strong>0.79</strong>,
                the F1-optimal operating point found on the validation set (precision 0.79, recall 0.87). It is a display boundary, not a
                filter: <code>POST /predict</code> always returns the top-k rows by confidence and marks each with{' '}
                <code>aboveThreshold</code>; <code>summary.above</code> counts how many rows in the whole index clear it. The interface
                lets the user move the threshold per request and renders rows above it in the accent colour, rows below it in grey.
              </p>
              <p>
                <code>top_k</code> is an integer from 1 to 50 (default 15). Values outside the range are clamped rather than rejected, and
                the effective value is echoed as <code>topK</code>. <code>direction</code> is <code>drug_to_disease</code> when the
                resolved entity is a drug or compound and <code>disease_to_drug</code> when it is a disease; <code>pair</code> on every
                row always names the drug and the disease explicitly so the client never has to reason about direction.
              </p>
              <p>
                Timestamps are ISO 8601 in UTC. Gene symbols are HGNC, upper case. Text fields may contain non-ASCII typography (en
                dashes, arrows, Greek letters) and must be served as UTF-8.
              </p>
            </div>
          </section>

          {/* ------------------------------------------------ 03 endpoints */}
          <section id="endpoints" className="docs-section" aria-labelledby="endpoints-title">
            <div className="eyebrow">03</div>
            <h2 id="endpoints-title" className="h2">
              Endpoints
            </h2>
            <div className="docs-prose">
              <p>
                Eleven routes, listed in the order the interface reaches for them. Each block gives the parameters, a runnable request
                against a local Flask server and a trimmed but genuine response; <code>// … n more</code> marks elided array items and
                the shapes are spelled out in full under Schemas.
              </p>
            </div>
            {ENDPOINTS.map((ep) => (
              <Endpoint key={ep.id} ep={ep} />
            ))}
          </section>

          {/* ------------------------------------------------ 04 schemas */}
          <section id="schemas" className="docs-section" aria-labelledby="schemas-title">
            <div className="eyebrow">04</div>
            <h2 id="schemas-title" className="h2">
              Schemas
            </h2>
            <div className="docs-prose">
              <p>
                Field names are camelCase in every response; the only snake_case anywhere is the <code>top_k</code> request field. Optional
                fields are absent rather than <code>null</code> unless the type says <code>| null</code>.
              </p>
            </div>

            <h3 className="h3 docs-h3">Entity: drug or compound</h3>
            <FieldTable rows={DRUG_FIELDS} caption="Drug and compound entity fields" />

            <h3 className="h3 docs-h3">Entity: disease</h3>
            <FieldTable rows={DISEASE_FIELDS} caption="Disease entity fields" />

            <h3 className="h3 docs-h3">Prediction row</h3>
            <div className="docs-prose">
              <p>
                One element of <code>predictions[]</code> from <code>POST /predict</code>.
              </p>
            </div>
            <FieldTable rows={PREDICTION_FIELDS} caption="Prediction row fields" />

            <h3 className="h3 docs-h3">Explanation</h3>
            <div className="docs-prose">
              <p>
                The body of <code>GET /explain</code>.
              </p>
            </div>
            <FieldTable rows={EXPLANATION_FIELDS} caption="Explanation fields" />

            <h3 className="h3 docs-h3">Enumerations</h3>
            <dl className="docs-enums">
              <div>
                <dt>direction</dt>
                <dd>
                  <code>drug_to_disease</code> · <code>disease_to_drug</code>
                </dd>
              </div>
              <div>
                <dt>type</dt>
                <dd>
                  <code>auto</code> · <code>drug</code> · <code>compound</code> · <code>disease</code> · <code>smiles</code>
                </dd>
              </div>
              <div>
                <dt>verdict</dt>
                <dd>
                  <code>Known indication</code> · <code>Strong repurposing candidate</code> · <code>Plausible — needs evidence</code> ·{' '}
                  <code>Weak signal</code>
                </dd>
              </div>
              <div>
                <dt>trial.outcome</dt>
                <dd>
                  <code>positive</code> · <code>mixed</code> · <code>negative</code> · <code>ongoing</code> · <code>approved</code>
                </dd>
              </div>
              <div>
                <dt>evidence.kind</dt>
                <dd>
                  <code>approved</code> · <code>trial</code> · <code>literature</code> · <code>curated</code> · <code>inferred</code> ·{' '}
                  <code>association</code> · <code>drug-gene</code> · <code>ppi</code> · <code>bioactivity</code> ·{' '}
                  <code>side-effects</code>
                </dd>
              </div>
              <div>
                <dt>featureContributions[].key</dt>
                <dd>
                  <code>bias</code> · <code>targets</code> · <code>pathways</code> · <code>ppi</code> · <code>prior</code> ·{' '}
                  <code>known</code> · <code>area</code> · <code>fingerprint</code> · <code>descriptors</code> · <code>sideEffects</code>
                </dd>
              </div>
              <div>
                <dt>sideEffects[].frequency</dt>
                <dd>
                  <code>very common</code> · <code>common</code> · <code>uncommon</code> · <code>rare</code>
                </dd>
              </div>
              <div>
                <dt>user.role</dt>
                <dd>
                  <code>researcher</code>
                </dd>
              </div>
            </dl>
          </section>

          {/* ------------------------------------------------ 05 integration */}
          <section id="integration" className="docs-section" aria-labelledby="integration-title">
            <div className="eyebrow">05</div>
            <h2 id="integration-title" className="h2">
              Frontend integration
            </h2>
            <div className="docs-prose">
              <p>
                The contract lives in one file, <code>src/api/index.js</code>: <code>api.search</code>, <code>api.entity</code>,{' '}
                <code>api.predict</code>, <code>api.explain</code>, <code>api.sources</code>, <code>api.model</code>,{' '}
                <code>api.stats</code> and <code>api.auth.signIn / signUp / me / signOut</code>. It delegates to{' '}
                <code>src/api/client.js</code>, which builds the URL from <code>VITE_API_BASE</code>, attaches the bearer token, parses the
                error envelope into <code>ApiError</code> and, while <code>VITE_USE_MOCK</code> is on, routes the call to the in-browser
                mock instead of <code>fetch</code>. Pages never call <code>fetch</code> and never import from <code>src/api/mock</code>, so
                swapping the mock for Flask changes no UI code.
              </p>
            </div>

            <h3 className="h3 docs-h3">How pages consume it</h3>
            <div className="docs-prose">
              <p>
                Data pages wrap a call in <code>useApi</code>, which owns the loading, error and data states, aborts a superseded request
                through <code>AbortSignal</code> and exposes <code>reload</code> for the retry button. Every page renders a skeleton while
                loading, an error state with retry, and an explicit empty state.
              </p>
            </div>
            <CodeBlock label="src/pages/Results.jsx (pattern)" code={USE_API_EXAMPLE} />

            <div className="table-wrap docs-table">
              <table className="table">
                <caption className="sr-only">Which page calls which endpoint</caption>
                <thead>
                  <tr>
                    <th scope="col">Route</th>
                    <th scope="col">Page</th>
                    <th scope="col">Endpoints</th>
                  </tr>
                </thead>
                <tbody>
                  {PAGE_USAGE.map(([route, page, eps]) => (
                    <tr key={route}>
                      <td>
                        <code>{route}</code>
                      </td>
                      <td>{page}</td>
                      <td className="mono small">{eps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="h3 docs-h3">
              Query history <span className="tag tag--accent">planned</span>
            </h3>
            <div className="docs-prose">
              <p>
                History is client-side for now: <code>src/hooks/useQueryHistory.js</code> keeps the last 50 queries in localStorage under{' '}
                <code>dawa.history.v1</code> and the <Link to="/history" className="link">History page</Link> reads them back. The entry
                shape is already API-friendly so that, once accounts exist server-side, it can move to <code>GET /api/history</code>{' '}
                (newest first, for the signed-in user) and <code>POST /api/history</code> (one entry per completed prediction) without
                changing the page. Neither route exists yet in the client or the mock.
              </p>
            </div>
            <CodeBlock label="History entry (proposed body)" code={HISTORY_ENTRY} />

            <h3 className="h3 docs-h3">CORS</h3>
            <div className="docs-prose">
              <p>
                Through the Vite proxy the browser sees a single origin and no CORS headers are needed. If <code>VITE_API_BASE</code> is
                set to the Flask origin directly, or the built site is served from a different host than the API, Flask must allow that
                origin. The token travels in a header, not a cookie, so credentials mode is not required.
              </p>
            </div>
            <CodeBlock label="app.py" code={CORS_EXAMPLE} />

            <h3 className="h3 docs-h3">Demo account</h3>
            <div className="docs-prose">
              <p>
                The mock ships one account: <code>demo@dawa.ae</code> with password <code>demo1234</code>, plus any accounts registered in
                the current browser (kept in localStorage under <code>dawa.mock.users</code>). Sign in from the{' '}
                <Link to="/signin" className="link">sign-in page</Link> to see the authenticated navigation; the real backend will seed its
                own users.
              </p>
            </div>

            <p className="docs-prose">
              <Link to="/model" className="arrow-link">
                Read the model card <Icon.ArrowRight size={16} />
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
