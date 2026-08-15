import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

// Supabase's password auth needs an email under the hood. A customer
// can sign up with a real email, or with just a phone number — in
// that second case we quietly turn the phone number into a stable,
// synthetic email for auth purposes. The real phone number is what's
// stored and shown everywhere else.
//
// Note: the domain here must be a normal-looking, real TLD. Supabase
// rejects reserved/special-use domains like ".local" as invalid email
// addresses, which is why sign-ups with only a phone number were
// failing before.
function phoneToAuthEmail(phone) {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@phone.betaprocurement-portal.com`
}

// Login accepts either a phone number or an email in the same field.
// If it looks like an email, use it as-is; otherwise treat it as a
// phone number and go through the same synthetic-email conversion
// used at sign up.
function identifierToAuthEmail(identifier) {
  const trimmed = identifier.trim()
  return trimmed.includes('@') ? trimmed : phoneToAuthEmail(trimmed)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error) setProfile(data)
    return data
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // `email` is optional. If the customer gives one, it becomes their
  // real Supabase auth identity (so they can log in with it, and it
  // unlocks things like password-reset emails later). If they leave
  // it blank, we fall back to the phone-as-email trick, same as before.
  async function signUp({ fullName, shippingName, phone, email, password }) {
    const trimmedEmail = email?.trim()
    const authEmail = trimmedEmail ? trimmedEmail : phoneToAuthEmail(phone)
    const { data, error } = await supabase.auth.signUp({ email: authEmail, password })
    if (error) throw error

    const userId = data.user?.id
    if (!userId) throw new Error('Sign up did not return a user. Check your Supabase email confirmation settings.')

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      full_name: fullName,
      shipping_name: shippingName,
      phone,
      email: trimmedEmail || null,
      role: 'customer',
      phone_verified: false, // flips to true once OTP verification is wired up
    })
    if (profileError) throw profileError

    // TODO: trigger OTP SMS here once an SMS provider (e.g. Termii,
    // Africa's Talking) is chosen. See src/pages/VerifyPhone.jsx for
    // the UI that's already waiting for that call.

    return userId
  }

  async function signIn({ identifier, password }) {
    const email = identifierToAuthEmail(identifier)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // For staff creating a customer account on the client's behalf.
  // Requires the admin's session; RLS on profiles allows this because
  // is_admin() checks the caller's own role.
  async function adminCreateCustomer({ fullName, shippingName, phone, email, password }) {
    const trimmedEmail = email?.trim()
    const authEmail = trimmedEmail ? trimmedEmail : phoneToAuthEmail(phone)
    const { data, error } = await supabase.auth.signUp({ email: authEmail, password })
    if (error) throw error
    const userId = data.user?.id
    if (!userId) throw new Error('Could not create the customer account.')

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      full_name: fullName,
      shipping_name: shippingName,
      phone,
      email: trimmedEmail || null,
      role: 'customer',
      phone_verified: true, // staff-created accounts skip OTP; they've verified the customer directly
    })
    if (profileError) throw profileError
    return userId
  }

  const value = {
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    signUp,
    signIn,
    signOut,
    adminCreateCustomer,
    refreshProfile: () => session?.user && loadProfile(session.user.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
