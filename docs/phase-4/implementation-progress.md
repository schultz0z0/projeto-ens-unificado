# Progresso de implementação — Fase 4

- **Estado:** `in_progress`
- **Progresso de implementação:** 75%
- **Snapshot:** 2026-07-22
- **Branch única:** `main`
- **Próximo gate:** Task 7 — integração frontend/bridge e cenários E2E

## Planejamento por task

| Task | Escopo | Estado | Saída esperada |
|---|---|---|---|
| 1 | contratos MCP, schema e baseline de auditoria | `implemented_unit_validated` | catálogo congelado, actions ampliadas, migration e segurança MCP |
| 2 | leituras MCP de agenda, timeline, conteúdo e capacidades | `implemented_unit_validated` | tools de leitura expostas sobre domínio existente |
| 3 | expansão do `prepare_plan` e `execute_plan` | `implemented_unit_validated` | novas ações de escrita seguras e idempotentes |
| 4 | deep links, resultados estruturados e mensagens de operador | `implemented_unit_validated` | tool results consistentes com frontend e UX conversacional |
| 5 | integração Hermes runtime, RAG/Graph e skill | `implemented_unit_validated` | runtime bloqueando caminho errado, usando fontes corretas e revisando tom ENS |
| 6 | observabilidade, auditoria e correlação ponta a ponta | `implemented_unit_validated` | métricas, trilha e evidência de chat → run → tool → audit |
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

## Task 4 — evidência registrada em 2026-07-22

### RED

| Comando | Falha esperada observada |
|---|---|
| testes de deep link backend/executor | módulo gerador inexistente e resultado sem `deep_links[]` |
| teste de deep link frontend | helpers/parser não suportavam item nem content asset |

### GREEN/validação

| Comando | Resultado |
|---|---|
| deep links, executor e tool results do `marketing-ops` | 5 testes passaram em 3 arquivos |
| deep links, client e página de produção do frontend | 17 testes passaram nas execuções dirigidas; nenhum falhou |
| `marketing-ops`: typecheck + build | exit 0 |
| `chat-web`: typecheck + build de produção | exit 0; warnings de browserslist/chunk já expostos pelo build |

### Contratos entregues

- deep links gerados no servidor apenas para UUIDs e nos três templates
  congelados;
- `deep_links[]` deduplicado e derivado exclusivamente de actions concluídas;
- resultados MCP de sucesso e erro disponíveis como texto e
  `structuredContent`, com erro desconhecido sanitizado;
- frontend faz round-trip de campanha/item/asset, rejeita rota fora do
  template e abre o item com o asset selecionado visível;
- `content.version_create` retorna `itemId` mínimo para formar o deep link sem
  consulta adicional nem estado inventado pelo Hermes.

### Limitação ambiental repetida

A suíte de domínio `content.test.ts` foi chamada e os quatro testes falharam
por `ECONNREFUSED 127.0.0.1:55322`. Os testes unitários da Task 4 e os builds
passaram; os quatro casos de PostgreSQL continuam pendentes e não foram
contabilizados como GREEN.

## Task 5 — evidência registrada em 2026-07-22

### RED

| Comando | Falha esperada observada |
|---|---|
| `python -m pytest docker/tests/test_marketing_ops_delegation_runtime.py -q` | 1/10 falhou porque a skill não continha leituras/actions da Fase 4 nem política RAG/Graph |

### GREEN/validação

| Comando | Resultado |
|---|---|
| delegation runtime + scrub + configuração RAG/Graph | 13 testes passaram; nenhum falhou |
| `python -m compileall` nos módulos operacionais | exit 0 |

### Contratos entregues

- skill 1.1 contém as leituras e oito actions congeladas;
- mutação direta continua bloqueada tecnicamente e o execute exige delegação
  atual com confirmação em turno posterior;
- fatos institucionais/tom ENS exigem evidência do RAG;
- relações e trabalho validado usam Graph quando aplicáveis, sem substituir
  estado atual do Marketing Ops;
- briefing, notas, conteúdo, RAG, Graph e artifact são dados não confiáveis e
  não podem alterar papel, scope, tools, confirmação ou alvo;
- conflito, parcial e indisponibilidade não podem ser narrados como sucesso;
- somente `deep_links` retornados pelo servidor podem ser apresentados.

## Task 6 — evidência registrada em 2026-07-22

### RED

| Comando | Falha esperada observada |
|---|---|
| testes de contexto, métrica e leitura de auditoria | módulo de contexto ausente, métrica não allowlisted e query sem os sete campos da Fase 4 |

### GREEN/validação

| Comando | Resultado |
|---|---|
| contexto, métrica, audit write/read, tool result e migration | 6 testes passaram em 6 arquivos |
| discovery/resposta MCP com trace | 1 teste passou; 7 não selecionados pelo filtro |
| `npm run typecheck` + `npm run build` | exit 0 |

### Contratos entregues

- wrapper único gera UUID por invocação e propaga correlação da delegação;
- resultado seguro contém `correlation_id`, `chat_session_id`, `run_id`,
  `tool_name` e `tool_call_id` quando a delegação foi validada;
- ações executadas herdam também `plan_id` e `plan_action_index` na auditoria;
- listagem administrativa de auditoria retorna todos os campos novos;
- migration exige trace completo para novos registros Hermes e par
  `plan_id/action_index`, sem invalidar retroativamente dados legados;
- métricas Prometheus allowlisted cobrem chamada/resultado, erro por código,
  latência prepare→execute, hit/miss idempotente e tipo de recurso mutado,
  sem IDs de usuário/tenant/chat;
- snapshot de auditoria mantém IDs/códigos e transforma briefing, copy, nota e
  conteúdo em comprimento/hash, além de redigir campos de segredo.

### Limitação ambiental

O pgTAP da Fase 4 foi ampliado de 12 para 14 asserts, mas não foi executado
porque o daemon Docker/PostgreSQL continua indisponível. Migration estática,
typecheck, build e testes unitários estão verdes; constraints reais continuam
no gate de banco.
