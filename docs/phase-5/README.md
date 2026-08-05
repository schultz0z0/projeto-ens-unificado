# Fase 5 — Governança e Aprovações

Este diretório reúne o contrato técnico, o plano de execução e as evidências
da Fase 5. O pacote segue o padrão documental das Fases 1–4 e não antecipa
estado de implementação, deploy ou homologação.

## Status

- **Fase:** `design_approved`
- **Snapshot:** 2026-08-05
- **Branch canônica e única:** `main`
- **Dependências:** Fases 3 e 4 `production_validated`
- **Implementação:** não iniciada
- **Gate local:** pendente
- **Homologação VPS:** pendente
- **PRD:** [phase-5-governanca-aprovacoes.md](../prds/phase-5-governanca-aprovacoes.md)
- **Design:** [design.md](design.md)
- **Plano:** [2026-08-05-phase-5-governanca-aprovacoes-implementation.md](../plans/2026-08-05-phase-5-governanca-aprovacoes-implementation.md)

## Gate de entrada

| Dependência | Evidência | Estado |
|---|---|---|
| Fase 3: conteúdo versionado e notificações | [Fase 3](../phase-3/README.md) | `production_validated` |
| Fase 4: operador Hermes e confirmação | [Fase 4](../phase-4/README.md) | `production_validated` |
| Separação dos três approvals | [ADR 0004](../phase-0/adrs/0004-approval-separation.md) | `accepted` |
| Fonte transacional e limites de serviço | [ADRs 0001–0002](../phase-0/adrs) | `accepted` |
| PRD da Fase 5 | [PRD](../prds/phase-5-governanca-aprovacoes.md) | `approved` |
| Desenho-base funcional | decisão do responsável em 2026-08-05 | `approved` |

## Decisões congeladas para o primeiro corte

- dois fluxos explícitos: editorial e operacional;
- uma decisão efetiva por solicitação, preservando todas as tentativas e
  transições na trilha append-only;
- `manager` e `admin` elegíveis podem decidir editorial;
- autorização operacional exige decisor diferente do solicitante;
- conteúdo editorial referencia exatamente `asset_id + version_number`;
- pacote operacional possui payload canônico e hash imutáveis;
- alterar versão ou payload cria novo ciclo, sem reaproveitar decisão anterior;
- Hermes pode preparar e submeter após confirmação, mas não decide;
- o modal técnico do Hermes não é reutilizado;
- nenhum endpoint da Fase 5 executa provedor, worker ou efeito externo.

## Pacote documental

| Documento | Estado inicial |
|---|---|
| [Design técnico](design.md) | `approved` |
| [Plano de implementação](../plans/2026-08-05-phase-5-governanca-aprovacoes-implementation.md) | `planned` |
| [Progresso](implementation-progress.md) | `not_started` |
| [Rastreabilidade](requirements-traceability.md) | `seeded` |
| [Riscos](risk-register.md) | `seeded` |
| [Validação local](local-validation.md) | `not_started` |
| [Deploy Supabase](supabase-deployment.md) | `not_started` |
| [Runbook](runbook.md) | `draft` |
| [Rollback](rollback.md) | `draft` |
| [Validação VPS](vps-validation.md) | `not_started` |
| [Handoff](continuation-handoff.md) | `phase_5_planned` |

## Responsabilidade pela validação

O assistente executará e registrará testes e validações de cada task neste
workspace. Depois do deploy realizado pelo responsável, o assistente fará a
homologação manual no site pelo navegador, incluindo papéis, fluxos, segurança,
responsividade, acessibilidade, auditoria, persistência e ausência de execução
externa. A fase só muda para `production_validated` após esse gate real.

## Critério de promoção

`design_approved` não equivale a implementação iniciada. `ready_for_production`
exige todas as tasks, testes e gate local. `production_validated` exige deploy,
homologação manual no navegador, evidências no Supabase/VPS e aceite final sem
falha alta ou crítica conhecida.
