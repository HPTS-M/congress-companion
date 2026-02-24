import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const email = 'admin@congressapp.com'
    const password = 'Admin2026!'
    const eventId = '5efca36a-deef-489b-be85-3dc9d1501ed7'

    // 1. Create auth user or get existing
    let userId: string
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Admin CongressApp' },
    })

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        // Get existing user
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
        const existing = users?.find(u => u.email === email)
        if (!existing) throw new Error('User exists but could not be found')
        userId = existing.id
      } else {
        throw authError
      }
    } else {
      userId = authData.user.id
    }

    // 2. Get event's organization_id
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('organization_id')
      .eq('id', eventId)
      .single()

    if (!event) throw new Error('Event not found')

    // 3. Profile is auto-created by trigger, but update organization_id
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ organization_id: event.organization_id, full_name: 'Admin CongressApp' })
      .eq('id', userId)

    // 4. Assign admin role
    const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
      user_id: userId,
      role: 'admin',
      organization_id: event.organization_id,
      is_active: true,
    })

    // 5. Add to event_staff
    const { error: staffError } = await supabaseAdmin.from('event_staff').insert({
      event_id: eventId,
      user_id: userId,
      role: 'event_coordinator',
      is_active: true,
    })

    return new Response(
      JSON.stringify({ success: true, userId, email, profileError, roleError, staffError }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
