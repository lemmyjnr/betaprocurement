// Deployed as a Supabase Edge Function.
//
// Why this exists: creating a user with the regular client-side
// supabase.auth.signUp() call also SIGNS IN as that new user in
// whichever browser made the call — there's no way to create an
// account client-side without also logging in as it. That's exactly
// why admin was getting logged out of their own session and dropped
// onto the customer dashboard every time they created an account —
// the browser really was now logged in as the customer they'd just
// made.
//
// Creating a user through the Admin API instead (server-side, with
// the service role key) does NOT touch anyone's session — it just
// creates the account and hands back its id. The admin stays logged
// in as themselves the whole time.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const { fullName, shippingName, phone, email, password, role } = await req.json()
    if (!fullName || !shippingName || !phone || !password) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), { status: 400 })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 })
    }

    // Scoped to the CALLER's own login — used only to check who's asking.
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } }
    )

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser()
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 })
    }

    const { data: callerProfile } = await callerClient.from('profiles').select('role, is_owner').eq('id', caller.id).single()
    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admins only' }), { status: 403 })
    }

    // Only the owner can create another admin this way — matches the
    // same rule the Staff page's invite links already enforce.
    const targetRole = role === 'admin' ? 'admin' : 'customer'
    if (targetRole === 'admin' && !callerProfile?.is_owner) {
      return new Response(JSON.stringify({ error: 'Only the owner can create admin accounts.' }), { status: 403 })
    }

    const trimmedEmail = email?.trim().toLowerCase()
    const phoneDigits = phone.replace(/\D/g, '')
    const authEmail = trimmedEmail || `${phoneDigits}@phone.betaprocurement-portal.com`

    // Service role client — the only thing that can create a user
    // without logging in as them.
    const adminClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
    })
    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 400 })
    }

    const { error: profileError } = await adminClient.from('profiles').insert({
      id: created.user.id,
      full_name: fullName,
      shipping_name: shippingName,
      phone,
      email: trimmedEmail || null,
      auth_email: authEmail,
      role: targetRole,
      phone_verified: true,
    })
    if (profileError) {
      // Roll back the auth user so there's no orphaned login with no profile.
      await adminClient.auth.admin.deleteUser(created.user.id)
      return new Response(JSON.stringify({ error: profileError.message }), { status: 400 })
    }

    return new Response(JSON.stringify({ userId: created.user.id }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
