insert into marketing_ops.tenants (id, slug, name)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ens', 'ENS')
on conflict (slug) do update set name = excluded.name, active = true;

create function marketing_ops_private.sync_ens_profile_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tenant_id::text = 'ens' and new.role::text in ('member', 'manager', 'admin') then
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

revoke all on function marketing_ops_private.sync_ens_profile_membership() from public, anon;

create trigger profiles_sync_ens_marketing_membership
after insert or update of tenant_id, role on public.profiles
for each row execute function marketing_ops_private.sync_ens_profile_membership();

insert into marketing_ops.memberships (tenant_id, user_id, role, active)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  profile.id,
  profile.role::text::marketing_ops.membership_role,
  true
from public.profiles as profile
join auth.users as auth_user on auth_user.id = profile.id
where profile.tenant_id::text = 'ens'
  and profile.role::text in ('member', 'manager', 'admin')
on conflict (tenant_id, user_id) do update
  set role = excluded.role, active = true;
