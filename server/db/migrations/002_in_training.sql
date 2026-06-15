-- Training-set flag: documents the admin has "pushed" for the chatbot to use.
alter table public.exam_questions
  add column if not exists in_training boolean not null default false;

create index if not exists idx_questions_training
  on public.exam_questions (in_training) where in_training;
