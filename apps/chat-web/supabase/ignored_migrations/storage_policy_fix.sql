-- Criar o bucket 'avatars' se não existir (necessário para as policies funcionarem)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Remover políticas antigas caso existam para evitar conflitos
drop policy if exists "Public read avatars" on storage.objects;
drop policy if exists "Authenticated upload avatars" on storage.objects;
drop policy if exists "Authenticated update avatars" on storage.objects;
drop policy if exists "Authenticated delete avatars" on storage.objects;

-- Criar políticas de acesso (RLS)
-- 1. Leitura pública (qualquer um pode ver os avatares)
create policy "Public read avatars" on storage.objects
  for select to public using (bucket_id = 'avatars');

-- 2. Upload autenticado (qualquer usuário logado pode subir arquivos)
create policy "Authenticated upload avatars" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');

-- 3. Atualização autenticada (usuário pode atualizar seus arquivos - simplificado para 'authenticated' para o bucket avatars)
create policy "Authenticated update avatars" on storage.objects
  for update to authenticated using (bucket_id = 'avatars');

-- 4. Deleção autenticada
create policy "Authenticated delete avatars" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars');
