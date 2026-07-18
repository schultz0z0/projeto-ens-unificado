# Evidências de validação local da Fase 3

- **Data-base:** 2026-07-18
- **Branch:** `main`
- **Estado:** `in_progress`
- **Política:** atualizar no mesmo ciclo de cada task; não registrar gate que
  não tenha sido realmente executado.

## Task 1 — schema, RLS e contratos

### RED observado

| Comando | Resultado esperado observado |
|---|---|
| `npx vitest run src/domain/contracts.test.ts` | 5 falhas/19 pela ausência dos contratos de item |
| `npx supabase test db ...calendar*.test.sql` | falhas pela ausência dos tipos, campos, tabelas e policies |

### GREEN observado

| Comando | Resultado |
|---|---|
| `npx supabase db reset --local --workdir .` | migrations e seed aplicados do zero |
| `npx supabase test db --local --workdir .` | 6 arquivos, 295/295 testes |
| `npx supabase db lint --local --schema marketing_ops,marketing_ops_private --level warning --fail-on error` | nenhum erro |
| `npx supabase db diff --local --schema marketing_ops,marketing_ops_private` | diff vazio |
| `npx vitest run src/domain/contracts.test.ts` | 19/19 |
| `npm test` | 135 pass; 2 E2E condicionais skipped |
| `npm run typecheck` | passou |
| `npm run build` | passou |

### Bugs e correções

1. `col_default_is` tentou converter a expressão esperada para o enum legado e
   encerrou o pgTAP antes de concluir o RED. A asserção passou a comparar
   `information_schema.columns.column_default`.
2. O novo arquivo RLS declarou 31 testes, mas continha 30. Corrigido para
   `plan(30)` após a reprodução isolada.
3. Duas execuções paralelas de `supabase test db` disputaram a ativação da
   extensão pgTAP. Não houve mudança de produto: os gates de banco passaram
   serializados e os comandos Supabase ficam serializados nos próximos ciclos.
4. Fixtures da Fase 2 usavam kinds livres e o estado legado `archived`.
   Atualizados para o enum `task` e terminal `cancelled`, preservando os cenários
   de autorização.

### Baseline remoto

Os advisors do projeto `Nexus AI - Marketing ENS` foram consultados em modo
read-only. Os achados de segurança/performance retornados já existem em schemas
legados e não citam objetos da migration nova, que ainda não foi aplicada
remotamente. Entre os achados estão três tabelas `public` sem RLS; eles não são
silenciados nem tratados como gate verde da Fase 3.

O clone não está ligado pelo Supabase CLI: `migration list --linked` retorna
`LegacyProjectNotLinkedError`. Nenhum deploy remoto foi realizado.

## Task 2 — CRUD e máquina de estados

### RED observado

`npx vitest run src/domain/items.test.ts src/production-gate.test.ts`:

- `items.test.ts`: 7/7 falhas pela ausência das funções novas;
- `production-gate.test.ts`: 5/5 pass, comprovando que o RED não era regressão
  da base anterior.

### GREEN observado

| Comando | Resultado |
|---|---|
| `npx vitest run src/domain/items.test.ts src/production-gate.test.ts` | 12/12 |
| `npm test` | 142 pass; 2 E2E condicionais skipped |
| `npm run typecheck` | passou |
| `npm run build` | passou |

### Critérios exercitados

- create/get/patch/cancel e replay idempotente;
- tipo/data/assignee inválidos;
- campanha arquivada e isolamento cross-tenant;
- conflito de versão com versão atual;
- todos os edges forward/backward/cancel aprovados;
- título/assignee/prazo para ready;
- conteúdo editorial antes de review;
- item terminal sem mutação;
- auditoria/outbox únicos no replay e sem conteúdo bruto.

### Bugs e correções

1. O tipo TypeScript de create usava a saída do Zod pós-default e exigia campos
   que a entrada mínima pode omitir. Separados `z.input` e `z.output`.
2. Wrappers legados receberam autorização explícita e preservação de updates
   content-only.
3. A regressão ampla expôs fixture antigo de busca não idempotente: múltiplas
   execuções acumulavam campanhas “Nexus Alpha”. O teste agora usa token único.

## Task 3 — agenda, query canônica e timezone

### RED observado

| Comando/cenário | Resultado |
|---|---|
| `npx vitest run src/domain/scheduling.test.ts src/domain/queries.test.ts` | falhas porque scheduling e a consulta canônica não existiam |
| `npx vitest run src/schedule.performance.test.ts --pool=forks --maxWorkers=1` | p95 2.566,34 ms para 10.000 itens; limite 500 ms |
| `EXPLAIN (ANALYZE, BUFFERS)` inicial | 2.401,49 ms; 195.471 buffer hits; helper RLS reavaliado por linha |

### Correção medida

A consulta passou a usar
`marketing_ops_private.list_production_schedule`, validando tenant/ator uma vez
e aplicando a autorização de campanha no mesmo plano. A função é
`security definer`, usa `search_path` vazio e não possui grant para `PUBLIC`.
O `EXPLAIN` posterior concluiu a função em 18,68 ms com 16.319 buffer hits.
Como a meta foi superada pela correção da causa, nenhum índice especulativo foi
adicionado.

### GREEN observado

| Comando | Resultado |
|---|---|
| `npx vitest run src/domain/scheduling.test.ts src/domain/queries.test.ts src/foundation.test.ts` | 39/39 |
| `npm run test:schedule-performance` | 1/1; p95 40,02 ms/10.000 itens |
| `npx supabase test db --local --workdir .` | 6 arquivos, 299/299 |
| `npx supabase db lint --local --schema marketing_ops,marketing_ops_private --level warning --fail-on error` | nenhum erro |
| `npx supabase db diff --local --schema marketing_ops,marketing_ops_private` | diff vazio |
| `npm test` | 153 pass; 2 E2E condicionais skipped |
| `npm run typecheck` | passou |
| `npm run build` | passou |

Na regressão completa executada em paralelo com typecheck/build, o mesmo gate
de volume registrou p95 de 316,31 ms e permaneceu abaixo de 500 ms.

### Critérios exercitados

- intervalo `[from,to)`, exclusão de item sem data no range e inclusão sem range;
- filtros combinados e paginação determinística com timestamps iguais;
- viradas de mês/ano, prioridades e cursor de item sem data;
- atraso e bloqueio derivados sem persistência;
- fallback `America/Sao_Paulo`, configuração IANA e timezone com DST;
- isolamento cross-tenant da função privilegiada;
- contrato de Compose e `.env.example` para timezone explícito.

### Bugs e correções

1. A consulta inicial reutilizava policies/helper RLS por linha e falhou o gate
   de performance. A autorização foi consolidada na função canônica privada.
2. O CLI Supabase local não aceita execução concorrente confiável dos pgTAP; os
   gates de banco permaneceram serializados conforme incidente da Task 1.

## Task 4 — dependências acíclicas

### RED observado

| Comando/cenário | Resultado |
|---|---|
| `npx vitest run src/domain/dependencies.test.ts` | suite não coletada porque `dependencies.ts` não existia |
| `node scripts/test_item_dependency_concurrency.mjs` | falhou: A→B e B→A foram aceitas; 2 arestas persistidas |
| pgTAP de calendário | 7/45 falhas: helpers/trigger ausentes |

### Implementação

- migration `20260718201158_enforce_acyclic_item_dependencies.sql`;
- lock do agregado da campanha antes dos locks advisory dos UUIDs ordenados;
- trigger transacional para self-loop, mesmo tenant/campanha, itens ativos e
  ciclo recursivo;
- helpers privilegiados sem grants públicos e com `search_path` vazio;
- comandos add/list/remove idempotentes, versionados, auditados e com outbox;
- bloqueio derivado do status vivo do predecessor.

### GREEN observado

| Comando | Resultado |
|---|---|
| `npx vitest run src/domain/dependencies.test.ts src/domain/items.test.ts src/domain/scheduling.test.ts` | 20/20 |
| `node scripts/test_item_dependency_concurrency.mjs` | PASS; exatamente uma aresta; sem deadlock |
| `npx supabase db reset --local --workdir .` | todas as migrations e seed aplicadas do zero |
| `npx supabase test db --local --workdir .` | 6 arquivos, 307/307 |
| `npx supabase db lint --local --schema marketing_ops,marketing_ops_private --level warning --fail-on error` | nenhum erro |
| `npx supabase db diff --local --schema marketing_ops,marketing_ops_private` | diff vazio |
| `npm test` | 157 pass; 2 E2E condicionais skipped |
| `npm run typecheck` | passou |
| `npm run build` | passou |

### Critérios exercitados

- add/list/remove, replay idempotente e conflito de versão com rollback;
- self-loop, duplicata, cross-campaign, cross-tenant e ator sem participação;
- item dependente terminal e predecessor terminal na criação;
- ciclo indireto sem alterar versão/arestas existentes;
- status concluído do predecessor remove o bloqueio sem concluir o dependente;
- auditoria/outbox únicos por mutação;
- duas inserções opostas concorrentes, com ambos os lados observados como
  vencedor em repetições diferentes.

### Bugs e correções

1. A ordem inicial do trigger poderia inverter os locks do agregado da campanha
   e dos itens. A ordem global ficou campanha → UUID menor → UUID maior.
2. O harness deixava um timer de 10 segundos ativo após sucesso e não garantia
   cleanup em falha. O timeout agora é cancelado e fixtures são removidas em
   `finally`.

## Task 5 — conteúdo imutável e artifacts

### RED observado

| Comando/cenário | Resultado |
|---|---|
| `npx vitest run src/domain/content.test.ts src/domain/itemArtifacts.test.ts src/integrations/artifactClient.test.ts` | módulos de conteúdo/artifacts e operação de metadata inexistentes |
| pgTAP de calendário | função atômica, grants mínimos e vínculo composto ausentes |
| concorrência de versões | apenas uma escrita deveria vencer no mesmo `expectedVersion` |
| mutação privilegiada de versão | update/delete deveriam falhar mesmo fora do fluxo da aplicação |

### Implementação

- migration `20260718202716_add_content_versioning_and_item_artifact_guards.sql`;
- função privada `create_content_version` com lock do asset, versão esperada,
  incremento atômico, SHA-256, limites de payload e `search_path` vazio;
- versões congeladas na criação e trigger append-only para update/delete;
- backfill legado estável e idempotente, preservando o corpo JSON original;
- FK composta assegurando que artifact e asset pertencem ao mesmo item/tenant;
- upload/link/list/access/unlink com validação de MIME/tamanho/ownership;
- compensação de bytes quando a transação falha após upload;
- auditoria registra IDs, hashes e fingerprints, nunca corpo/metadata brutos.

### GREEN observado

| Comando | Resultado |
|---|---|
| `npx vitest run src/domain/content.test.ts src/domain/itemArtifacts.test.ts src/integrations/artifactClient.test.ts` | 13/13 |
| suíte focada incluindo regressão de materiais | 20/20 |
| `npm test` em `services/marketing-ops` | 166 pass; 2 E2E condicionais skipped; p95 69,08 ms |
| `npm run typecheck` e `npm run build` | passaram |
| `npx supabase db reset --local --workdir .` | todas as migrations e seed aplicadas do zero |
| `npx supabase test db --local --workdir .` | 6 arquivos, 320/320 |
| `npx supabase db lint --local --schema marketing_ops,marketing_ops_private --level warning --fail-on error` | nenhum erro |
| `npx supabase db diff --local --schema marketing_ops,marketing_ops_private` | diff vazio |
| `npm test` em `services/artifact-server` | 8/8 |
| `docker compose --env-file .env build marketing-ops artifact-server` | duas imagens construídas |
| smoke real do Artifact Server | upload de 27 bytes, owner, URL assinada, download e cleanup passaram |

### Critérios exercitados

- primeira/próxima versão, histórico ordenado, hash e freeze;
- duas escritas concorrentes com exatamente uma vencedora;
- update/delete bloqueados por trigger append-only;
- `expectedVersion` ausente/null/stale rejeitado;
- isolamento cross-tenant e autorização do item;
- backfill legado com preservação e reexecução idempotente;
- owner incorreto, asset de outro item e artifact externo rejeitados;
- compensação de upload em rollback e unlink sem apagar bytes compartilhados;
- auditoria/outbox únicos e sem conteúdo sensível.

### Bugs e correções

1. Uma comparação SQL permitia que `expectedVersion = null` escapasse devido à
   semântica ternária de null. A função passou a rejeitar null explicitamente e
   ganhou teste pgTAP.
2. Um teste de dependência excedeu 5 s somente quando a regressão, typecheck e
   build disputaram recursos. Isolado passou em cerca de 504 ms e a suíte
   completa, executada sozinha, passou 166/166. Gates amplos ficam serializados.
3. O primeiro download assinado local retornou 404 porque a URL pública no
   `.env` era a de produção. O container foi recriado com URL pública local e o
   smoke completo passou; nenhum endpoint remoto foi alterado.

## Task 6 — REST, OpenAPI e SDK frontend

### RED observado

| Comando/cenário | Resultado |
|---|---|
| `npx vitest run src/rest.test.ts` | suite não coletada: rotas de dependências/conteúdo inexistentes |
| REST após adapters | 3 falhas: paths/headers/OpenAPI ainda ausentes |
| SDK frontend | `listProductionSchedule` e query keys da produção inexistentes |
| versão de conteúdo com 300 KiB | HTTP 500 antes da rota por limite JSON de 256 KiB |
| regressão ampla inicial | 168 pass; teste multi-transação de dependência encerrou em 5,049 s pelo timeout genérico |
| primeiro Compose local | bloqueado antes de alterar container por descoberta de Compose incorreto/variável obrigatória |
| readiness com URL de host | banco inacessível pelo loopback do Windows e depois TLS indevido no hostname Docker |

### Implementação

- recursos canônicos em `/v1/campaign-items` com agenda, CRUD e transição;
- dependências, content assets, versões append-only e artifacts;
- adapters legados de item preservados;
- validação Zod strict de query/body, estados reservados rejeitados;
- guards de mutação, ETags e erro de conflito com `currentVersion`;
- OpenAPI 3.1 com 26 paths/38 operações em lockstep com Express;
- SDK frontend e query keys compartilhadas para todas as visualizações;
- parser JSON alinhado ao limite de conteúdo, com `413 payload_too_large`;
- `sslmode=disable` explícito para Docker local e TLS mantido no remoto.

Notificações/lote permanecem na Task 9. Nenhum endpoint placeholder foi
publicado antes da existência de domínio, autorização e testes correspondentes.

### GREEN observado

| Comando | Resultado |
|---|---|
| `npx vitest run src/rest.test.ts` | 15/15 |
| `npm test` em Marketing Ops | 170 pass; 2 E2E condicionais skipped; p95 367,39 ms |
| `npm run typecheck` e `npm run build` em Marketing Ops | passaram |
| Redocly 2.18.1 `--extends=minimal` | OpenAPI válido |
| testes client/query keys frontend | 13/13 |
| `npm run typecheck` e `npm run build` no frontend | passaram |
| `docker compose --env-file .env build marketing-ops` | imagem construída |
| health/readiness com Supabase local | container healthy |
| smoke REST manual | login, campanha, item, agenda, patch, asset, versão e 409 passaram |
| `npx supabase db reset --local --workdir .` | fixtures removidas e todas as migrations reaplicadas |
| health após reset | container healthy |

O build frontend manteve os avisos baseline de Browserslist e chunk principal
acima de 500 KiB. Não houve regressão de build; as rotas lazy das Tasks 7–8
continuam sendo o gate pertinente para não ampliar esse chunk.

### Critérios exercitados

- inventário path+método e lockstep router/OpenAPI;
- query/body strict e mass assignment rejeitado;
- headers obrigatórios, ETag por item/asset e conflito `currentVersion`;
- range, filtros, cursor, paginação e timezone na resposta;
- create/get/patch/transição reais;
- add/list/remove de dependência reais;
- asset, versão congelada, histórico e stale write reais;
- link/access/unlink de artifact com client controlado;
- payload intermediário aceito e envelope excessivo rejeitado em 413;
- auth real e fluxo Docker contra Supabase estritamente local;
- client preserva auth/correlação e arquivo binário sem JSON/base64.

### Bugs e correções

1. O parser HTTP contradizia o limite de 1 MiB do domínio. Alinhado para o
   envelope necessário e adicionada resposta pública 413.
2. O teste composto de dependências era correto, mas o timeout de 5 s era
   instável sob concorrência das suites. O cenário isolado confirmou 495 ms; o
   harness usa 15 s e não mascara timeout de produção.
3. O `.env` local contém destinos Supabase não locais. O gate bloqueou seu uso;
   o smoke derivou credenciais do Supabase CLI sem imprimi-las e usou overrides.
4. PostgreSQL do Supabase local não é acessível pelo loopback do host a partir
   do container. A validação anexou a rede local do Supabase.
5. O hostname Docker era classificado como remoto e recebia TLS forçado.
   `createPool` agora respeita `sslmode=disable` explícito; URL remota continua
   com TLS.
