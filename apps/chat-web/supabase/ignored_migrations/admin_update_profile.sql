-- Add avatar_url column to profiles (idempotente)
alter table public.profiles add column if not exists avatar_url text;

-- RPC: Admin Update Profile
create or replace function public.admin_update_profile(
  target_user_id uuid,
  new_full_name text,
  new_avatar_url text
)
returns void as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: Apenas administradores podem atualizar perfis.';
  end if;

  update public.profiles
    set full_name = coalesce(new_full_name, full_name),
        avatar_url = coalesce(new_avatar_url, avatar_url),
        updated_at = now()
  where id = target_user_id;
end;
$$ language plpgsql security definer;

grant execute on function public.admin_update_profile to authenticated;
