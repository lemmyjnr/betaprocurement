-- Run this once in your Supabase project's SQL Editor.
--
-- Adds staff invite links (an admin generates a link, the new staff
-- member sets their own password through it — no more manually
-- editing this database to make someone an admin).
--
-- Also tightens a real gap: the old insert policy on profiles let
-- anyone technically savvy enough to call the database directly set
-- role = 'admin' on their own signup, bypassing the app entirely.
-- This closes that.

drop policy if exists "admin can insert profiles" on profiles;

create policy "self-signup is always customer; admin can insert any role"
  on profiles for insert
  with check (
    (id = auth.uid() and role = 'customer')
    or is_admin()
  );

create table if not exists staff_invites (
  id uuid primary key default gen_random_uuid(),
  note text,
  created_by uuid not null references profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table staff_invites enable row level security;

drop policy if exists "only admins manage staff invites" on staff_invites;
create policy "only admins manage staff invites"
  on staff_invites for all
  using (is_admin())
  with check (is_admin());

create or replace function staff_invite_is_valid(invite_id uuid)
returns boolean as $$
  select exists (
    select 1 from staff_invites
    where id = invite_id and used_at is null and expires_at > now()
  );
$$ language sql security definer set search_path = public;

grant execute on function staff_invite_is_valid(uuid) to anon, authenticated;

create or replace function redeem_staff_invite(
  invite_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_auth_email text
)
returns void as $$
begin
  if not exists (
    select 1 from staff_invites
    where id = invite_id and used_at is null and expires_at > now()
  ) then
    raise exception 'INVALID_INVITE';
  end if;

  insert into profiles (id, full_name, shipping_name, phone, email, auth_email, role, phone_verified)
  values (auth.uid(), p_full_name, p_full_name, p_phone, p_email, p_auth_email, 'admin', true);

  update staff_invites set used_at = now(), used_by = auth.uid() where id = invite_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function redeem_staff_invite(uuid, text, text, text, text) to authenticated;
