-- P3.11 status labels + P2.6 killer/unsafe marks
alter table public.exam_questions
  add column if not exists status text not null default 'active',
  add column if not exists killer_marks text;

-- Backfill status from the existing is_active flag.
update public.exam_questions set status = case when is_active then 'active' else 'disabled' end
where status is null or status = 'active';

-- Constrain to the allowed lifecycle values.
do $$ begin
  alter table public.exam_questions
    add constraint exam_questions_status_chk check (status in ('draft','active','disabled','archived'));
exception when duplicate_object then null; end $$;

create index if not exists idx_exam_questions_status on public.exam_questions (status);

-- P1.4 SECURITY: revoke direct writes to the case bank from browser roles.
-- All create/edit/delete/activate now MUST go through the protected backend
-- admin endpoints (service role bypasses these grants). SELECT stays allowed
-- so the admin app can still read the list.
revoke insert, update, delete on public.exam_questions from anon, authenticated;
