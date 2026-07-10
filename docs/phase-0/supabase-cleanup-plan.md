# Plano de limpeza do Supabase do app

## Limites aprovados

- ambiente auditado: Supabase de produção do frontend;
- Supabase do `rag-mcp`: **somente leitura durante o diagnóstico; não alterar registros**;
- não apagar migration histórica;
- não executar SQL destrutivo sem backup, migration versionada e janela de rollback;
- `rag_ens` antigo do app foi declarado descartável pelo usuário;
- `rag_marketing` antigo pode conter conhecimento reaproveitável e não será importado automaticamente.

## Evidência remota de 2026-07-10

A inspeção usou `HEAD`/contagem pela Data API com `service_role`, sem ler ou imprimir conteúdo.

| Objeto no Supabase do app | Linhas | Consumidor ativo no runtime | Decisão |
|---|---:|---|---|
| `rag_marketing` | 37 | nenhum; somente workflows n8n históricos | `quarantine`, preservar para revisão |
| `rag_ens` | 403 | nenhum; cursos atuais vêm do RAG MCP | `drop_after_backup`, aprovado pelo usuário |
| `rag_email_html` | 0 | nenhum | `drop_after_backup` |
| `chatbot_rag_documents` | ausente/404 | scripts históricos apenas | nenhuma ação no banco |
| `ad_sets` | 0 | nenhum | `drop_after_backup` |
| `ads` | 0 | nenhum | `drop_after_backup` |
| `daily_metrics` | 0 | nenhum | `drop_after_backup` |
| `market_competitors` | 0 | frontend removido | `drop_after_backup` |
| `market_competitor_ads` | 0 | frontend removido | `drop_after_backup` |
| `market_trends` | 0 | frontend removido | `drop_after_backup` |
| `market_intelligence_feed` | 0 | frontend removido | `drop_after_backup` |

Tabelas ativas confirmadas incluem `profiles` (7), `chat_sessions` (8), `chat_messages` (81), `chat_session_hermes_state` (4), `user_chat_integrations` (1) e `validated_works` (7). Elas não fazem parte da limpeza.

Buckets confirmados e preservados: `avatars`, `partners-logos`, `offers-logos`, `chat-attachments` e `image-gen-outputs`.

## Evidência do RAG dedicado

Inspeção somente leitura no Supabase do `rag-mcp`:

- 135 documentos;
- 964 chunks;
- coleções: `courses` 116 documentos, `insights` 10, `institutional` 4 e `marketing` 5;
- nenhum insert, update, delete ou migration executado.

Essa evidência confirma a separação, mas não autoriza copiar os 37 registros antigos de marketing. Importação exige revisão/deduplicação e validação de conteúdo.

## Estratégia em duas etapas

### Etapa A — backup e quarentena

1. renovar o token administrativo/confirmar conectividade PostgreSQL;
2. gerar dump de schema e dados dos candidatos;
3. registrar hashes/contagens do dump, sem versioná-lo no Git;
4. criar schema privado `legacy_archive` com grants revogados;
5. mover `rag_marketing` para `legacy_archive` e remover a RPC pública correspondente;
6. confirmar que chat, RAG MCP, Graph e frontend continuam saudáveis;
7. observar logs de n8n/consumidores externos.

Quarentena remove o objeto da Data API pública e mantém as 37 linhas restauráveis sem tocar o RAG MCP.

### Etapa B — remoção controlada

Depois do backup e da observação:

- remover `public.rag_ens`, `public.rag_email_html` e suas RPCs;
- remover as tabelas vazias de Meta/Market Intelligence;
- manter `legacy_archive.rag_marketing` até decisão de conteúdo;
- se houver conteúdo útil, usar o processo oficial do RAG MCP com deduplicação e validação humana;
- hard drop de `legacy_archive.rag_marketing` somente após aceite explícito.

## Rollback

- antes do hard drop: mover a tabela de quarentena de volta para `public`, recriar RPC/policies pela migration histórica e invalidar o schema cache;
- depois do hard drop: restaurar somente pelo dump/backup confirmado;
- se um workflow externo falhar, mantê-lo desativado ou apontá-lo ao contrato novo; não reativar RAG duplicado silenciosamente.

## Estado

`planned_not_applied`. Nenhum registro foi alterado durante a Fase 0.
