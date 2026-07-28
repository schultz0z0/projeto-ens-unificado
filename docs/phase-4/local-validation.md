# Validação local — Fase 4

- **Estado:** `partially_executed`
- **Base:** 2026-07-28
- **Branch:** `main`
- **Política:** registrar apenas gates realmente executados

## Pré-condições planejadas

- `marketing-ops` com catálogo MCP atualizado e testes de contrato;
- runtime Hermes com skill e guardrails alinhados ao novo catálogo;
- Bridge configurando delegação curta e confirmação explícita;
- frontend apto a abrir deep links e mostrar o objeto criado/alterado.

## Checklist do gate local

- [x] contratos MCP validados e documentados (Task 1, testes unitários);
- [x] catálogo sem tools diretas legadas de mutação (Task 1, discovery unitário);
- [x] catálogo de leitura da Task 2 e capacidades contextuais validados
  unitariamente;
- [ ] migration aplicada em banco limpo e sobre baseline existente;
- [x] testes unitários de domínio e executor do plano verdes;
- [x] testes dirigidos do runtime Hermes verdes;
- [x] build, lint e typecheck aplicáveis verdes (`marketing-ops` e `chat-web`
  com build/typecheck verdes; lint do frontend sem erro novo);
- [x] E2E `frontend -> bridge -> Hermes -> MCP -> marketing-ops -> frontend`
  verde em stack fake/controlada do Playwright;
- [ ] retry idempotente sem duplicidade;
- [ ] conflito de versão com nova consulta e nova confirmação;
- [x] mutações diretas bloqueadas no runtime em teste;
- [ ] tenant/papel forjados rejeitados;
- [x] delegação expirada/reutilizada rejeitada em testes dirigidos de token;
- [x] rate limit por ator e tool validado unitariamente;
- [ ] prompt injection sem ampliação de autoridade;
- [x] redaction de delegação e snapshots de auditoria validada unitariamente;
- [x] auditoria sem briefing, copy, nota ou conteúdo integral em teste unitário;
- [x] deep links validados em unit/component test para campanha, item e asset;
- [ ] briefing convertido em calendário/checklist após confirmação;
- [ ] resposta do chat convertida em versão vinculada;
- [ ] revisão pelo tom ENS fundamentada no RAG;
- [ ] Graph usado em cenário relacional sem substituir estado transacional;
- [x] indisponibilidade comunicada sem falso sucesso;
- [ ] serviço reiniciado sem perder dados/auditoria;
- [ ] backup e rollback validados ou marcados não aplicáveis com justificativa.

## Evidências a registrar quando a execução começar

- comandos RED/GREEN por task;
- arquivos de teste realmente executados;
- falhas observadas e correções aplicadas;
- outputs resumidos, nunca secrets ou tokens.

## Registro Task 1 — 2026-07-22

- RED/GREEN detalhado em `implementation-progress.md`;
- 10 testes unitários dirigidos passaram;
- build e typecheck do `marketing-ops` passaram;
- pgTAP/reset/lint de banco bloqueados localmente porque Docker não está
  instalado; nenhum desses gates foi marcado como executado.

## Registro Task 2 — 2026-07-22

- discovery MCP e derivação de capacidades: 2 testes verdes;
- build e typecheck do `marketing-ops`: verdes após a implementação;
- consultas reutilizam os domínios das Fases 2–3 e suas transações com ator/RLS;
- integração real com PostgreSQL continua pendente pelo mesmo bloqueio de
  Docker registrado na Task 1.

## Registro Task 3 — 2026-07-22

- 12/12 testes passaram nas suítes de contratos, token, executor,
  idempotência e append de notas;
- build e typecheck do `marketing-ops` passaram após o GREEN;
- atomicidade real, RLS e replay contra PostgreSQL permanecem no gate de banco
  pendente; o comportamento de orquestração foi validado com dependências
  controladas.

## Registro Task 4 — 2026-07-22

- 5 testes backend e 17 testes frontend passaram nas execuções dirigidas;
- typecheck/build de `marketing-ops` e `chat-web` passaram;
- página de produção rejeita rota inválida e evidencia o content asset do
  parâmetro congelado `contentAssetId`;
- os 4 testes de conteúdo dependentes do banco falharam somente por
  `ECONNREFUSED :55322` e permanecem pendentes.

## Registro Task 5 — 2026-07-22

- 13 testes do runtime, scrub de credenciais e configuração RAG/Graph passaram;
- módulos Python operacionais passaram em `compileall`;
- confirmação em turno posterior, binding de token atual e bloqueio das tools
  diretas permanecem cobertos;
- o teste conversacional golden com serviços reais continua reservado ao E2E.

## Registro Task 6 — 2026-07-22

- 7 testes dirigidos de contexto, métricas, auditoria, migration e resposta MCP
  passaram;
- build/typecheck do `marketing-ops` passaram;
- pgTAP contém 14 asserts, porém segue não executado por ausência de Docker;
- métricas não carregam IDs de usuário, tenant, chat ou objeto como labels.

## Registro Task 7 — 2026-07-22

- o novo E2E fake do operador Hermes passou com dois cenários no Playwright:
  confirmação em turno posterior e indisponibilidade sem falso sucesso;
- `ChatMessageContent.test.tsx` e `deepLinks.test.ts` validaram a navegação SPA
  para o deep link retornado pelo servidor e o bloqueio de links malformados;
- `chat-web` passou em typecheck/build e `chat-bridge` manteve o contrato do
  operador Hermes verde;
- a integração completa com banco/serviços reais continua reservada ao gate VPS,
  porque a stack local não possui Docker/PostgreSQL.

## Registro Task 8 — 2026-07-22

- a migration
  `apps/chat-web/supabase/migrations/20260722130000_phase_4_hermes_operator_audit.sql`
  foi aplicada no Supabase remoto via MCP e teve as colunas novas confirmadas;
- o pacote documental da Fase 4 foi reconciliado com o estado real de código,
  testes aplicáveis e limitações ambientais;
- runbook, rollback e checklist VPS passaram a refletir o fluxo operacional do
  monorepo já usado em produção (`docker compose` com os arquivos base e prod).

## Registro de pré-deploy — 2026-07-28

- a Supabase CLI autenticada confirmou desvio somente no histórico remoto da
  migration da Fase 4; nenhuma divergência de schema ou dados foi encontrada;
- a entrada remota órfã foi revertida e `20260722130000` ficou alinhada entre
  migration local e remota;
- os gates que exigem VPS, serviços reais, retry, conflito e indisponibilidade
  continuam pendentes e não foram promovidos por esta evidência.

## Registro de regressões pré-deploy — 2026-07-28

| Comando | Resultado |
|---|---|
| `services/marketing-ops`: contratos, executor, deep links, contexto, resultados, rate limit e migration estática | 12 testes passaram |
| `services/marketing-ops`: `npm run typecheck && npm run build` | exit 0 |
| `services/chat-bridge`: `npm test` | 85 testes passaram |
| `apps/chat-web`: deep links, conteúdo de chat e páginas de produção | 12 testes passaram |
| `apps/chat-web`: `npm run typecheck && npm run build` | exit 0; somente avisos preexistentes de Browserslist, chunk e import dinâmico/estático |
| `services/hermes-runtime`: testes de delegação, scrub e configuração RAG/Graph | 13 testes passaram |
| `services/hermes-runtime`: `python -m compileall -q docker vendor/hermes-agent/agent` | exit 0 |

### Limitação confirmada

- `src/mcp.test.ts` do `marketing-ops` voltou a falhar somente nos cinco casos
  que alcançam `resolveActor()`/PostgreSQL: `ECONNREFUSED 127.0.0.1:55322`.
  Uma assinatura e verificação JWT com os mesmos algoritmos, emissor, público,
  claims e janela temporal passou isoladamente; portanto não há regressão de
  delegação a corrigir neste snapshot.
- Docker não está disponível nesta máquina, logo não é possível iniciar o
  Supabase local nem converter este bloqueio ambiental em um resultado verde
  artificial. Os cinco cenários seguem no gate VPS real.

## Registro de correção do runtime MCP — 2026-07-28

- o primeiro deploy VPS confirmou health dos serviços, mas Hermes não conectou
  aos MCPs HTTP porque `tools/mcp_tool.py` exigia o símbolo legado
  `streamablehttp_client`, mesmo quando a API atual `streamable_http_client`
  estava instalada;
- RED: `docker/tests/test_mcp_http_sdk_compat.py` falhou, reproduzindo a
  detecção incorreta da API atual;
- GREEN: a API atual agora também marca `_MCP_HTTP_AVAILABLE=true`;
- a primeira correção foi publicada, mas o teste real na VPS revelou a segunda
  incompatibilidade: a API atual retornou dois streams e o runtime tentava
  desempacotar três valores (`not enough values to unpack (expected 3, got 2)`);
- RED: o novo teste de regressão para o retorno de dois streams falhou pelo
  desempacotamento rígido;
- GREEN: o caminho da API atual consome os dois streams necessários e tolera o
  terceiro valor das versões anteriores;
- o primeiro smoke conversacional em produção alcançou o Marketing Ops, mas a
  execução da tool falhou porque o `CallToolResult` instalado expõe
  `is_error`, enquanto o runtime acessava somente `isError`;
- RED: o novo teste de regressão para a flag snake_case falhou pelo atributo
  ausente observado no log real;
- GREEN: o handler compartilhado aceita `isError` e `is_error`;
- validação: a suíte dirigida atualizada passou com 19 testes e `compileall`
  passou;
- o gate VPS permanece pendente até um terceiro rebuild sem cache de
  `hermes-api` e `hermes-kanban`, novo smoke de leitura que invoque uma tool
  MCP e as jornadas reais restantes.

## Decisão atual

Os gates locais aplicáveis de código, build, typecheck, lint dirigido, contrato
do runtime, deep links e E2E fake foram executados. Continuam pendentes apenas
os gates que exigem banco/serviços reais ou a infraestrutura final da VPS.
