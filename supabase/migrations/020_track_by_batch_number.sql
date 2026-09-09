-- Run this in Supabase's SQL Editor, after 019.
-- Client wants customers to track by their Batch number (e.g.
-- BCH-2026-3411), not by individual tracking/waybill numbers. Adds
-- a new lookup function for that; the old public_track_waybill()
-- function is left in place (harmless) but the app no longer calls
-- it once the matching code file is deployed.
--
-- Same privacy rule as before: only what's safe to share stays in
-- the result — no customer name, phone, or packing list contents.

create or replace function public_track_batch(lookup text)
returns table (
  batch_code text,
  batch_status text,
  service_type text,
  route text,
  tracking_count int
) as $$
  select b.batch_code, b.status, b.service_type, b.route, count(t.id)::int
  from batches b
  left join tracking_numbers t on t.batch_id = b.id
  where b.batch_code = trim(lookup)
  group by b.id
  limit 1
$$ language sql security definer set search_path = public;

grant execute on function public_track_batch(text) to anon, authenticated;
