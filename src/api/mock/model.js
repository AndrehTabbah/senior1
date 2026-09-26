/* ------------------------------------------------------------------
   Model card for the Dawa VAE + MLP classifier (deck slides 8–12, 21).
   ------------------------------------------------------------------ */

export const MODEL = {
  name: 'Dawa VAE-128 + MLP',
  version: '0.9.2',
  trainedOn: '2026-08-14',
  framework: 'PyTorch 2.4',
  threshold: 0.79,
  latencyMs: { p50: 38, p95: 71 },
  summary:
    'A variational autoencoder compresses a 315-dimensional drug vector (Morgan fingerprint + RDKit descriptors) into a 128-dimensional latent embedding. A multilayer perceptron classifies each drug–disease pair using that embedding together with the pair\'s knowledge-graph neighbourhood, returning a calibrated probability.',
  input: {
    fingerprint: { name: 'Morgan fingerprint', bits: 300, radius: 2 },
    descriptors: ['MolWt', 'LogP', 'TPSA', 'NumHDonors', 'NumHAcceptors', 'NumRotatableBonds', 'RingCount', 'AromaticRings', 'HeavyAtomCount', 'NumAliphaticRings', 'FractionCSP3', 'NumValenceElectrons', 'MolMR', 'BalabanJ', 'BertzCT'],
    dims: 315,
    latentDims: 128,
  },
  architecture: {
    encoder: '315 → 256 → 128 (μ, log σ²)',
    decoder: '128 → 256 → 315',
    classifier: 'MLP on [z_drug ‖ graph features] → sigmoid',
    activation: 'ReLU + BatchNorm + Dropout(0.2)',
  },
  hyperparameters: [
    { param: 'Latent dim', value: '128' },
    { param: 'Hidden layers', value: '315 → 256 → 128 (encoder); 128 → 256 → 315 (decoder)' },
    { param: 'Activation', value: 'ReLU + BatchNorm + Dropout(0.2)' },
    { param: 'β (KL weight)', value: '0 → 1, linear warm-up over 10 epochs' },
    { param: 'Optimizer', value: 'Adam, lr = 1e-3, weight_decay = 1e-5' },
    { param: 'Batch size', value: '256' },
    { param: 'pos_weight', value: '5.0 (matches 1:5 negative sampling)' },
    { param: 'Early stopping', value: 'patience = 10 on validation AUPRC' },
  ],
  training: {
    positives: 100000,
    negatives: 500000,
    ratio: '1:5',
    split: 'Drug-level 70 / 15 / 15',
    positiveShare: 0.167,
    negativeSampling: 'Negatives sampled with Jaccard gene-overlap < 50% to avoid near-positives',
    crossValidation: '5-fold within the training split for hyper-parameter selection',
  },
  metrics: {
    primary: 'AUPRC',
    at: [
      { threshold: 0.5, label: '@ 0.5', auroc: 0.98, auprc: 0.897, f1: 0.799, accuracy: 0.92, precision: 0.686, recall: 0.956, rmse: 0.24 },
      { threshold: 0.79, label: '@ best F1 (0.79)', auroc: 0.98, auprc: 0.897, f1: 0.83, accuracy: 0.94, precision: 0.791, recall: 0.874, rmse: 0.24 },
    ],
    baseRate: 0.167,
    confusion: { threshold: 0.5, tp: 12866, fp: 5876, fn: 590, tn: 61404 },
    definitions: [
      { name: 'AUPRC', value: 0.897, formula: 'AUPRC = ∫ Precision(r) dRecall(r)', why: 'Primary metric. Sensitive to minority-class performance; recommended when positives are rare and false negatives are costly (Saito & Rehmsmeier, 2015).' },
      { name: 'AUROC', value: 0.98, formula: 'AUROC = ∫ TPR(t) dFPR(t)', why: 'Threshold-free ranking quality. Optimistic under class imbalance, so it is paired with AUPRC.' },
      { name: 'F1 (tuned)', value: 0.83, formula: 'F1 = 2 · (P · R) / (P + R)', why: 'Operating-point metric at the F1-optimal threshold (0.79) found by grid search on the validation set.' },
      { name: 'Precision / Recall', value: '0.79 / 0.87', formula: 'P = TP / (TP + FP) ; R = TP / (TP + FN)', why: 'Reported as a pair so a user can pick a threshold that suits their risk tolerance: high recall surfaces more candidates, high precision reduces wet-lab waste.' },
      { name: 'RMSE on probabilities', value: 0.24, formula: 'RMSE = √[ (1/n) Σ (pᵢ − yᵢ)² ]', why: 'Calibration check: probabilities should be meaningful, not just well-ranked (Niculescu-Mizil & Caruana, 2005).' },
    ],
  },
  /* Points for the hand-drawn SVG curves. */
  curves: {
    roc: [[0, 0], [0.005, 0.32], [0.01, 0.48], [0.02, 0.63], [0.03, 0.74], [0.05, 0.87], [0.07, 0.92], [0.09, 0.955], [0.12, 0.975], [0.15, 0.985], [0.2, 0.992], [0.3, 0.997], [0.5, 0.999], [0.75, 1], [1, 1]],
    rocMarkers: [{ label: '@ 0.5', fpr: 0.09, tpr: 0.956 }, { label: '@ best F1 (0.79)', fpr: 0.045, tpr: 0.874 }],
    pr: [[0, 1], [0.05, 0.995], [0.1, 0.99], [0.2, 0.975], [0.3, 0.96], [0.4, 0.945], [0.5, 0.93], [0.6, 0.91], [0.7, 0.88], [0.8, 0.84], [0.85, 0.81], [0.874, 0.791], [0.9, 0.74], [0.93, 0.68], [0.956, 0.6], [0.975, 0.5], [0.99, 0.35], [1, 0.167]],
    prMarkers: [{ label: '@ best F1', recall: 0.874, precision: 0.791 }, { label: '@ 0.5', recall: 0.956, precision: 0.686 }],
  },
  validation: [
    { title: '5-fold cross-validation', text: 'Within the training split, for hyper-parameter selection.' },
    { title: 'Hold-out test', text: '15% of drugs held out at drug level; no drug in test appears in training.' },
    { title: 'Threshold tuning', text: 'F1-optimal threshold found on the validation set, then evaluated once on test.' },
    { title: 'Sanity check', text: 'Verified that drugs with well-known indications rank those diseases at the top.' },
  ],
  designDecisions: [
    { title: 'VAE over plain autoencoder', text: 'The KL regulariser keeps the latent space smooth, which generalises better to unseen drugs — the repurposing case.' },
    { title: 'VAE over GNN', text: 'Drug features mix chemical structure with biological signatures; a VAE handles that heterogeneity directly and keeps inference on CPU.' },
    { title: 'Drug-level split', text: 'Pair-level splits leak drug identity across train and test. Splitting by drug prevents the model from memorising drug-specific shortcuts.' },
    { title: 'Hard-negative filtering', text: 'Negatives with > 50% Jaccard gene overlap to a positive are rejected so near-positives are not labelled as negatives.' },
    { title: 'Weighted negative sampling', text: 'Edge-type imbalance (84% gene–disease) is addressed with weighted negative sampling.' },
  ],
  calibration: [
    { bucket: '0.90 – 1.00', empiricalPrecision: 0.93, n: 4120 },
    { bucket: '0.79 – 0.90', empiricalPrecision: 0.81, n: 5810 },
    { bucket: '0.60 – 0.79', empiricalPrecision: 0.58, n: 6930 },
    { bucket: '0.40 – 0.60', empiricalPrecision: 0.39, n: 8150 },
    { bucket: '0.20 – 0.40', empiricalPrecision: 0.21, n: 12400 },
    { bucket: '0.00 – 0.20', empiricalPrecision: 0.05, n: 43326 },
  ],
}
