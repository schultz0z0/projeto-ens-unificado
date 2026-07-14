export type MarketingOpsCampaignStatus = 'draft' | 'planned' | 'active' | 'completed' | 'archived';
export type MarketingOpsTransitionTarget = Exclude<MarketingOpsCampaignStatus, 'archived'>;
export type MarketingOpsReferenceType = 'course' | 'product' | 'initiative';
export type MarketingOpsCampaignChannel =
  | 'email'
  | 'instagram'
  | 'linkedin'
  | 'facebook'
  | 'whatsapp'
  | 'website'
  | 'paid_media'
  | 'events'
  | 'press'
  | 'other';

export interface MarketingOpsCampaignEditableFields {
  name: string;
  objective: string | null;
  referenceType: MarketingOpsReferenceType | null;
  referenceKey: string | null;
  referenceTitleSnapshot: string | null;
  referenceDocumentId: string | null;
  audience: string | null;
  startsOn: string | null;
  endsOn: string | null;
  primaryChannel: MarketingOpsCampaignChannel | null;
  secondaryChannels: MarketingOpsCampaignChannel[];
  briefing: string | null;
  notes: string | null;
}

export interface MarketingOpsCampaign extends MarketingOpsCampaignEditableFields {
  id: string;
  tenantId: string;
  courseSlug: string | null;
  referenceVerifiedAt: string | null;
  status: MarketingOpsCampaignStatus;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export type MarketingOpsCampaignCreate = Pick<MarketingOpsCampaignEditableFields, 'name'> &
  Partial<Omit<MarketingOpsCampaignEditableFields, 'name'>> & {
    courseSlug?: string;
  };

export type MarketingOpsCampaignPatch = Partial<MarketingOpsCampaignEditableFields>;

export interface MarketingOpsResult<T> {
  data: T;
  correlationId: string | null;
  etag: string | null;
  page?: MarketingOpsPage;
}

export interface MarketingOpsPage {
  limit: number;
  count: number;
  nextCursor: string | null;
}

export interface MarketingOpsCampaignFilters {
  q?: string;
  status?: MarketingOpsCampaignStatus;
  referenceType?: MarketingOpsReferenceType;
  referenceKey?: string;
  channel?: MarketingOpsCampaignChannel;
  responsible?: string;
  periodFrom?: string;
  periodTo?: string;
  cursor?: string;
  limit?: number;
  course?: string;
  owner?: string;
  from?: string;
  to?: string;
}

export type MarketingOpsParticipantRole = 'owner' | 'editor' | 'viewer';
export type MarketingOpsTenantRole = 'member' | 'manager' | 'admin';

export interface MarketingOpsParticipant {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  memberRole: MarketingOpsParticipantRole;
  isPrimary: boolean;
}

export interface MarketingOpsParticipantCandidate {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  tenantRole: MarketingOpsTenantRole;
}

export interface MarketingOpsParticipantCreate {
  userId: string;
  memberRole: MarketingOpsParticipantRole;
  isPrimary?: boolean;
}

export interface MarketingOpsParticipantPatch {
  memberRole?: MarketingOpsParticipantRole;
  isPrimary?: boolean;
}

export interface MarketingOpsParticipantMutation {
  participant: MarketingOpsParticipant;
  campaignVersion: number;
}

export interface MarketingOpsParticipantRemoval {
  removedUserId: string;
  campaignVersion: number;
}

export interface MarketingOpsParticipantCandidateFilters {
  q?: string;
  limit?: number;
}

export interface MarketingOpsMaterial {
  id: string;
  campaignId: string;
  artifactId: string;
  artifactOwnerId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  source: 'upload' | 'existing_artifact';
  createdBy: string;
  createdAt: string;
}

export interface MarketingOpsMaterialMutation {
  material: MarketingOpsMaterial;
  campaignVersion: number;
}

export interface MarketingOpsMaterialRemoval {
  materialId: string;
  campaignVersion: number;
}

export interface MarketingOpsMaterialAccessLink {
  url: string;
  expiresAt: string;
}

export interface MarketingOpsTimelineChange {
  field: string;
  kind: 'added' | 'removed' | 'changed';
}

export interface MarketingOpsTimelineEvent {
  id: string;
  action: string;
  occurredAt: string;
  actor: { displayName: string };
  origin: 'rest' | 'mcp' | 'internal';
  changes: MarketingOpsTimelineChange[];
  correlationId: string;
}

export interface MarketingOpsTimelineFilters {
  limit?: number;
  cursor?: string;
}

export interface MarketingOpsCourseReference {
  referenceKey: string;
  title: string;
  documentId: string;
  collection: 'courses';
  category: string | null;
  courseType: string | null;
  offerMetadata: {
    modalities: string[];
    locations: string[];
    statuses: string[];
  };
  verifiedAt: string;
}

export interface MarketingOpsErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    correlationId?: string;
    details?: unknown;
  };
}
