-- Run this in Supabase's SQL Editor.
-- Bug found: login-by-phone was stripping non-digit characters
-- (+ and spaces) from what the CUSTOMER TYPES at login, but never
-- did the same to the phone number as STORED from signup. So any
-- customer who typed their phone with a "+" or spaces at signup
-- (e.g. "+234 907 727 3651") could never log back in — the loose
-- digits from login never matched the formatted version in storage.
--
-- Fix: normalize BOTH sides to digits-only before comparing, so
-- formatting differences (+, spaces, dashes) no longer matter.

create or replace function auth_email_for_identifier(lookup text)
returns text as $$
  select auth_email from profiles
  where email = lower(trim(lookup))
     or regexp_replace(phone, '\D', '', 'g') = regexp_replace(lookup, '\D', '', 'g')
  limit 1
$$ language sql security definer set search_path = public;
