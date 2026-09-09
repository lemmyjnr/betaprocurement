-- Run this in Supabase's SQL Editor, after 020.
-- Updates the 'in transit' email wording to the client's revised
-- text, which now also tells the customer they can log into their
-- portal to see the total CBM and other shipment details.

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
        '<p>You can log into your <a href="https://procurement.beta-eshopping.com/login">customer portal</a> to view the total CBM of your goods and other shipment details.</p>' ||
        '<p>We will continue to keep you updated on the progress of your shipment.</p>' ||
        '<p>Thank you for choosing Beta Courier &amp; Logistics. We appreciate your continued patronage.</p>';

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
-- Trigger itself already exists from migration 006 and doesn't
-- need to be recreated — replacing the function above is enough.
