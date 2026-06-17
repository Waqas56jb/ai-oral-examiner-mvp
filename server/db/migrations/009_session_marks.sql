-- P2.6 / P4: persist marks-based grading on each session for reporting & Power BI.
alter table public.exam_sessions
  add column if not exists marks_awarded integer,
  add column if not exists total_marks integer,
  add column if not exists killer_failed boolean not null default false;
