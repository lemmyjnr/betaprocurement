-- Run this in Supabase's SQL Editor.
-- Adds 'picked_up' as an allowed batch status, sitting between
-- 'clearing' and 'delivered' in the admin dropdown (matching the
-- code changes already made in the app).

alter table batches drop constraint if exists batches_status_check;
alter table batches add constraint batches_status_check
  check (status in ('submitted', 'received', 'in_transit', 'arrived_port', 'clearing', 'picked_up', 'delivered'));

-- Note: no email template exists yet for 'picked_up' (same as
-- 'clearing' and 'submitted', changing a batch to this status
-- won't send anything). Let me know if you want one added.
