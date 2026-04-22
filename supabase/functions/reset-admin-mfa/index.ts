import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetMfaRequest {
  target_user_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate caller via JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check caller is superuser
    const { data: roles } = await userClient.rpc('get_user_roles', { _user_id: user.id });
    const isSuperuser = Array.isArray(roles) && roles.includes('superuser');
    if (!isSuperuser) {
      return new Response(JSON.stringify({ error: 'Forbidden — superuser only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as ResetMfaRequest;
    if (!body.target_user_id || typeof body.target_user_id !== 'string') {
      return new Response(JSON.stringify({ error: 'target_user_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role to delete MFA factors
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // List factors for the target user
    const { data: factorsData, error: listError } = await adminClient.auth.admin.mfa.listFactors({
      userId: body.target_user_id,
    });

    if (listError) {
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete every factor
    let deleted = 0;
    for (const factor of factorsData?.factors ?? []) {
      const { error: delError } = await adminClient.auth.admin.mfa.deleteFactor({
        userId: body.target_user_id,
        id: factor.id,
      });
      if (!delError) deleted++;
    }

    return new Response(
      JSON.stringify({ success: true, deleted }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
