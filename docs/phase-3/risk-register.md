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

## Revisão após a Task 5

- F3-R-04: mitigação local validada com trigger append-only, grants mínimos,
  função atômica, concorrência otimista e pgTAP negativo para update/delete.
  Permanece aberto até o E2E e o gate de produção.
- F3-R-06: ownership, tenant/item composto, compensação e unlink sem deleção de
  bytes foram validados no domínio. O smoke Docker comprovou upload, URL
  assinada, download e cleanup. Permanece aberto até restart/E2E da Task 10.
- A URL pública do Artifact Server deve ser configurada por ambiente. O smoke
  local usa endpoint local explícito; produção não foi chamada nem alterada.

## Revisão após a Task 6

- F3-R-02: API e SDK usam uma única consulta/query key canônica. Permanece
  aberto até lista/semana/mês reutilizarem esses contratos nas Tasks 7–8.
- F3-R-07: ETag/If-Match/currentVersion estão validados individualmente; lote
  continua aberto para a Task 9.
- F3-R-09: 26 paths/38 operações foram comparados automaticamente entre router
  e OpenAPI; p95 amplo permaneceu em 367,39 ms, abaixo do limite de 500 ms.
- F3-R-11: reset completo após o smoke reaplicou todas as migrations e o
  serviço voltou healthy.
- Novo risco operacional observado: `.env` de desenvolvimento pode apontar para
  destinos não locais. Smokes locais devem classificar endpoints antes de subir
  containers e usar overrides explícitos; nenhum remoto foi acessado.

## Revisão após a Task 7

- F3-R-01: timezone retornado pela API ficou visível e o formulário declara
  persistência UTC; limites locais e DST continuam no gate da Task 8.
- F3-R-02: lista usa o client/query key canônicos e filtros URL compartilháveis;
  permanece aberto somente até semana/mês comprovarem equivalência.
- F3-R-08: lista desktop/mobile, labels, diálogo e controles nativos foram
  validados por testes e browser. Axe e navegação dos calendários ficam na
  Task 8.
- O CORS de produção permaneceu fechado. Desenvolvimento local usa proxy Vite
  same-origin e não altera imagem, compose ou allowlist do serviço.

## Revisão após a Task 8

- F3-R-01: mitigação local validada ponta a ponta. Limites semana/mês, São
  Paulo, DST e conversão de formulário local ↔ UTC passaram. Permanece aberto
  somente para repetição no gate VPS.
- F3-R-02: mitigação local validada. Lista/semana/mês reutilizam client, query
  key, filtros e resposta canônica; não há segunda consulta de negócio.
- F3-R-08: mitigação local validada com lista equivalente, navegação por
  teclado/formulário, linhas ARIA, contraste, axe desktop/mobile e overflow
  interno. Permanece aberto somente para o aceite final de produção.
- O calendário vazio foi mantido visível, evitando que ausência de dados
  impeça navegação. Itens sem data continuam deliberadamente fora das grades.
