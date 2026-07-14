import type {
  MarketingOpsCampaign,
  MarketingOpsCampaignCreate,
  MarketingOpsCampaignFilters,
  MarketingOpsCampaignPatch,
  MarketingOpsCampaignSummary,
  MarketingOpsCourseReference,
  MarketingOpsErrorEnvelope,
  MarketingOpsMaterial,
  MarketingOpsMaterialAccessLink,
  MarketingOpsMaterialMutation,
  MarketingOpsMaterialRemoval,
  MarketingOpsPage,
  MarketingOpsParticipant,
  MarketingOpsParticipantCandidate,
  MarketingOpsParticipantCandidateFilters,
  MarketingOpsParticipantCreate,
  MarketingOpsParticipantMutation,
  MarketingOpsParticipantPatch,
  MarketingOpsParticipantRemoval,
  MarketingOpsResult,
  MarketingOpsTimelineEvent,
  MarketingOpsTimelineFilters,
  MarketingOpsTransitionTarget
} from './types';

function conflictVersion(details: unknown): number | null {
  if (!details || typeof details !== 'object') return null;
  const value = (details as { currentVersion?: unknown }).currentVersion;
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

export class MarketingOpsApiError extends Error {
  public readonly currentVersion: number | null;

  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly correlationId: string | null,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'MarketingOpsApiError';
    this.currentVersion = conflictVersion(details);
  }
}

export interface MarketingOpsClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  tenantId?: string;
  fetch?: typeof globalThis.fetch;
}

function withQuery(path: string, values: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  return query.size ? `${path}?${query}` : path;
}

function mutationHeaders(idempotencyKey: string, version?: number): HeadersInit {
  return {
    'Idempotency-Key': idempotencyKey,
    ...(version === undefined ? {} : { 'If-Match': `"${version}"` })
  };
}

export function createMarketingOpsClient(options: MarketingOpsClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const request = async <T>(path: string, init: RequestInit = {}): Promise<MarketingOpsResult<T>> => {
    const token = await options.getAccessToken();
    if (!token) throw new MarketingOpsApiError('unauthorized', 401, 'Authentication is required', null);

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (options.tenantId) headers.set('X-Tenant-Id', options.tenantId);

    const response = await (options.fetch ?? globalThis.fetch)(`${baseUrl}${path}`, { ...init, headers });
    const payload = await response.json().catch(() => ({})) as {
      data?: T;
      page?: MarketingOpsPage;
    } & MarketingOpsErrorEnvelope;
    const correlationId = response.headers.get('X-Correlation-Id') ?? payload.error?.correlationId ?? null;
    if (!response.ok) {
      throw new MarketingOpsApiError(
        payload.error?.code ?? 'request_failed',
        response.status,
        payload.error?.message ?? 'Marketing Ops request failed',
        correlationId,
        payload.error?.details,
      );
    }

    return {
      data: payload.data as T,
      correlationId,
      etag: response.headers.get('ETag'),
      ...(payload.page ? { page: payload.page } : {})
    };
  };

  const campaignPath = (campaignId: string): string =>
    `/v1/campaigns/${encodeURIComponent(campaignId)}`;

  return {
    listCampaigns: (filters: MarketingOpsCampaignFilters = {}) =>
      request<MarketingOpsCampaignSummary[]>(withQuery('/v1/campaigns', filters)),

    getCampaign: (campaignId: string) =>
      request<MarketingOpsCampaign>(campaignPath(campaignId)),

    createCampaign: (input: MarketingOpsCampaignCreate, idempotencyKey: string) =>
      request<MarketingOpsCampaign>('/v1/campaigns', {
        method: 'POST',
        headers: mutationHeaders(idempotencyKey),
        body: JSON.stringify(input)
      }),

    updateCampaign: (
      campaignId: string,
      version: number,
      patch: MarketingOpsCampaignPatch,
      idempotencyKey: string
    ) => request<MarketingOpsCampaign>(campaignPath(campaignId), {
      method: 'PATCH',
      headers: mutationHeaders(idempotencyKey, version),
      body: JSON.stringify(patch)
    }),

    transitionCampaign: (
      campaignId: string,
      version: number,
      to: MarketingOpsTransitionTarget,
      idempotencyKey: string
    ) => request<MarketingOpsCampaign>(`${campaignPath(campaignId)}/transitions`, {
      method: 'POST',
      headers: mutationHeaders(idempotencyKey, version),
      body: JSON.stringify({ to })
    }),

    archiveCampaign: (campaignId: string, version: number, idempotencyKey: string) =>
      request<MarketingOpsCampaign>(`${campaignPath(campaignId)}/archive`, {
        method: 'POST',
        headers: mutationHeaders(idempotencyKey, version)
      }),

    listParticipants: (campaignId: string) =>
      request<MarketingOpsParticipant[]>(`${campaignPath(campaignId)}/participants`),

    listParticipantCandidates: (
      campaignId: string,
      filters: MarketingOpsParticipantCandidateFilters = {}
    ) => request<MarketingOpsParticipantCandidate[]>(
      withQuery(`${campaignPath(campaignId)}/participant-candidates`, filters)
    ),

    addParticipant: (
      campaignId: string,
      version: number,
      input: MarketingOpsParticipantCreate,
      idempotencyKey: string
    ) => request<MarketingOpsParticipantMutation>(`${campaignPath(campaignId)}/participants`, {
      method: 'POST',
      headers: mutationHeaders(idempotencyKey, version),
      body: JSON.stringify(input)
    }),

    updateParticipant: (
      campaignId: string,
      userId: string,
      version: number,
      patch: MarketingOpsParticipantPatch,
      idempotencyKey: string
    ) => request<MarketingOpsParticipantMutation>(
      `${campaignPath(campaignId)}/participants/${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: mutationHeaders(idempotencyKey, version),
        body: JSON.stringify(patch)
      }
    ),

    removeParticipant: (
      campaignId: string,
      userId: string,
      version: number,
      idempotencyKey: string
    ) => request<MarketingOpsParticipantRemoval>(
      `${campaignPath(campaignId)}/participants/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: mutationHeaders(idempotencyKey, version)
      }
    ),

    listMaterials: (campaignId: string) =>
      request<MarketingOpsMaterial[]>(`${campaignPath(campaignId)}/materials`),

    uploadMaterial: (
      campaignId: string,
      version: number,
      file: File,
      idempotencyKey: string
    ) => request<MarketingOpsMaterialMutation>(`${campaignPath(campaignId)}/materials/upload`, {
      method: 'POST',
      headers: {
        ...mutationHeaders(idempotencyKey, version),
        'Content-Type': file.type,
        'X-Nexus-Filename': file.name
      },
      body: file
    }),

    linkMaterial: (
      campaignId: string,
      version: number,
      artifactId: string,
      idempotencyKey: string
    ) => request<MarketingOpsMaterialMutation>(`${campaignPath(campaignId)}/materials/link`, {
      method: 'POST',
      headers: mutationHeaders(idempotencyKey, version),
      body: JSON.stringify({ artifactId })
    }),

    unlinkMaterial: (
      campaignId: string,
      materialId: string,
      version: number,
      idempotencyKey: string
    ) => request<MarketingOpsMaterialRemoval>(
      `${campaignPath(campaignId)}/materials/${encodeURIComponent(materialId)}`,
      {
        method: 'DELETE',
        headers: mutationHeaders(idempotencyKey, version)
      }
    ),

    createMaterialAccessLink: (campaignId: string, materialId: string) =>
      request<MarketingOpsMaterialAccessLink>(
        `${campaignPath(campaignId)}/materials/${encodeURIComponent(materialId)}/access-link`,
        { method: 'POST' }
      ),

    listTimeline: (campaignId: string, filters: MarketingOpsTimelineFilters = {}) =>
      request<MarketingOpsTimelineEvent[]>(
        withQuery(`${campaignPath(campaignId)}/timeline`, filters)
      ),

    searchCourseReferences: (query: string, limit = 10) =>
      request<MarketingOpsCourseReference[]>(
        withQuery('/v1/references/courses', { q: query, limit })
      )
  };
}

export type MarketingOpsClient = ReturnType<typeof createMarketingOpsClient>;
