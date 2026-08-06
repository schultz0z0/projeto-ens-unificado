# Registro de riscos — Fase 5

- **Estado:** `production_validation_blocked`
- **Revisão:** 2026-08-06

| ID | Risco | Mitigação comprovada | Estado |
|---|---|---|---|
| F5-R-01 | approval técnico confundido com decisão de negócio | rotas/componentes/contratos separados | `mitigated_local` |
| F5-R-02 | versão/payload mudar após decisão | alvo/hash imutáveis, triggers e revalidação | `mitigated_local_remote_db` |
| F5-R-03 | autoaprovação operacional | domínio + helper/RLS; smoke remoto negativo | `mitigated_local_remote_db` |
| F5-R-04 | papel revogado ainda decidir | membership/papel revalidados dentro da transação | `mitigated_local` |
| F5-R-05 | duas decisões vencerem | row lock, versão e unique append-only | `mitigated_local_remote_db` |
| F5-R-06 | retry duplicar | idempotência por ator/operação/payload | `mitigated_local` |
| F5-R-07 | expiração liberar pacote | worker limitado com `SKIP LOCKED`, ledger `system` e invalidação atômica; smoke remoto | `mitigated_local_remote_db` |
| F5-R-08 | comentário causar XSS/vazamento | texto React, limites strict e redaction | `mitigated_local` |
| F5-R-09 | fila vazar cross-tenant | RLS forçada, grants mínimos e smoke | `mitigated_local_remote_db` |
| F5-R-10 | payload sensível em logs | auditoria minimizada e logger redigido | `mitigated_local` |
| F5-R-11 | Hermes decidir/contornar UI | sem action/scope de decisão | `mitigated_local` |
| F5-R-12 | endpoint executar efeito externo | guard estático/E2E; sem provider/worker | `mitigated_local` |
| F5-R-13 | workflow genérico ampliar escopo | dois tipos explícitos e decisão única | `accepted` |
| F5-R-14 | fila virar gargalo | índice/cursor e gate remoto de 10 mil linhas com p95 de 16,01 ms | `mitigated_local_remote_db` |
| F5-R-15 | timezone expirar incorretamente | UTC/ISO e validação temporal | `mitigated_local` |
| F5-R-16 | pacote não servir à Fase 6 | payload canônico e autorização explícita | `accepted_for_phase_6_gate` |
| F5-R-17 | advisories legados do Supabase | 37 achados preexistentes fora dos objetos F5 | `accepted_out_of_scope` |
| F5-R-18 | React Router sem versão sem advisory no registry | mantido 6.30.4 client-only; 2 moderados, zero high; upgrade 7.18.2 introduz advisory high | `accepted_monitor` |
| F5-R-19 | resposta autenticada/capability reutilizada entre contas | reproduzido member → manager → admin no mesmo deep link; REST nova confirmou capability correta | `open_high` |
| F5-R-20 | decisão terminal revertida ao notificar outro usuário | `POST /decisions` 500; PostgreSQL confirmou RLS em `in_app_notifications`; zero decisão persistida | `open_high` |
| F5-R-21 | frontend mascara erro interno como conflito | UI mostrou conflito para HTTP 500, dificultando operação e diagnóstico | `open_medium` |
| F5-R-22 | confirmação verbosa do Hermes entra em retry no mesmo turno | barreira evitou execução indevida; confirmação curta concluiu o plano | `open_low` |

## Bloqueadores remanescentes

F5-R-19 e F5-R-20 são bloqueadores altos comprovados em produção. Eles exigem
correção, regressão automatizada, novo deploy e repetição do gate manual.
Restart/persistência, fluxo operacional, expiração, mobile e cross-tenant manual
continuam pendentes. A fase permanece fora de `production_validated`.
