import { describe, expect, it, vi } from 'vitest';
import { createMarketingOpsClient, MarketingOpsApiError } from './client';
import { campaignDeepLink, parseMarketingOpsDeepLink } from './deepLinks';
import { marketingOpsFlags } from './flags';

describe('Marketing Ops frontend contracts', () => {
  it('gets a fresh access token and propagates correlation ids per call', async () => {
    const getAccessToken = vi.fn().mockResolvedValueOnce('token-1').mockResolvedValueOnce('token-2');
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'X-Correlation-Id': 'corr-1' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'X-Correlation-Id': 'corr-2' } }));
    const client = createMarketingOpsClient({ baseUrl: 'https://ops.local', getAccessToken, fetch });
    expect((await client.listCampaigns()).correlationId).toBe('corr-1');
    expect((await client.listCampaigns()).correlationId).toBe('corr-2');
    expect(getAccessToken).toHaveBeenCalledTimes(2);
    expect((fetch.mock.calls[1]?.[1]?.headers as Headers).get('Authorization')).toBe('Bearer token-2');
  });

  it('serializes campaign filters and preserves cursor pagination', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [], page: { limit: 10, count: 0, nextCursor: 'next-page' }
    }), { status: 200 }));
    const client = createMarketingOpsClient({ baseUrl: 'https://ops.local', getAccessToken: async () => 'token', fetch });
    const result = await client.listCampaigns({
      course: 'course-one', status: 'draft', owner: '11111111-1111-4111-8111-111111111111',
      from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T23:59:59.999Z', limit: 10, cursor: 'cursor-one'
    });
    expect(fetch.mock.calls[0]?.[0]).toBe('https://ops.local/v1/campaigns?course=course-one&status=draft&owner=11111111-1111-4111-8111-111111111111&from=2026-01-01T00%3A00%3A00.000Z&to=2026-12-31T23%3A59%3A59.999Z&limit=10&cursor=cursor-one');
    expect(result.page).toEqual({ limit: 10, count: 0, nextCursor: 'next-page' });
  });

  it('throws a typed API error without trusting client tenant authority', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'tenant_forbidden', message: 'Denied', correlationId: 'corr-x' } }), { status: 403 }));
    const client = createMarketingOpsClient({ baseUrl: 'https://ops.local', getAccessToken: async () => 'token', fetch, tenantId: 'ens' });
    await expect(client.listCampaigns()).rejects.toBeInstanceOf(MarketingOpsApiError);
    expect((fetch.mock.calls[0]?.[1]?.headers as Headers).get('X-Tenant-Id')).toBe('ens');
  });

  it('keeps local values and exposes currentVersion on a version conflict', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: 'version_conflict',
        message: 'stale',
        correlationId: 'corr-conflict',
        details: { currentVersion: 7 }
      }
    }), { status: 409 }));
    const client = createMarketingOpsClient({
      baseUrl: 'https://ops.local',
      getAccessToken: async () => 'token',
      fetch
    });

    await expect(client.updateCampaign(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      6,
      { objective: 'Objetivo local' },
      'idem-update'
    )).rejects.toMatchObject({
      code: 'version_conflict',
      status: 409,
      correlationId: 'corr-conflict',
      currentVersion: 7
    });
  });

  it('sends mutation guards and uploads a File as the raw request body', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'campaign', version: 4 } }), {
        status: 200,
        headers: { ETag: '"4"', 'X-Correlation-Id': 'corr-update' }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { material: {}, campaignVersion: 5 } }), {
        status: 201,
        headers: { ETag: '"5"', 'X-Correlation-Id': 'corr-upload' }
      }));
    const client = createMarketingOpsClient({
      baseUrl: 'https://ops.local/',
      getAccessToken: async () => 'token',
      fetch
    });

    const update = await client.transitionCampaign(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      3,
      'planned',
      'idem-transition'
    );
    const file = new File(['campaign'], 'briefing.pdf', { type: 'application/pdf' });
    const upload = await client.uploadMaterial(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      4,
      file,
      'idem-upload'
    );

    const transitionInit = fetch.mock.calls[0]?.[1] as RequestInit;
    const transitionHeaders = transitionInit.headers as Headers;
    expect(fetch.mock.calls[0]?.[0]).toBe('https://ops.local/v1/campaigns/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/transitions');
    expect(transitionInit.method).toBe('POST');
    expect(transitionHeaders.get('If-Match')).toBe('"3"');
    expect(transitionHeaders.get('Idempotency-Key')).toBe('idem-transition');
    expect(transitionHeaders.get('Content-Type')).toBe('application/json');
    expect(update).toMatchObject({ correlationId: 'corr-update', etag: '"4"' });

    const uploadInit = fetch.mock.calls[1]?.[1] as RequestInit;
    const uploadHeaders = uploadInit.headers as Headers;
    expect(fetch.mock.calls[1]?.[0]).toBe('https://ops.local/v1/campaigns/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/materials/upload');
    expect(uploadInit.body).toBe(file);
    expect(uploadHeaders.get('Content-Type')).toBe('application/pdf');
    expect(uploadHeaders.get('X-Nexus-Filename')).toBe('briefing.pdf');
    expect(uploadHeaders.get('If-Match')).toBe('"4"');
    expect(uploadHeaders.get('Idempotency-Key')).toBe('idem-upload');
    expect(upload).toMatchObject({ correlationId: 'corr-upload', etag: '"5"' });
  });

  it('covers participants, materials, timeline and official course references', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const client = createMarketingOpsClient({
      baseUrl: 'https://ops.local',
      getAccessToken: async () => 'token',
      fetch
    });
    const campaignId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    await client.listParticipants(campaignId);
    await client.listParticipantCandidates(campaignId, { q: 'Ana', limit: 5 });
    await client.listMaterials(campaignId);
    await client.listTimeline(campaignId, { limit: 20, cursor: 'next' });
    await client.searchCourseReferences('gestao', 8);

    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `https://ops.local/v1/campaigns/${campaignId}/participants`,
      `https://ops.local/v1/campaigns/${campaignId}/participant-candidates?q=Ana&limit=5`,
      `https://ops.local/v1/campaigns/${campaignId}/materials`,
      `https://ops.local/v1/campaigns/${campaignId}/timeline?limit=20&cursor=next`,
      'https://ops.local/v1/references/courses?q=gestao&limit=8'
    ]);
  });

  it('maps every campaign aggregate mutation to its guarded REST endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    const client = createMarketingOpsClient({
      baseUrl: 'https://ops.local',
      getAccessToken: async () => 'token',
      fetch
    });
    const campaignId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const materialId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const artifactId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    await client.createCampaign({ name: 'Campanha' }, 'idem-create');
    await client.updateCampaign(campaignId, 1, { objective: 'Objetivo' }, 'idem-update');
    await client.archiveCampaign(campaignId, 2, 'idem-archive');
    await client.addParticipant(campaignId, 3, { userId, memberRole: 'editor' }, 'idem-add');
    await client.updateParticipant(campaignId, userId, 4, { memberRole: 'owner' }, 'idem-participant');
    await client.removeParticipant(campaignId, userId, 5, 'idem-remove');
    await client.linkMaterial(campaignId, 6, artifactId, 'idem-link');
    await client.unlinkMaterial(campaignId, materialId, 7, 'idem-unlink');
    await client.createMaterialAccessLink(campaignId, materialId);

    expect(fetch.mock.calls.map(([url, init]) => [url, (init as RequestInit).method])).toEqual([
      ['https://ops.local/v1/campaigns', 'POST'],
      [`https://ops.local/v1/campaigns/${campaignId}`, 'PATCH'],
      [`https://ops.local/v1/campaigns/${campaignId}/archive`, 'POST'],
      [`https://ops.local/v1/campaigns/${campaignId}/participants`, 'POST'],
      [`https://ops.local/v1/campaigns/${campaignId}/participants/${userId}`, 'PATCH'],
      [`https://ops.local/v1/campaigns/${campaignId}/participants/${userId}`, 'DELETE'],
      [`https://ops.local/v1/campaigns/${campaignId}/materials/link`, 'POST'],
      [`https://ops.local/v1/campaigns/${campaignId}/materials/${materialId}`, 'DELETE'],
      [`https://ops.local/v1/campaigns/${campaignId}/materials/${materialId}/access-link`, 'POST']
    ]);

    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual({ name: 'Campanha' });
    expect(JSON.parse(fetch.mock.calls[6]?.[1]?.body as string)).toEqual({ artifactId });
    for (const index of [1, 2, 3, 4, 5, 6, 7]) {
      const headers = fetch.mock.calls[index]?.[1]?.headers as Headers;
      expect(headers.get('If-Match')).toBe(`"${index}"`);
      expect(headers.get('Idempotency-Key')).toBeTruthy();
    }
    const accessHeaders = fetch.mock.calls[8]?.[1]?.headers as Headers;
    expect(accessHeaders.has('If-Match')).toBe(false);
    expect(accessHeaders.has('Idempotency-Key')).toBe(false);
  });

  it('keeps read and write off by default and honors the kill switch', () => {
    expect(marketingOpsFlags({})).toEqual({ enabled: false, read: false, write: false });
    expect(marketingOpsFlags({ VITE_MARKETING_OPS_ENABLED: 'true', VITE_MARKETING_OPS_READ: 'true', VITE_MARKETING_OPS_WRITE: 'true', VITE_MARKETING_OPS_KILL_SWITCH: 'true' }))
      .toEqual({ enabled: false, read: false, write: false });
  });

  it('round-trips campaign IDs without embedding state', () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const link = campaignDeepLink(id);
    expect(link).toBe(`/marketing-ops/campaigns/${id}`);
    expect(parseMarketingOpsDeepLink(link)).toEqual({ resource: 'campaign', id });
    expect(parseMarketingOpsDeepLink('/marketing-ops/campaigns/not-a-uuid')).toBeNull();
  });
});
