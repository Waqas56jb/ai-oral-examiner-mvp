-- Marking controls per case (#3): total marks available for the station.
-- pass_mark and duration_seconds were added in 005_marking_review.sql.
alter table public.exam_questions
  add column if not exists total_marks integer not null default 10;
