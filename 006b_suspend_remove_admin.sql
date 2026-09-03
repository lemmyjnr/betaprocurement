-- Renamed from 006 to 006b: this project accidentally shipped two
-- different migrations both numbered 006 (this one and
-- 006_email_notifications.sql). If you ever ran migrations by
-- number/order, double check both 006 files actually got run —
-- easy to think the second "006" was a duplicate of the first and
-- skip it. Safe to run now either way; every statement here is
-- idempotent.

-- Run this once in your Supabase project's SQL Editor.
-- Lets the owner pause or remove another admin's access.

alter table profiles add column if not exists suspended boolean not null default false;

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and coalesce(suspended, false) = false
  );
$$ language sql security definer;

create or replace function set_admin_suspended(target_id uuid, should_suspend boolean)
returns void as $$
begin
  if not is_owner() then
    raise exception 'NOT_OWNER';
  end if;
  if target_id = auth.uid() then
    raise exception 'CANNOT_TARGET_SELF';
  end if;
  update profiles set suspended = should_suspend where id = target_id and role = 'admin';
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function set_admin_suspended(uuid, boolean) to authenticated;

create or replace function remove_admin(target_id uuid)
returns void as $$
begin
  if not is_owner() then
    raise exception 'NOT_OWNER';
  end if;
  if target_id = auth.uid() then
    raise exception 'CANNOT_TARGET_SELF';
  end if;
  delete from profiles where id = target_id and role = 'admin';
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function remove_admin(uuid) to authenticated;
