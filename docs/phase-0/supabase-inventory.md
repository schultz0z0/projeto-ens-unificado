# Inventário Supabase

## Status e limite da evidência

- **Estado:** `completed_repository_inventory`
- **Escopo:** migrations, funções, Storage, RLS e consumidores versionados no repositório
- **Estado remoto:** `partial_read_only_verified`; Data API confirmou objetos/contagens, sem DDL ou mutação
- **Configuração local:** o `.env` da raiz é a fonte das variáveis do app e não teve valores impressos ou copiados
- **Regra:** uma declaração SQL no Git não comprova que o objeto existe hoje no Supabase de desenvolvimento ou produção

O Compose raiz traduz `NEXUS_APP_SUPABASE_URL` e `NEXUS_APP_SUPABASE_ANON_KEY` para os `build.args` `VITE_SUPABASE_*` do frontend. Para testes Node executados diretamente em `apps/chat-web`, as variáveis da raiz precisam ser carregadas e mapeadas para `VITE_SUPABASE_*`/`SUPABASE_*`; o script Bash `scripts/dev/chat-web.sh` já faz essa tradução, mas Bash não está disponível neste ambiente Windows.

## Fontes catalogadas

| Fonte | Quantidade | Papel | Autoridade neste inventário |
|---|---:|---|---|
| `apps/chat-web/supabase/migrations` | 24 arquivos | cadeia oficial do app | Alta para histórico declarado; insuficiente para provar runtime |
| `apps/chat-web/supabase/ignored_migrations` | 25 arquivos | bootstrap e correções históricas fora da cadeia oficial | Referência apenas; não aplicar automaticamente |
| `apps/chat-web/supabase/manual` | 1 arquivo | correção manual de privacidade/RLS | Referência; requer reconciliação explícita |
| `apps/chat-web/supabase/functions` | 4 funções Edge e testes | administração e proxy Hermes legado | Código implantável; deploy remoto não confirmado |
| `services/rag-mcp/supabase/schema.sql` | 1 schema-base | banco dedicado de RAG | Contrato declarativo do serviço |
| `services/rag-mcp/supabase/migrations` | 4 arquivos | evolução do RAG | Cadeia oficial do serviço RAG |

Os quatro arquivos `remote_sync_*` da cadeia oficial do app são placeholders e não contêm o schema-base que seus nomes sugerem.

## Inventário por domínio

| Domínio | Objetos declarados ou consumidos | Origem/evidência | Segurança declarada | Classificação | Fase-alvo |
|---|---|---|---|---|---|
| Identidade | `auth.users`, `profiles`; `handle_new_user`, `current_app_profile_role`, `admin_update_profile` | `AuthContext`, `UserManagement`, migrations de julho/2026 | Papel em `profiles`; funções privilegiadas; testes RLS passaram | `keep` + `adapt` | Fase 1 |
| Histórico de chat | `chat_sessions`, `chat_messages`, trigger de contagem | `chatService`, migration `20260117_*` | RLS existe apenas no histórico ignorado; runtime passou no gate RLS | `keep` | Transversal |
| Configuração Hermes por usuário | `user_chat_integrations`, `admin_upsert_user_chat_integration` | migration `20260118000000_*`, `UserManagement` | RLS; leitura do próprio registro; mutação administrativa por RPC | `adapt` | Fase 1 |
| Estado Hermes por sessão | `chat_session_hermes_state` | migration `20260529090000_*`, Chat Bridge | RLS por `user_id`, cascade com `chat_sessions`, trigger de `updated_at` | `keep` | Transversal |
| Anexos de chat | bucket configurável, padrão `chat-attachments` | migrations `20260528154000_*` e `20260612120000_*`, `chatAttachments` | bucket privado e policies por usuário/caminho | `keep` | Transversal |
| Imagens geradas | bucket `image-gen-outputs` | migration `20260618123000_*`, frontend e Bridge | bucket privado; policy de ownership deve continuar testada | `keep` + `adapt` | Fases 2–4 |
| Avatares | bucket `avatars` | `Sidebar`, `UserManagement` | configuração de bucket não está na cadeia oficial observada | `unknown_runtime` | Fase 1 |
| Memória validada | `validated_works`; `touch_validated_works_updated_at` | migration `20260702143000_*`, frontend e Graph MCP | RLS; leitura autenticada condicionada; gestão manager/admin | `adapt` | Fases 4 e 7 |
| Catálogo ENS | `course_modalities`, `course_partners`, `course_offers`, `offer_discounts`, `offer_modules`, `offer_partners`; buckets de logos | migration `20260109093000_*` | RLS e policies declaradas | `keep` | Transversal |
| RAG antigo no banco do app | `rag_marketing`, `rag_ens`, `rag_email_html`; funções `match_rag_*` | migration `20260114_*` | RLS/policies declaradas; nenhum consumidor ativo do frontend identificado | `migrate`/`archive` | Fase 1 |
| RAG dedicado | `tenants`, `documents`, `document_chunks`, `rag_queries`, `rag_audit_events`; `match_document_chunks*` | `services/rag-mcp/supabase` | acesso server-side e isolamento lógico por tenant no serviço | `keep` | Transversal |
| Meta/campanhas antigas | `campaigns`, `ad_sets`, `ads`, `daily_metrics`, `campaign_events`, view `campaign_stats` | migration `20251230120000_*` | RLS apenas em `campaigns` na migration original | `archive` histórico | Fase 0 |
| Market Intelligence | `market_competitors`, `market_competitor_ads`, `market_trends`, `market_intelligence_feed` | migration `20260116_*`; frontend consumidor foi removido | RLS por usuário; consumidores externos não confirmados | `unknown_runtime`/`remove_candidate` | Fase 7 |
| Marketing Ops futuro | campanhas, itens, versões, aprovações, autorizações, execuções, eventos e auditoria ainda inexistentes | Roadmap/PRDs | RBAC, RLS, idempotência e auditoria obrigatórios | `create` | Fase 1 |

## Evidência remota somente leitura

Em 2026-07-10, a Data API do Supabase do app confirmou:

- `profiles` 7, `chat_sessions` 8, `chat_messages` 81;
- `chat_session_hermes_state` 4, `user_chat_integrations` 1 e `validated_works` 7;
- `rag_marketing` 37, `rag_ens` 403 e `rag_email_html` 0;
- `ad_sets`, `ads`, `daily_metrics` e todas as tabelas `market_*` com 0 registros;
- buckets `avatars`, `partners-logos`, `offers-logos`, `chat-attachments` e `image-gen-outputs`.

O Supabase separado do RAG MCP foi consultado apenas para contagens: 135 documentos, 964 chunks e coleções `courses`, `insights`, `institutional` e `marketing`. Nenhum registro desse projeto foi alterado.

O plano aprovado preserva `rag_marketing` antigo em quarentena para eventual revisão, permite remover `rag_ens` antigo após backup e não escreve automaticamente no RAG MCP. Detalhes: [supabase-cleanup-plan.md](supabase-cleanup-plan.md).

## Cadeia de migrations e reprodutibilidade

### Lacuna de bootstrap do app

As tabelas-base `profiles`, `chat_sessions` e `chat_messages` são consumidas pelo runtime, mas sua criação aparece apenas em `ignored_migrations/00_master_setup.sql` e `ignored_migrations/20240523000000_create_chat_history.sql`. As migrations oficiais posteriores alteram ou referenciam esses objetos, porém não os criam.

Consequência: aplicar somente `apps/chat-web/supabase/migrations` sobre um projeto vazio pode falhar ou produzir um schema incompleto. Antes da Fase 1 será necessário:

1. extrair o schema real do ambiente de desenvolvimento;
2. comparar com a cadeia versionada;
3. gerar um baseline limpo e idempotente;
4. testar bootstrap do zero em um projeto descartável;
5. documentar a ordem sem reaproveitar cegamente arquivos ignorados/manuais.

### Histórico destrutivo de campanhas

- `20251230120000_meta_integration_full.sql` executa `DROP TABLE` e depois `CREATE TABLE` para `campaigns`, `ad_sets`, `ads`, `daily_metrics` e `campaign_events`.
- `20260116_market_intelligence.sql` executa `DROP TABLE` sobre `campaigns`, `campaign_events` e `campaign_metrics`, remove a view `campaign_stats` e cria as tabelas `market_*`.
- A migration de Market Intelligence não remove explicitamente `ad_sets`, `ads` ou `daily_metrics`; o estado final desses objetos depende da sequência realmente aplicada.

Não apagar migrations históricas e não executar novos drops até confirmar schema, dados e consumidores externos no Supabase real.

## RLS, grants e funções privilegiadas

### Evidência local

Com as variáveis públicas do `.env` raiz carregadas sem exibir valores:

- `validate:rls`: `pass`;
- `validate:rag-rls`: `pass`;
- o primeiro `security:gate` chegou ao audit e encontrou dependências vulneráveis, não falha de RLS; após atualização compatível do lockfile, o gate completo passou com 0 vulnerabilidades.

### Pontos que exigem revisão na Fase 1

- `current_app_profile_role` e `admin_update_profile` são `SECURITY DEFINER` no schema `public`; precisam de revisão de `EXECUTE`, `search_path`, checagem de ator e superfície Data API.
- `market_competitor_ads` possui policy `FOR ALL` com `USING`, mas sem `WITH CHECK`; não usar como padrão para o novo domínio.
- o tenant de `validated_works` tem default fixo `ens`; isso não constitui isolamento multi-tenant completo.
- buckets de `avatars` e o schema-base de chat precisam ser reconciliados com o remoto.
- novas tabelas devem receber `GRANT` explícito para os papéis necessários, além de RLS. O Supabase anunciou em 2026 a retirada gradual da exposição automática de novas tabelas à Data API: <https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically>.
- autorização nunca deve depender de `user_metadata`; somente claims controladas pelo servidor, tabela de perfis validada e/ou delegação assinada.

## Edge Functions

| Função | Papel observado | Classificação | Observação |
|---|---|---|---|
| `admin-create-user` | criar usuário por administrador | `keep`/`adapt` | validar deploy e origem permitida na VPS |
| `admin-delete-user` | excluir usuário por administrador | `keep`/`adapt` | operação destrutiva; exigir auditoria |
| `admin-reset-password` | reset administrativo | `keep`/`adapt` | confirmar fluxo e política de sessão |
| `proxy-chatbot` | proxy Hermes anterior ao Chat Bridge | `archive_candidate` | runtime principal atual usa `app-bridge`; confirmar tráfego antes de desativar |

## Decisões e proibições desta fase

- nenhuma tabela, policy, função, bucket, migration ou registro remoto foi alterado;
- os 22 arquivos residuais removidos do frontend não autorizam remover tabelas `market_*`;
- `ignored_migrations` e `manual` não integram automaticamente o bootstrap;
- o `.env` raiz permanece não versionado e nenhum secret deve entrar em Markdown;
- o inventário remoto e o baseline de schema são bloqueadores da Fundação do Marketing Ops.
