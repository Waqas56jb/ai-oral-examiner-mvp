-- ============================================================
--  PassGP — ADMIN schema
--  Run in: Supabase Dashboard → SQL Editor → New query → Run
--  (Safe to re-run; everything is idempotent.)
-- ============================================================

-- ------------------------------------------------------------
-- Admin users (which auth.users are admins)
-- ------------------------------------------------------------
create table if not exists public.admin_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'admin',   -- admin | superadmin
  created_at timestamptz not null default now()
);

-- is_admin() — used by RLS policies below
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admin_users a where a.id = auth.uid());
$$;

-- ------------------------------------------------------------
-- App settings (AI config, integration settings, etc.)
-- ------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.admin_users  enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists admin_users_read on public.admin_users;
create policy admin_users_read on public.admin_users
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Give admins full access to the platform tables (added alongside the
-- existing user-scoped policies; the secret key on the server still bypasses RLS).
drop policy if exists admin_all_profiles on public.profiles;
create policy admin_all_profiles on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_all_questions on public.exam_questions;
create policy admin_all_questions on public.exam_questions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_all_sessions on public.exam_sessions;
create policy admin_all_sessions on public.exam_sessions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_all_turns on public.session_turns;
create policy admin_all_turns on public.session_turns
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- Seed default AI configuration
-- ------------------------------------------------------------
insert into public.app_settings (key, value)
values (
  'ai_config',
  '{"voice":"marin","difficulty":"standard","systemPromptOverride":"","examinerInstructions":""}'::jsonb
)
on conflict (key) do nothing;

insert into public.app_settings (key, value)
values ('integrations', '{"kajabi":{"enabled":true},"jotform":{"enabled":true}}'::jsonb)
on conflict (key) do nothing;
