import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase env vars are missing. Copy .env.example to .env and fill in your project URL and anon key.'
  )
}

// "Remember me" on the login page: when checked (the default),
// sessions persist in localStorage — survives closing the browser,
// same as most sites. When unchecked, we use sessionStorage instead,
// so the session disappears once the tab/browser is closed. Login.jsx
// sets this flag right before calling signIn(); everything else here
// just reads it on every storage operation, since Supabase's own
// client is only ever created once.
const REMEMBER_KEY = 'sb-remember-me'

const authStorage = {
  getItem: (key) => {
    const remember = localStorage.getItem(REMEMBER_KEY) !== 'false'
    return (remember ? localStorage : sessionStorage).getItem(key)
  },
  setItem: (key, value) => {
    const remember = localStorage.getItem(REMEMBER_KEY) !== 'false'
    ;(remember ? localStorage : sessionStorage).setItem(key, value)
  },
  removeItem: (key) => {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: authStorage },
})

// TEMPORARY — for manually testing RLS/security fixes from the
// browser console (e.g. confirming 014_lock_privileged_profile_fields
// actually blocks self-promotion to admin). This exposes nothing new
// or sensitive: the anon key is already public in the bundled JS
// regardless, and Row Level Security is what actually protects data,
// not keeping this reference private. Still, remove this block once
// testing is done, just to keep things tidy.
window.supabase = supabase
