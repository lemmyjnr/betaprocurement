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
// We can't just guess which synthetic/real email an account was
// created with — someone who signed up with both a phone and an
// email only has ONE real identity in Supabase Auth (whichever was
// used at sign up). So instead of guessing, we look up the actual
// auth email that was stored for this phone/email at sign up time,
// via a database function that's allowed to run before login.
async function resolveAuthEmail(identifier) {
  const trimmed = identifier.trim()
  const { data, error } = await supabase.rpc('auth_email_for_identifier', {
    lookup: trimmed,
  })
  if (error) throw error
  return data || null
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

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session?.user) {
        if (event === 'SIGNED_IN') {
          // A real, fresh sign-in — hold `loading` true until the
          // profile catches up, so pages gated on session can't
          // render (and let someone act) before we know who they
          // are. See ProtectedRoute.jsx.
          setLoading(true)
          loadProfile(session.user.id).finally(() => setLoading(false))
        } else {
          // Anything else with a session (e.g. Supabase's automatic
          // background token refresh) — just quietly refresh the
          // profile without flashing a loading screen over the app.
          loadProfile(session.user.id)
        }
      } else {
        setProfile(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Email is required on the sign-up form now (it's needed for shipment
  // status emails), but this function itself still works if a caller
  // ever passes an empty one (e.g. an old admin-created account) — it
  // falls back to the phone-as-email trick either way. Either way, we
  // save the exact auth email we used in `auth_email`, so login can
  // always find it again later — see resolveAuthEmail.
  async function signUp({ fullName, shippingName, phone, email, password }) {
    const trimmedEmail = email?.trim().toLowerCase()
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
      auth_email: authEmail,
      role: 'customer',
      phone_verified: true, // no OTP step in this build — see the client decision noted in SignUp.jsx
    })
    if (profileError) throw profileError
    return userId
  }

  async function signIn({ identifier, password }) {
    const authEmail = await resolveAuthEmail(identifier)
    if (!authEmail) {
      throw new Error('NO_ACCOUNT')
    }
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // For staff creating a customer account on the client's behalf.
  // This has to go through a server-side Edge Function, not a direct
  // supabase.auth.signUp() call — signUp() also logs the CALLER in
  // as the account it just created, which was silently signing admin
  // out of their own session and dropping them onto the customer
  // dashboard every time. The Edge Function creates the account
  // without touching anyone's session.
  async function adminCreateCustomer({ fullName, shippingName, phone, email, password, role = 'customer' }) {
    const { data, error } = await supabase.functions.invoke('admin-create-customer', {
      body: { fullName, shippingName, phone, email, password, role },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return data.userId
  }

  // Admin generates a one-time link instead of typing a new staff
  // member's password in for them. `note` is just for the admin's
  // own memory (e.g. "for Chidi") — it's never shown to the invitee.
  async function createStaffInvite({ note }) {
    const { data, error } = await supabase
      .from('staff_invites')
      .insert({ note, created_by: session.user.id })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function checkStaffInvite(inviteId) {
    const { data, error } = await supabase.rpc('staff_invite_is_valid', { invite_id: inviteId })
    if (error) throw error
    return data === true
  }

  async function setAdminSuspended(targetId, shouldSuspend) {
    const { error } = await supabase.rpc('set_admin_suspended', {
      target_id: targetId,
      should_suspend: shouldSuspend,
    })
    if (error) throw error
  }

  async function removeAdmin(targetId) {
    const { error } = await supabase.rpc('remove_admin', { target_id: targetId })
    if (error) throw error
  }

  // For a customer who's locked out and has no email to send a reset
  // link to. Sets their password directly — tell them the new one
  // yourself (call, WhatsApp, etc.).
  async function adminResetPassword(customerId, newPassword) {
    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      body: { customerId, newPassword },
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
  }

  // The invitee's own sign-up flow: create their login, then redeem
  // the invite server-side to actually become an admin. See
  // redeem_staff_invite() in the database — that's what enforces this
  // is only possible with a real, unused, unexpired invite.
  async function redeemStaffInvite({ inviteId, fullName, phone, email, password }) {
    const trimmedEmail = email?.trim().toLowerCase()
    const authEmail = trimmedEmail ? trimmedEmail : phoneToAuthEmail(phone)
    const { data, error } = await supabase.auth.signUp({ email: authEmail, password })
    if (error) throw error
    const userId = data.user?.id
    if (!userId) throw new Error('Sign up did not return a user.')

    const { error: redeemError } = await supabase.rpc('redeem_staff_invite', {
      invite_id: inviteId,
      p_full_name: fullName,
      p_phone: phone,
      p_email: trimmedEmail || null,
      p_auth_email: authEmail,
    })
    if (redeemError) throw redeemError

    await loadProfile(userId)
    return userId
  }

  const value = {
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    isOwner: profile?.is_owner === true,
    signUp,
    signIn,
    signOut,
    adminCreateCustomer,
    createStaffInvite,
    checkStaffInvite,
    redeemStaffInvite,
    setAdminSuspended,
    removeAdmin,
    adminResetPassword,
    refreshProfile: () => session?.user && loadProfile(session.user.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
