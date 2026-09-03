-- Run this once in your Supabase project's SQL Editor.

-- Tracking-number status is now just pending/received — the fuller
-- lifecycle (shipped, arrived at port, delivered) lives at the batch
-- level only. Move any existing rows with an old status to
-- "received" before tightening the constraint, so nothing gets
-- rejected.
update tracking_numbers set status = 'received' where status not in ('pending', 'received');

alter table tracking_numbers drop constraint if exists tracking_numbers_status_check;
alter table tracking_numbers add constraint tracking_numbers_status_check
  check (status in ('pending', 'received'));

-- Courier is no longer collected anywhere in the app (customer never
-- had it; admin's had it removed too) — drop the now-dead column.
alter table tracking_numbers drop column if exists courier_name;

-- Public tracking lookup — no login required, returns only the
-- waybill's own status and what kind of shipment it is. No customer
-- name, phone, or packing list contents.
create or replace function public_track_waybill(lookup text)
returns table (
  waybill_number text,
  tracking_status text,
  batch_status text,
  service_type text,
  route text
) as $$
  select t.waybill_number, t.status, b.status, b.service_type, b.route
  from tracking_numbers t
  join batches b on b.id = t.batch_id
  where t.waybill_number = trim(lookup)
  limit 1
$$ language sql security definer set search_path = public;

grant execute on function public_track_waybill(text) to anon, authenticated;
