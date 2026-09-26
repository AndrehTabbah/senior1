/* ------------------------------------------------------------------
   Data sources, standardised tables and knowledge-graph statistics.
   Numbers come from the project's dataset build (deck slides 7–8).
   ------------------------------------------------------------------ */

export const SOURCES = [
  { id: 'drugbank', name: 'DrugBank', records: 19842, recordLabel: '19,842 drugs', role: 'Drug metadata + IDs', kind: 'Drug', url: 'https://go.drugbank.com', license: 'Academic (CC BY-NC 4.0)', version: '5.1.12', description: 'Canonical drug identifiers, SMILES, targets, ATC codes and approved indications.' },
  { id: 'chembl', name: 'ChEMBL', records: 2400000, recordLabel: '~2.4M compounds', role: 'Bioactivity', kind: 'Compound', url: 'https://www.ebi.ac.uk/chembl/', license: 'CC BY-SA 3.0', version: '34', description: 'Bioactivity measurements (IC50, Ki) linking compounds to protein targets.' },
  { id: 'ctd', name: 'CTD', records: 498000, recordLabel: '498K relationships', role: 'Drug–gene–disease', kind: 'Relations', url: 'https://ctdbase.org', license: 'Free for research', version: 'Jul 2025', description: 'Comparative Toxicogenomics Database: curated chemical–gene, chemical–disease and gene–disease relationships.' },
  { id: 'opentargets', name: 'Open Targets', records: 4480000, recordLabel: '4.48M associations', role: 'Gene–disease evidence', kind: 'Relations', url: 'https://platform.opentargets.org', license: 'CC0', version: '25.06', description: 'Integrated gene–disease association scores from genetics, literature and expression data.' },
  { id: 'dgidb', name: 'DGIdb', records: 23365, recordLabel: '23,365 interactions', role: 'Drug–gene', kind: 'Relations', url: 'https://www.dgidb.org', license: 'MIT', version: '5.0', description: 'Drug–gene interaction database aggregating druggable-genome annotations.' },
  { id: 'string', name: 'STRING', records: 234000, recordLabel: '234K edges', role: 'PPI network', kind: 'Network', url: 'https://string-db.org', license: 'CC BY 4.0', version: '12.0', description: 'Protein–protein interaction network (high-confidence edges, score ≥ 700).' },
  { id: 'sider', name: 'SIDER', records: 140658, recordLabel: '140,658 pairs', role: 'Side effects', kind: 'Drug', url: 'http://sideeffects.embl.de', license: 'CC BY-NC-SA 4.0', version: '4.1', description: 'Drug–side-effect pairs mined from package inserts, mapped to MedDRA.' },
  { id: 'dsigdb', name: 'DSigDB', records: 22527, recordLabel: '22,527 signatures', role: 'Drug signatures (aux)', kind: 'Expression', url: 'https://dsigdb.tanlab.org', license: 'Free for research', version: '1.0', description: 'Drug signature gene sets, used as auxiliary features.' },
  { id: 'lincs', name: 'LINCS L1000', records: null, recordLabel: 'Annotations', role: 'Gene expression', kind: 'Expression', url: 'https://lincsproject.org', license: 'CC BY 4.0', version: '2020', description: 'Perturbational gene-expression annotations for drug-treated cell lines.' },
  { id: 'edrug3d', name: 'e-Drug3D', records: 2162, recordLabel: '2,162 drugs', role: '3D structures', kind: 'Structure', url: 'https://chemoinfo.ipmc.cnrs.fr/MOLDB/index.php', license: 'Free for research', version: '2024', description: 'Curated 3D conformers of approved drugs for docking and structural features.' },
  { id: 'mesh', name: 'MeSH / UMLS', records: 30000, recordLabel: '~30K disease terms', role: 'Disease vocabulary & ID harmonisation', kind: 'Vocabulary', url: 'https://www.nlm.nih.gov/mesh/', license: 'NLM terms', version: '2025', description: 'Controlled vocabulary used as the canonical disease namespace (MeSH ids, UMLS CUIs).' },
]

export const TABLES = [
  { file: 'drug_target_std.parquet', columns: ['drug_uid', 'entrez_id', 'activity'], rows: 437000, rowsLabel: '437K', description: 'Drug → protein target edges with bioactivity class.' },
  { file: 'drug_disease_std.parquet', columns: ['drug_uid', 'mesh_id', 'evidence'], rows: 103000, rowsLabel: '103K', description: 'Known drug → disease associations (indications and curated evidence).' },
  { file: 'gene_disease_std.parquet', columns: ['entrez_id', 'mesh_id', 'source'], rows: 4500000, rowsLabel: '4.5M', description: 'Gene ↔ disease associations with provenance.' },
  { file: 'ppi_network_std.parquet', columns: ['entrez_id_1', 'entrez_id_2', 'score'], rows: 234000, rowsLabel: '234K', description: 'Protein–protein interaction edges (STRING, Entrez-mapped).' },
  { file: 'drug_sideeffect_std.parquet', columns: ['drug_uid', 'mesh_id', 'name'], rows: 141000, rowsLabel: '141K', description: 'Drug → side-effect edges (SIDER).' },
  { file: 'master_drug_table.parquet', columns: ['drug_uid', '+ 15 RDKit descriptors'], rows: 15000, rowsLabel: '~15K', description: 'One row per drug: identifiers, SMILES and z-scored molecular descriptors.' },
]

export const PREPROCESSING = [
  { title: 'ID harmonisation', text: 'All entities mapped to canonical ids: drug_uid, Entrez, MeSH, UMLS CUI.' },
  { title: 'Missing-value policy', text: 'Drugs without SMILES get zero-filled descriptors and rely on their target and side-effect profile.' },
  { title: 'PPI standardisation', text: 'Ensembl → Entrez mapping retained 49% of edges (234K of 474K); the loss is documented.' },
  { title: 'Disease id gaps', text: '30% of Open Targets diseases keep EFO/UMLS ids in a separate, tracked namespace.' },
]

export const STATS = {
  entities: { drugs: 10395, genes: 28642, diseases: 33506, sideEffects: 4759 },
  edges: {
    total: 5324697,
    byType: [
      { type: 'gene–disease', share: 0.842, count: 4482972 },
      { type: 'drug–target', share: 0.08, count: 427386 },
      { type: 'PPI', share: 0.044, count: 234000 },
      { type: 'drug–disease', share: 0.019, count: 103000 },
      { type: 'drug–side effect', share: 0.015, count: 80410 },
    ],
  },
  matrices: [
    { name: 'Drug molecular', shape: '10,395 × 15', type: 'Dense', nonZero: 'all (z-scored)', sparsity: null },
    { name: 'Drug–Target', shape: '10,395 × 28,642', type: 'Sparse CSR', nonZero: '427,386', sparsity: 0.9986 },
    { name: 'Drug–Side Effect', shape: '10,395 × 4,759', type: 'Sparse CSR', nonZero: '80,410', sparsity: 0.9984 },
    { name: 'Gene–Disease', shape: '28,642 × 33,506', type: 'Sparse CSR', nonZero: '4,482,972', sparsity: 0.9953 },
    { name: 'PPI Adjacency', shape: '28,642 × 28,642', type: 'Sparse CSR', nonZero: '467,694', sparsity: 0.9994 },
  ],
  sources: SOURCES.length,
  tables: TABLES.length,
  lastBuilt: '2026-08-14',
}
