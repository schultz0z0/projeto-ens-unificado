-- Phase 5 follow-up: covering indexes for tenant-scoped foreign keys.
-- These indexes support integrity checks, approval detail joins, and cleanup paths.

create index action_packages_campaign_fk_idx
  on marketing_ops.action_packages (tenant_id, campaign_id);

create index action_packages_created_by_fk_idx
  on marketing_ops.action_packages (tenant_id, created_by);

create index action_packages_authorized_request_fk_idx
  on marketing_ops.action_packages (tenant_id, authorized_by_request_id)
  where authorized_by_request_id is not null;

create index approval_requests_requested_by_fk_idx
  on marketing_ops.approval_requests (tenant_id, requested_by);

create index approval_requests_content_version_fk_idx
  on marketing_ops.approval_requests (tenant_id, content_asset_id, content_version_number)
  where content_asset_id is not null;

create index approval_requests_action_package_fk_idx
  on marketing_ops.approval_requests (tenant_id, action_package_id)
  where action_package_id is not null;

create index approval_requests_supersedes_fk_idx
  on marketing_ops.approval_requests (tenant_id, supersedes_request_id)
  where supersedes_request_id is not null;

create index approval_decisions_request_fk_idx
  on marketing_ops.approval_decisions (tenant_id, request_id);

create index approval_decisions_decided_by_fk_idx
  on marketing_ops.approval_decisions (tenant_id, decided_by);
