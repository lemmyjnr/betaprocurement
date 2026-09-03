-- Run this once in your Supabase project's SQL Editor.
--
-- Why this exists: 012_fix_batch_delete_policy.sql fixed one specific
-- gap — "Delete order" silently doing nothing because its RLS policy
-- was added to schema.sql at some point but never shipped as its own
-- migration, so it never actually ran against the live database.
--
-- That bug could exist anywhere else the same way: schema.sql is
-- meant to always reflect the app's current, intended state, but
-- there's no automated check that every policy in it was actually
-- applied to this specific project. Rather than manually audit every
-- policy one at a time, this migration just re-asserts ALL of them —
-- drops each by name and recreates it exactly as schema.sql defines
-- it. If a policy was already correct, this is a no-op. If one was
-- ever missing (like the batch delete one was), this adds it.
--
-- Entirely safe to run — this changes no data, only permission rules,
-- and every statement below is copied verbatim from schema.sql.

-- Profiles
drop policy if exists "view own profile or admin views all" on profiles;
create policy "view own profile or admin views all"
  on profiles for select
  using (id = auth.uid() or is_admin());

drop policy if exists "self-signup is always customer; admin can insert any role" on profiles;
create policy "self-signup is always customer; admin can insert any role"
  on profiles for insert
  with check (
    (id = auth.uid() and role = 'customer')
    or is_admin()
  );

drop policy if exists "user updates own profile or admin updates any" on profiles;
create policy "user updates own profile or admin updates any"
  on profiles for update
  using (id = auth.uid() or is_admin());

drop policy if exists "admin deletes customer accounts" on profiles;
create policy "admin deletes customer accounts"
  on profiles for delete
  using (is_admin() and role = 'customer');

-- Batches
drop policy if exists "customer views own batches or admin views all" on batches;
create policy "customer views own batches or admin views all"
  on batches for select
  using (customer_id = auth.uid() or is_admin());

drop policy if exists "customer or admin creates batch" on batches;
create policy "customer or admin creates batch"
  on batches for insert
  with check (customer_id = auth.uid() or is_admin());

drop policy if exists "admin updates batch status" on batches;
create policy "admin updates batch status"
  on batches for update
  using (is_admin());

drop policy if exists "admin deletes batches" on batches;
create policy "admin deletes batches"
  on batches for delete
  using (is_admin());

-- Tracking numbers
drop policy if exists "view tracking numbers for accessible batches" on tracking_numbers;
create policy "view tracking numbers for accessible batches"
  on tracking_numbers for select
  using (
    exists (
      select 1 from batches
      where batches.id = tracking_numbers.batch_id
      and (batches.customer_id = auth.uid() or is_admin())
    )
  );

drop policy if exists "add tracking numbers while batch is editable" on tracking_numbers;
create policy "add tracking numbers while batch is editable"
  on tracking_numbers for insert
  with check (
    exists (
      select 1 from batches
      where batches.id = tracking_numbers.batch_id
      and (
        (batches.customer_id = auth.uid() and batches.status in ('submitted', 'received'))
        or is_admin()
      )
    )
  );

drop policy if exists "edit tracking numbers while batch is editable" on tracking_numbers;
create policy "edit tracking numbers while batch is editable"
  on tracking_numbers for update
  using (
    exists (
      select 1 from batches
      where batches.id = tracking_numbers.batch_id
      and (
        (batches.customer_id = auth.uid() and batches.status in ('submitted', 'received') and tracking_numbers.status = 'pending')
        or is_admin()
      )
    )
  );

drop policy if exists "only admin removes tracking numbers" on tracking_numbers;
create policy "only admin removes tracking numbers"
  on tracking_numbers for delete
  using (is_admin());

-- Packing lists
drop policy if exists "view packing lists for accessible batches" on packing_lists;
create policy "view packing lists for accessible batches"
  on packing_lists for select
  using (
    exists (
      select 1 from batches
      where batches.id = packing_lists.batch_id
      and (batches.customer_id = auth.uid() or is_admin())
    )
  );

drop policy if exists "only admin creates packing lists" on packing_lists;
create policy "only admin creates packing lists"
  on packing_lists for insert
  with check (is_admin());

-- Packing list items
drop policy if exists "view packing list items for accessible batches" on packing_list_items;
create policy "view packing list items for accessible batches"
  on packing_list_items for select
  using (
    exists (
      select 1 from packing_lists
      join batches on batches.id = packing_lists.batch_id
      where packing_lists.id = packing_list_items.packing_list_id
      and (batches.customer_id = auth.uid() or is_admin())
    )
  );

drop policy if exists "only admin adds packing list items" on packing_list_items;
create policy "only admin adds packing list items"
  on packing_list_items for insert
  with check (is_admin());

drop policy if exists "only admin edits packing list items" on packing_list_items;
create policy "only admin edits packing list items"
  on packing_list_items for update
  using (is_admin());

drop policy if exists "only admin deletes packing list items" on packing_list_items;
create policy "only admin deletes packing list items"
  on packing_list_items for delete
  using (is_admin());

-- Staff invites
drop policy if exists "only admins manage staff invites" on staff_invites;
drop policy if exists "only the owner manages staff invites" on staff_invites;
create policy "only the owner manages staff invites"
  on staff_invites for all
  using (is_owner())
  with check (is_owner());
