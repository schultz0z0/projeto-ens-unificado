export interface MarketingOpsCampaign {
  id: string;
  tenantId: string;
  name: string;
  status: 'draft' | 'archived';
  version: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface MarketingOpsResult<T> {
  data: T;
  correlationId: string | null;
}

export interface MarketingOpsErrorEnvelope {
  error?: { code?: string; message?: string; correlationId?: string; details?: unknown };
}
