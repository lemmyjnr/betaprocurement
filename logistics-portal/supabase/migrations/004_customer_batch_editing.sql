-- Run this once in your Supabase project's SQL Editor.
-- Lets a customer add, edit, or remove tracking numbers on their own
-- batch while it's still "submitted" or "received". Once it moves to
-- in_transit (shipped) or later, only admin can touch it — matches
-- what the client asked for.

drop policy if exists "add tracking numbers to accessible batches" on tracking_numbers;
drop policy if exists "admin updates tracking status" on tracking_numbers;
drop policy if exists "add tracking numbers while batch is editable" on tracking_numbers;
drop policy if exists "edit tracking numbers while batch is editable" on tracking_numbers;
drop policy if exists "remove tracking numbers while batch is editable" on tracking_numbers;

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

create policy "edit tracking numbers while batch is editable"
  on tracking_numbers for update
  using (
    exists (
      select 1 from batches
      where batches.id = tracking_numbers.batch_id
      and (
        (batches.customer_id = auth.uid() and batches.status in ('submitted', 'received'))
        or is_admin()
      )
    )
  );

create policy "remove tracking numbers while batch is editable"
  on tracking_numbers for delete
  using (
    exists (
      select 1 from batches
      where batches.id = tracking_numbers.batch_id
      and (
        (batches.customer_id = auth.uid() and batches.status in ('submitted', 'received'))
        or is_admin()
      )
    )
  );
