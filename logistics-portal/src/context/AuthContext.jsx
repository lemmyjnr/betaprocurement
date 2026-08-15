import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

// Supabase's password auth needs an email under the hood. Customers
// only ever see and type a phone number, so we quietly turn their
// phone number into a stable, fake-looking email for auth purposes.
// The real phone number is what's stored and shown everywhere else.
function phoneToAuthEmail(phone) {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@logistics.local`
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

  async function signUp({ fullName, shippingName, phone, password }) {
    const email = phoneToAuthEmail(phone)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error

    const userId = data.user?.id
    if (!userId) throw new Error('Sign up did not return a user. Check your Supabase email confirmation settings.')

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      full_name: fullName,
      shipping_name: shippingName,
      phone,
      role: 'customer',
      phone_verified: false, // flips to true once OTP verification is wired up
    })
    if (profileError) throw profileError

    // TODO: trigger OTP SMS here once an SMS provider (e.g. Termii,
    // Africa's Talking) is chosen. See src/pages/VerifyPhone.jsx for
    // the UI that's already waiting for that call.

    return userId
  }

  async function signIn({ phone, password }) {
    const email = phoneToAuthEmail(phone)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // For staff creating a customer account on the client's behalf.
  // Requires the admin's session; RLS on profiles allows this because
  // is_admin() checks the caller's own role.
  async function adminCreateCustomer({ fullName, shippingName, phone, password }) {
    const email = phoneToAuthEmail(phone)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    const userId = data.user?.id
    if (!userId) throw new Error('Could not create the customer account.')

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      full_name: fullName,
      shipping_name: shippingName,
      phone,
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
