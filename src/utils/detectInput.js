/* ------------------------------------------------------------------
   Heuristics for the search box: is this a SMILES string, and is it
   well-formed? These are deliberately conservative — the backend does
   the real parsing with RDKit. We only need enough to pick a sensible
   default input type and to give the user early feedback.
   ------------------------------------------------------------------ */

const SMILES_CHARS = /^[A-Za-z0-9@+\-[\]()\\/%=#$.:*]+$/
const ORGANIC_SUBSET = /^(Cl|Br|[BCNOPSFI]|[bcnops])/

/** True if the text is plausibly a SMILES string rather than a name. */
export function looksLikeSmiles(text) {
  const s = (text || '').trim()
  if (s.length < 2 || /\s/.test(s)) return false
  if (!SMILES_CHARS.test(s)) return false
  // A SMILES string almost always has structure characters or ring digits.
  const hasStructure = /[()[\]=#@\\/]|\d/.test(s)
  // Plain words like "Metformin" or "Aspirin" contain letters SMILES never uses.
  const hasNonSmilesLetters = /[DEGJLMQRTUVWXYZadefghijklmqrtuvwxyz]/.test(s.replace(/\[[^\]]*\]/g, ''))
  if (hasNonSmilesLetters) return false
  if (hasStructure) return true
  // Short all-organic strings such as "CCO" or "CCCC" (no structure chars).
  return s.length <= 12 && /^[A-Z]/.test(s) && ORGANIC_SUBSET.test(s) && !/[a-z]{3,}/.test(s)
}

/**
 * Light validation of a SMILES string.
 * Returns { valid: boolean, reason?: string }
 */
export function validateSmiles(text) {
  const s = (text || '').trim()
  if (!s) return { valid: false, reason: 'Empty' }
  if (!SMILES_CHARS.test(s)) return { valid: false, reason: 'Contains characters not used in SMILES' }

  let depth = 0
  let inBracket = false
  const rings = new Map()
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '[') {
      if (inBracket) return { valid: false, reason: 'Nested bracket atom' }
      inBracket = true
      continue
    }
    if (ch === ']') {
      if (!inBracket) return { valid: false, reason: 'Unmatched "]"' }
      inBracket = false
      continue
    }
    if (inBracket) continue
    if (ch === '(') depth++
    if (ch === ')') {
      depth--
      if (depth < 0) return { valid: false, reason: 'Unmatched ")"' }
    }
    if (ch === '%') {
      const two = s.slice(i + 1, i + 3)
      if (!/^\d\d$/.test(two)) return { valid: false, reason: 'Bad ring label after "%"' }
      rings.set(two, (rings.get(two) || 0) + 1)
      i += 2
      continue
    }
    if (/\d/.test(ch)) rings.set(ch, (rings.get(ch) || 0) + 1)
  }
  if (inBracket) return { valid: false, reason: 'Unclosed "["' }
  if (depth !== 0) return { valid: false, reason: 'Unbalanced parentheses' }
  for (const [label, count] of rings) {
    if (count % 2 !== 0) return { valid: false, reason: `Ring closure ${label} is not paired` }
  }
  if (/^[=#)]/.test(s) || /[=#(]$/.test(s)) return { valid: false, reason: 'Dangling bond symbol' }
  return { valid: true }
}

/**
 * Classify raw input into { kind: 'smiles' | 'text' | 'empty', valid, reason }.
 */
export function detectInput(text) {
  const s = (text || '').trim()
  if (!s) return { kind: 'empty', valid: false }
  if (looksLikeSmiles(s)) {
    const v = validateSmiles(s)
    return { kind: 'smiles', valid: v.valid, reason: v.reason }
  }
  return { kind: 'text', valid: s.length >= 2 }
}

export const INPUT_TYPES = [
  { value: 'auto', label: 'Auto' },
  { value: 'drug', label: 'Drug' },
  { value: 'disease', label: 'Disease' },
  { value: 'compound', label: 'Compound' },
  { value: 'smiles', label: 'SMILES' },
]

export const KIND_LABEL = {
  drug: 'Drug',
  compound: 'Compound',
  disease: 'Disease',
  smiles: 'SMILES',
  auto: 'Auto',
}
