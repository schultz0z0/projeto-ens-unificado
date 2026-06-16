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
  const origin = req.headers.get('Origin');
  const allowOrigin = resolveAllowedOrigin(origin);
  const allowAll = allowOrigin === '*';

  return {
    ...(allowAll ? { 'Access-Control-Allow-Origin': '*' } : (allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin, Vary: 'Origin' } : {})),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

const schema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(72),
  full_name: z.string().min(1).max(120),
  role: z.enum(['user', 'admin']).optional(),
});

const mapRoleToProfileRole = (role?: 'user' | 'admin') => (role === 'admin' ? 'broker' : 'tenant');
const isAdminRole = (role: unknown) => role === 'admin' || role === 'broker';
const getBearerToken = (authHeader: string) => authHeader.replace(/^Bearer\s+/i, '').trim();

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

    const profileRole = mapRoleToProfileRole(parsed.data.role)

    const { data: created, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        full_name: parsed.data.full_name,
        role: profileRole,
      },
    })

    if (adminErr || !created.user?.id) {
      return new Response(
        JSON.stringify({ error: 'admin_create_failed', reason: adminErr?.message ?? 'unknown_admin_create_error' }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    const id = created.user.id

    const { data: createdProfile, error: profileReadError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (profileReadError) {
      await supabaseAdmin.auth.admin.deleteUser(id)
      return new Response(
        JSON.stringify({ error: 'profile_read_failed', reason: profileReadError.message }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    const profileUpdatePayload = {
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      updated_at: new Date().toISOString(),
    }

    const { error: profileWriteError } = createdProfile
      ? await supabaseAdmin
          .from('profiles')
          .update(profileUpdatePayload)
          .eq('id', id)
      : await supabaseAdmin
          .from('profiles')
          .insert({
            id,
            ...profileUpdatePayload,
            role: profileRole,
          })

    if (profileWriteError) {
      await supabaseAdmin.auth.admin.deleteUser(id)
      return new Response(
        JSON.stringify({ error: 'profile_upsert_failed', reason: profileWriteError.message }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    return new Response(JSON.stringify({ id }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown_internal_error'
    return new Response(JSON.stringify({ error: 'internal_error', reason }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } })
  }
});
