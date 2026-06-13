import 'dotenv/config'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'

/**
 * Run a .sql file against Supabase Postgres via the session pooler.
 *   npm run db:run -- db/admin_schema.sql
 */

const file = process.argv[2]
if (!file) {
  console.log('Usage: node db/runSql.mjs <path-to.sql>')
  process.exit(1)
}

const ref = process.env.SUPABASE_PROJECT_ID
const host = process.env.SUPABASE_DB_HOST
const port = Number(process.env.SUPABASE_DB_PORT || 5432)
const pw = process.env.SUPABASE_DB_PASSWORD

if (!ref || !host || !pw) {
  console.log('Missing SUPABASE_PROJECT_ID / SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD in .env')
  process.exit(1)
}

const sql = readFileSync(path.resolve(file), 'utf8')

const client = new pg.Client({
  host,
  port,
  user: `postgres.${ref}`,
  password: pw,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
})

const ok = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m)
const bad = (m) => console.log('  \x1b[31m✗\x1b[0m ' + m)

try {
  console.log(`\nRunning ${file} on ${host} …`)
  await client.connect()
  await client.query(sql) // simple protocol runs all statements
  ok('SQL executed successfully.')
  await client.end()
} catch (e) {
  bad('Failed: ' + e.message)
  try { await client.end() } catch { /* noop */ }
  process.exit(1)
}
