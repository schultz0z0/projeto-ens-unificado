import { type GraphContext } from './schema.js';

export const VALIDATED_WORK_TYPES = [
  'copy',
  'campanha',
  'briefing',
  'insight',
  'decisao',
  'prompt',
  'estrategia'
] as const;

export const VALIDATED_WORK_STATUSES = ['draft', 'validated', 'deprecated'] as const;

export type ValidatedWorkType = typeof VALIDATED_WORK_TYPES[number];
export type ValidatedWorkStatus = typeof VALIDATED_WORK_STATUSES[number];
export type NormalizedProfileRole = 'admin' | 'manager' | 'member';

export type ValidatedWorkProfile = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
};

export type SaveValidatedWorkInput = {
  artifact_type: ValidatedWorkType;
  title: string;
  content: string;
  status?: ValidatedWorkStatus;
  related_course_id?: string;
  related_course_title?: string;
  related_rag_source_id?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  validated?: boolean;
  validation_note?: string;
  user_id?: string;
};

export type SearchValidatedWorksInput = {
  artifact_type?: ValidatedWorkType;
  query?: string;
  related_course_title?: string;
  include_deprecated?: boolean;
  limit?: number;
};

export type DeprecateValidatedWorkInput = {
  id: string;
  reason?: string;
  user_id?: string;
};

export type ValidatedWorkRecord = {
  id: string;
  tenant_id: string;
  artifact_type: ValidatedWorkType;
  title: string;
  content: string;
  status: ValidatedWorkStatus;
  related_course_id?: string | null;
  related_course_title?: string | null;
  related_rag_source_id?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
  created_by_user_id?: string | null;
  created_by_name?: string | null;
  validated_by_user_id?: string | null;
  validated_by_name?: string | null;
  validated_at?: string | null;
  deprecated_by_user_id?: string | null;
  deprecated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ValidatedWorkRepositoryConfig = {
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
};

const roleMap: Record<string, NormalizedProfileRole> = {
  admin: 'admin',
  broker: 'admin',
  owner: 'member',
  manager: 'manager',
  member: 'member',
  user: 'member',
  tenant: 'member'
};

export function normalizeProfileRole(role: unknown): NormalizedProfileRole {
  const key = String(role ?? '').trim().toLowerCase();
  return roleMap[key] ?? 'member';
}

export function canManageValidatedWorks(role: unknown): boolean {
  const normalized = normalizeProfileRole(role);
  return normalized === 'admin' || normalized === 'manager';
}

export function assertExplicitValidation(input: { validated?: boolean; validation_note?: string }): void {
  if (!input.validated) {
    throw new Error('Validated work write blocked: explicit user approval is required.');
  }
  if (!input.validation_note?.trim()) {
    throw new Error('Validated work write blocked: validation_note is required.');
  }
}

export function normalizeValidatedWorkLimit(limit: unknown, max = 50): number {
  const value = typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : 10;
  return Math.max(1, Math.min(max, value));
}

export function buildValidatedWorkGraphId(id: string): string {
  return `validated_work:${id}`;
}

export function getProfileDisplayName(profile: ValidatedWorkProfile | null | undefined, fallback = 'Usuario ENS'): string {
  return profile?.full_name?.trim() || profile?.email?.trim() || fallback;
}

export function buildValidatedWorkGraphProperties(record: ValidatedWorkRecord): Record<string, string | number | boolean | string[]> {
  return {
    artifact_type: record.artifact_type,
    status: record.status,
    supabase_record_id: record.id,
    related_course_id: record.related_course_id ?? '',
    related_course_title: record.related_course_title ?? '',
    related_rag_source_id: record.related_rag_source_id ?? '',
    validated_by_name: record.validated_by_name ?? '',
    validated_at: record.validated_at ?? '',
    created_by_name: record.created_by_name ?? '',
    created_at: record.created_at ?? '',
    tags: Array.isArray(record.tags) ? record.tags.filter(tag => typeof tag === 'string') : []
  };
}

export function summarizeValidatedWork(record: ValidatedWorkRecord): Record<string, unknown> {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    artifact_type: record.artifact_type,
    title: record.title,
    content: record.content,
    status: record.status,
    related_course_id: record.related_course_id,
    related_course_title: record.related_course_title,
    related_rag_source_id: record.related_rag_source_id,
    tags: record.tags ?? [],
    created_by_name: record.created_by_name,
    validated_by_name: record.validated_by_name,
    validated_at: record.validated_at,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

export class SupabaseValidatedWorkRepository {
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;

  constructor(config: ValidatedWorkRepositoryConfig) {
    this.supabaseUrl = (config.supabaseUrl ?? '').replace(/\/$/, '');
    this.serviceRoleKey = config.supabaseServiceRoleKey ?? '';
  }

  isConfigured(): boolean {
    return Boolean(this.supabaseUrl && this.serviceRoleKey);
  }

  async getActorProfile(userId: string): Promise<ValidatedWorkProfile> {
    this.assertConfigured();
    const params = new URLSearchParams({
      id: `eq.${userId}`,
      select: 'id,full_name,email,role',
      limit: '1'
    });
    const rows = await this.rest<ValidatedWorkProfile[]>(`/rest/v1/profiles?${params.toString()}`, {
      method: 'GET'
    });
    const profile = rows[0];
    if (!profile?.id) {
      throw new Error('validated_work_actor_profile_not_found');
    }
    return profile;
  }

  async save(context: GraphContext, input: SaveValidatedWorkInput): Promise<ValidatedWorkRecord> {
    this.assertConfigured();
    assertExplicitValidation(input);
    const userId = input.user_id?.trim() || context.userId;
    if (!userId) {
      throw new Error('validated_work_user_id_required');
    }
    const actor = await this.getActorProfile(userId);
    const now = new Date().toISOString();
    const status = input.status ?? 'validated';
    const body = {
      tenant_id: context.tenantId,
      artifact_type: input.artifact_type,
      title: input.title.trim(),
      content: input.content.trim(),
      status,
      related_course_id: input.related_course_id?.trim() || null,
      related_course_title: input.related_course_title?.trim() || null,
      related_rag_source_id: input.related_rag_source_id?.trim() || null,
      tags: normalizeTags(input.tags),
      metadata: sanitizeJsonObject({
        ...(input.metadata ?? {}),
        validation_note: input.validation_note?.trim() ?? null
      }),
      created_by_user_id: actor.id,
      created_by_name: getProfileDisplayName(actor),
      validated_by_user_id: status === 'validated' ? actor.id : null,
      validated_by_name: status === 'validated' ? getProfileDisplayName(actor) : null,
      validated_at: status === 'validated' ? now : null
    };

    const rows = await this.rest<ValidatedWorkRecord[]>('/rest/v1/validated_works', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body)
    });
    const record = rows[0];
    if (!record?.id) {
      throw new Error('validated_work_create_missing_record');
    }
    return record;
  }

  async search(context: GraphContext, input: SearchValidatedWorksInput): Promise<ValidatedWorkRecord[]> {
    this.assertConfigured();
    const limit = normalizeValidatedWorkLimit(input.limit, 100);
    const params = new URLSearchParams({
      tenant_id: `eq.${context.tenantId}`,
      select: '*',
      order: 'validated_at.desc.nullslast,created_at.desc',
      limit: String(Math.max(limit, 50))
    });
    if (input.artifact_type) {
      params.set('artifact_type', `eq.${input.artifact_type}`);
    }
    if (!input.include_deprecated) {
      params.set('status', 'eq.validated');
    }

    const rows = await this.rest<ValidatedWorkRecord[]>(`/rest/v1/validated_works?${params.toString()}`, {
      method: 'GET'
    });
    const query = String(input.query ?? '').trim().toLowerCase();
    const course = String(input.related_course_title ?? '').trim().toLowerCase();
    return rows
      .filter(row => {
        if (query) {
          const haystack = [
            row.title,
            row.content,
            row.related_course_title,
            ...(row.tags ?? [])
          ].join('\n').toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        if (course && !String(row.related_course_title ?? '').toLowerCase().includes(course)) {
          return false;
        }
        return true;
      })
      .slice(0, limit);
  }

  async deprecate(context: GraphContext, input: DeprecateValidatedWorkInput): Promise<ValidatedWorkRecord> {
    this.assertConfigured();
    const userId = input.user_id?.trim() || context.userId;
    if (!userId) {
      throw new Error('validated_work_user_id_required');
    }
    const actor = await this.getActorProfile(userId);
    if (!canManageValidatedWorks(actor.role)) {
      throw new Error('validated_work_manage_forbidden_for_member');
    }
    const body = {
      status: 'deprecated',
      deprecated_by_user_id: actor.id,
      deprecated_at: new Date().toISOString(),
      metadata: sanitizeJsonObject({
        deprecation_reason: input.reason?.trim() || null,
        deprecated_by_name: getProfileDisplayName(actor)
      })
    };
    const params = new URLSearchParams({
      id: `eq.${input.id}`,
      tenant_id: `eq.${context.tenantId}`
    });
    const rows = await this.rest<ValidatedWorkRecord[]>(`/rest/v1/validated_works?${params.toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body)
    });
    const record = rows[0];
    if (!record?.id) {
      throw new Error('validated_work_not_found');
    }
    return record;
  }

  private async rest<T>(pathAndQuery: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.supabaseUrl}${pathAndQuery}`, {
      ...init,
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {})
      }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const reason = payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message?: unknown }).message)
        : `supabase_rest_failed:${response.status}`;
      throw new Error(reason);
    }
    return payload as T;
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('validated_work_supabase_not_configured');
    }
  }
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map(tag => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
}

function sanitizeJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, nested]) => (
      nested === null ||
      typeof nested === 'string' ||
      typeof nested === 'number' ||
      typeof nested === 'boolean' ||
      Array.isArray(nested)
    ))
  );
}
