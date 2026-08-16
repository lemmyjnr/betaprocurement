-- Run this in Supabase's SQL Editor. Covers the client's latest
-- round of feedback:
--   1. Service type becomes three options (Sea Freight, Air Freight,
--      Express) instead of the combined "Air Cargo / Express"
--   2. Tracking numbers: customers only ever submit a waybill
--      number now — courier name and quantity are admin-filled, so
--      those columns can no longer require a value up front
--   3. Packing list: drop the "item" field entirely, add CBM, price
--      per CBM, and amount; weight is always kg now, so the
--      separate unit column goes away

-- ── Service type ────────────────────────────────────────────────
alter table batches drop constraint if exists batches_service_type_check;
update batches set service_type = 'sea_freight' where service_type = 'sea_shipping';
update batches set service_type = 'air_freight' where service_type = 'air_cargo';
alter table batches add constraint batches_service_type_check
  check (service_type in ('sea_freight', 'air_freight', 'express'));

-- ── Tracking numbers ────────────────────────────────────────────
-- Customers now submit only a waybill number. Courier and quantity
-- are filled in by admin once the item is actually received, so
-- these can no longer be required at submission time.
alter table tracking_numbers alter column courier_name drop not null;
alter table tracking_numbers alter column courier_name drop default;
alter table tracking_numbers alter column quantity drop not null;
alter table tracking_numbers alter column quantity drop default;

-- ── Packing list items ──────────────────────────────────────────
alter table packing_list_items drop column if exists item_name;
alter table packing_list_items drop column if exists weight_unit;
alter table packing_list_items add column if not exists cbm numeric;
alter table packing_list_items add column if not exists price_per_cbm numeric;
alter table packing_list_items add column if not exists amount numeric;
