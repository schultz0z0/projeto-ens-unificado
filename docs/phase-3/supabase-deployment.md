# Deploy Supabase — Fase 3

- **Estado:** `production_validated`
- **Data:** 2026-07-20
- **Alvo:** projeto do app Nexus AI — Marketing ENS
- **Projeto:** `murxwqdevpwjtnnuzzxi` (`sa-east-1`)
- **Projeto RAG:** não acessado nem alterado

## Pré-deploy executado

O alvo foi identificado inequivocamente antes de qualquer escrita. O backup
externo foi criado em diretório temporário local, fora do repositório:

`nexus-phase3-predeploy-20260719-020422`

| Evidência | SHA-256 |
|---|---|
| `migration-list-before.txt` | `5A8070E982799D1DA1C4D3DC6B8CD19B40389B2865B0F6E4262FA6B929110F19` |
| `schema.sql` | `D6EF1E7D4C18F8A2EAD4931C727D066B0F8D1D81057EB031931BAE08777A99DB` |
| `data.sql` | `5D12FDFD7CCB7B33FB0DB82A87CA8E9482168A0C64225C8E3C8A3AAD65262F4C` |

O dry-run apresentou exatamente oito migrations, sem seed nem alteração de
roles:

1. `20260716181000_fix_sync_ens_profile_membership.sql`;
2. `20260718183937_add_campaign_list_tenant_updated_index.sql`;
3. `20260718193003_phase_3_calendar_production_pipeline.sql`;
4. `20260718195853_add_production_schedule_query.sql`;
5. `20260718201158_enforce_acyclic_item_dependencies.sql`;
6. `20260718202716_add_content_versioning_and_item_artifact_guards.sql`;
7. `20260719012000_harden_in_app_notification_projection.sql`;
8. `20260719013000_exclude_archived_campaigns_from_production_schedule.sql`.

## Aplicação e verificação

As oito migrations foram aplicadas com sucesso. A listagem pós-deploy contém 14
migrations sincronizadas, zero pendente e versão mais recente
`20260719013000`.

| Invariante remoto | Resultado |
|---|---|
| tabelas novas com RLS + FORCE RLS | 5/5 |
| `campaign_items` evoluída com RLS + FORCE RLS | sim |
| função canônica de agenda `security definer` | sim |
| `search_path` da função canônica | vazio |
| agenda exclui campanha arquivada | sim |
| policy segura de insert de notificações | 1 |
| triggers de versão imutável habilitadas | 2 |
| status de item fora do enum | 0 |
| dependência ativa em campanha arquivada | 0 |
| lint `marketing_ops,marketing_ops_private` | zero erro |

O aviso final do CLI sobre cache do catálogo `pg-delta` ocorreu depois das
migrations por ausência de um arquivo CA temporário. A listagem e as consultas
diretas acima confirmaram a aplicação; não houve rollback implícito.

## Advisors e resíduos aceitos

Os advisors não estão zerados. Permanecem achados históricos fora dos objetos
novos da Fase 3:

- RLS desabilitada em três tabelas públicas legadas (`ad_sets`, `ads`,
  `daily_metrics`);
- funções antigas em `public`/`smart_mail` com `search_path` mutável;
- avisos históricos de storage/policies e índices ainda sem uso observado;
- proteção contra senhas vazadas desabilitada.

Não surgiu erro novo nos schemas alterados pela Fase 3. Esses itens continuam
no baseline e não devem ser apagados da evidência:

- [RLS disabled in public](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public);
- [Function search path mutable](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable);
- [Leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Credencial

Uma credencial de banco foi exposta na saída do terminal durante uma tentativa
de conexão. Nenhum valor foi persistido no Git ou nesta evidência. A rotação
foi tratada como pré-condição obrigatória antes do deploy VPS final; seguir
[runbook.md](runbook.md) como referência reaproveitável.

## Regra para a VPS

Não executar `supabase db push` nem `supabase db reset` durante o deploy da
aplicação. O gate VPS deve apenas verificar o histórico e os invariantes em modo
read-only.
