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
