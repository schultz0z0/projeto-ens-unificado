# Deploy Supabase do app — Fase 1

- **Estado:** `deployed_and_validated`
- **Data:** 2026-07-11
- **Alvo:** Supabase do app Nexus AI
- **Exclusão:** Supabase do RAG não foi consultado nem alterado

## Backup pré-deploy

Diretório externo ao Git: `C:\Users\rapha\AppData\Local\Temp\nexus-phase-1\predeploy-20260711-183723`.

| Artefato | Bytes | SHA-256 |
|---|---:|---|
| `schema.sql` | 123556 | `7b6999e2538b4903af4d40f92d8d3dccfcef05eaaf12a8f7fd2567a5e47b4451` |
| `data.sql` | 11308811 | `215ba560b2d58043dc97a01a0348ef19437b5876a1a88766de62f2d152853643` |
| `migration-list-before.txt` | 2206 | `a10760609648d719816ef148c9edb952169248f8bbcc4d2b8283027585495aba` |

## Adoção do baseline

O histórico remoto continha 11 versões antigas que não correspondiam à cadeia oficial, enquanto o schema era o mesmo usado para gerar o baseline. Após backup e comparação estrutural:

1. as 11 versões antigas foram marcadas como `reverted` somente na tabela de histórico;
2. `20260711150910_app_schema_baseline.sql` foi marcada como `applied`, sem executar DDL;
3. o dry-run listou exatamente as quatro migrations incrementais esperadas;
4. `db push` foi executado sem seed.

Versões oficiais sincronizadas:

- `20260711150910_app_schema_baseline.sql`;
- `20260711151350_fix_keyword_match_similarity_type.sql`;
- `20260711151907_marketing_ops_foundation.sql`;
- `20260711212218_add_campaign_filtering.sql`;
- `20260711212801_bootstrap_ens_tenant_memberships.sql`.

## Validação pós-deploy

| Invariante remoto | Resultado |
|---|---:|
| migrations oficiais sincronizadas | 5 |
| schemas Marketing Ops | 2 |
| tabelas Marketing Ops | 10 |
| tabelas com RLS habilitada e forçada | 10 |
| tenant ENS ativo | 1 |
| memberships ENS ativas importadas | 6 |
| grants de tabela para `anon` | 0 |
| trigger de sincronização de perfil | 1 |
| índice de filtro por curso | 1 |

`db lint --level error --fail-on error` retornou zero erro. O advisor retornou os mesmos 15 warnings legados já catalogados, sem warning novo do Marketing Ops. O CLI emitiu um warning posterior ao push ao tentar gerar cache local `pg-delta` por arquivo temporário de certificado ausente; a lista de migrations, lint, advisor e consultas diretas confirmaram que o deploy foi concluído.

O deploy do banco não conclui a Fase 1: containers e integração ainda precisam do gate Ubuntu descrito em [vps-validation.md](vps-validation.md).
