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
