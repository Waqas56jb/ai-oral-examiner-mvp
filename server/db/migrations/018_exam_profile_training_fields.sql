-- Per-case training fields shown on the case editor (Training page):
--   prep_seconds       = Preparation time
--   expected_standard  = Expected candidate standard
--   common_errors      = Common candidate errors
--   evidence_base      = Evidence base / references
--   teaching_notes     = Teaching notes for AI
-- (Consultation time = duration_seconds, Marking rubric = marking_criteria,
--  Critical fail = killer_marks, Model answer = model_answer — already exist.)
alter table public.exam_questions
  add column if not exists prep_seconds integer,
  add column if not exists expected_standard text,
  add column if not exists common_errors text,
  add column if not exists evidence_base text,
  add column if not exists teaching_notes text;
