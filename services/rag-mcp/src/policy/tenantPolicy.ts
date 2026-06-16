export type TenantPolicyConfig = {
  commonTenant: string;
  adminProfiles: string[];
  defaultLimit: number;
  maxLimit: number;
};

export type TenantScopeInput = {
  actorProfile: string;
  activeClient?: string;
  requestedTenants?: string[];
  adminMode?: boolean;
  policy: TenantPolicyConfig;
};

export type TenantScope = {
  actorProfile: string;
  activeClient?: string;
  allowedTenants: string[];
  isAdmin: boolean;
};

export class TenantAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantAccessError';
  }
}

export function resolveTenantScope(input: TenantScopeInput): TenantScope {
  const actorProfile = input.actorProfile.trim();
  const requestedTenants = uniqueTenants(input.requestedTenants ?? []);
  const activeClient = input.activeClient?.trim() || undefined;
  const isAdminProfile = input.policy.adminProfiles.includes(actorProfile);
  const isAdmin = Boolean(input.adminMode && isAdminProfile);

  if (isAdmin) {
    return {
      actorProfile,
      activeClient,
      allowedTenants: requestedTenants.length > 0 ? requestedTenants : [input.policy.commonTenant],
      isAdmin
    };
  }

  const activeScope = uniqueTenants([input.policy.commonTenant, activeClient].filter(Boolean) as string[]);
  const allowedTenants =
    requestedTenants.length === 0
      ? activeScope
      : requestedTenants.filter(tenant => activeScope.includes(tenant));

  return {
    actorProfile,
    activeClient,
    allowedTenants,
    isAdmin
  };
}

export function assertTenantAccess(input: TenantScopeInput): TenantScope {
  const requestedTenants = uniqueTenants(input.requestedTenants ?? []);
  const scope = resolveTenantScope(input);

  for (const tenant of requestedTenants) {
    if (!scope.allowedTenants.includes(tenant)) {
      throw new TenantAccessError(`Access denied: tenant ${tenant} is outside the active task scope.`);
    }
  }

  return scope;
}

function uniqueTenants(tenants: string[]): string[] {
  return [...new Set(tenants.map(tenant => tenant.trim()).filter(Boolean))];
}

