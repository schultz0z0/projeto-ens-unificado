# Fase 2 — Workspace Operacional MVP

Este diretório reúne o contrato, a implementação executada e as evidências de
encerramento da Fase 2. O pacote mantém o padrão das Fases 0 e 1: PRD, design,
progresso, rastreabilidade, riscos, validações, operação, rollback e handoff.

## Status

- **Fase:** `production_validated`
- **Snapshot reconciliado:** 2026-07-18
- **Branch canônica e única:** `main`
- **Tasks:** 1–15 concluídas
- **Homologação VPS:** aprovada em 2026-07-16 no commit `9588366`
- **Saneamento local pós-homologação:** gates verdes em 2026-07-18
- **PRD:** [phase-2-workspace-operacional-mvp.md](../prds/phase-2-workspace-operacional-mvp.md)
- **Design:** [design.md](design.md)
- **Plano original:** [2026-07-13-phase-2-workspace-operacional-mvp-implementation.md](../plans/2026-07-13-phase-2-workspace-operacional-mvp-implementation.md)
- **Plano de saneamento:** [2026-07-18-phase-2-sanitation-phase-3-readiness-implementation.md](../plans/2026-07-18-phase-2-sanitation-phase-3-readiness-implementation.md)

O aceite funcional, de segurança, persistência, Compose, integrações e papéis
foi registrado na VPS. O saneamento posterior corrigiu três gates locais:
parser fail-closed dos erros de validação, fixtures/asserts pgTAP e p95 da lista
de campanhas. Nenhuma funcionalidade da Fase 3 foi implementada neste ciclo.

## Classificação das evidências

| Classe | Significado |
|---|---|
| `production_validated` | executado e aceito na VPS de produção |
| `verified_local_2026-07-18` | executado no Supabase/Docker local deste computador |
| `accepted_residual` | não bloqueia a entrada técnica da Fase 3; owner e impacto registrados |
| `not_evidenced` | ausência de prova; bloqueia somente se atingir critério obrigatório |

## Pacote documental

| Entregável | Estado | Documento |
|---|---|---|
| Design e reconciliação as built | `approved_as_built` | [design.md](design.md) |
| Progresso por task | `completed` | [implementation-progress.md](implementation-progress.md) |
| Rastreabilidade PRD → código → prova | `closed` | [requirements-traceability.md](requirements-traceability.md) |
| Decisões e desvios aprovados | `current` | [decision-log.md](decision-log.md) |
| Evidência local final | `verified_local_2026-07-18` | [local-validation.md](local-validation.md) |
| Homologação VPS | `production_validated` | [vps-validation.md](vps-validation.md) |
| Deploy Supabase | `production_validated_with_local_forward_fix_pending` | [supabase-deployment.md](supabase-deployment.md) |
| Riscos residuais | `accepted_residuals_recorded` | [risk-register.md](risk-register.md) |
| LGPD e retenção | `production_validated` | [lgpd-retention.md](lgpd-retention.md) |
| SLO e observabilidade | `baseline_established` | [slo.md](slo.md) |
| Operação | `executed_and_reusable` | [runbook.md](runbook.md) |
| Rollback | `verified_in_vps` | [rollback.md](rollback.md) |
| Continuidade | `phase_closed` | [continuation-handoff.md](continuation-handoff.md) |

## Decisões de encerramento

1. A seção funcional “Configurações” do PRD foi absorvida pelos controles de
   ciclo de vida no cabeçalho do workspace. Não será criada uma sexta seção
   vazia apenas para cumprir um rótulo.
2. A migration do RAG aplicada no QA da VPS foi uma otimização de consulta,
   sem escrita de dados de campanha e sem transformar o RAG em fonte
   transacional.
3. A migration
   `20260718183937_add_campaign_list_tenant_updated_index.sql` foi criada e
   validada localmente. Ela deve ser aplicada no Supabase do app no próximo
   deploy controlado antes de exigir paridade de performance em produção.
4. O aceite operacional do piloto foi registrado na VPS. A adoção ampla e a
   eliminação total de planilhas são métricas contínuas de produto, não um
   bloqueio técnico para iniciar a Fase 3.

## Gate de saída

| Gate | Resultado |
|---|---|
| Critérios funcionais F2-RF-01–12 | `production_validated` |
| RLS/RBAC e cross-tenant | `production_validated` + `verified_local_2026-07-18` |
| pgTAP | 228/228 `verified_local_2026-07-18` |
| Concorrência campanha/participante/item | `production_validated` + harness local verde |
| REST/MCP/Artifact/RAG | `production_validated` |
| Frontend lint/typecheck/test/build | `verified_local_2026-07-18` |
| Lista com 5.000 campanhas, p95 <= 500 ms | p95 entre 21,38 e 23,36 ms `verified_local_2026-07-18` |
| Compose/restart/persistência/rollback | `production_validated` |
| Falha alta/crítica conhecida | nenhuma |

**Parecer:** a Fase 2 permanece `production_validated`. O pacote técnico pode
ser usado como baseline da Fase 3. A migration de índice local é um forward-fix
operacional pendente para o próximo deploy, não uma reabertura funcional da
Fase 2.

## Governança

- trabalhar somente em `main`;
- commits locais são permitidos depois dos testes;
- `git push` e deploy VPS continuam sob responsabilidade do usuário;
- qualquer deploy Supabase exige identificação do projeto, backup, dry-run,
  aplicação, lint/advisors e registro de evidência;
- não registrar secrets, payloads sensíveis ou URLs assinadas;
- o Supabase do RAG permanece separado; mudanças nele exigem escopo explícito,
  migration revisada e evidência própria.
