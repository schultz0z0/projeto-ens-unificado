-- Safe hotfix to sync trigger function sync_ens_profile_membership
-- Allowing profiles with null tenant_id (e.g. created via admin panel) to sync to default 'ens' tenant.
create or replace function marketing_ops_private.sync_ens_profile_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.tenant_id::text = 'ens' or new.tenant_id is null) and new.role::text in ('member', 'manager', 'admin') then
    insert into marketing_ops.memberships (tenant_id, user_id, role, active)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      new.id,
      new.role::text::marketing_ops.membership_role,
      true
    )
    on conflict (tenant_id, user_id) do update
      set role = excluded.role, active = true;
  else
    update marketing_ops.memberships
    set active = false
    where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and user_id = new.id;
  end if;
  return new;
end;
$$;
