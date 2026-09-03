-- Run this once in your Supabase project's SQL Editor. Do this one
-- first, before anything else pending — this closes an actual
-- privilege escalation hole, not a cosmetic bug.
--
-- THE PROBLEM
-- "user updates own profile or admin updates any" (in schema.sql)
-- only restricts *which row* someone can update:
--
--   using (id = auth.uid() or is_admin())
--
-- It has no "with check" clause. Postgres's documented behavior when
-- that's missing on an UPDATE policy is to reuse the USING
-- expression to validate the row afterwards too. Since `id` never
-- changes, `id = auth.uid()` is still true after the update no
-- matter what else got changed — so this policy never actually
-- restricted WHAT a customer could set on their own row. Any logged
-- in customer could open devtools and run:
--
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', theirOwnId)
--
-- ...and it would silently succeed. Same gap also lets any regular
-- admin grant themselves `is_owner`, and lets a suspended admin
-- quietly clear their own `suspended` flag — both by the same
-- mechanism, just touching different columns.
--
-- THE FIX
-- A trigger that fires on every update to `profiles` and blocks any
-- change to role / is_owner / suspended unless the person making the
-- change is already the owner. This applies regardless of which RLS
-- policy let the UPDATE statement through in the first place, so it
-- closes the hole even if another policy gap like this ever gets
-- introduced later.
--
-- Nothing in the app currently depends on being able to change these
-- three fields via a plain table update — the legitimate paths
-- (set_admin_suspended, remove_admin, redeem_staff_invite,
-- admin-create-customer) all go through their own functions, which
-- this trigger does not interfere with (see note below).

create or replace function protect_privileged_profile_fields()
returns trigger as $$
begin
  if new.role is distinct from old.role or new.is_owner is distinct from old.is_owner then
    if not is_owner() then
      raise exception 'Only the owner can change role or ownership, and only through the Staff page.';
    end if;
  end if;

  if new.suspended is distinct from old.suspended then
    if not is_owner() then
      raise exception 'Only the owner can change suspension status, and only through the Staff page.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_privileged_profile_fields_trigger on profiles;
create trigger protect_privileged_profile_fields_trigger
  before update on profiles
  for each row execute function protect_privileged_profile_fields();

-- Why this doesn't break set_admin_suspended / remove_admin: both
-- are already gated by "if not is_owner() then raise exception" at
-- the top of the function itself, so only the real owner's session
-- ever reaches the update inside them — and this trigger fires using
-- that same real caller's auth.uid(), so is_owner() here agrees with
-- the check those functions already made. It's a second, independent
-- lock on the same door, not a conflicting one.
