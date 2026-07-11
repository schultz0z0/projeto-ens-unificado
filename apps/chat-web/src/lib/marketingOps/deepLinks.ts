const campaignPath = /^\/marketing-ops\/campaigns\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;

export function campaignDeepLink(id: string): string {
  if (!campaignPath.test(`/marketing-ops/campaigns/${id}`)) throw new Error('invalid campaign id');
  return `/marketing-ops/campaigns/${id}`;
}

export function parseMarketingOpsDeepLink(url: string): { resource: 'campaign'; id: string } | null {
  const path = url.startsWith('http') ? new URL(url).pathname : url.split(/[?#]/, 1)[0] ?? '';
  const match = path.match(campaignPath);
  return match?.[1] ? { resource: 'campaign', id: match[1].toLowerCase() } : null;
}
