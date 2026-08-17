-- ============================================================
-- Logistics Portal — database schema
-- Run this in the Supabase SQL editor on a fresh project.
-- ============================================================

-- The one "main admin" who can bring on other staff. Regular admins
-- can do everything else (customers, batches, packing lists) but
-- can't create more admins — only the owner can. See is_owner()
-- below and the staff_invites policy that depends on it.
--
-- `suspended` lets the owner pause a staff member's access without
-- deleting their account — is_admin() checks it below, so a
-- suspended admin is immediately blocked from every admin-only table,
-- even if they're still logged in.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  shipping_name text not null,
  phone text unique not null,
  email text unique,
  auth_email text unique,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  is_owner boolean not null default false,
  suspended boolean not null default false,
  phone_verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- A batch is a group of tracking numbers the customer (or admin,
-- on their behalf) submitted together. Every batch gets a
-- human-readable code like BCH-2026-0001 so customers can refer
-- to "that batch" in conversation, not a uuid.
create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text unique not null,
  customer_id uuid not null references profiles(id) on delete cascade,
  created_by uuid not null references profiles(id),
  service_type text check (service_type in ('sea_freight', 'air_freight', 'express')),
  route text check (route in ('china_nigeria', 'dubai_nigeria')),
  status text not null default 'submitted' check (
    status in ('submitted', 'received', 'in_transit', 'arrived_port', 'clearing', 'delivered')
  ),
  created_at timestamptz not null default now()
);

-- Each waybill/tracking number a customer adds, always tied to
-- exactly one batch so uploads never bleed into each other.
-- One row per waybill/tracking number a customer adds. Customers only
-- ever submit the waybill number itself — courier gets removed from
-- the app entirely, and quantity is filled in by admin once the item
-- is actually received (see AdminBatchDetail.jsx). Status here is
-- deliberately just pending/received — the fuller lifecycle
-- (shipped, arrived at port, delivered) lives at the batch level.
create table if not exists tracking_numbers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  waybill_number text not null,
  quantity integer,
  status text not null default 'pending' check (status in ('pending', 'received')),
  created_at timestamptz not null default now()
);

-- A packing list is a header the admin creates against a batch.
-- The actual contents are structured line items, not a file — see
-- packing_list_items below. A batch can have more than one packing
-- list if it's built up in stages, but usually it's just one.
create table if not exists packing_lists (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- One row per line on the packing list, freight-invoice style: how
-- many, how much it weighs (always kg), how much space it takes up
-- (CBM), and what that space costs. `amount` is auto-calculated in
-- the app as CBM × price_per_cbm when a row is added, so it's never
-- out of sync with the other two numbers — see AdminBatchDetail.jsx.
create table if not exists packing_list_items (
  id uuid primary key default gen_random_uuid(),
  packing_list_id uuid not null references packing_lists(id) on delete cascade,
  quantity integer not null default 1,
  weight numeric,
  cbm numeric,
  price_per_cbm numeric,
  amount numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_batches_customer on batches(customer_id);
create index if not exists idx_tracking_batch on tracking_numbers(batch_id);
create index if not exists idx_packing_batch on packing_lists(batch_id);
create index if not exists idx_packing_items_list on packing_list_items(packing_list_id);

-- ============================================================
-- Row Level Security — customers only ever see their own data,
-- admins see everything. This is the actual enforcement layer,
-- not just something the front end hides.
-- ============================================================

alter table profiles enable row level security;
alter table batches enable row level security;
alter table tracking_numbers enable row level security;
alter table packing_lists enable row level security;
alter table packing_list_items enable row level security;

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and coalesce(suspended, false) = false
  );
$$ language sql security definer;

create or replace function is_owner()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and is_owner = true
  );
$$ language sql security definer;

-- Lets the login page find the right Supabase Auth email for
-- whatever a customer typed — their phone number OR their email —
-- without needing to be logged in first (RLS on profiles would
-- otherwise block this). Deliberately returns nothing but the one
-- email string; no other profile data is exposed by this function.
create or replace function auth_email_for_identifier(lookup text)
returns text as $$
  select auth_email from profiles
  where email = lower(trim(lookup))
     or phone = regexp_replace(lookup, '\D', '', 'g')
  limit 1
$$ language sql security definer set search_path = public;

grant execute on function auth_email_for_identifier(text) to anon, authenticated;

-- Profiles
create policy "view own profile or admin views all"
  on profiles for select
  using (id = auth.uid() or is_admin());

create policy "self-signup is always customer; admin can insert any role"
  on profiles for insert
  with check (
    (id = auth.uid() and role = 'customer')
    or is_admin()
  );

create policy "user updates own profile or admin updates any"
  on profiles for update
  using (id = auth.uid() or is_admin());

-- Batches
create policy "customer views own batches or admin views all"
  on batches for select
  using (customer_id = auth.uid() or is_admin());

create policy "customer or admin creates batch"
  on batches for insert
  with check (customer_id = auth.uid() or is_admin());

create policy "admin updates batch status"
  on batches for update
  using (is_admin());

-- Tracking numbers
create policy "view tracking numbers for accessible batches"
  on tracking_numbers for select
  using (
    exists (
      select 1 from batches
      where batches.id = tracking_numbers.batch_id
      and (batches.customer_id = auth.uid() or is_admin())
    )
  );

-- A customer can add/edit/remove tracking numbers on their own batch
-- only while it's still "submitted" or "received" — once it moves to
-- in_transit (shipped) or later, only admin can touch it. Admin can
-- always touch any batch, any status.
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
        (batches.customer_id = auth.uid() and batches.status in ('submitted', 'received') and tracking_numbers.status = 'pending')
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
        (batches.customer_id = auth.uid() and batches.status in ('submitted', 'received') and tracking_numbers.status = 'pending')
        or is_admin()
      )
    )
  );

-- Packing lists
create policy "view packing lists for accessible batches"
  on packing_lists for select
  using (
    exists (
      select 1 from batches
      where batches.id = packing_lists.batch_id
      and (batches.customer_id = auth.uid() or is_admin())
    )
  );

create policy "only admin creates packing lists"
  on packing_lists for insert
  with check (is_admin());

-- Packing list items
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

create policy "only admin adds packing list items"
  on packing_list_items for insert
  with check (is_admin());

create policy "only admin edits packing list items"
  on packing_list_items for update
  using (is_admin());

create policy "only admin deletes packing list items"
  on packing_list_items for delete
  using (is_admin());

-- ============================================================
-- Staff invites — lets an existing admin bring on new staff
-- without ever touching this database directly. An admin
-- generates a one-time link (a row here); whoever opens it sets
-- their own password and becomes an admin, with the redemption
-- itself locked down by redeem_staff_invite() below.
-- ============================================================

create table if not exists staff_invites (
  id uuid primary key default gen_random_uuid(),
  note text, -- optional reminder for the admin, e.g. "for Chidi"
  created_by uuid not null references profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table staff_invites enable row level security;

create policy "only the owner manages staff invites"
  on staff_invites for all
  using (is_owner())
  with check (is_owner());

-- Lets an invite link check whether it's still good, before the
-- person visiting it has an account or is logged in.
create or replace function staff_invite_is_valid(invite_id uuid)
returns boolean as $$
  select exists (
    select 1 from staff_invites
    where id = invite_id and used_at is null and expires_at > now()
  );
$$ language sql security definer set search_path = public;

grant execute on function staff_invite_is_valid(uuid) to anon, authenticated;

-- The only sanctioned way for someone who isn't already an admin to
-- end up with role = 'admin'. Called right after the invitee's own
-- supabase.auth.signUp() succeeds, so auth.uid() is their new user id.
-- Re-checks the invite is still valid (handles two people opening the
-- same link at once) and marks it used so it can't be replayed.
create or replace function redeem_staff_invite(
  invite_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_auth_email text
)
returns void as $$
begin
  if not exists (
    select 1 from staff_invites
    where id = invite_id and used_at is null and expires_at > now()
  ) then
    raise exception 'INVALID_INVITE';
  end if;

  insert into profiles (id, full_name, shipping_name, phone, email, auth_email, role, phone_verified)
  values (auth.uid(), p_full_name, p_full_name, p_phone, p_email, p_auth_email, 'admin', true);

  update staff_invites set used_at = now(), used_by = auth.uid() where id = invite_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function redeem_staff_invite(uuid, text, text, text, text) to authenticated;

-- The owner's controls over other admins. Both bypass RLS (security
-- definer) and do their own is_owner() check inline, so they work
-- regardless of what the general profiles policies allow — and
-- neither lets the owner target their own account, so there's no way
-- to accidentally lock yourself out.
create or replace function set_admin_suspended(target_id uuid, should_suspend boolean)
returns void as $$
begin
  if not is_owner() then
    raise exception 'NOT_OWNER';
  end if;
  if target_id = auth.uid() then
    raise exception 'CANNOT_TARGET_SELF';
  end if;
  update profiles set suspended = should_suspend where id = target_id and role = 'admin';
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function set_admin_suspended(uuid, boolean) to authenticated;

-- Removes someone's admin profile entirely — they immediately lose
-- all admin access, since is_admin()/is_owner() depend on this row
-- existing. Their login credentials remain in Supabase Auth itself
-- (removing those needs the Admin API, which isn't available from
-- the browser), but without a profile they have nothing to log into.
create or replace function remove_admin(target_id uuid)
returns void as $$
begin
  if not is_owner() then
    raise exception 'NOT_OWNER';
  end if;
  if target_id = auth.uid() then
    raise exception 'CANNOT_TARGET_SELF';
  end if;
  delete from profiles where id = target_id and role = 'admin';
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function remove_admin(uuid) to authenticated;

-- ============================================================
-- Email notifications — fires automatically whenever a batch's
-- status changes. See supabase/migrations/006_email_notifications.sql
-- for the full explanation and setup steps (Resend API key, etc.)
-- ============================================================

create extension if not exists pg_net;

create or replace function notify_batch_status_change()
returns trigger as $$
declare
  customer_email text;
  customer_name text;
  api_key text;
  status_label text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select email, full_name into customer_email, customer_name
  from profiles where id = new.customer_id;

  if customer_email is null then
    return new;
  end if;

  select decrypted_secret into api_key
  from vault.decrypted_secrets where name = 'resend_api_key';

  if api_key is null then
    return new;
  end if;

  status_label := replace(new.status, '_', ' ');

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'Beta Logistics <onboarding@resend.dev>', -- swap for your own verified domain once you have one, see README
      'to', customer_email,
      'subject', 'Your batch ' || new.batch_code || ' is now ' || status_label,
      'html', '<p>Hi ' || coalesce(customer_name, 'there') || ',</p>' ||
              '<p>Your batch <strong>' || new.batch_code || '</strong> is now <strong>' || status_label || '</strong>.</p>' ||
              '<p>Log in to your account to see full details.</p>'
    )
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public, vault, net;

drop trigger if exists on_batch_status_change on batches;
create trigger on_batch_status_change
  after update on batches
  for each row
  execute function notify_batch_status_change();

-- ============================================================
-- Public tracking lookup — no login required. Deliberately returns
-- only the minimum: waybill number, its own status, the batch's
-- status, and what kind of shipment it is. No customer name, phone,
-- or packing list contents — safe to share or forward.
-- ============================================================

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
