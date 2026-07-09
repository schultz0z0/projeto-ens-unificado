import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.6";
import { buildPasswordUpdatePayload, getBearerToken, getCorsHeaders, isAdminRole, parseAllowedOrigins, resolveAllowedOrigin } from "./adminResetPasswordPolicy.ts";

const schema = z.object({
  user_id: z.string().uuid(),
  password: z.string().min(8).max(72),
});

serve(async (req) => {
  const allowedOriginsRaw = Deno.env.get("ALLOWED_ORIGINS");
  const cors = getCorsHeaders(req, allowedOriginsRaw);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const origin = req.headers.get("Origin");
  if (origin && !resolveAllowedOrigin(origin, parseAllowedOrigins(allowedOriginsRaw))) {
    return new Response(JSON.stringify({ error: "forbidden_origin" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: "missing_env" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  try {
    const accessToken = getBearerToken(authHeader);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "unauthorized", reason: "missing_bearer_token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const supabaseAuth = createClient(url, anonKey);
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "unauthorized", reason: userErr?.message ?? "invalid_user_token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...cors } },
      );
    }

    const supabaseAdmin = createClient(url, serviceKey);

    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profErr || !profile || !isAdminRole(profile.role)) {
      return new Response(
        JSON.stringify({ error: "forbidden", reason: profErr?.message ?? "admin_profile_not_found" }),
        { status: 403, headers: { "Content-Type": "application/json", ...cors } },
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", parsed.data.user_id)
      .maybeSingle();

    if (targetProfileError) {
      return new Response(
        JSON.stringify({ error: "profile_read_failed", reason: targetProfileError.message }),
        { status: 502, headers: { "Content-Type": "application/json", ...cors } },
      );
    }

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "profile_not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      parsed.data.user_id,
      buildPasswordUpdatePayload(parsed.data.password),
    );

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "admin_reset_password_failed", reason: updateError.message }),
        { status: 502, headers: { "Content-Type": "application/json", ...cors } },
      );
    }

    await supabaseAdmin
      .from("profiles")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", parsed.data.user_id);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_internal_error";
    return new Response(JSON.stringify({ error: "internal_error", reason }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }
});
