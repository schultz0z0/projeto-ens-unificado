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

  it('throws a typed API error without trusting client tenant authority', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'tenant_forbidden', message: 'Denied', correlationId: 'corr-x' } }), { status: 403 }));
    const client = createMarketingOpsClient({ baseUrl: 'https://ops.local', getAccessToken: async () => 'token', fetch, tenantId: 'ens' });
    await expect(client.listCampaigns()).rejects.toBeInstanceOf(MarketingOpsApiError);
    expect((fetch.mock.calls[0]?.[1]?.headers as Headers).get('X-Tenant-Id')).toBe('ens');
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
