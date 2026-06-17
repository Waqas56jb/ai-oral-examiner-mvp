-- Fix: the 008 lockdown revoked writes from BOTH anon and authenticated, which
-- broke the admin app's direct-write paths. Only admins ever authenticate (there
-- are no candidate logins), so re-grant writes to `authenticated` while keeping
-- the public/anon role (the candidate widget) locked out. The protected backend
-- endpoints (service role) remain the primary write path and still enforce
-- admin_users membership.
grant insert, update, delete on public.exam_questions to authenticated;
-- anon stays revoked (no public writes):
revoke insert, update, delete on public.exam_questions from anon;
