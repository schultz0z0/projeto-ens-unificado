create index campaigns_tenant_updated_idx
  on marketing_ops.campaigns (tenant_id, updated_at desc, id desc);
