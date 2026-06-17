-- P4.13 reliable capture: record the case identity on every session
-- (question_id covers DB cases; form_id covers live Jotform cases).
alter table public.exam_sessions
  add column if not exists form_id text,
  add column if not exists case_title text;
