-- Capture the candidate's spoken name on each session
alter table public.exam_sessions
  add column if not exists candidate_name text;
