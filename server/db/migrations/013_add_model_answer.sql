-- The code references exam_questions.model_answer (expected/model answer used in
-- marking and the case editor) but the column was never created — so any query
-- selecting it errored and any write including it silently failed. Add it.
alter table public.exam_questions
  add column if not exists model_answer text;
