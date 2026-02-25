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

    // Verify caller is authenticated admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token)
    if (!caller) throw new Error('Unauthorized')

    const body = await req.json()
    const { email, full_name, event_id, assigned_room, access_expires_at, action } = body

    if (!email || !full_name || !event_id) {
      throw new Error('Missing required fields: email, full_name, event_id')
    }

    // Verify caller has admin access to this event
    const { data: roles } = await supabaseAdmin.rpc('get_user_roles', { _user_id: caller.id })
    const isAdmin = roles?.some((r: string) => ['superuser', 'admin', 'coordinator'].includes(r))
    if (!isAdmin) throw new Error('Insufficient permissions')

    // Handle reinvite (delete old auth user, create new)
    if (action === 'reinvite') {
      const { data: staffRecord } = await supabaseAdmin
        .from('staff_members')
        .select('user_id')
        .eq('event_id', event_id)
        .eq('contact_email', email)
        .maybeSingle()

      if (staffRecord?.user_id) {
        await supabaseAdmin.auth.admin.deleteUser(staffRecord.user_id)
      }
    }

    // Create or get auth user via invitation
    let userId: string
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { data: { full_name, role: 'staff' } }
    )

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
        const existing = users?.find((u: any) => u.email === email)
        if (!existing) throw new Error('User exists but could not be found')
        userId = existing.id
      } else {
        throw authError
      }
    } else {
      userId = authData.user.id
    }

    // Update profile organization
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('organization_id')
      .eq('id', event_id)
      .single()

    if (event) {
      await supabaseAdmin
        .from('profiles')
        .update({ organization_id: event.organization_id, full_name })
        .eq('id', userId)
    }

    // Assign field_manager role (for event staff access)
    await supabaseAdmin.from('user_roles').upsert({
      user_id: userId,
      role: 'field_manager',
      organization_id: event?.organization_id,
      is_active: true,
    }, { onConflict: 'user_id,role' })

    // Add to event_staff
    await supabaseAdmin.from('event_staff').upsert({
      event_id,
      user_id: userId,
      role: 'checkin_staff',
      is_active: true,
    }, { onConflict: 'event_id,user_id' })

    // Update staff_members record
    await supabaseAdmin
      .from('staff_members')
      .update({
        user_id: userId,
        invitation_status: 'active',
      })
      .eq('event_id', event_id)
      .eq('contact_email', email)

    return new Response(
      JSON.stringify({ success: true, userId, email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
