# Validação local — Fase 4

- **Estado:** `partially_executed`
- **Base:** 2026-07-28
- **Branch:** `main`
- **Política:** registrar apenas gates realmente executados

## Pré-condições planejadas

- `marketing-ops` com catálogo MCP atualizado e testes de contrato;
- runtime Hermes com skill e guardrails alinhados ao novo catálogo;
- Bridge configurando delegação curta e confirmação contextual em turno posterior;
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

## Registro de validação real e correção do contrato de plano — 2026-07-28

- após o terceiro hotfix ser publicado, a leitura real de campanhas e agenda
  no chat de produção foi concluída: o Hermes listou 13 campanhas, consultou a
  agenda de 03/08–09/08 e informou ausência de itens no período; nenhuma
  mutação foi solicitada ou persistida nesse smoke;
- essa evidência exercita `app -> bridge -> Hermes -> MCP Marketing Ops ->
  app` e confirma, em produção, o tratamento de `CallToolResult.is_error`;
- um pedido de preview contendo nome, objetivo, público, canal, briefing e
  datas revelou uma falha distinta: o modelo montou um
  `campaign.create_draft` com campos que o schema estrito não aceita. O
  Marketing Ops recusou o prepare, não emitiu plano assinado e não criou
  objeto;
- RED: `services/chat-bridge/test/hermes-payloads.test.js` passou a exigir que
  o contrato do operador declare a forma estrita de `campaign.create_draft` e
  a separação entre criação e `campaign.update`; o teste falhou antes da
  alteração pelo texto ausente;
- GREEN: o contrato injetado pela Bridge e a skill `marketing-ops-operator`
  agora instruem criação apenas com `type`, `ref`, `name` e `course_slug`
  opcional; objetivo, público, canais, briefing, notas e datas exigem leitura,
  novo plano de `campaign.update` e nova confirmação após a campanha existir;
- validação: teste dirigido GREEN e `services/chat-bridge: npm test` com
  **85/85** testes aprovados;
- próximo gate: publicar somente a nova imagem `app-bridge`, repetir o preview
  de criação estrita em produção e, antes de qualquer persistência, obter uma
  confirmação explícita para o objeto de teste exato.

## Registro de correção do payload de plano — 2026-07-28

- o quarto hotfix da Bridge foi publicado e o preview estrito foi repetido no
  app real; o comportamento continuou fail-closed, sem criação nem alteração;
- a sessão Hermes e o log do serviço confirmaram a causa exata: a chamada de
  `marketing_ops_prepare_plan_v1` omitiu `actions`, e o MCP devolveu
  `expected array, received undefined` para esse campo;
- RED: o contrato conversacional da Bridge passou a exigir, em teste, que o
  prepare envie `actions` como uma lista; o teste falhou pelo texto ausente;
- GREEN: a instrução compartilhada e a skill do operador agora exigem o array
  `actions` e exemplificam o rascunho como o único elemento dessa lista;
- validação: teste dirigido GREEN e `services/chat-bridge: npm test` com
  **85/85** testes aprovados; `git diff --check` passou;
- próximo gate: publicar o quinto hotfix, novamente limitado a `app-bridge`,
  e repetir o mesmo preview sem persistência.

## Registro de compatibilidade MiniMax no schema MCP — 2026-07-28

- o quinto hotfix foi publicado e o preview estrito foi repetido no app real;
  a sessão Hermes confirmou que o MiniMax não enviou o array JSON esperado:
  transformou `actions: [{...}]` em `actions: { item: {...} }` e, em novas
  tentativas, em string JSON; nenhuma tentativa foi assinada, executada ou
  persistida;
- o MCP permaneceu fail-closed e retornou `expected array, received object` ou
  `string`; a sessão foi encerrada sem plano pendente;
- RED: o teste `normalizes the MiniMax item wrapper before validating a plan`
  falhou no schema MCP, antes de verificar a delegação;
- GREEN: somente o envelope exato `{ item: action | action[] }` agora é
  normalizado para array. Arrays nativos e qualquer outro formato seguem para o
  schema estrito das oito actions, sem afrouxar campos ou autorização;
- validação local: teste dirigido passou; `npm run typecheck`, `npm run build`
  e `git diff --check` passaram em `services/marketing-ops`;
- próximo gate: rebuild sem cache e recriação de `marketing-ops`, repetir o
  preview sem persistência e só então continuar para criação confirmada.

## Registro de confirmação conversacional — 2026-07-28

- após o rebuild do `marketing-ops`, o preview real passou: o plano de criação
  estrita foi preparado, exibido no app e não persistiu dados;
- a confirmação seguinte, em turno posterior, foi corretamente encaminhada ao
  `execute_plan_v1`, mas o backend a recusou com `confirmation_required`; a
  mensagem continha o nome do rascunho e `exatamente como apresentado`, portanto
  era inequívoca e não alterava o plano;
- a sessão Hermes confirmou que a Bridge havia assinado a delegação sem
  `confirmation_intent`: o classificador aceitava apenas frases completas de
  uma allowlist e rejeitava a confirmação contextual;
- o detector literal planejado foi substituído antes de deploy pela decisão
  contextual aprovada. O runtime recebe apenas sessão e mensagem, detecta plano
  pendente, usa uma chamada sem tools/sem persistência e devolve enum fechado;
  a Bridge só transforma `approve` em `confirmation_intent=true`. Sem plano,
  não há chamada de modelo; timeout, erro ou saída inválida resultam em
  `clarify` e nunca em execução;
- RED: os testes do runtime e da Bridge falharam sem a rota/classificação;
  GREEN: o teste dirigido do runtime e `compileall` passaram; o contrato de
  payload passou com 20 testes e `services/chat-bridge: npm test` com **86/86**;
  `git diff --check` passou;
- próximo gate: rebuild sem cache e recriação de `hermes-api` e `app-bridge`,
  repetir preview e a matriz de aprovação, pergunta, rejeição e revisão antes
  de continuar a criação do dado de teste.

## Decisão atual

Os gates locais aplicáveis de código, build, typecheck, lint dirigido, contrato
do runtime, deep links, contrato conversacional e E2E fake foram executados.
Continuam pendentes os gates que exigem banco/serviços reais ou a infraestrutura
final da VPS, inclusive a publicação pontual de `hermes-api` e `app-bridge` e
as jornadas de escrita com confirmação contextual.
