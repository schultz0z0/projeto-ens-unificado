-- RPC: Delete User By Admin
-- Allows an admin to delete a user from auth.users.
-- Because of ON DELETE CASCADE on public.profiles, the profile is also deleted.
create or replace function public.delete_user_by_admin(target_user_id uuid)
returns void as $$
begin
  -- Check if executing user is admin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Acesso negado. Apenas administradores podem deletar usuários.';
  end if;

  -- Prevent self-deletion (optional but recommended safety)
  if target_user_id = auth.uid() then
    raise exception 'Você não pode deletar sua própria conta.';
  end if;

  -- Delete from auth.users (Cascade will handle public.profiles)
  delete from auth.users where id = target_user_id;
end;
$$ language plpgsql security definer;
