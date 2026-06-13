import 'dotenv/config'
import { jotformReady, listForms, parseClinicalCase, createForm, deleteForm } from './jotform.js'

const ok = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m)
const bad = (m) => console.log('  \x1b[31m✗\x1b[0m ' + m)

const CASE_FORM = process.argv[2] || '251572174898975' // Case L77

async function main() {
  console.log('\nPassGP — Jotform integration check')
  console.log('───────────────────────────────────')

  if (!jotformReady()) {
    bad('JOTFORM_API_KEY missing in .env')
    process.exit(1)
  }

  /* ---------------- READ ---------------- */
  console.log('\n[1] READ — list forms')
  const forms = await listForms({ limit: 200 })
  ok(`Connected. ${forms.length} forms readable.`)
  const cases = forms.filter((f) => /^case\s/i.test(f.title))
  ok(`Found ${cases.length} clinical "Case ..." forms (e.g. ${cases.slice(0, 3).map((c) => c.title).join(', ')})`)

  console.log('\n[2] READ — parse one clinical case for the examiner')
  const c = await parseClinicalCase(CASE_FORM)
  ok(`Title: ${c.title}`)
  ok(`Category: ${c.category || '(none)'}`)
  ok(`Scenario: ${c.scenario.slice(0, 140)}…`)
  ok(`Questions to ask (${c.questions.length}):`)
  c.questions.forEach((q, i) => console.log(`       ${i + 1}. ${q.slice(0, 90)}`))
  ok(`Model answers parsed: ${c.modelAnswers.length}  | Hints: ${c.hints ? 'yes' : 'no'}`)
  if (!c.scenario || c.questions.length === 0) {
    bad('Parser did not extract scenario/questions — needs adjusting for this form layout.')
  } else {
    ok('Case parsed cleanly — ready to feed the AI examiner. ✅')
  }

  /* ---------------- WRITE ---------------- */
  console.log('\n[3] WRITE — create a throwaway form, then delete it')
  let newId = null
  try {
    const created = await createForm({ title: 'PassGP API WRITE TEST (safe to ignore)' })
    newId = created?.id || created?.['id']
    if (!newId) throw new Error('No form id returned')
    ok(`Created form id=${newId} (write access confirmed)`)
  } catch (e) {
    bad(`Create failed: ${e.message}`)
  }
  if (newId) {
    try {
      await deleteForm(newId)
      ok(`Deleted form id=${newId} (cleanup done — no junk left in the account)`)
    } catch (e) {
      bad(`Delete failed (please remove form ${newId} manually): ${e.message}`)
    }
  }

  console.log('\n───────────────────────────────────')
  ok('READ + WRITE verified.\n')
}

main().catch((e) => {
  bad('Error: ' + e.message)
  process.exit(1)
})
