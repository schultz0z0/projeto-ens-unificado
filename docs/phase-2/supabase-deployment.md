# Deploy Supabase do app — Fase 2

- **Estado:** `not_executed`
- **Data do snapshot:** 2026-07-14
- **Alvo permitido:** Supabase do app Nexus AI
- **Alvo proibido:** Supabase do RAG
- **CLI observada neste computador:** `2.109.1`; executar `npx supabase --version` e `--help` novamente no deploy

## Inventário atual

Até a Task 7, a migration própria da fase é:

| Migration | Conteúdo | Estado remoto |
|---|---|---|
| `20260714020344_phase_2_workspace_operational_mvp.sql` | agregado do Workspace, participantes, materiais, RLS, locks e compatibilidade | não verificado/não aplicado pela Fase 2 |

Tasks posteriores podem exigir migrations aditivas. A lista efetiva é sempre a saída do `migration list` e do `db push --dry-run` no momento do deploy, nunca esta tabela isolada.

## Pré-condições

- [ ] Tasks 1–15 fechadas internamente;
- [ ] gate nativo fresco aprovado e documentado;
- [ ] migrations revisadas sem ação destrutiva inesperada;
- [ ] projeto/ref/host confirmados inequivocamente como Supabase do app;
- [ ] backup externo de schema e dados criado e hasheado;
- [ ] dry-run lista somente migrations aprovadas da Fase 2;
- [ ] plano de rollback/forward-fix revisado;
- [ ] nenhuma variável `NEXUS_RAG_SUPABASE_*` usada pelo CLI.

## Backup e dry-run

Executar a partir de `apps/chat-web`, sem imprimir senha ou access token:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $env:TEMP "nexus-phase-2-predeploy-$stamp"
New-Item -ItemType Directory -Path $backup | Out-Null

npx supabase --version
npx supabase migration list --linked | Tee-Object (Join-Path $backup 'migration-list-before.txt')
npx supabase db dump --linked --file (Join-Path $backup 'schema.sql')
npx supabase db dump --linked --data-only --use-copy --file (Join-Path $backup 'data.sql')
npx supabase db dump --linked --schema marketing_ops,marketing_ops_private --file (Join-Path $backup 'marketing-ops-schema.sql')
Get-FileHash (Join-Path $backup '*') -Algorithm SHA256
npx supabase db push --linked --dry-run
```

Antes de continuar, comparar o projeto vinculado com a identificação aprovada do app e revisar linha por linha as migrations pendentes. Se aparecer migration desconhecida, projeto divergente ou ação destrutiva, interromper.

## Aplicação

Somente após backup e dry-run aprovados:

```powershell
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db lint --linked --schema marketing_ops,marketing_ops_private --level warning --fail-on error
npx supabase db advisors --linked --type all --level warn --fail-on error
```

Os arquivos pgTAP executados contra o linked devem estar revisados com `begin`/`rollback`, fixtures identificadas e nenhuma chamada externa. Não executar harness genérico de concorrência ou suíte de serviço contra produção; a Task 14 deve fornecer o gate VPS dedicado.

```powershell
npx supabase test db --linked supabase/tests/marketing_ops_workspace.test.sql supabase/tests/marketing_ops_workspace_rls.test.sql
```

## Invariantes pós-deploy

- [ ] histórico local/remoto sincronizado;
- [ ] 228 asserts atuais, mais os adicionados posteriormente, aprovados;
- [ ] zero erro de lint;
- [ ] warnings comparados ao baseline, sem achado novo nos objetos alterados;
- [ ] RLS habilitada/forçada e grants mínimos;
- [ ] exatamente um owner principal;
- [ ] archive terminal/read-only e progressão de versão protegida;
- [ ] Supabase do RAG não consultado ou alterado;
- [ ] hashes e saídas sanitizadas registrados abaixo.

## Registro da execução

| Evidência | Resultado |
|---|---|
| Data/hora | `pending` |
| Commit | `pending` |
| Diretório externo de backup | `pending` |
| SHA-256 schema/dados/lista | `pending` |
| Migrations no dry-run | `pending` |
| Resultado do push | `pending` |
| pgTAP/lint/advisors | `pending` |

Este documento só muda para `deployed_and_validated` depois da execução real e da revisão das evidências. Deploy do banco não conclui a fase; Compose, VPS e aceite permanecem obrigatórios.
