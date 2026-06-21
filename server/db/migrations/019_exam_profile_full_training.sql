-- The same training fields as the case editor, now on the EXAM PROFILE so they
-- set the exam-wide default/format for the whole batch of that exam's questions.
--   prep_seconds      = Preparation time
--   consult_seconds   = Consultation time
--   critical_fail     = Critical fail criteria
--   common_errors     = Common candidate errors
--   evidence_base     = Evidence base / references
--   model_answer      = Model answer
--   teaching_notes    = Teaching notes for AI
-- (Expected candidate standard = existing `standard`; Marking rubric = existing `mark_scheme`.)
alter table public.exam_profiles
  add column if not exists prep_seconds integer,
  add column if not exists consult_seconds integer,
  add column if not exists critical_fail text,
  add column if not exists common_errors text,
  add column if not exists evidence_base text,
  add column if not exists model_answer text,
  add column if not exists teaching_notes text;
