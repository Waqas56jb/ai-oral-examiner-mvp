import 'dotenv/config'
import { supabase } from './supabase.js'
import { listCaseForms, parseClinicalCase, deriveExamType } from '../integrations/jotform.js'

/**
 * Bulk-import the ENTIRE Jotform clinical case bank into Supabase.
 * No serverless timeout — run from the CLI:  npm run import:jotform
 * Idempotent: skips cases already imported (by external_ref).
 */

const ok = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m)

async function loadExistingRefs() {
  const set = new Set()
  let from = 0
  while (true) {
    const { data, error } = await supabase.from('exam_questions').select('external_ref').range(from, from + 999)
    if (error || !data || !data.length) break
    data.forEach((r) => r.external_ref && set.add(String(r.external_ref)))
    if (data.length < 1000) break
    from += 1000
  }
  return set
}

async function main() {
  console.log('\nPassGP — Jotform full bank import')
  console.log('──────────────────────────────────')
  if (!supabase) {
    console.log('  ✗ Supabase not configured (.env).')
    process.exit(1)
  }

  console.log('  Fetching case forms from Jotform (paginated)…')
  const cases = await listCaseForms()
  ok(`${cases.length} clinical case forms found.`)

  const existing = await loadExistingRefs()
  ok(`${existing.size} already in the database — these will be skipped.`)

  let imported = 0
  let skipped = 0
  let failed = 0
  const t0 = Date.now()

  for (let i = 0; i < cases.length; i++) {
    const f = cases[i]
    if (existing.has(String(f.id))) { skipped++; continue }
    try {
      const c = await parseClinicalCase(f.id, f.title)
      if (!c.scenario) { failed++; continue }
      const row = {
        exam_type: deriveExamType(c.category, c.title),
        external_ref: String(f.id),
        title: c.title,
        stem: c.scenario,
        marking_criteria: c.questions,
        is_active: true,
      }
      const ins = await supabase.from('exam_questions').insert(row).select('id').single()
      if (ins.error) { failed++; continue }
      await supabase.from('exam_questions').update({ model_answer: c.modelAnswers.join('\n\n') }).eq('id', ins.data.id)
      imported++
    } catch {
      failed++
    }
    if ((imported + skipped + failed) % 25 === 0) {
      const done = imported + skipped + failed
      const rate = done / ((Date.now() - t0) / 1000)
      const eta = Math.round((cases.length - done) / Math.max(rate, 0.1) / 60)
      console.log(`  … ${done}/${cases.length}  (imported ${imported}, skipped ${skipped}, failed ${failed})  ~${eta}m left`)
    }
  }

  console.log('\n──────────────────────────────────')
  ok(`Done. Imported ${imported}, skipped ${skipped}, failed ${failed} of ${cases.length}.`)
  console.log('')
}

main().catch((e) => {
  console.log('  ✗ Error:', e.message)
  process.exit(1)
})
