# Logistics Portal

Customer-facing tracking portal for Beta Logistics, built with React,
Tailwind, and Supabase. Customers sign up (name, shipping name, phone,
email, password), upload waybills in batches, and view packing lists.
Admin/staff manage all of that from a separate side of the same app,
reachable at the same login page (or a dedicated admin URL/subdomain).

## What's built

- "Order" is the customer-facing word for what the database still
  calls a batch internally — same thing, renamed in the UI per
  client feedback. Code/table/route names weren't touched, only
  visible text.
- Public tracking lookup at `/track` — no login, just a waybill
  number, returns status only (no customer info). Linked from the
  login page.
- Search: customers can search their own tracking numbers from the
  Dashboard; admin can search across every customer's from Overview,
  and filter the All Orders list by order code, name, or phone.
- "Remember me" on login — see `src/lib/supabaseClient.js` for how
  the session storage switches between localStorage (persists) and
  sessionStorage (clears on browser close) based on the checkbox.
- Tracking-number status is just Pending/Received now — the fuller
  status lifecycle lives at the order level only.
- Courier is no longer collected anywhere — customers only submit a
  waybill number; admin fills in quantity once it's received.
- Packing lists only show for Sea Freight orders on the customer
  side (admin can still manage them regardless of service type).
- Bulk-paste option on the upload page — paste a list of waybill
  numbers instead of typing them one at a time.
- CBM can be typed directly or calculated from length/width/height
  in the admin packing-list form.


- Sign up (name, shipping name, phone, email, password — all
  required) and login with either phone number or email, same
  password either way.
- Batch upload: customers submit just a waybill number per tracking
  entry — courier and quantity are filled in by admin once the item
  is actually received. Every submission is tagged with a service
  type (Sea Freight / Air Freight / Express) and route (China -
  Nigeria, Dubai - Nigeria), and gets its own batch code so nothing
  mixes with a previous upload.
- Customers can edit or remove their own waybills up until the batch
  is marked shipped — after that, only admin can touch it.
- Automatic email to the customer whenever a batch's status changes
  (see the Resend section below to turn this on).
- Admin: create a customer account on their behalf, add tracking
  numbers to any customer's batch, fill in courier/quantity per
  waybill, update batch/tracking status, and build packing lists as
  structured freight line items (quantity, weight in kg, CBM, price
  per CBM, auto-calculated amount, notes). Customers see it as a
  table on the site and can download it as CSV.
- Staff management: the one "owner" admin can generate one-time
  invite links for other staff to set up their own admin account,
  and can pause or remove any admin's access at any time — see the
  Staff page.
- Role-based access enforced at the database level (Row Level
  Security), not just hidden in the UI — a customer genuinely cannot
  query another customer's data even if they inspect network
  requests.

## What's stubbed, on purpose

**OTP / SMS verification.** Not built — the client confirmed it isn't
needed. `profiles.phone_verified` is set `true` at sign up rather
than going through a real verification step.

**Public tracking lookup (no login).** Discussed, not built yet —
worth doing if the client wants a shareable, no-login tracking link.

## Setting up your Supabase project

1. Create a project at supabase.com.
2. In the SQL Editor, run everything in `supabase/schema.sql`. This
   creates the tables, Row Level Security policies, and the email
   notification trigger, matching the app's current state. (If
   you already had this project running before some of this was
   added, run whichever files under `supabase/migrations/` you're
   missing instead — each one is safe to run even if parts of it
   already exist. If you're not sure what's already been run,
   `supabase/migrations/013_reconcile_all_policies.sql` re-asserts
   every permission rule in the app in one go and is always safe to
   run — see the comment at the top of that file for why it exists.)
3. In Project Settings → API Keys, copy your Project URL (Settings →
   General) and your Publishable key.
4. In Authentication → Settings, turn OFF "Confirm email" — sign-ups
   here don't go through email confirmation, so leaving this on will
   block every sign-up.

## Deploying the Edge Functions

Three features — deleting a customer, creating a customer account as
admin, and resetting a customer's password as admin — run as
Supabase Edge Functions (`supabase/functions/`), not from the
browser directly, because they need the service role key. **Writing
the code in this repo does not make it live** — each function has to
be deployed to your Supabase project separately, and this project
isn't wired up to the Supabase CLI (no `supabase/config.toml`), so
the easiest path is the dashboard:

1. In your Supabase project, go to **Edge Functions** → **Deploy a
   new function**.
2. Name it exactly as the folder is named (`delete-customer`,
   `admin-create-customer`, or `admin-reset-password`), and paste in
   the contents of that folder's `index.ts`.
3. Repeat for all three — they're independent, so each one has to be
   created and deployed on its own.

If a button in the app that should call one of these (Delete
customer, Set password, admin's "create customer" form) fails with
**"Failed to send a request to the Edge Function"**, that specific
function hasn't been deployed yet (or was renamed) — that error means
the request never reached a function at all, as opposed to the
function running and returning its own error message. Re-check step
2 for that function's name.

If you'd rather use the CLI going forward: `supabase init`, then
`supabase link --project-ref YOUR_PROJECT_REF`, then
`supabase functions deploy delete-customer` (repeat per function, or
`supabase functions deploy` with no name to deploy all of them).

## Setting up shipment status emails (Resend)

Batch status changes trigger an email automatically once this is set
up — no app code involved, it's a Postgres trigger.

1. Create a free account at [resend.com](https://resend.com).
2. In Resend, go to **API Keys** → create one → copy it.
3. **Don't put the key in `.env` or GitHub.** Instead, run this once
   in Supabase's SQL Editor, with your real key pasted in:
   ```sql
   select vault.create_secret('YOUR_RESEND_API_KEY_HERE', 'resend_api_key');
   ```
4. Run `supabase/migrations/006_email_notifications.sql`, then
   `supabase/migrations/015_status_email_templates.sql`, then
   `supabase/migrations/016_add_picked_up_status.sql`, then
   `supabase/migrations/017_email_branding_and_personalization.sql`,
   then `supabase/migrations/018_admin_notifications.sql`, then
   `supabase/migrations/019_verified_sender_address.sql`, then
   `supabase/migrations/020_track_by_batch_number.sql`, then
   `supabase/migrations/021_update_in_transit_email.sql`, then
   `supabase/migrations/022_fix_phone_login_lookup.sql`
   (all are already included in `schema.sql` for brand-new projects).
5. Test it: as admin, change any batch's status to `received`,
   `in_transit`, `arrived_port`, or `delivered`. If the customer on
   that batch has an email on file, they should get one of the four
   branded templates below. `submitted` and `clearing` don't send an
   email — there's no client-approved template for those yet.

**The four templates currently in use** (edit them directly in the
`notify_batch_status_change()` function if wording needs to change):
- **Received** — goods received at the warehouse, being processed.
- **In transit** — batch is on its way.
- **Arrived at port** — arrived in Nigeria, customs clearance in progress.
- **Delivered** — out of customs, customer picks pick-up/delivery/waybill.

**Admin notifications** (`notify_admins_new_customer()` and
`notify_admins_new_tracking()`, migration 018) send to every admin
with an email on file (and not suspended) whenever:
- a new customer signs up, or
- a customer adds tracking number(s) to a batch — either when first
  creating it or adding more later. One email per upload, even if
  several tracking numbers are added at once. Admin-side additions
  through the admin panel don't trigger this — only customer-initiated ones.

**Sender address:** `procurement.beta-eshopping.com` is verified in
Resend, and all emails (customer status updates and admin
notifications) send from `info@procurement.beta-eshopping.com`
(migration 019). If you ever need to change it, update the `from`
line in all three functions — `notify_batch_status_change()`,
`notify_admins_new_customer()`, and `notify_admins_new_tracking()`.

Free-tier Resend allows up to 100 emails/day and 3,000/month.

## Running locally

```bash
npm install
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
npm run dev
```

## Creating your first admin account

There's no UI for this on purpose — you don't want a button anywhere
that turns a customer into an admin. Instead:

1. Sign up normally through the app with the account you want to be
   admin.
2. In the Supabase Table Editor, open `profiles`, find that row, and
   change `role` from `customer` to `admin`, and `is_owner` to `true`
   (this makes them the one admin who can invite/pause/remove others
   — see the Staff page).
3. Log out and back in. The sidebar switches to the admin navigation.

Every admin after that first one is created through the Staff page's
invite links — no more manual database edits needed.

## Two front doors, one app (`src/lib/portalHost.js`)

The customer and admin sides can be served from two different
subdomains once the client's domain is connected (see that file for
where to put the real subdomain names). Until then, adding
`?portal=admin` to the login URL previews the admin-flavored login
page without needing DNS set up — e.g.
`https://your-app.vercel.app/login?portal=admin`. Either way this is
just a cosmetic front door — actual access is enforced by role,
regardless of which URL someone used to log in (see
`ProtectedRoute.jsx`).

## Deploying (Vercel via GitHub)

1. Push this project to a GitHub repo.
2. On vercel.com, import that repo as a new project. Vercel detects
   Vite automatically, so the build command and output directory
   should already be right (`npm run build` and `dist`).
3. Before deploying, add the two environment variables from your
   `.env` file — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` —
   under the project's Environment Variables settings. Without
   these the deployed app will build fine but auth won't work.
4. Deploy. Every push to the connected branch redeploys
   automatically after this.
5. `vercel.json` in this repo is required — without it, direct links
   (invite links, shared batch links, etc.) 404 instead of loading
   the app.

## Project structure

```
src/
  context/AuthContext.jsx   — signup/login/session, phone-as-email trick
  components/               — shared UI (shell, form fields, status badges)
  pages/                    — customer-facing screens
  pages/admin/               — staff-facing screens
  lib/labels.js             — shared service type / route display labels
  lib/portalHost.js         — customer vs admin front-door detection
  lib/supabaseClient.js     — Supabase connection
supabase/schema.sql         — tables + Row Level Security policies (current state)
supabase/migrations/        — incremental history, for an already-running project
```
