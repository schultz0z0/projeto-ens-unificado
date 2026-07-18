# Registro de riscos da Fase 3

- **Estado:** `active_during_implementation`
- **Revisão:** 2026-07-18

| ID | Risco | Impacto | Mitigação/gate | Owner |
|---|---|---|---|---|
| F3-R-01 | timezone deslocar prazo/dia | alto | UTC, IANA visível e testes de borda/DST | Frontend/Backend |
| F3-R-02 | lista/semana/mês divergirem | alto | uma query/client/query key canônicos | Backend/Frontend |
| F3-R-03 | ciclo ou deadlock em dependências | alto | locks ordenados, detecção transacional e harness | Backend/Data |
| F3-R-04 | versão congelada ser alterada | crítico | append-only, grants mínimos e pgTAP negativo | Backend/Data |
| F3-R-05 | estado simular aprovação/execução | alto | enum reduzido e rejeição de estados reservados | Produto/Backend |
| F3-R-06 | artifact cross-tenant/órfão | alto | ownership Fase 2, compensação e restart | Backend/DevOps |
| F3-R-07 | lote ocultar falha ou sobrescrever | alto | versão/autorização/resultado por item | Backend/Frontend |
| F3-R-08 | calendário inacessível | alto | lista equivalente, teclado e axe | Frontend/QA |
| F3-R-09 | query lenta/N+1 | alto | volume, EXPLAIN, índices medidos e payload resumido | Backend/Data |
| F3-R-10 | notificação duplicada/sensível | médio | event key único e payload allowlisted | Backend/Security |
| F3-R-11 | migration quebrar itens legados | alto | backfill determinístico, pgTAP e imagem anterior compatível | Data/DevOps |
| F3-R-12 | scope creep para drag/recorrência/aprovação | médio | não objetivos vinculantes e revisão por task | Produto/Tech lead |
| F3-R-13 | índice F2 não chegar ao remoto antes do gate | médio | pré-condição explícita do deploy | Data/DevOps |

Bloqueiam rollout: cross-tenant, perda/mutação de versão, ciclo/deadlock,
timezone incorreto, estado reservado aceito, dado sensível em log/evento ou
falha alta/crítica sem mitigação.

## Revisão após a Task 3

- F3-R-01: mitigação backend validada com UTC, IANA, São Paulo e timezone DST;
  permanece aberto até a validação visual das Tasks 7–8.
- F3-R-02: query canônica validada; permanece aberto até todas as views usarem o
  mesmo client/query key.
- F3-R-09: gate local validado em p95 40,02 ms/10.000 itens. O EXPLAIN confirmou
  a remoção da avaliação RLS por linha e não justificou índice adicional.

## Revisão após a Task 4

- F3-R-03: mitigação local validada. A ordem global de locks é campanha → UUID
  menor → UUID maior; o harness concorrente terminou sem deadlock e aceitou no
  máximo uma aresta A↔B. Permanece aberto até o E2E/restart da Task 10.
