# Progresso de implementação — Fase 4

- **Estado:** `in_progress`
- **Progresso de implementação:** 37.5%
- **Snapshot:** 2026-07-22
- **Branch única:** `main`
- **Próximo gate:** Task 4 — deep links e resultados estruturados

## Planejamento por task

| Task | Escopo | Estado | Saída esperada |
|---|---|---|---|
| 1 | contratos MCP, schema e baseline de auditoria | `implemented_unit_validated` | catálogo congelado, actions ampliadas, migration e segurança MCP |
| 2 | leituras MCP de agenda, timeline, conteúdo e capacidades | `implemented_unit_validated` | tools de leitura expostas sobre domínio existente |
| 3 | expansão do `prepare_plan` e `execute_plan` | `implemented_unit_validated` | novas ações de escrita seguras e idempotentes |
| 4 | deep links, resultados estruturados e mensagens de operador | `not_started` | tool results consistentes com frontend e UX conversacional |
| 5 | integração Hermes runtime, RAG/Graph e skill | `not_started` | runtime bloqueando caminho errado, usando fontes corretas e revisando tom ENS |
| 6 | observabilidade, auditoria e correlação ponta a ponta | `not_started` | métricas, trilha e evidência de chat → run → tool → audit |
| 7 | frontend/bridge/E2E e falhas controladas | `not_started` | jornada integrada com erros sem falso sucesso |
| 8 | gates locais, operação, VPS e handoff | `not_started` | pacote documental reconciliado e fase pronta para homologação |

## Estratégia de execução

- cada task começa por RED real e termina com GREEN real;
- a documentação da fase deve ser atualizada no mesmo ciclo da task;
- leituras MCP entram antes das novas mutações do plano;
- mutações novas só entram depois do catálogo e do contrato de auditoria
  estarem congelados;
- o runtime Hermes só é ampliado depois que o `marketing-ops` expuser o novo
  contrato de forma estável;
- o frontend e a Bridge fecham a reta final com E2E e correlação.

## Critérios de progresso

A fase não avança para `in_progress` apenas por existir documentação. Esse
estado só deve ser usado quando a Task 1 começar com execução técnica real,
testes RED e arquivos de produto alterados.

## Bloqueadores prévios conhecidos

- nenhuma decisão de produto permanece aberta; os contratos estão congelados
  em `design.md`;
  - bloqueadores descobertos durante RED/GREEN devem ser registrados aqui e no
  `risk-register.md` antes de qualquer mudança de escopo.

## Task 1 — evidência registrada em 2026-07-22

### RED

| Comando | Falha esperada observada |
|---|---|
| `npx vitest run src/plans/contracts.test.ts` | 3/3 falharam porque as sete actions novas não existiam |
| `npx vitest run src/mcp.test.ts -t "registers versioned tools"` | catálogo ainda publicava três tools diretas legadas |
| `npx vitest run src/mcp/rateLimit.test.ts` | módulo de rate limit inexistente |
| `npx vitest run src/domain/audit.test.ts` | SQL não continha `operator_origin`/contexto Hermes |
| `npx vitest run src/migration-contract.test.ts` | migration da Fase 4 inexistente |

### GREEN/validação

| Comando | Resultado |
|---|---|
| suíte unitária dirigida da Task 1 | 10 testes passaram; nenhum falhou |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| validação documental | links, contratos fechados e `git diff --check` aprovados |

### Limitação ambiental

O baseline completo encontrou 71 falhas por `ECONNREFUSED 127.0.0.1:55322`.
`npx supabase status` confirmou ausência do daemon Docker e o executável
`docker` não está instalado. A migration possui teste estático GREEN e pgTAP
versionado, mas reset/lint/pgTAP permanecem pendentes para o gate local/VPS.

## Task 2 — evidência registrada em 2026-07-22

### RED

| Comando | Falha esperada observada |
|---|---|
| `npx vitest run src/mcp.test.ts src/domain/capabilities.test.ts -t "registers versioned tools\|object capabilities"` | discovery não continha os quatro tools e `capabilities.ts` não existia |

### GREEN/validação

| Comando | Resultado |
|---|---|
| suíte dirigida de discovery e capacidades | 2 testes passaram; 7 testes não selecionados pelo filtro |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `git diff --check` | exit 0; apenas avisos de normalização LF/CRLF |

### Contratos entregues

- agenda MCP sobre `listProductionSchedule()`, com intervalo obrigatório,
  filtros, paginação e timezone;
- timeline MCP sobre `listCampaignTimeline()`;
- leitura agregada de assets, versões limitadas e artifacts por item/asset;
- capacidades derivadas de papel, visibilidade RLS, estado terminal/arquivado e
  funções contextuais `can_edit_*` do banco;
- rate limit de leitura aplicado por ator e tool.

## Task 3 — evidência registrada em 2026-07-22

### RED

| Comando | Falha esperada observada |
|---|---|
| `npx vitest run src/plans/executor.test.ts` | 3/3 falharam: actions incompletas, executor interrompia após uma falha e resultado usava o shape legado |

### GREEN/validação

| Comando | Resultado |
|---|---|
| suítes integrais de executor, contratos, token, idempotência e notas | 12 testes passaram em 5 arquivos; nenhum skipped/falhou |
| discovery MCP dirigido | executor/prepare permanecem publicados e mutações diretas ausentes |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |

### Contratos entregues

- execução das oito actions congeladas, com mapeamento snake_case → domínio;
- uma transação de domínio e chave `plan:{plan_id}:{action_index}` por action;
- referências intra-plano para campanha e asset;
- ações independentes continuam; dependentes de criação falha viram
  `pending/dependency_failed`;
- resultado normalizado com `completed[]`, `failed[]`, `pending[]`, erro seguro
  e `idempotency_hit` real reportado pelo comando;
- `campaign.note_add` append-only, delimitado e limitado a 10.000 caracteres,
  sem texto integral no evento/auditoria específicos da operação;
- Artifact Server é dependência obrigatória somente quando o plano contém
  `artifact.link_existing`.
