drop policy in_app_notifications_insert
  on marketing_ops.in_app_notifications;

create policy in_app_notifications_insert
on marketing_ops.in_app_notifications
for insert to authenticated
with check (
  tenant_id = (select marketing_ops_private.current_tenant_id())
  and user_id = (select auth.uid())
  and (select marketing_ops_private.can_access_campaign_item(item_id))
);
