-- Structured case fields (#7) + exam pathway tag (#14)
alter table public.exam_questions
  add column if not exists candidate_instructions text,
  add column if not exists patient_script         text,
  add column if not exists examiner_instructions   text,
  add column if not exists red_flags               text,
  add column if not exists feedback_points         text,
  add column if not exists pathway                 text;

create index if not exists idx_questions_pathway on public.exam_questions (pathway);

-- NOTE: existing columns map to the remaining structured fields:
--   stem            -> Clinical scenario
--   marking_criteria-> Tasks / Marking rubric (jsonb list)
--   model_answer    -> Expected answers / model answer
