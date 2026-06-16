-- Candidate registration fields captured before the exam starts.
alter table public.exam_sessions
  add column if not exists candidate_email text,
  add column if not exists pathway text;

create index if not exists idx_exam_sessions_candidate_email on public.exam_sessions (candidate_email);
