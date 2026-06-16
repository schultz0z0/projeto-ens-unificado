# Plano de Refatoração Completa Supabase (Design Nexus AI 2.0)

Este documento detalha a reestruturação completa do backend, autenticação e banco de dados para garantir segurança, estabilidade e funcionamento das integrações (N8N).

## 1. Arquitetura de Dados (Schema)

O banco será recriado com foco em integridade referencial e permissões explícitas.

### Tabelas Principais
1.  **`public.profiles`**
    *   Vinculada 1:1 com `auth.users` via FK.
    *   Colunas: `id` (UUID, PK), `full_name` (Text), `email` (Text), `role` (Text: 'admin' | 'user'), `created_at`, `updated_at`.
    *   Segurança: RLS ativado.

2.  **`public.generated_images`** (Para integração N8N de Imagens)
    *   Colunas: `id` (UUID), `user_id` (UUID, FK), `image_url` (Text), `prompt` (Text), `created_at`.
    *   Segurança: RLS ativado.

3.  **`public.chat_messages`** (Para integração N8N de Chatbot - Opcional/Futuro)
    *   Estrutura básica para suportar histórico se necessário.

## 2. Segurança e Permissões (RLS & Grants)

Para evitar o erro "Database error querying schema", aplicaremos uma política de "Zero Trust" inicial, liberando apenas o necessário.

### Roles
*   **Admin**: Acesso total a gestão de usuários e visualização de todos os dados.
*   **User**: Acesso apenas aos seus próprios dados (`profiles`, `generated_images`).

### Estratégia Anti-Recursão
Utilizaremos uma função `SECURITY DEFINER` chamada `is_admin()` para verificar permissões nas políticas RLS, evitando loops infinitos.

### Permissões de Schema
Garantiremos `GRANT USAGE` explícito no schema `public` e `auth` para os roles `authenticated`, `anon` e `service_role`.

## 3. Gestão de Usuários (Edge Functions)

A criação e exclusão de usuários pelo Admin **NÃO** será feita via SQL direto. Usaremos **Supabase Edge Functions** com a `service_role_key` (Admin API).

*   **`admin-create-user`**:
    1.  Recebe email, senha, nome e role.
    2.  Cria no Auth (`auth.users`, `auth.identities`).
    3.  Cria no `public.profiles`.
    4.  Retorna sucesso.
*   **`admin-delete-user`**:
    1.  Recebe `user_id`.
    2.  Deleta do Auth (Cascade remove profile).

## 4. Integrações (N8N)

*   As tabelas `generated_images` estarão prontas.
*   O N8N deve conectar usando a string de conexão Postgres (User: `postgres`) OU via API usando a `service_role_key` para contornar RLS se necessário, ou um usuário comum para respeitar RLS.

## 5. Passo a Passo da Migração

1.  **Reset do Banco**: (Feito manualmente ao trocar o projeto, assumindo banco vazio).
2.  **Executar Migração Mestre**: Cria tabelas, funções e permissões.
3.  **Deploy Edge Functions**: Publicar as funções de admin.
4.  **Bootstrap Admin**: Script SQL para promover o primeiro usuário (você) a admin.
5.  **Frontend Update**: Atualizar chamadas para usar as novas funções.

