# Progresso de implementação — Fase 4

- **Estado:** `corrective_fix_ready_for_vps_revalidation`
- **Progresso de implementação:** 100%
- **Snapshot reconciliado:** 2026-07-29
- **Branch única:** `main`
- **Próximo gate:** deploy corretivo de `hermes-api`, homologação
  VPS real e aceite final do usuário

## Planejamento por task

| Task | Escopo | Estado | Saída esperada |
|---|---|---|---|
| 1 | contratos MCP, schema e baseline de auditoria | `implemented_unit_validated` | catálogo congelado, actions ampliadas, migration e segurança MCP |
| 2 | leituras MCP de agenda, timeline, conteúdo e capacidades | `implemented_unit_validated` | tools de leitura expostas sobre domínio existente |
| 3 | expansão do `prepare_plan` e `execute_plan` | `implemented_unit_validated` | novas ações de escrita seguras e idempotentes |
| 4 | deep links, resultados estruturados e mensagens de operador | `implemented_unit_validated` | tool results consistentes com frontend e UX conversacional |
| 5 | integração Hermes runtime, RAG/Graph e skill | `implemented_unit_validated` | runtime bloqueando caminho errado, usando fontes corretas e revisando tom ENS |
| 6 | observabilidade, auditoria e correlação ponta a ponta | `implemented_unit_validated` | métricas, trilha e evidência de chat → run → tool → audit |
| 7 | frontend/bridge/E2E e falhas controladas | `implemented_local_e2e_validated` | jornada integrada controlada com erro sem falso sucesso |
| 8 | gates locais, operação, VPS e handoff | `completed_pending_vps_gate` | pacote documental reconciliado e fase pronta para homologação |

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

A fase não avança para `implemented_pending_vps_validation` apenas por existir
documentação. Este estado só é válido quando houver código real, testes locais
aplicáveis, schema remoto reconciliado e pacote operacional pronto para
homologação.

## Bloqueadores prévios conhecidos

- nenhuma decisão de produto permanece aberta; os contratos estão congelados em
  `design.md`;
- o bloqueador residual é apenas ambiental/operacional: falta executar a
  homologação real na VPS com banco/serviços finais.

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

- skill 1.2 contém as leituras e oito actions congeladas e separa contrato,
  segurança conversacional, diagnóstico e preview em referências carregáveis;
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

## Task 7 — evidência registrada em 2026-07-22

### RED

| Comando | Falha esperada observada |
|---|---|
| Playwright dirigido do operador Hermes | o cenário inicial não conseguia abrir o deep link do Marketing Ops porque as rotas estavam desabilitadas pelas flags públicas e o assert usava um alvo de UI instável |

### GREEN/validação

| Comando | Resultado |
|---|---|
| Playwright E2E fake do operador Hermes | 2 cenários passaram: confirmação antes da execução e indisponibilidade sem falso sucesso |
| testes dirigidos de `ChatMessageContent` e deep links | navegação SPA validada para deep link válido e rota malformada bloqueada |
| `chat-web`: `npm run typecheck` + `npm run build` | exit 0 |
| `chat-bridge`: `npm test` | contrato do operador Hermes verde |
| `marketing-ops`: `npm run typecheck` + `npm run build` | exit 0 |

### Contratos entregues

- stack fake controlada para Supabase, Bridge e Marketing Ops em Playwright;
- confirmação explícita em mensagem posterior antes de qualquer deep link de
  conclusão;
- deep link retornado pelo chat abre o item correto do workspace de produção
  com `contentAssetId` selecionado;
- indisponibilidade do Marketing Ops é comunicada sem falso sucesso e sem link
  inventado;
- flags públicas do Marketing Ops no Playwright foram alinhadas ao roteamento
  real do app.

## Task 8 — evidência registrada em 2026-07-22

### Escopo concluído

- README, progresso, rastreabilidade, riscos, gate local, runbook, rollback,
  deploy Supabase, handoff e checklist VPS reconciliados com o estado real;
- migration remota da Fase 4 aplicada no projeto Supabase conectado e histórico
  reparado/alinhado pela CLI em 2026-07-28;
- instruções operacionais da VPS alinhadas ao fluxo real do monorepo com
  `docker compose` usando `docker-compose.yml` e `docker-compose.prod.yml`.

### Evidência operacional

| Evidência | Resultado |
|---|---|
| `supabase_apply_migration` na migration `20260722130000_phase_4_hermes_operator_audit.sql` | aplicado com sucesso no projeto remoto conectado |
| verificação do schema remoto pelo MCP Supabase | colunas `operator_origin`, `chat_session_id`, `run_id`, `tool_name`, `tool_call_id`, `plan_id` e `plan_action_index` confirmadas |
| `supabase migration repair` | entrada órfã `20260722183310` revertida e `20260722130000` marcada como aplicada; listagem local/remota alinhada |
| regressões pré-deploy independentes de banco | 12 testes Marketing Ops, 85 Bridge, 12 frontend e 13 Hermes; typecheck/build aplicáveis verdes |
| pacote documental da fase | reconciliado para refletir implementação local e gate VPS pendente |

### Limitação residual

O MCP PostgreSQL read-only não refletiu as colunas novas do mesmo modo que o
MCP integrado do Supabase. A verificação canônica deste snapshot ficou no
`supabase_get_tables`, e a repetição do check em produção continua no gate VPS.

Na regressão de 2026-07-28, os cinco casos MCP que exigem PostgreSQL ficaram
bloqueados por `ECONNREFUSED 127.0.0.1:55322`; a verificação JWT equivalente
passou isoladamente. O bloqueio é ambiental e está rastreado em
`local-validation.md`, sem promover os cenários ao estado verde.

O primeiro deploy VPS revelou três incompatibilidades com a API HTTP atual do
SDK MCP no Hermes: a detecção exigia o símbolo legado, o transporte podia
retornar dois streams e o resultado da tool instalada expõe `is_error` em vez
de `isError`. Todas tiveram RED/GREEN; a suíte dirigida passou com 19 testes e
`compileall`. O rebuild foi feito e uma leitura real de campanhas/agenda no
chat concluiu com sucesso, exercitando a tool MCP em produção.

Esse smoke revelou um quarto ponto de integração, agora na composição do plano
pela Bridge: `campaign.create_draft` é estrita e não aceita os campos de
enriquecimento de campanha. O erro foi corretamente recusado pelo Marketing
Ops, sem plano assinado nem persistência. A Bridge e a skill do operador foram
ajustadas por RED/GREEN para explicitar a criação estrita e o segundo ciclo de
leitura/plano/confirmação para `campaign.update`; o teste dirigido e a suíte
integral da Bridge passaram com 85/85. A correção foi publicada, mas a repetição
real revelou um quinto ponto: o modelo chamou `prepare_plan` sem o campo
obrigatório `actions`. O MCP recusou com `expected array, received undefined`,
novamente sem plano assinado ou persistência.

O quinto hotfix foi publicado, mas o novo preview provou uma incompatibilidade
de serialização do MiniMax: em vez de `actions: [{...}]`, o provedor enviou o
envelope `actions: { item: {...} }` e também tentou uma string JSON. O MCP
recusou corretamente ambos os formatos e não houve plano ou persistência. O
sexto hotfix fica no limite MCP: normaliza somente esse envelope `item` para
array, antes do mesmo schema estrito e da verificação de delegação. O RED foi
reproduzido no teste MCP e o GREEN, typecheck e build passaram. Ele requer
rebuild sem cache de `marketing-ops` antes da repetição real.

O preview repetido passou no app real, sem persistência prematura. O execute
posterior, porém, foi recusado porque a confirmação real incluía o nome do
rascunho e o classificador da Bridge só aceitava frases exatamente iguais à sua
allowlist. O sétimo hotfix de frases foi descartado antes de publicação em favor
da decisão contextual aprovada: o `hermes-api` verifica se há plano pendente e,
somente nesse caso, classifica a resposta em `approve`, `reject`, `revise` ou
`clarify` sem tools, sem persistir sessão e com uma única iteração; sem plano,
retorna `none` sem chamar modelo. A Bridge registra somente o enum e emite
`confirmation_intent=true` exclusivamente para `approve`. Timeout, erro ou
schema inválido viram `clarify`.

RED: os testes estáticos do runtime e da Bridge falharam antes de existir a rota
interna/classificação. GREEN: o teste dirigido do runtime, `compileall`, o teste
de payload e a suíte completa da Bridge passaram com 86/86. O deploy exige
rebuild sem cache e recriação de **`hermes-api` e `app-bridge`**, seguido da
matriz manual contextual; nenhum dado novo foi persistido por essa correção.

O primeiro deploy dessa correção confirmou que a rota foi chamada, mas uma
resposta de confirmação natural foi recusada pelo parser JSON estrito. A
evidência do log e a inspeção do fluxo mostram que a Bridge já calcula a
decisão antes de assinar a delegação; o classificador é o ponto corrigido. O
oitavo hotfix passa a executá-lo com prompt exclusivo, sem persona
conversacional, tools ou persistência, exige a linha fechada
`NEXUS_MARKETING_OPS_DECISION: {"decision":"..."}` e registra somente o enum
e a aderência ao contrato. RED reproduziu a recusa do contrato prefixado e a
ausência de isolamento; GREEN: runtime dirigido **12/12**, `compileall`,
`git diff --check` e Bridge **86/86**. Requer novo rebuild pontual de
`hermes-api` e `app-bridge`; não altera schema, migration ou domínio.

## Registro de varredura e nono release candidato — 2026-07-28

### Correções incorporadas

- o log de produção mostrou que o provedor pode serializar uma única action de
  `prepare_plan` como objeto tipado direto ou como JSON codificado, além do
  envelope `{ item: ... }` já conhecido. O normalizador do MCP agora aceita
  somente esses três formatos do provedor e os converte para array antes da
  mesma validação estrita de actions, delegação e confirmação;
- o primeiro smoke publicado de agenda concluiu a leitura, mas registrou duas
  recusas de schema antes da autocorreção porque `from` e `to` exigem instantes
  ISO 8601 completos com offset. A instrução compartilhada da Bridge e a
  referência da skill agora tornam esse contrato obrigatório;
- a skill `marketing-ops-operator` foi promovida a pacote estruturado: fonte
  principal curta, referências carregáveis de contrato MCP, segurança de
  conversa e diagnóstico, mais template de preview humano. A imagem que a
  contém é `hermes-api`.

### RED → GREEN e validação

| Escopo | RED observado | GREEN/resultado |
|---|---|---|
| action MCP direta | objeto tipado retornou `-32602`/schema antes de qualquer assinatura | teste de normalização passa e o payload chega à rejeição esperada de delegação inválida, provando que ultrapassou o schema |
| action MCP JSON | string JSON retornou `-32602`/schema antes de qualquer assinatura | teste de normalização passa sob a mesma validação estrita |
| contrato da agenda | teste da Bridge falhou antes de exigir ISO 8601 com offset | `services/chat-bridge: npm test` **86/86** após a regra |
| skill estruturada | teste estático falhou porque as referências não existiam | referências e template carregáveis; runtime **13/13** e `compileall` verdes |
| Marketing Ops | typecheck + build | exit 0; três testes dirigidos de normalização passaram |
| RAG MCP | testes + typecheck + build | **26/26**, exit 0, exit 0 |
| Graph MCP | testes + typecheck + build | **18/18**, exit 0, exit 0 |
| frontend | testes dirigidos, typecheck e build | **22/22**, exit 0, exit 0 |
| segurança frontend | RLS app/RAG, scan, lint, build e audit | RLS anon de app e RAG passou; lint sem erro (10 avisos preexistentes); audit encontrou dependências preexistentes com vulnerabilidades, fora do código F4 |

### Limite ambiental e de promoção

`services/marketing-ops: npm test` foi executado integralmente. Os testes sem
banco passaram, e os testes de integração falharam exclusivamente ao abrir o
PostgreSQL local ausente em `127.0.0.1:55322`; seis gates de produção ficaram
skipped por configuração. Docker também não existe nesta estação, portanto não
há como iniciar um banco descartável local. A suite não foi redirecionada para
o Supabase de produção porque ela cria, atualiza e limpa registros. Esses
cenários permanecem no gate manual real pós-deploy.

O próximo passo é publicar **`marketing-ops`**, **`app-bridge`** e
**`hermes-api`** a partir deste release candidato, confirmar a carga da skill
no runtime e repetir a matriz de escrita em produção. Nenhum estado acima
autoriza promover a fase antes dessa evidência.

## Décimo release candidato — confirmação e skill persistida — 2026-07-29

### Evidência real antes da correção

- a consulta somente leitura no app real passou: o Hermes chamou a listagem de
  campanhas e a agenda operacional e respondeu sem preparar plano;
- o preview de `HML F4 Final 20260729-A` chamou `skill_view` e
  `marketing_ops_prepare_plan_v1`; a consulta direta ao Supabase confirmou
  zero campanhas com esse nome antes e depois do preview;
- `vamos nessa` foi classificado como `approve` com contrato de saída válido,
  mas a classificação levou cerca de 6,4 segundos e a Bridge encerrava a
  espera em 4 segundos. Ela prosseguiu em fail-closed como `clarify`, assinou a
  delegação sem `confirmation_intent` e o runtime bloqueou a execução com
  `confirmation_required`;
- nenhuma campanha foi persistida pelo fluxo recusado;
- o catálogo de skills do Hermes mostrou `marketing-ops-operator` ativa, porém
  o editor revelou a cópia persistida `1.0.0`, enquanto a imagem fonte contém
  o pacote `1.2.0`. O instalador de skills gerenciadas não sincronizava a cópia
  de Marketing Ops, que continuava prevalecendo.

### Causas e correções

1. `MARKETING_OPS_DECISION_TIMEOUT_MS` passa a ter default de 15 segundos,
   limite configurável entre 1 e 60 segundos e propagação pelo Compose. A
   confirmação continua sendo única; timeout, erro ou resposta inválida
   permanecem fail-closed como `clarify`.
2. A imagem `hermes-api` passa a copiar o pacote
   `marketing-ops-operator` para `/opt/nexus-skills`, e o entrypoint substitui
   atomicamente a cópia persistida em `/opt/data/skills` e nos perfis. Skills
   do usuário fora da lista gerenciada continuam preservadas.

### RED → GREEN

| Escopo | RED observado | GREEN/resultado |
|---|---|---|
| timeout contextual | configuração não expunha timeout e o teste recebeu `undefined` | default `15000`, override validado e Bridge usa o valor |
| skill persistida | teste não encontrou cópia/instalação gerenciada do pacote | Dockerfile e instalador incluem `marketing-ops-operator` |
| Bridge integral | regressão após a correção | **87/87** testes passaram |
| runtime dirigido | regressão da delegação e instalação | **14 passed, 1 skipped**; skip POSIX esperado no Windows |
| higiene do diff | `git diff --check` | exit 0 |

O gate real permanece aberto até reconstruir e recriar `app-bridge` e
`hermes-api`, confirmar a skill `1.2.0` no volume e repetir a matriz completa.

## Décimo primeiro release candidato — resolução canônica e gate estável — 2026-07-29

### Evidência real depois do décimo release

- `hermes-api` e `app-bridge` ficaram healthy e a classificação terminou em
  aproximadamente 8,6 segundos, provando que o novo timeout de 15 segundos foi
  propagado;
- o loader registrou colisão entre
  `/opt/data/skills/marketing-ops-operator/SKILL.md` e
  `/opt/data/skills/marketing/marketing-ops-operator/SKILL.md`; ao receber o
  caminho explícito, `skill_view` carregou a cópia categorizada histórica;
- o preview de `HML F4 Gate 20260729-B` não persistiu dados;
- `vamos nessa` foi classificado como `clarify`; a delegação permaneceu sem
  autorização e o executor bloqueou as tentativas com
  `confirmation_required`;
- a consulta direta ao Supabase comprovou `campaign_count=0` e
  `audit_count=0`, mantendo o fail-closed sem escrita nem auditoria falsa.

### Causas e correções

1. O instalador gerenciado ignorava a categoria original da skill e criava uma
   segunda candidata na raiz. Ele agora atualiza atomicamente
   `skills/marketing/marketing-ops-operator` e remove somente o caminho
   gerenciado obsoleto `skills/marketing-ops-operator`, tanto no home padrão
   quanto nos perfis.
2. Respostas curtas, completas e inequivocamente afirmativas ou negativas eram
   delegadas ao modelo classificador, introduzindo não determinância em um gate
   de segurança. O runtime agora decide localmente apenas esse subconjunto
   fechado. Perguntas, ressalvas, alterações e frases não reconhecidas
   continuam usando histórico + modelo; erro ou contrato inválido continua
   resultando em `clarify`.
3. O campo sanitizado `output_contract` agora mede todas as formas JSON fechadas
   aceitas pelo parser, e o log informa `source=deterministic|model` sem expor a
   mensagem humana, plano ou tokens.

### RED → GREEN

| Escopo | RED observado | GREEN/resultado |
|---|---|---|
| resposta inequívoca | funções de decisão local ausentes | `vamos nessa`, `pode ser` e equivalentes completos aprovam; perguntas e ressalvas não entram no fast path |
| contrato observável | log considerava somente a variante prefixada | JSON fechado prefixado ou puro é reconhecido; texto extra permanece inválido |
| instalação canônica | teste estático encontrou destino achatado | mapping aponta para `marketing/marketing-ops-operator` e limpeza segura da raiz |
| runtime dirigido | três testes falharam antes da implementação | **15 passed, 1 skipped**; skip é o entrypoint POSIX indisponível no Windows |
| sintaxe Python | `compileall` | exit 0 |
| higiene do diff | `git diff --check` | exit 0 |

O próximo gate requer rebuild sem cache e recriação somente de `hermes-api`.
Depois, o dashboard `/skills` e `/files`, o filesystem do container, o log
sanitizado, o app real e o Supabase devem provar uma única skill, confirmação
única, escrita correta, auditoria e deep link.

## Decisão atual

O escopo técnico e documental da Fase 4 está concluído. A promoção final depende
do deploy pontual de `hermes-api` e da homologação real na VPS,
com banco e serviços finais; nenhuma mudança de domínio ou migration foi
introduzida por esta correção.
