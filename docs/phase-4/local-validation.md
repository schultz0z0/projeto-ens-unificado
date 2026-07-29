# Validação local — Fase 4

- **Estado:** `partially_executed`
- **Base:** 2026-07-29
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
- [x] prompt injection sem ampliação de autoridade, comprovada em produção;
- [x] redaction de delegação e snapshots de auditoria validada unitariamente;
- [x] auditoria sem briefing, copy, nota ou conteúdo integral em teste unitário;
- [x] deep links validados em unit/component test para campanha, item e asset;
- [ ] briefing convertido em calendário/checklist após confirmação;
- [ ] resposta do chat convertida em versão vinculada;
- [ ] revisão pelo tom ENS fundamentada no RAG; fonte consultada, versão final pendente;
- [x] Graph usado em cenário relacional sem substituir estado transacional;
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

## Registro de endurecimento do classificador contextual — 2026-07-28

- após o deploy inicial da decisão contextual, o teste real preparou um plano,
  recebeu `vamos nessa` no turno posterior e não gravou dados: o runtime
  recusou `execute_plan_v1` por `confirmation_required`, preservando o
  fail-closed;
- os logs confirmaram a chamada do endpoint interno de decisão e uma resposta
  do modelo com 91 caracteres. Como o parser aceitava apenas um objeto JSON
  inteiro, a saída fora desse formato virou `clarify`; a Bridge, portanto,
  assinou corretamente sem `confirmation_intent`;
- foi solicitada ao próprio Hermes uma análise somente-leitura. Ela confirmou
  a matriz de diagnóstico: decisão `clarify`, perda na Bridge ou perda no
  transporte da delegação são hipóteses separáveis; a inspeção do código prova
  que a Bridge calcula a decisão antes de emitir a nova delegação, isolando o
  problema observado no contrato da resposta do classificador;
- RED: o teste do runtime falhou para a resposta prefixada de contrato e para
  a ausência de isolamento do prompt;
- GREEN: o classificador usa somente seu prompt efêmero, sem tools e sem
  persistência; responde pela linha fechada
  `NEXUS_MARKETING_OPS_DECISION: {"decision":"..."}`. O parser continua
  fail-closed para texto adicional ou enum desconhecido;
- observabilidade: o `hermes-api` agora registra apenas o enum da decisão e
  `output_contract=true|false`; mensagens, tokens de plano e delegações não
  entram no log;
- validação local: `python -m pytest
  services/hermes-runtime/docker/tests/test_marketing_ops_delegation_runtime.py
  -q` (**12 passed**), `python -m compileall -q` dos dois módulos alterados,
  `services/chat-bridge: npm test` (**86/86**) e `git diff --check` passaram.

O próximo gate é publicar **somente** `hermes-api` e `app-bridge`, iniciar uma
conversa nova e repetir primeiro o preview, depois `vamos nessa`/`pode ser` e
a matriz negativa. Se houver nova recusa, consultar o log sanitizado do Hermes
antes de qualquer mudança adicional.

## Registro de compatibilidade, skill e varredura — 2026-07-28

### RED real

| Alteração | Falha reproduzida antes da correção |
|---|---|
| action única como objeto tipado | `marketing_ops_prepare_plan_v1` recusou o payload com `-32602`, pois o schema esperava array |
| action única como string JSON | a string também foi recusada pelo schema antes de assinatura, execução ou persistência |
| intervalo de agenda | o log do smoke publicado registrou `invalid_type`/`invalid_format` para datas incompletas antes da terceira chamada válida |
| referências da skill | teste estático do runtime falhou porque `references/` e `templates/` não existiam |

### GREEN/validação executada

| Comando | Resultado |
|---|---|
| `services/marketing-ops: npm test -- src/mcp.test.ts -t "normalizes (the MiniMax item wrapper|a direct MiniMax action|a JSON-encoded MiniMax action) before validating a plan"` | **3 passed**, 8 não selecionados |
| `services/marketing-ops: npm run typecheck && npm run build` | exit 0 |
| `services/chat-bridge: npm test` | **86/86** |
| `services/hermes-runtime: python -m pytest docker/tests/test_marketing_ops_delegation_runtime.py -q` | **13/13** |
| `services/hermes-runtime: python -m compileall -q docker vendor/hermes-agent/agent` | exit 0 |
| `services/rag-mcp: npm test && npm run typecheck && npm run build` | **26/26**, exit 0, exit 0 |
| `services/graph-mcp: npm test && npm run typecheck && npm run build` | **18/18**, exit 0, exit 0 |
| `apps/chat-web`: cinco arquivos de teste F4 dirigidos | **22/22** |
| `apps/chat-web: npm run typecheck && npm run build` | exit 0; warnings preexistentes de Browserslist/chunk/import |
| gate de segurança do frontend com as variáveis de leitura anônima do `.env` raiz | RLS de app e RAG passou; scan de segredos e build passaram; lint tem 10 avisos sem erro |

### Resultado integral do Marketing Ops

`npm test` integral foi chamado uma vez. Casos unitários e estáticos passaram;
os casos de domínio/integração falharam todos pela mesma causa ambiental
`ECONNREFUSED 127.0.0.1:55322`, e os seis testes de gate de produção ficaram
skipped. O binário Docker não está instalado nesta estação, por isso não foi
possível subir o PostgreSQL/Supabase local. A suite não foi apontada ao banco
remoto, pois ela é mutável. Isso não é contabilizado como GREEN e será provado
na jornada real pós-deploy.

### Observação de segurança fora do escopo F4

O `npm audit --audit-level=high` do frontend reportou 16 vulnerabilidades
transitivas já presentes (14 altas, 2 moderadas), incluindo cadeias de
`brace-expansion`/ESLint, PostCSS e React Router. Não houve alteração
automática de dependências nesta fase, porque a correção sugerida inclui uma
atualização maior de ESLint. Isso deve ser tratado como débito de segurança do
produto, separado da validação funcional da Fase 4; não altera a superfície
MCP, a delegação ou o schema desta entrega.

## Registro do gate real e correção local — 2026-07-29

### Produção observada

| Caso | Resultado |
|---|---|
| leitura de campanhas + agenda | passou; tools operacionais corretas e nenhuma mutação |
| preview de campanha | passou; plano preparado e zero linhas com o nome de homologação no Supabase |
| `vamos nessa` | classificador retornou `approve`, mas após ~6,4 s; timeout da Bridge em 4 s converteu o turno em fail-closed |
| execução | bloqueada com `confirmation_required`; nenhuma persistência |
| skill ativa | cópia persistida `1.0.0`, não o pacote estruturado `1.2.0` |

O diagnóstico conversacional do Hermes sugeriu incorretamente uma confirmação
dupla. A inspeção de código e a correlação temporal dos logs provaram que o
contrato continua de confirmação única; a causa foi a expiração antecipada da
Bridge, seguida da prevalência independente da skill antiga no volume.

### RED → GREEN local

| Comando/teste | Resultado |
|---|---|
| teste novo do timeout antes da implementação | falhou: valor `undefined`, esperado `15000` |
| teste novo da skill persistida antes da implementação | falhou: Dockerfile não empacotava a cópia gerenciada |
| `services/chat-bridge: npm test` | **87/87** |
| runtime de delegação + instalação de skill | **14 passed, 1 skipped**; caso POSIX indisponível no Windows |
| `git diff --check` | exit 0 |

O binário Docker e o Bash não existem nesta estação, então o build da imagem e
o teste executável do entrypoint Linux continuam no gate VPS. O teste estático
prova o empacotamento/instalador, e o runbook exige validar `version: 1.2.0` e
os quatro arquivos auxiliares dentro do volume após a recriação.

## Registro pós-deploy do décimo release — 2026-07-29

| Verificação | Resultado |
|---|---|
| health de `hermes-api` e `app-bridge` | passou |
| timeout contextual | passou; classificação concluiu em ~8,6 s dentro dos 15 s |
| descoberta da skill | falhou; duas candidatas com o mesmo nome |
| preview | passou sem persistência |
| confirmação `vamos nessa` | `clarify`; execução bloqueada |
| Supabase pós-falha | zero campanha e zero auditoria para `HML F4 Gate 20260729-B` |

### RED → GREEN do décimo primeiro release

Os testes foram escritos e executados antes da implementação. Eles falharam
pela ausência do gate determinístico, do detector correto de contrato e do
destino categorizado do instalador.

| Comando | Resultado |
|---|---|
| `python -m pytest services/hermes-runtime/docker/tests/test_marketing_ops_delegation_runtime.py -q -k "unambiguous_confirmation_fast_path or confirmation_output_contract or operator_skill_has_loadable"` antes da correção | **3 failed**, falhas esperadas |
| mesmos contratos depois da correção | **4 passed**, 11 não selecionados |
| runtime dirigido + contrato compartilhado do instalador | **15 passed, 1 skipped** |
| `python -m compileall -q` dos dois módulos Hermes alterados | exit 0 |
| `git diff --check` | exit 0 |

O skip é exclusivamente o teste executável do shell POSIX, porque esta estação
Windows não possui Bash, WSL ou Docker. O teste está incluído e será exercitado
no ambiente Linux; o gate VPS também confere caminho canônico, ausência da
cópia raiz e pacote completo antes dos smokes de escrita.

## Decisão atual

Os gates locais aplicáveis de código, build, typecheck, lint dirigido, contrato
do runtime, deep links, contrato conversacional e E2E fake foram executados.
Continuam pendentes os gates que exigem banco/serviços reais ou a infraestrutura
final da VPS, inclusive a publicação pontual de `hermes-api` e
as jornadas de escrita com o classificador contextual endurecido.

## Registro pós-deploy do décimo primeiro release — 2026-07-29

| Verificação real | Resultado |
|---|---|
| health de `hermes-api` e `app-bridge` | passou |
| skill canônica | passou; uma cópia em `skills/marketing/marketing-ops-operator`, versão `1.2.0`, referências e template presentes |
| catálogo MCP | passou; 10 tools de Marketing Ops, sem mutações diretas legadas |
| leitura de campanhas/agenda | passou; 12 campanhas e agenda vazia na janela pedida |
| correlação com Supabase | passou; tenant `ens` também possui 12 campanhas |
| preview `HML F4 Final 20260729-A` | recusado com segurança; tool call registrada como `{}` e `actions` ausente |
| persistência após a falha | zero campanha, zero auditoria e zero idempotência para o nome de teste |

### RED → GREEN do décimo segundo release

| Comando/teste | Resultado |
|---|---|
| teste novo do schema visível antes da implementação | **1 failed**; `delegation_token` ainda era exigido do modelo |
| mesmo teste depois da implementação | **1 passed** |
| runtime dirigido completo | **16 passed, 1 skipped** |
| `python -m compileall -q` do runtime Hermes | exit 0 |
| `git diff --check` | exit 0 |
| `uv run --extra dev pytest tests/tools/test_mcp_tool.py::TestSchemaConversion -q` | **17 passed** no ambiente exato do `uv.lock` |

O patch não aceita plano vazio e não cria fallback de escrita. Ele corrige a
fronteira anterior ao servidor: campos efêmeros já vinculados pelo runtime
deixam de ser exigidos do modelo; `actions` continua obrigatório e validado
pelo contrato real do Marketing Ops.

## Registro do contrato de conteúdo da skill — 2026-07-29

O app real comprovou campanha e item da esteira, mas recusou o primeiro plano de
asset + versão porque a referência operacional da skill não continha o wire
shape completo. O domínio não foi alterado.

| Comando/teste | Resultado |
|---|---|
| regressão `contract_freezes_content_plan_wire_shape` antes da alteração | **1 failed**; `expected_item_version` ausente |
| mesma regressão após completar `mcp-contract.md` | **1 passed** |
| `python -m pytest services/hermes-runtime/docker/tests/test_marketing_ops_delegation_runtime.py -q` | **17 passed, 1 skipped** |

O pacote foi versionado como `1.2.1`. O skip continua sendo apenas o teste POSIX
indisponível nesta estação Windows. A prova final exige redeploy do
`hermes-api` e repetição do plano de conteúdo no ambiente publicado.

## Registro da leitura de versões para revisão ENS — 2026-07-29

| Verificação | Resultado |
|---|---|
| criação real do asset + versão 1 | passou |
| RAG institucional | passou |
| Graph de trabalho validado | passou; nenhum trabalho relacionado encontrado |
| leitura do corpo atual | falhou por ausência de `include_versions=true` na instrução |
| regressão antes da correção | **1 failed** |
| regressão depois da correção | **1 passed** |
| runtime dirigido completo | **18 passed, 1 skipped** |
| RBAC admin/manager/member | passou no app e logs |
| prompt injection/cross-tenant/sem confirmação | recusado; zero persistência |

O pacote `1.2.2` aguarda redeploy pontual de `hermes-api`. Depois dele, somente
a criação da versão 2 precisa ser repetida.
