import 'dotenv/config'
import { supabase } from './supabase.js'

/**
 * CLI connection check:  npm run verify:db
 * Confirms the Supabase URL + SECRET key are valid and reports which of the
 * PassGP tables exist yet.
 */

const TABLES = ['profiles', 'exam_questions', 'exam_sessions', 'session_turns']

function ok(msg) {
  console.log('  \x1b[32m✓\x1b[0m ' + msg)
}
function bad(msg) {
  console.log('  \x1b[31m✗\x1b[0m ' + msg)
}

async function main() {
  console.log('\nPassGP — Supabase connection check')
  console.log('──────────────────────────────────')
  console.log('  URL:', process.env.SUPABASE_URL || '(missing)')

  if (!supabase) {
    bad('SUPABASE_URL / SUPABASE_SECRET_KEY missing in .env')
    process.exit(1)
  }

  // 1) Auth admin call — only works with a valid service/secret key.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
  if (error) {
    bad('Secret key rejected: ' + error.message)
    process.exit(1)
  }
  ok(`Connected. Secret key valid. Auth users so far: ${data?.users?.length ?? 0}`)

  // 2) Probe each table to see if the schema has been created yet.
  //    Use a real select (not head/count) so a missing table reliably errors.
  console.log('\n  Tables:')
  let missing = 0
  for (const t of TABLES) {
    const { error: tErr } = await supabase.from(t).select('*').limit(1)
    if (tErr) {
      missing++
      bad(`${t}  —  not found (${tErr.message})`)
    } else {
      ok(`${t}  —  exists`)
    }
  }

  console.log('')
  if (missing === 0) {
    ok('All tables present. Database is ready. 🎉')
  } else {
    console.log(`  \x1b[33m!\x1b[0m ${missing} table(s) missing — paste server/db/schema.sql into the Supabase SQL Editor and run it.`)
  }
  console.log('')
}

main().catch((e) => {
  bad('Unexpected error: ' + e.message)
  process.exit(1)
})
