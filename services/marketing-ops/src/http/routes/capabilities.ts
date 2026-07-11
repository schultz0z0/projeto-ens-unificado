import type { Router } from 'express';

export function registerCapabilities(router: Router, features: { read: boolean; write: boolean }) {
  router.get('/v1/capabilities', (_request, response) => response.json({
    service: 'marketing-ops', contractVersion: 1, features,
    resources: ['campaigns', 'campaign_items', 'audit_events'],
    transports: ['rest', 'mcp']
  }));
}
