-- Run this once in your Supabase project's SQL Editor.
-- Lets admin delete a customer's account. Deleting a profile cascades
-- to every order, tracking number, and packing list that customer
-- ever had — permanent, no soft-delete. This does NOT let admin
-- delete another admin's account through this same path — that's
-- still owner-only, via the Staff page (remove_admin()).

drop policy if exists "admin deletes customer accounts" on profiles;

create policy "admin deletes customer accounts"
  on profiles for delete
  using (is_admin() and role = 'customer');
