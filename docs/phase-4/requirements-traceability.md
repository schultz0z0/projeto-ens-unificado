# Rastreabilidade de requisitos — Fase 4

- **Estado:** `seeded`
- **Implementação:** `not_started`
- **Revisão:** 2026-07-20

## Matriz requisito → design → task

| Requisito | Design | Task | Estado |
|---|---|---|---|
| F4-RF-01 Consulta fundamentada | 3, 6.1, 12 | 2 | `planned` |
| F4-RF-02 Uso do RAG | 5, 10 | 5, 7 | `planned` |
| F4-RF-03 Uso do Graph | 5 | 5, 7 | `planned` |
| F4-RF-04 Preview | 4.2, 7.2 | 3, 4, 5 | `planned` |
| F4-RF-05 Confirmação | 4.2, 7 | 3, 5 | `planned` |
| F4-RF-06 Delegação | 5, 10, 11 | 1, 3, 5, 6 | `planned` |
| F4-RF-07 Deep link | 9 | 4, 7 | `planned` |
| F4-RF-08 Idempotência | 4.2, 7.3, 10 | 3, 6 | `planned` |
| F4-RF-09 Conflito | 7.3, 8, 12 | 3, 4, 5 | `planned` |
| F4-RF-10 Operação parcial | 7.3, 8, 12 | 3, 4 | `planned` |
| F4-RF-11 Auditoria | 4.4, 11 | 1, 6, 7 | `planned` |
| F4-RF-12 Limites | 2, 4.2, 10 | 1, 5, 7 | `planned` |

## Gates transversais

| Gate | Design | Task | Estado |
|---|---|---|---|
| Catálogo MCP versionado | 6, 7 | 1 | `planned` |
| Sem mutação direta fora do plano | 4.2, 7 | 3, 5 | `planned` |
| Auditoria/correlação | 11 | 1, 6 | `planned` |
| Runtime Hermes alinhado | 3.1, 4.2, 12 | 5 | `planned` |
| E2E ponta a ponta | 12, 13, 14 | 7, 8 | `planned` |
| Gate local | 13 | 8 | `planned` |
| Gate VPS | 14 | 8 | `planned` |

## Leitura inicial

- F4-RF-01, F4-RF-04, F4-RF-05 e F4-RF-06 aproveitam muito do que foi
  antecipado na Fase 1, mas precisam ser estendidos para o escopo real da
  Fase 4.
- F4-RF-07 e F4-RF-11 são os pontos com maior probabilidade de exigir contrato
  novo, porque deep link e correlação ponta a ponta ainda não estão fechados no
  MCP atual.
- F4-RF-02 e F4-RF-03 são requisitos de fronteira arquitetural; a
  implementação deve provar que RAG e Graph continuam complementares, nunca
  transacionais.

## Critério de encerramento desta matriz

Esta matriz só muda de `seeded` para `closed` quando cada requisito tiver:

- task concluída;
- evidência local ou VPS quando aplicável;
- referência explícita em `implementation-progress.md`;
- ausência de conflito aberto entre design, contrato MCP e comportamento real.
