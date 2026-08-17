-- Run this in Supabase's SQL Editor. It sets up automatic emails to
-- customers whenever a batch's status changes, e.g. "submitted" to
-- "in_transit". You do NOT need to write any app code for this —
-- Postgres itself watches for the change and fires the email.
--
-- IMPORTANT: this file does not contain your Resend API key, and
-- never should. Your GitHub repo is public, so anything committed
-- to it is visible to anyone. The key goes in separately, straight
-- into Supabase, in a one-off command that never touches GitHub —
-- see the README section on this feature for that exact step.

-- pg_net lets Postgres make an HTTP request (to Resend's API) from
-- inside a trigger. Usually already enabled on Supabase, this is
-- just a safety check.
create extension if not exists pg_net;

-- Looks up the customer's email and fires a request to Resend
-- whenever a batch's status actually changes (not on every update,
-- e.g. editing tracking numbers doesn't trigger this — only status
-- itself changing does).
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

  -- No email on file yet (older test accounts, or someone who
  -- hasn't added one) — nothing to send to, just skip quietly.
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
