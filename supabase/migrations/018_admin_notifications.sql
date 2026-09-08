-- Run this in Supabase's SQL Editor, after 017.
-- Adds two new triggers (separate from the customer-facing status
-- emails already set up):
--   1. When someone signs up as a customer -> email every admin
--   2. When a CUSTOMER adds tracking number(s) to a batch (either
--      when first creating it, or adding more later) -> email every
--      admin, once per upload (not once per tracking number)
--
-- Admin-initiated tracking number additions (via the admin panel)
-- do NOT trigger #2 — admins already know when they add something
-- themselves.
--
-- Both reuse the same 'resend_api_key' vault secret from 006, so no
-- extra setup needed if that's already in place.

-- ---------- 1. New customer registered ----------

create or replace function notify_admins_new_customer()
returns trigger as $$
declare
  admin_emails text[];
  api_key text;
begin
  -- Staff accounts (created via invite) shouldn't trigger this,
  -- only real customer sign-ups.
  if new.role <> 'customer' then
    return new;
  end if;

  select array_agg(email) into admin_emails
  from profiles
  where role = 'admin' and email is not null and suspended = false;

  if admin_emails is null or array_length(admin_emails, 1) is null then
    return new;
  end if;

  select decrypted_secret into api_key
  from vault.decrypted_secrets where name = 'resend_api_key';

  if api_key is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'Beta Courier & Logistics <onboarding@resend.dev>',
      'to', to_jsonb(admin_emails),
      'subject', 'New customer registered: ' || new.full_name,
      'html',
        '<p><strong>' || new.full_name || '</strong> just created a customer account on the portal.</p>' ||
        '<p>Phone: ' || coalesce(new.phone, '—') || '<br/>' ||
        'Email: ' || coalesce(new.email, '—') || '</p>'
    )
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public, vault, net;

drop trigger if exists on_new_customer_registered on profiles;
create trigger on_new_customer_registered
  after insert on profiles
  for each row
  execute function notify_admins_new_customer();

-- ---------- 2. Customer added tracking number(s) ----------

create or replace function notify_admins_new_tracking()
returns trigger as $$
declare
  admin_emails text[];
  api_key text;
  row_count int;
  first_batch_id uuid;
  batch_code_val text;
  customer_name_val text;
  is_customer boolean;
begin
  select count(*), (array_agg(batch_id))[1] into row_count, first_batch_id
  from new_rows;

  if row_count is null or row_count = 0 then
    return null;
  end if;

  -- Only notify when a customer (not an admin) is the one adding
  -- these — admin-side additions don't need to tell the admin team
  -- about themselves.
  select exists(
    select 1 from profiles where id = auth.uid() and role = 'customer'
  ) into is_customer;

  if not is_customer then
    return null;
  end if;

  select array_agg(email) into admin_emails
  from profiles
  where role = 'admin' and email is not null and suspended = false;

  if admin_emails is null or array_length(admin_emails, 1) is null then
    return null;
  end if;

  select decrypted_secret into api_key
  from vault.decrypted_secrets where name = 'resend_api_key';

  if api_key is null then
    return null;
  end if;

  select b.batch_code, p.full_name into batch_code_val, customer_name_val
  from batches b
  join profiles p on p.id = b.customer_id
  where b.id = first_batch_id;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'Beta Courier & Logistics <onboarding@resend.dev>',
      'to', to_jsonb(admin_emails),
      'subject', 'New tracking number' || (case when row_count = 1 then '' else 's' end) || ' added — ' || coalesce(batch_code_val, 'batch'),
      'html',
        '<p><strong>' || coalesce(customer_name_val, 'A customer') || '</strong> added <strong>' || row_count || '</strong> tracking number' || (case when row_count = 1 then '' else 's' end) ||
        ' to batch <strong>' || coalesce(batch_code_val, '') || '</strong>.</p>'
    )
  );

  return null;
end;
$$ language plpgsql security definer set search_path = public, vault, net;

drop trigger if exists on_tracking_numbers_added on tracking_numbers;
create trigger on_tracking_numbers_added
  after insert on tracking_numbers
  referencing new table as new_rows
  for each statement
  execute function notify_admins_new_tracking();
