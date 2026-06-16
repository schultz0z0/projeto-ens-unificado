import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.6";

const canonicalizeOrigin = (raw: string) => {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  if (trimmed === '*') return '*';

  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
};

const parseAllowedOrigins = () => {
  const allowedOriginsRaw = Deno.env.get('ALLOWED_ORIGINS');
  return (allowedOriginsRaw ? allowedOriginsRaw.split(',') : ['*'])
    .map((origin: string) => canonicalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));
};

const resolveAllowedOrigin = (origin: string | null) => {
  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.includes('*')) return '*';
  if (!origin) return '';

  const canonicalOrigin = canonicalizeOrigin(origin);
  if (!canonicalOrigin) return '';

  let originUrl: URL | null = null;
  try {
    originUrl = new URL(canonicalOrigin);
  } catch {
    originUrl = null;
  }

  const matched = allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin === canonicalOrigin) return true;
    if (!originUrl) return false;

    try {
      const allowedUrl = new URL(allowedOrigin);
      return allowedUrl.host === originUrl.host && allowedUrl.protocol === originUrl.protocol;
    } catch {
      return allowedOrigin === originUrl.host.toLowerCase() || allowedOrigin === originUrl.hostname.toLowerCase();
    }
  });

  return matched ? canonicalOrigin : '';
};

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('Origin')
  const allowOrigin = resolveAllowedOrigin(origin)
  const allowAll = allowOrigin === '*'

  return {
    ...(allowAll ? { 'Access-Control-Allow-Origin': '*' } : (allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin, Vary: 'Origin' } : {})),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

const schema = z.object({
  user_id: z.string().uuid(),
})

const isAdminRole = (role: unknown) => role === 'admin' || role === 'broker'
const getBearerToken = (authHeader: string) => authHeader.replace(/^Bearer\s+/i, '').trim()
const isMissingAuthUserError = (message?: string) => {
  const normalized = (message ?? '').toLowerCase()
  return (
    normalized.includes('user not found') ||
    normalized.includes('database error loading user') ||
    normalized.includes('database error finding user')
  )
}

const cleanupAppUserData = async (supabaseAdmin: ReturnType<typeof createClient>, userId: string) => {
  const { error: integrationError } = await supabaseAdmin
    .from('user_chat_integrations')
    .delete()
    .eq('user_id', userId)

  if (integrationError) {
    throw integrationError
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (profileError) {
    throw profileError
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...cors } })

  const origin = req.headers.get('Origin')
  if (origin && !resolveAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: 'forbidden_origin' }), { status: 403, headers: { 'Content-Type': 'application/json', ...cors } })
  }

  const url = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: 'missing_env' }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } })
  }

  try {
    const accessToken = getBearerToken(authHeader)
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'unauthorized', reason: 'missing_bearer_token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } })
    }

    const supabaseAuth = createClient(url, anonKey)
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(accessToken)
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', reason: userErr?.message ?? 'invalid_user_token' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    const supabaseAdmin = createClient(url, serviceKey)

    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (profErr || !profile || !isAdminRole(profile.role)) {
      return new Response(
        JSON.stringify({ error: 'forbidden', reason: profErr?.message ?? 'admin_profile_not_found' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'invalid_payload' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } })
    }

    const { data: existingUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(parsed.data.user_id)

    if (getUserError && !isMissingAuthUserError(getUserError.message)) {
      return new Response(
        JSON.stringify({ error: 'admin_delete_failed', reason: getUserError.message }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    if (existingUser?.user) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(parsed.data.user_id)
      if (delErr && !isMissingAuthUserError(delErr.message)) {
        return new Response(
          JSON.stringify({ error: 'admin_delete_failed', reason: delErr.message }),
          { status: 502, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }
    }

    await cleanupAppUserData(supabaseAdmin, parsed.data.user_id)

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown_internal_error'
    return new Response(JSON.stringify({ error: 'internal_error', reason }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } })
  }
});
