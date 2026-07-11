import type { MarketingOpsCampaign, MarketingOpsCampaignFilters, MarketingOpsErrorEnvelope, MarketingOpsPage, MarketingOpsResult } from './types';

export class MarketingOpsApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly correlationId: string | null,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'MarketingOpsApiError';
  }
}

interface ClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  tenantId?: string;
  fetch?: typeof globalThis.fetch;
}

export function createMarketingOpsClient(options: ClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const request = async <T>(path: string, init: RequestInit = {}): Promise<MarketingOpsResult<T>> => {
    const token = await options.getAccessToken();
    if (!token) throw new MarketingOpsApiError('unauthorized', 401, 'Authentication is required', null);
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/json');
    if (init.body) headers.set('Content-Type', 'application/json');
    if (options.tenantId) headers.set('X-Tenant-Id', options.tenantId);
    const response = await (options.fetch ?? globalThis.fetch)(`${baseUrl}${path}`, { ...init, headers });
    const payload = await response.json().catch(() => ({})) as { data?: T; page?: MarketingOpsPage } & MarketingOpsErrorEnvelope;
    const correlationId = response.headers.get('X-Correlation-Id') ?? payload.error?.correlationId ?? null;
    if (!response.ok) {
      throw new MarketingOpsApiError(
        payload.error?.code ?? 'request_failed', response.status,
        payload.error?.message ?? 'Marketing Ops request failed', correlationId, payload.error?.details,
      );
    }
    return { data: payload.data as T, correlationId, ...(payload.page ? { page: payload.page } : {}) };
  };

  return {
    listCampaigns: (filters: MarketingOpsCampaignFilters = {}) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) query.set(key, String(value));
      }
      const suffix = query.size ? `?${query}` : '';
      return request<MarketingOpsCampaign[]>(`/v1/campaigns${suffix}`);
    },
    getCampaign: (id: string) => request<MarketingOpsCampaign>(`/v1/campaigns/${encodeURIComponent(id)}`),
    createCampaign: (name: string, idempotencyKey: string, courseSlug?: string) => request<MarketingOpsCampaign>('/v1/campaigns', {
      method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ name, ...(courseSlug ? { courseSlug } : {}) }),
    }),
    updateCampaign: (id: string, version: number, name: string, idempotencyKey: string) => request<MarketingOpsCampaign>(`/v1/campaigns/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Idempotency-Key': idempotencyKey, 'If-Match': `"${version}"` }, body: JSON.stringify({ name }),
    }),
  };
}
