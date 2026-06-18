/**
 * Smart, forgiving search used across the admin (Training, Questions…).
 *
 *  - Case-insensitive AND punctuation/space-insensitive
 *    ("StAMPS (ACRRM)" matches "stamps", "st amps", "STAMPS").
 *  - Exam synonyms: searching one name finds the other
 *    (stamps ↔ ACRRM, cce ↔ RACGP, etc.).
 *  - Multi-word: every word in the query must appear somewhere in the row.
 */

// Strip everything except letters/numbers and lowercase — so spacing, dashes,
// brackets and case never block a match.
export const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')

// Groups of equivalent exam names. If a row contains any term in a group, all
// the other terms in that group will also match it.
const SYNONYMS = [
  ['acrrm', 'stamps', 'staamps'],
  ['racgp', 'cce'],
  ['amc', 'amcclinical'],
  ['pesci'],
]

// Build the normalized "haystack" for a row, augmented with exam synonyms.
function haystackOf(parts) {
  let h = norm(Array.isArray(parts) ? parts.join(' ') : parts)
  for (const group of SYNONYMS) {
    if (group.some((g) => h.includes(g))) h += group.join('')
  }
  return h
}

/**
 * @param {string[]|string} parts  the row's searchable fields (title, category, exam…)
 * @param {string} query           the raw search text
 */
export function matchesSearch(parts, query) {
  const q = String(query || '').trim()
  if (!q) return true
  const hay = haystackOf(parts)
  // every whitespace-separated word in the query must be present
  return q.split(/\s+/).filter(Boolean).every((word) => hay.includes(norm(word)))
}
