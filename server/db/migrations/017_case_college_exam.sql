-- PassGP bulk case-tagging via CSV: store the college and exam-type explicitly.
--   exam_college = RACGP / ACRRM / AMC / IME / RANZCOG / other
--   exam_name    = CCE / STAMPS / Clinical / AKT / KFP / MCQ / other  ("exam type")
-- The candidate-facing exam (pathway) is the combination, e.g. "RACGP CCE".
-- exam_type continues to hold the clinical CATEGORY (cardiovascular, etc.).
alter table public.exam_questions
  add column if not exists exam_college text,
  add column if not exists exam_name text;
