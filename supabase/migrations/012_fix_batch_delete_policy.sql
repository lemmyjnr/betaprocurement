-- Run this once in your Supabase project's SQL Editor.
--
-- Fixes: "Delete order" in the admin batch detail page silently does
-- nothing — no error shown, the order just never actually goes away.
--
-- Root cause: the "admin deletes batches" policy has been part of
-- schema.sql (the fresh-install script) for a while, but it was
-- never captured as its own migration file. Every other schema
-- change shipped as a migration and got run against the live
-- project — this one didn't, so it was never applied. With Row
-- Level Security on and no delete policy at all on `batches`, every
-- delete is silently blocked: Postgres reports 0 rows matched, and
-- supabase-js treats "0 rows deleted" as success (no error), so the
-- app just navigated away as if it had worked.
--
-- This migration is safe to run even if the policy already exists.

drop policy if exists "admin deletes batches" on batches;

create policy "admin deletes batches"
  on batches for delete
  using (is_admin());
