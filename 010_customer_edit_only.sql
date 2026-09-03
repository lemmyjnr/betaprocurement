-- Run this once in your Supabase project's SQL Editor.
-- Customers can still edit their own pending waybills (unchanged),
-- but can no longer delete one outright — only admin can remove a
-- tracking number now.

drop policy if exists "remove tracking numbers while batch is editable" on tracking_numbers;
drop policy if exists "only admin removes tracking numbers" on tracking_numbers;

create policy "only admin removes tracking numbers"
  on tracking_numbers for delete
  using (is_admin());
