-- ============================================================
--  PassGP — Supabase schema
--  Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1) PROFILES  (1:1 with Supabase auth.users — holds signup data)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  father_name text,
  email       text unique,
  phone       text,
  address     text,
  language    text,
  degree      text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2) EXAM QUESTIONS  (central question bank — scales to 1000s)
--    external_ref lets one embed map to any Jotform/Kajabi form.
-- ------------------------------------------------------------
create table if not exists public.exam_questions (
  id               uuid primary key default gen_random_uuid(),
  exam_type        text not null default 'RACGP',
  external_ref     text,                       -- e.g. Jotform form/question ID
  title            text not null,
  stem             text not null,
  vitals           text,
  marking_criteria jsonb not null default '[]'::jsonb,
  model_answer     text,                       -- admin-pasted reference answer
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3) EXAM SESSIONS  (one practice attempt + its feedback report)
-- ------------------------------------------------------------
create table if not exists public.exam_sessions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users(id) on delete cascade,
  question_id        uuid references public.exam_questions(id) on delete set null,
  exam_type          text not null default 'RACGP',
  status             text not null default 'in_progress',  -- in_progress | completed
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  duration_sec       integer not null default 0,
  questions_answered integer not null default 0,
  word_count         integer not null default 0,
  -- feedback report
  confidence         integer,                  -- 0-100
  score              integer,                  -- 0-100
  result             text,                     -- Clear pass | Borderline | Below standard
  summary            text,
  strengths          jsonb default '[]'::jsonb,
  improvements       jsonb default '[]'::jsonb,
  created_at         timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4) SESSION TURNS  (transcript, line by line)
-- ------------------------------------------------------------
create table if not exists public.session_turns (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.exam_sessions(id) on delete cascade,
  role        text not null check (role in ('examiner','candidate')),
  text        text not null,
  time_marker text,                            -- e.g. "02:14"
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_sessions_user    on public.exam_sessions(user_id);
create index if not exists idx_sessions_created  on public.exam_sessions(created_at desc);
create index if not exists idx_turns_session     on public.session_turns(session_id);
create index if not exists idx_questions_exam    on public.exam_questions(exam_type) where is_active;

-- ------------------------------------------------------------
-- updated_at auto-touch
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_questions_updated on public.exam_questions;
create trigger trg_questions_updated before update on public.exam_questions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Auto-create a profile row whenever a user signs up
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, father_name, phone, address, language, degree, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'father_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'address', ''),
    coalesce(new.raw_user_meta_data->>'language', ''),
    coalesce(new.raw_user_meta_data->>'degree', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  Row Level Security
--  (The server uses the SECRET key = service_role, which bypasses
--   RLS. These policies protect direct browser access.)
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.exam_sessions  enable row level security;
alter table public.session_turns  enable row level security;
alter table public.exam_questions enable row level security;

-- profiles: each user manages only their own row
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

-- sessions: each user manages only their own
drop policy if exists sessions_all_own on public.exam_sessions;
create policy sessions_all_own on public.exam_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- turns: accessible only via a session the user owns
drop policy if exists turns_select_own on public.session_turns;
create policy turns_select_own on public.session_turns
  for select using (
    exists (select 1 from public.exam_sessions s where s.id = session_id and s.user_id = auth.uid())
  );
drop policy if exists turns_insert_own on public.session_turns;
create policy turns_insert_own on public.session_turns
  for insert with check (
    exists (select 1 from public.exam_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- questions: any signed-in user may read the active bank
drop policy if exists questions_read on public.exam_questions;
create policy questions_read on public.exam_questions
  for select using (auth.role() = 'authenticated');

-- ============================================================
--  Seed: the hard-coded MVP sample case
-- ============================================================
insert into public.exam_questions (exam_type, external_ref, title, stem, vitals, marking_criteria)
values (
  'RACGP',
  'racgp-cardio-001',
  'Acute chest pain in general practice',
  'A 54-year-old man, Mr. David Brown, presents to your general practice clinic with central chest pain that started 40 minutes ago while gardening. He describes it as a heavy pressure radiating to his left arm, associated with sweating and mild nausea. He has a history of hypertension and is a current smoker (20 pack-years). His father had a myocardial infarction at 58.',
  'HR 96, BP 158/94, RR 18, SpO2 96% on room air, afebrile.',
  '["Takes a focused, structured cardiac history (SOCRATES) and risk factors","Recognises this as a possible acute coronary syndrome (ACS) early","Requests and interprets an ECG promptly","States immediate management: aspirin, GTN, analgesia, oxygen if hypoxic","Arranges urgent transfer / activates the appropriate acute pathway","Communicates safely and explains to the patient with empathy","Demonstrates safe, time-critical clinical prioritisation"]'::jsonb
)
on conflict do nothing;
