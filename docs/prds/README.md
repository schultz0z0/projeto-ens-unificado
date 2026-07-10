# PRDs do Programa Nexus AI — Marketing Operations

Este diretório contém um PRD para cada fase do roadmap aprovado. O [`Roadmap.md`](../../Roadmap.md) é a visão executiva; o [design consolidado](../plans/2026-07-10-nexus-marketing-ops-roadmap-design.md) é o contrato arquitetural; estes PRDs definem valor, escopo e aceite.

## Regra de execução

Uma fase só entra em implementação quando:

1. a fase anterior satisfaz seus critérios de saída;
2. decisões abertas que bloqueiam a fase foram resolvidas;
3. existe plano de implementação técnico com arquivos, testes e rollback;
4. responsável funcional aprovou o PRD.

## Estados

- `draft`: em elaboração;
- `approved`: escopo funcional aprovado;
- `in_progress`: implementação iniciada;
- `ready_for_production`: gate local concluído;
- `completed`: gate local e homologação VPS concluídos;
- `blocked`: dependência externa impede avanço.

## Fases

| Fase | PRD | Resultado principal | Dependência | Status inicial |
|---|---|---|---|---|
| 0 | [Diagnóstico e Contrato de Evolução](phase-0-diagnostico-contrato-evolucao.md) | Base inventariada e decisões registradas | — | `approved` |
| 1 | [Fundação do Marketing Ops](phase-1-fundacao-marketing-ops.md) | Domínio seguro compartilhado | Fase 0 | `draft` |
| 2 | [Workspace Operacional MVP](phase-2-workspace-operacional-mvp.md) | Primeiro release utilizável | Fase 1 | `draft` |
| 3 | [Calendário e Esteira de Produção](phase-3-calendario-esteira-producao.md) | Operação diária planejada | Fase 2 | `draft` |
| 4 | [Hermes Campaign Operator](phase-4-hermes-campaign-operator.md) | Hermes opera objetos reais | Fases 1–3 | `draft` |
| 5 | [Governança e Aprovações](phase-5-governanca-aprovacoes.md) | Decisões editoriais e sensíveis rastreáveis | Fases 3–4 | `draft` |
| 6 | [Execução Assistida Piloto](phase-6-execucao-assistida-piloto.md) | Um canal real executado com controle | Fase 5 | `draft` |
| 7 | [Performance, Diagnóstico e Aprendizado](phase-7-performance-diagnostico-aprendizado.md) | Resultado convertido em decisão | Fase 6 | `draft` |
| 8 | [Hermes Proativo e Escala Operacional](phase-8-hermes-proativo-escala.md) | Alertas e recomendações controlados | Fase 7 | `draft` |

## Gates comuns

Todo PRD herda:

- segurança por padrão;
- tenant, RLS e RBAC testados;
- auditoria e correlação;
- idempotência onde houver mutação;
- observabilidade;
- testes proporcionais ao risco;
- backup e rollback;
- validação local;
- homologação posterior na VPS Linux.

Sem homologação na VPS, a fase não pode receber status `completed`.

## Artefatos por fase

Cada fase deverá produzir:

- PRD aprovado;
- design técnico da fase;
- plano de implementação;
- migrations e contratos quando aplicáveis;
- testes automatizados;
- checklist local com evidências;
- runbook de deploy e rollback;
- checklist VPS com evidências;
- registro de aceite.
