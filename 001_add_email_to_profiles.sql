-- Run this once in your Supabase project's SQL Editor.
-- Adds an optional email column to profiles, so customers can sign
-- up/log in with email in addition to phone number. Safe to run even
-- if you already ran the original schema.sql — this only adds what's
-- missing.

alter table profiles add column if not exists email text unique;
