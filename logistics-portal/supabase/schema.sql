-- ============================================================
-- Logistics Portal — database schema
-- Run this in the Supabase SQL editor on a fresh project.
-- ============================================================

-- Supabase auth.users needs an email to sign up with a password.
-- A customer can give us a real email at sign up, or just a phone
-- number — in that case the app writes a synthetic email like
-- "2348012345678@phone.betaprocurement-portal.com" into auth.users.
-- Either way, the phone number (always required) and the real email
-- (if given) both live here, in profiles. `auth_email` is always the
-- exact value that was used as the Supabase Auth identity — it's how
-- login looks up the right account whether someone types their phone
-- or their email (see auth_email_for_identifier below).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  shipping_name text not null,
  phone text unique not null,
  email text unique,
  auth_email text unique,
  role text not null default 'customer' check (role in ('customer', 'admin')),
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
  service_type text check (service_type in ('air_cargo', 'sea_shipping')),
  route text check (route in ('china_nigeria', 'dubai_nigeria')),
  status text not null default 'submitted' check (
    status in ('submitted', 'received', 'in_transit', 'arrived_port', 'clearing', 'delivered')
  ),
  created_at timestamptz not null default now()
);

-- Each waybill/tracking number a customer adds, always tied to
-- exactly one batch so uploads never bleed into each other.
create table if not exists tracking_numbers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  waybill_number text not null,
  courier_name text not null,
  quantity integer not null default 1,
  status text not null default 'pending' check (
    status in ('pending', 'received', 'shipped', 'arrived_port', 'delivered')
  ),
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

-- One row per item on the packing list: what it is, how many,
-- how much it weighs. This is what renders as a table in the app
-- and what gets turned into a CSV on download.
create table if not exists packing_list_items (
  id uuid primary key default gen_random_uuid(),
  packing_list_id uuid not null references packing_lists(id) on delete cascade,
  item_name text not null,
  quantity integer not null default 1,
  weight numeric,
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
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
    select 1 from profiles where id = auth.uid() and role = 'admin'
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

create policy "only admins manage staff invites"
  on staff_invites for all
  using (is_admin())
  with check (is_admin());

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
