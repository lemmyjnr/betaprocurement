-- Run this in Supabase's SQL Editor. Replaces the generic
-- "your batch is now X" email (from 006_email_notifications.sql)
-- with the client's actual branded templates, one per status.
--
-- Requires 006_email_notifications.sql to have already been run
-- (pg_net enabled, resend_api_key stored in the vault). This
-- migration only replaces the function body — the trigger itself
-- is untouched.
--
-- Status -> template mapping:
--   received      -> "Goods received & shipping update"
--   in_transit    -> "Shipping update" (in transit)
--   arrived_port  -> "Shipping update" (arrived in Nigeria / customs)
--   clearing      -> no email (the arrived_port email already tells
--                    the customer clearance is starting)
--   delivered     -> "Shipping update" (out of customs, ready)
--   submitted     -> no email (nothing has happened yet)
--
-- If you want a distinct email for "clearing" later, add another
-- `when 'clearing' then ...` branch below following the same
-- pattern as the others.

create or replace function notify_batch_status_change()
returns trigger as $$
declare
  customer_email text;
  customer_name text;
  api_key text;
  email_subject text;
  email_html text;
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

  select decrypted_secret into api_key
  from vault.decrypted_secrets where name = 'resend_api_key';

  if api_key is null then
    -- Key hasn't been added yet — skip rather than error, so
    -- status updates still work fine even before email is set up.
    return new;
  end if;

  case new.status
    when 'received' then
      email_subject := 'Goods received & shipping update';
      email_html :=
        '<p>Dear Customer,</p>' ||
        '<p>We are pleased to inform you that all your goods have been received at our warehouse and are currently being processed and prepared for shipment.</p>' ||
        '<p>Your items are being checked, consolidated, and packaged accordingly to ensure they are ready for dispatch.</p>' ||
        '<p>We will provide you with further updates once your shipment has been dispatched.</p>' ||
        '<p>Thank you for choosing us. We appreciate your patience and continued patronage.</p>' ||
        '<p><strong>Beta Courier &amp; Logistics</strong><br/>' ||
        '<em>Moving Your Goods, Moving Your Business.</em></p>';

    when 'in_transit' then
      email_subject := '🚚 Shipping update';
      email_html :=
        '<p>Dear Customer,</p>' ||
        '<p>We are pleased to inform you that Item Batch <strong>' || new.batch_code || '</strong> is currently in transit and on its way to its destination.</p>' ||
        '<p>We will keep you updated on the progress of the shipment.</p>' ||
        '<p>Thank you for choosing Beta Courier &amp; Logistics. We appreciate your continued patronage. ❤️</p>';

    when 'arrived_port' then
      email_subject := '🇳🇬 Shipping update';
      email_html :=
        '<p>Dear Customer,</p>' ||
        '<p>We are pleased to inform you that Item Batch <strong>' || new.batch_code || '</strong> has arrived in Nigeria and is currently undergoing the customs clearance process.</p>' ||
        '<p>We will keep you updated once the clearance process is completed and the shipment is ready for the next stage.</p>' ||
        '<p>Thank you for choosing Beta Courier &amp; Logistics. We appreciate your patience and continued patronage.</p>';

    when 'delivered' then
      email_subject := '📦 Shipping update';
      email_html :=
        '<p>Dear Customer,</p>' ||
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
      -- 'submitted', 'clearing', or any future status with no
      -- client-approved template yet: skip sending.
      return new;
  end case;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'Beta Courier & Logistics <onboarding@resend.dev>', -- swap for your own verified domain once you have one, see README
      'to', customer_email,
      'subject', email_subject,
      'html', email_html
    )
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public, vault, net;

-- Trigger itself already exists from migration 006 and doesn't
-- need to be recreated — replacing the function above is enough.
