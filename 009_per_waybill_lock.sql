-- Run this once in your Supabase project's SQL Editor.
-- A customer's waybill now locks the moment ITS OWN status flips to
-- "received" — even if the order overall is still open. Previously
-- the whole order being open meant every waybill on it was editable.

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

drop policy if exists "remove tracking numbers while batch is editable" on tracking_numbers;
create policy "remove tracking numbers while batch is editable"
  on tracking_numbers for delete
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
