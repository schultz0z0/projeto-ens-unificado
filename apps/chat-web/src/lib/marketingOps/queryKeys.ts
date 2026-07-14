import type {
  MarketingOpsCampaignFilters,
  MarketingOpsParticipantCandidateFilters,
  MarketingOpsTimelineFilters
} from './types';

export const marketingOpsKeys = {
  all: ['marketing-ops'] as const,
  campaigns: (filters?: MarketingOpsCampaignFilters) => filters === undefined
    ? ['marketing-ops', 'campaigns'] as const
    : ['marketing-ops', 'campaigns', { ...filters }] as const,
  campaign: (campaignId: string) => ['marketing-ops', 'campaign', campaignId] as const,
  participants: (campaignId: string) =>
    ['marketing-ops', 'campaign', campaignId, 'participants'] as const,
  participantCandidates: (
    campaignId: string,
    filters: MarketingOpsParticipantCandidateFilters = {}
  ) => ['marketing-ops', 'campaign', campaignId, 'participant-candidates', { ...filters }] as const,
  materials: (campaignId: string) =>
    ['marketing-ops', 'campaign', campaignId, 'materials'] as const,
  timeline: (campaignId: string, filters: MarketingOpsTimelineFilters = {}) =>
    ['marketing-ops', 'campaign', campaignId, 'timeline', { ...filters }] as const,
  courseReferences: (query: string, limit = 10) =>
    ['marketing-ops', 'references', 'courses', query, limit] as const
};
