import 'dotenv/config'
import { supabase } from './supabase.js'

/**
 * Create (or promote) an admin user via the Supabase Auth admin API.
 *   npm run create:admin -- admin@passgp.com 'StrongPass123!'
 * Defaults are used if no args are given.
 *
 * Requires admin_schema.sql to have been run first (for the admin_users table).
 */

const email = process.argv[2] || 'admin@passgp.com'
const password = process.argv[3] || 'PassGP@Admin2026'

const ok = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m)
const bad = (m) => console.log('  \x1b[31m✗\x1b[0m ' + m)

async function main() {
  console.log('\nPassGP — create admin user')
  console.log('───────────────────────────')
  if (!supabase) {
    bad('Supabase not configured (.env).')
    process.exit(1)
  }

  // 1) Create the auth user (or find the existing one)
  let userId
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (created.error) {
    if (/already/i.test(created.error.message)) {
      ok('Auth user already exists — locating it…')
      // find existing user
      const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const found = list.data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())
      if (!found) {
        bad('Could not locate the existing user.')
        process.exit(1)
      }
      userId = found.id
      // reset password so the provided one works
      await supabase.auth.admin.updateUserById(userId, { password })
      ok('Password updated for existing user.')
    } else {
      bad('createUser failed: ' + created.error.message)
      process.exit(1)
    }
  } else {
    userId = created.data.user.id
    ok('Auth user created.')
  }

  // 2) Mark as admin
  const up = await supabase.from('admin_users').upsert({ id: userId, email, role: 'superadmin' })
  if (up.error) {
    bad('Could not write admin_users row: ' + up.error.message)
    console.log('\n  → Run server/db/admin_schema.sql in the Supabase SQL editor, then re-run this script.')
    process.exit(1)
  }
  ok('Marked as admin (superadmin).')

  console.log('\n  Admin login ready:')
  console.log('    Email:    ' + email)
  console.log('    Password: ' + password)
  console.log('')
}

main().catch((e) => {
  bad('Error: ' + e.message)
  process.exit(1)
})
