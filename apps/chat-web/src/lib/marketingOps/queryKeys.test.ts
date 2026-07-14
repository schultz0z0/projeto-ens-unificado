import { describe, expect, it } from 'vitest';
import { marketingOpsKeys } from './queryKeys';

describe('Marketing Ops query keys', () => {
  it('keeps list and detail resources in separate invalidation scopes', () => {
    const filters = { q: 'gestao', status: 'planned' as const, limit: 25 };

    expect(marketingOpsKeys.all).toEqual(['marketing-ops']);
    expect(marketingOpsKeys.campaigns()).toEqual(['marketing-ops', 'campaigns']);
    expect(marketingOpsKeys.campaigns(filters)).toEqual(['marketing-ops', 'campaigns', filters]);
    expect(marketingOpsKeys.campaign('campaign-1')).toEqual(['marketing-ops', 'campaign', 'campaign-1']);
  });

  it('scopes nested resources by campaign and pagination input', () => {
    expect(marketingOpsKeys.participants('campaign-1')).toEqual([
      'marketing-ops', 'campaign', 'campaign-1', 'participants'
    ]);
    expect(marketingOpsKeys.participantCandidates('campaign-1', { q: 'Ana', limit: 10 })).toEqual([
      'marketing-ops', 'campaign', 'campaign-1', 'participant-candidates', { q: 'Ana', limit: 10 }
    ]);
    expect(marketingOpsKeys.materials('campaign-1')).toEqual([
      'marketing-ops', 'campaign', 'campaign-1', 'materials'
    ]);
    expect(marketingOpsKeys.timeline('campaign-1', { limit: 25, cursor: 'next' })).toEqual([
      'marketing-ops', 'campaign', 'campaign-1', 'timeline', { limit: 25, cursor: 'next' }
    ]);
    expect(marketingOpsKeys.courseReferences('gestao', 10)).toEqual([
      'marketing-ops', 'references', 'courses', 'gestao', 10
    ]);
  });
});
