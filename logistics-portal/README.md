# Logistics Portal

Customer-facing tracking portal, built with React, Tailwind, and Supabase.
Customers sign up with a phone number, upload tracking numbers in batches,
and view packing lists. Admin/staff manage all of that from a separate
side of the same app.

## What's built

- Sign up (name, shipping name, phone, password) and login (phone, password)
- Batch upload: add one or several waybills at once, tagged with service
  type (Air Cargo / Sea Shipping) and route (China → Nigeria, Dubai →
  Nigeria). Every submission gets its own batch code, so nothing mixes
  with a previous upload.
- Batch detail page: tracking numbers and packing list for that batch
- Admin: create a customer account on their behalf, add tracking numbers
  to any customer's batch, update batch/tracking status, build packing
  lists as structured line items (item, quantity, weight, notes) —
  customers see it as a table on the site and can download it as CSV
- Change password page
- Role-based access enforced at the database level (Row Level Security),
  not just hidden in the UI — a customer genuinely cannot query another
  customer's data even if they inspect network requests.

## What's stubbed, on purpose

**OTP verification.** The sign-up flow already routes to a verification
screen (`src/pages/VerifyPhone.jsx`) and the database already has a
`phone_verified` flag, but no SMS is actually sent yet — entering any
6-digit code marks the account verified. This was deferred until the
SMS provider (Termii or Africa's Talking) is picked, since that's a
separate paid account and a decision for the client to sign off on
first. Search this codebase for `TODO` to find both places to wire it
up: `AuthContext.jsx` (where the code would be sent) and
`VerifyPhone.jsx` (where it would be checked).

## Setting up your Supabase project

1. Create a project at supabase.com.
2. In the SQL Editor, run everything in `supabase/schema.sql`. This
   creates the tables and the Row Level Security policies that keep
   customers from seeing each other's data.
3. In Project Settings → API, copy your Project URL and anon public
   key.
4. In Authentication → Settings, turn OFF "Confirm email" — this app
   uses phone numbers, not real email addresses, so there's no inbox
   to confirm from. Leaving it on will block sign-ups.

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
   change `role` from `customer` to `admin`.
3. Log out and back in. The sidebar switches to the admin navigation.

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

## Project structure

```
src/
  context/AuthContext.jsx   — signup/login/session, phone-as-email trick
  components/               — shared UI (shell, form fields, status badges)
  pages/                    — customer-facing screens
  pages/admin/               — staff-facing screens
  lib/supabaseClient.js     — Supabase connection
supabase/schema.sql         — tables + Row Level Security policies
```
