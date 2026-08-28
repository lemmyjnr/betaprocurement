// Deployed as a Supabase Edge Function.
//
// Many customers sign up with just a phone number, no email — so
// Supabase's normal email-based "forgot password" flow can't reach
// them at all. This lets admin set a new password directly instead.
// Same pattern as delete-customer and admin-create-customer: only
// the service role key (server-side only) can actually change
// someone else's password.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const { customerId, newPassword } = await req.json()
    if (!customerId || !newPassword) {
      return new Response(JSON.stringify({ error: 'customerId and newPassword are required' }), { status: 400 })
    }
    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters.' }), { status: 400 })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 })
    }

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

    const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admins only' }), { status: 403 })
    }

    const adminClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

    const { error: updateError } = await adminClient.auth.admin.updateUserById(customerId, {
      password: newPassword,
    })
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 400 })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
