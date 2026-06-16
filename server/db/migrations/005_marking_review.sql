-- #3 Marking controls + #6 timers (per case)
alter table public.exam_questions
  add column if not exists pass_mark        integer,            -- pass threshold 0-100 (null = global default)
  add column if not exists duration_seconds integer not null default 480; -- station time (8 min)

-- #7 enhanced feedback + #12 manual review (per session)
alter table public.exam_sessions
  add column if not exists pass_fail     text,
  add column if not exists missed_items  jsonb default '[]'::jsonb,
  add column if not exists unsafe_areas  jsonb default '[]'::jsonb,
  add column if not exists score_override integer,             -- admin override of AI score
  add column if not exists reviewed      boolean not null default false,
  add column if not exists reviewer_note text;
