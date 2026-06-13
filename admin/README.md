# PassGP — Admin Panel

A standalone **React + Vite** admin console for the PassGP AI Oral Examiner.
Talks directly to **Supabase** (with admin RLS) for data, and to the Node
backend for privileged actions (Jotform import).

## Features

- **Auth** — email/password login + password reset (Supabase Auth, admin-only)
- **Dashboard** — users, exams, questions, AI sessions, activity feed + chart
- **Questions** — full CRUD, search, category filter, enable/disable, CSV export,
  **Import from Jotform**
- **Candidates** — profiles, exam history, performance
- **Exam Sessions** — review responses + AI feedback, download transcripts
- **Transcripts** — view, search inside, download
- **Analytics** — growth, exam distribution, score trend, distribution (Recharts)
- **AI Configuration** — voice, difficulty, examiner instructions, prompt override
- **Settings** — integrations status, secure API config, security controls

## Setup

```bash
cd admin
cp .env.example .env      # fill in Supabase URL + publishable (anon) key
npm install
npm run dev               # http://localhost:5174
```

`.env`:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
VITE_API_BASE=            # blank in dev (uses Vite proxy to :5050)
```

## First-time database setup

1. Run **`server/db/schema.sql`** (main tables) — if not already done.
2. Run **`server/db/admin_schema.sql`** (admin tables + RLS) in the Supabase SQL editor.
3. Create an admin login from the server folder:
   ```bash
   cd ../server
   npm run create:admin -- admin@passgp.com 'YourStrongPassword!'
   ```
4. Sign in at `/login`.

## Architecture

- Reads/writes go straight to Supabase using the **publishable (anon)** key.
  Row Level Security + the `is_admin()` function gate all admin access.
- The **secret** key never touches the browser. Privileged server work
  (Jotform import) runs on the Node backend behind an admin-JWT check.
