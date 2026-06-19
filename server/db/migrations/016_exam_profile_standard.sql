-- Per-exam marking guidance that trains the AI examiner & grader:
--   mark_scheme = "What mark scheme am I using?"
--   standard    = "What is the standard for this exam, and how would a good
--                  candidate answer?"
alter table public.exam_profiles
  add column if not exists mark_scheme text,
  add column if not exists standard text;
