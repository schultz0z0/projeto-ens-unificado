export interface MarketingOpsCampaign {
  id: string;
  tenantId: string;
  name: string;
  courseSlug: string | null;
  status: 'draft' | 'archived';
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface MarketingOpsResult<T> {
  data: T;
  correlationId: string | null;
  page?: MarketingOpsPage;
}

export interface MarketingOpsPage {
  limit: number;
  count: number;
  nextCursor: string | null;
}

export interface MarketingOpsCampaignFilters {
  course?: string;
  status?: 'draft' | 'archived';
  owner?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export interface MarketingOpsErrorEnvelope {
  error?: { code?: string; message?: string; correlationId?: string; details?: unknown };
}
