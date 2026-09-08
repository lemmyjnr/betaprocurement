-- Run this in Supabase's SQL Editor, after 018.
-- Now that procurement.beta-eshopping.com is verified in Resend,
-- this switches all outgoing emails (customer status updates AND
-- admin notifications) from the onboarding@resend.dev test address
-- to info@procurement.beta-eshopping.com. This is what actually
-- makes emails deliver to real customers/admins, not just your own
-- Resend account.

create or replace function notify_batch_status_change()
returns trigger as $$
declare
  customer_email text;
  customer_name text;
  greeting_name text;
  tracking_count int;
  api_key text;
  email_subject text;
  email_body text;
  header_html text;
  footer_html text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select email, full_name into customer_email, customer_name
  from profiles where id = new.customer_id;

  -- No email on file yet — nothing to send to, just skip quietly.
  if customer_email is null then
    return new;
  end if;

  greeting_name := coalesce(nullif(trim(customer_name), ''), 'Customer');

  select decrypted_secret into api_key
  from vault.decrypted_secrets where name = 'resend_api_key';

  if api_key is null then
    -- Key hasn't been added yet — skip rather than error, so
    -- status updates still work fine even before email is set up.
    return new;
  end if;

  header_html :=
    '<div style="text-align:center;margin-bottom:20px;">' ||
    '<img src="https://procurement.beta-eshopping.com/logo.png" alt="Beta Courier & Logistics" style="max-width:180px;height:auto;"/>' ||
    '</div>';

  footer_html :=
    '<hr style="border:none;border-top:1px solid #ddd;margin:24px 0 16px;"/>' ||
    '<p style="font-size:12px;color:#666;line-height:1.6;">' ||
    'Website: <a href="https://procurement.beta-eshopping.com" style="color:#666;">procurement.beta-eshopping.com</a><br/>' ||
    '08144847539, 09049990019<br/>' ||
    '23b Fatai Atere way Mushin Matori.' ||
    '</p>';

  case new.status
    when 'received' then
      select count(*) into tracking_count from tracking_numbers where batch_id = new.id;

      email_subject := 'Goods received & shipping update';
      email_body :=
        '<p>Dear ' || greeting_name || ',</p>' ||
        '<p>We are pleased to inform you that all your goods have been received at our warehouse and are currently being processed and prepared for shipment.</p>' ||
        '<p>We can confirm a total of <strong>' || tracking_count || '</strong> tracking number' || (case when tracking_count = 1 then '' else 's' end) || ' received under this batch.</p>' ||
        '<p>Your items are being checked, consolidated, and packaged accordingly to ensure they are ready for dispatch.</p>' ||
        '<p>We will provide you with further updates once your shipment has been dispatched.</p>' ||
        '<p>Thank you for choosing us. We appreciate your patience and continued patronage.</p>' ||
        '<p><strong>Beta Courier &amp; Logistics</strong><br/>' ||
        '<em>Moving Your Goods, Moving Your Business.</em></p>';

    when 'in_transit' then
      email_subject := '🚚 Shipping update';
      email_body :=
        '<p>Dear ' || greeting_name || ',</p>' ||
        '<p>We are pleased to inform you that Item Batch <strong>' || new.batch_code || '</strong> is currently in transit and on its way to its destination.</p>' ||
        '<p>We will keep you updated on the progress of the shipment.</p>' ||
        '<p>Thank you for choosing Beta Courier &amp; Logistics. We appreciate your continued patronage. ❤️</p>';

    when 'arrived_port' then
      email_subject := '🇳🇬 Shipping update';
      email_body :=
        '<p>Dear ' || greeting_name || ',</p>' ||
        '<p>We are pleased to inform you that Item Batch <strong>' || new.batch_code || '</strong> has arrived in Nigeria and is currently undergoing the customs clearance process.</p>' ||
        '<p>We will keep you updated once the clearance process is completed and the shipment is ready for the next stage.</p>' ||
        '<p>Thank you for choosing Beta Courier &amp; Logistics. We appreciate your patience and continued patronage.</p>';

    when 'delivered' then
      email_subject := '📦 Shipping update';
      email_body :=
        '<p>Dear ' || greeting_name || ',</p>' ||
        '<p>We are pleased to inform you that your item is now out of customs and ready for delivery. 🎉</p>' ||
        '<p>Please reach out to our Customer Service Team to confirm your preferred option:</p>' ||
        '<ul>' ||
        '<li><strong>Pick-up</strong> – You can arrange to pick up your item from our location.</li>' ||
        '<li><strong>Delivery</strong> – We can arrange delivery to your preferred address.</li>' ||
        '<li><strong>Waybill</strong> – We can waybill the item to your preferred destination.</li>' ||
        '</ul>' ||
        '<p>Kindly contact Customer Service to indicate your preferred option and make the necessary arrangements.</p>' ||
        '<p>Thank you for choosing Beta Courier &amp; Logistics. We appreciate your patronage. ❤️</p>';

    else
      -- 'submitted', 'clearing', 'picked_up', or any future status
      -- with no client-approved template yet: skip sending.
      return new;
  end case;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'Beta Courier & Logistics <info@procurement.beta-eshopping.com>',
      'to', customer_email,
      'subject', email_subject,
      'html', header_html || email_body || footer_html
    )
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public, vault, net;

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
      'from', 'Beta Courier & Logistics <info@procurement.beta-eshopping.com>',
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
      'from', 'Beta Courier & Logistics <info@procurement.beta-eshopping.com>',
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

-- Triggers themselves already exist from migrations 006, 017, and
-- 018 — replacing the three function bodies above is enough.
