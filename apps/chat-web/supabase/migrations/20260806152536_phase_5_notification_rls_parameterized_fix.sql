-- Row-dependent authorization functions must be evaluated with the values from
-- each candidate notification. Wrapping them in scalar SELECTs turns them into
-- initPlans under prepared statements and can evaluate them without the row.
drop policy in_app_notifications_insert on marketing_ops.in_app_notifications;

create policy in_app_notifications_insert
on marketing_ops.in_app_notifications
for insert
to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and (
    (
      item_id is not null
      and marketing_ops_private.can_edit_campaign_item(item_id)
    )
    or (
      approval_request_id is not null
      and marketing_ops_private.can_access_approval_request(approval_request_id)
    )
  )
);

insert into marketing_ops.schema_versions (version, description)
values ('5.0.5', 'Evaluate notification RLS authorization against each inserted row')
on conflict (version) do nothing;
