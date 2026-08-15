-- Run this once in your Supabase project's SQL Editor.
-- Fixes phone-or-email login for accounts that have both: previously,
-- only whichever the app happened to guess (usually the email) could
-- actually log in. This adds a column that remembers the real
-- Supabase Auth identity for each account, and a lookup function the
-- login page uses to find it — whether someone types their phone or
-- their email.

alter table profiles add column if not exists auth_email text unique;

-- Backfill existing accounts: for anyone who signed up with a real
-- email, that's their auth_email. For anyone who signed up with just
-- a phone number, rebuild the same synthetic email the app would
-- have created at sign up time.
update profiles
set auth_email = coalesce(email, regexp_replace(phone, '\D', '', 'g') || '@phone.betaprocurement-portal.com')
where auth_email is null;

create or replace function auth_email_for_identifier(lookup text)
returns text as $$
  select auth_email from profiles
  where email = lower(trim(lookup))
     or phone = regexp_replace(lookup, '\D', '', 'g')
  limit 1
$$ language sql security definer set search_path = public;

grant execute on function auth_email_for_identifier(text) to anon, authenticated;
