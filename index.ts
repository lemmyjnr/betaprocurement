// Deployed as a Supabase Edge Function. This is the only place in
// the whole app that touches the service role key — it's what lets
// this function actually delete someone's Supabase Auth login, not
// just their profile row. Never expose this key anywhere else.
//
// Deleting the auth user cascades (via "on delete cascade" in
// schema.sql) to their profile, and from there to every order,
// tracking number, and packing list they ever had. Permanent.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Browsers send a CORS "preflight" OPTIONS request before the real
// POST when a function is called directly from client-side JS (which
// is exactly what supabase.functions.invoke() does). Without these
// headers, the browser blocks the request before it ever reaches
// this code, and supabase-js reports it back as a generic
// "Failed to send a request to the Edge Function" — indistinguishable
// from the function not existing at all. Every function called from
// the browser needs this same block.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { customerId } = await req.json()
    if (!customerId) {
      return new Response(JSON.stringify({ error: 'customerId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Scoped to the CALLER's own login — used only to check who's asking.
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } }
    )

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', user.id).single()
    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admins only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // The service role key — this is the only thing that can actually
    // delete a Supabase Auth login. It's automatically available in
    // every Edge Function's environment; nothing to configure.
    const adminClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

    // Refuse to delete another admin through this path — removing an
    // admin is still owner-only, via the Staff page.
    const { data: target } = await adminClient.from('profiles').select('role').eq('id', customerId).single()
    if (target?.role !== 'customer') {
      return new Response(JSON.stringify({ error: 'This can only delete customer accounts.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(customerId)
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
