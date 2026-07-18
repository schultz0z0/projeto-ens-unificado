# Deploy Supabase — Fase 2

- **Estado da base da Fase 2:** `production_validated`
- **Estado do forward-fix de performance:** `verified_local_pending_next_deploy`
- **Alvo:** Supabase do app Nexus AI
- **CLI local observada:** `2.109.1`

## Histórico reconciliado

| Migration | Alvo | Estado |
|---|---|---|
| `20260714020344_phase_2_workspace_operational_mvp.sql` | app | aplicada e homologada |
| `20260716181000_fix_sync_ens_profile_membership.sql` | app | aplicada e homologada durante QA |
| `20260718183937_add_campaign_list_tenant_updated_index.sql` | app | validada localmente; deploy pendente |
| `2026-07-16-optimize-mcp-search.sql` | RAG | aplicada e homologada durante QA como hotfix de leitura/performance |

A migration do RAG foi uma exceção aprovada e registrada em
[decision-log.md](decision-log.md). Ela não grava dados de campanha.

## Próximo deploy do app

Executar a partir de `apps/chat-web`, sem imprimir credenciais:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $env:TEMP "nexus-predeploy-$stamp"
New-Item -ItemType Directory -Path $backup | Out-Null

npx supabase --version
npx supabase migration list --linked | Tee-Object (Join-Path $backup 'migration-list-before.txt')
npx supabase db dump --linked --file (Join-Path $backup 'schema.sql')
npx supabase db dump --linked --data-only --use-copy --file (Join-Path $backup 'data.sql')
Get-FileHash (Join-Path $backup '*') -Algorithm SHA256
npx supabase db push --linked --dry-run
```

O dry-run esperado deve incluir apenas migrations locais ainda ausentes no
remoto. Interromper se o project ref, host ou conjunto de migrations divergir.

Após revisão:

```powershell
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db lint --linked --schema marketing_ops,marketing_ops_private --level warning --fail-on error
npx supabase db advisors --linked --type all --level warn --fail-on error
```

## Invariantes pós-deploy

- histórico local/remoto sincronizado;
- índice `campaigns_tenant_updated_idx` presente;
- RLS habilitada/forçada e grants preservados;
- lista mantém autorização por tenant/papel;
- primeira página dentro do SLO;
- zero erro de lint/advisors;
- warnings comparados ao baseline;
- nenhum secret ou dado de campanha em evidências.

Até esse procedimento ser executado e registrado, não marcar o forward-fix de
performance como aplicado em produção.
