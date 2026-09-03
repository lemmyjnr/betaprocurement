-- Run this once in your Supabase project's SQL Editor.
-- Introduces a single "owner" admin who alone can create staff invite
-- links. Every other admin (including anyone invited from here on)
-- can still do everything else — customers, batches, packing lists —
-- just not bring on more staff.

alter table profiles add column if not exists is_owner boolean not null default false;

create or replace function is_owner()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and is_owner = true
  );
$$ language sql security definer;

drop policy if exists "only admins manage staff invites" on staff_invites;
drop policy if exists "only the owner manages staff invites" on staff_invites;
create policy "only the owner manages staff invites"
  on staff_invites for all
  using (is_owner())
  with check (is_owner());

-- One-time: mark your own account as the owner. Replace the phone
-- number below with whichever admin account should be the one in
-- control of staff invites — almost certainly your own.
update profiles set is_owner = true where phone = '08103374784';
