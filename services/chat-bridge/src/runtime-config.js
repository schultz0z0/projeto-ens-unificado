const placeholder = /^(?:(?:change|replace)[-_]?me|placeholder|example|secret)(?:[-_].*)?$/i;

const value = (env, names) => names.map((name) => env[name]?.trim()).find(Boolean) || "";

export const validateBridgeRuntimeConfig = (env = process.env) => {
  const production = env.NODE_ENV === "production";
  const allowInsecureLocalAuth = !production && env.BRIDGE_ALLOW_INSECURE_LOCAL_AUTH === "true";
  const supabaseUrl = value(env, ["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  const supabaseAnonKey = value(env, ["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  const supabaseServiceRoleKey = value(env, ["SUPABASE_SERVICE_ROLE_KEY"]);
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    if (!allowInsecureLocalAuth) {
      const missing = !supabaseUrl ? "SUPABASE_URL" : !supabaseAnonKey ? "SUPABASE_ANON_KEY" : "SUPABASE_SERVICE_ROLE_KEY";
      throw new Error(`${missing} is required; set BRIDGE_ALLOW_INSECURE_LOCAL_AUTH=true only for isolated local development`);
    }
  }
  const activeKid = value(env, ["MARKETING_OPS_DELEGATION_ACTIVE_KID"]);
  const activeKey = value(env, ["MARKETING_OPS_DELEGATION_ACTIVE_KEY"]);
  if (production && (!activeKid || !activeKey || placeholder.test(activeKey))) {
    throw new Error("MARKETING_OPS_DELEGATION_ACTIVE_KID and MARKETING_OPS_DELEGATION_ACTIVE_KEY are required in production");
  }
  const delegationRefreshKey = value(env, ["MARKETING_OPS_DELEGATION_REFRESH_KEY"]);
  if (production && (!delegationRefreshKey || placeholder.test(delegationRefreshKey))) {
    throw new Error("MARKETING_OPS_DELEGATION_REFRESH_KEY is required in production");
  }
  return {
    production,
    allowInsecureLocalAuth,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    activeKid,
    activeKey,
    delegationRefreshKey,
  };
};
