alter table marketing_ops.campaigns
  add column course_slug text,
  add constraint campaigns_course_slug_format
    check (course_slug is null or course_slug ~ '^[a-z0-9][a-z0-9-]{1,127}$');

create index campaigns_tenant_course_updated_idx
  on marketing_ops.campaigns (tenant_id, course_slug, updated_at desc, id);
