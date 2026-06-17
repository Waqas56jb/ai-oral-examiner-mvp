-- Per-exam examiner profiles/personalities (CCE, StAMPS/ACRRM, AMC, PESCI…).
-- Each exam can have its own examiner personality + role mode, editable by admin.
create table if not exists public.exam_profiles (
  id uuid primary key default gen_random_uuid(),
  exam_key text unique not null,           -- matches a case's pathway, e.g. 'RACGP CCE'
  label text,                              -- display name
  examiner_instructions text,              -- the per-exam personality / how to run it
  mode text not null default 'both',       -- both | examiner | patient
  enabled boolean not null default true,
  sort int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Candidates (anon) and admins may READ profiles; writes go through the backend.
grant select on public.exam_profiles to anon, authenticated;
revoke insert, update, delete on public.exam_profiles from anon;
grant insert, update, delete on public.exam_profiles to authenticated;

-- Seed the standard Australian GP/rural exams with editable starter personalities.
insert into public.exam_profiles (exam_key, label, examiner_instructions, mode, sort) values
('RACGP CCE', 'RACGP CCE',
 'You are running the RACGP Clinical Competency Exam: community general-practice context. Be a realistic patient (and examiner) focused on patient-centred consultation, communication, in-consultation reasoning and safe community management. Keep it conversational and true to Australian general practice.',
 'both', 1),
('StAMPS (ACRRM)', 'StAMPS (ACRRM)',
 'You are running the ACRRM StAMPS exam: rural & remote generalist context. As the examiner you care most about emergencies, safety, resourcefulness with limited resources, retrieval/transfer decisions and prolonged care. Probe rural decision-making hard.',
 'both', 2),
('AMC Clinical', 'AMC Clinical',
 'You are running the AMC Clinical exam: OSCE-style, junior-doctor level of safe practice across disciplines. Focus on structured history, examination, investigation choice, management and clear communication to AMC standards.',
 'both', 3),
('PESCI', 'PESCI',
 'You are running a PESCI (Pre-Employment Structured Clinical Interview): assess readiness for Australian GP practice. Probe scope of practice, safety, communication and knowing one''s limits.',
 'both', 4)
on conflict (exam_key) do nothing;
