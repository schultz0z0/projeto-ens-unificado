# Validação local parcial da Fase 2

- **Estado:** `task_11_implemented_pending_vps_validation`
- **Ambiente da evidência histórica:** Windows, PowerShell, Git Bash, Docker Desktop e Supabase CLI local no computador anterior
- **Data:** 2026-07-14
- **Código do baseline histórico:** `1a49c4d` e ancestrais da Fase 2
- **Correção da Task 2:** `c921294`
- **Último código da fase:** `df4903b`

## Evidência concluída

| Gate | Resultado |
|---|---|
| Supabase local | portas `55320–55329`; API `55321`; PostgreSQL `55322` |
| Reset e seed | exit code 0; migrations e fixtures aplicadas |
| pgTAP da Task 2 | 2 arquivos, 100 testes (`32 + 68`), aprovados |
| pgTAP completo | 4 arquivos, 197 testes, aprovados |
| DB lint | `results=[]`; zero erro |
| Advisors | 81 warnings preexistentes; zero achado nos objetos novos/alterados da Task 2 |
| Schema diff | vazio; banco reproduzível pelas migrations |
| Harness oficial de concorrência | PASS para campanha → participante versus participante; espera em advisory lock, sem `40P01` |
| Invariantes de owner | índice único `23505`, constraint diferida `23514` e exatamente um primary owner aprovados |
| Upgrade legado | `course_slug` preservado; dois owners mantidos; criador escolhido deterministicamente como primary |
| Writer da Fase 1 | criação autenticada sem `is_primary` continuou válida; primeiro owner promovido |
| Mass assignment | INSERT/UPDATE de campanha e escrita de participantes limitados por coluna nos caminhos testados |
| Deploy remoto | não executado |

## Bloqueio encontrado no baseline histórico

A revisão independente final confirmou os gates acima, mas encontrou um bloqueio não coberto pelo harness oficial:

- sessão A: atualiza a campanha e, mantendo a transação aberta, tenta atualizar um `campaign_item`;
- sessão B: atualiza o mesmo `campaign_item` e depois tenta atualizar a campanha;
- resultado observado: deadlock PostgreSQL `40P01`;
- causa provável: `campaign_items_insert` e `campaign_items_update` ainda usam `can_access_campaign`, sem adquirir o advisory lock do agregado antes do row lock do item.

A revisão também identificou que um `member` sem autoridade de mutação, mas conhecendo o UUID de uma campanha do mesmo tenant, podia chamar um helper público e manter o advisory lock até o fim da transação.

## Correção atual e evidência nativa

O commit `c921294` implementa:

- policies de INSERT/UPDATE de `campaign_items` com `can_edit_campaign`, lock antes do row lock, tenant explícito e estado `draft`;
- matriz pgTAP para viewer/editor/owner/manager/admin, membership inativa, campanha/item arquivados, ACLs e consumo indevido de lock;
- harness determinístico para campanha/participante, campanha/item e probes de duas sessões para viewer e member não participante;
- pré-autorização do helper antes do advisory lock;
- grants por coluna compatíveis com o writer da Fase 1;
- trigger autenticado que exige `version = old.version + 1` e mantém item arquivado read-only;
- recusa do harness a bancos remotos por padrão e limpeza de fixtures inclusive após falha.

| Gate nativo da correção da Task 2 | Resultado |
|---|---|
| Contagem estrutural pgTAP | `plan(98)` e 98 asserts no arquivo RLS; execução `deferred_to_vps` |
| Total pgTAP esperado | 228 asserts (`2 + 95 + 33 + 98`); execução `deferred_to_vps` |
| Sintaxe do harness | `node --check`: exit code 0 |
| Lint do harness | ESLint: exit code 0 |
| Serviço sem banco | 4 arquivos e 21 testes Vitest aprovados |
| Typecheck do serviço | exit code 0 |
| Build do serviço | exit code 0 |
| Higiene do diff | `git diff --check`: sem erro |
| Revisão estática | zero achado `Critical` ou `Important` após o hardening de versão |
| Deploy remoto | não executado |

## Interpretação correta

Os 197 testes verdes permanecem apenas como baseline histórico. As implementações atuais podem avançar internamente para `implemented_pending_vps_validation`, mas não para `completed`, porque ainda faltam a observação RED no schema anterior, o GREEN no schema corrigido, os 228 asserts pgTAP e os gates reais de PostgreSQL/RLS/concorrência na VPS.

## Política de validação no computador de retomada

- **Decisão do usuário:** não usar ou instalar Docker Desktop, WSL ou Podman neste computador.
- **Gate local disponível:** testes unitários sem banco, lint, typecheck, build, validação documental e inspeções estáticas.
- **Gate diferido para VPS:** reset/migrations, pgTAP, RLS real, harnesses concorrentes, lint/advisors/diff de banco, imagens Linux, Compose, restart e persistência.
- **Regra de status:** mudanças dependentes desses gates ficam `implemented_pending_vps_validation`; nenhuma será descrita como RED/GREEN, aceita ou concluída antes da execução real.
- **Fechamento interno:** após Tasks 1–15, usar `implementation_complete_pending_vps_validation`, ainda dentro de `in_progress`.
- **Fechamento final:** somente após deploy do usuário, gate automatizado na VPS, inspeção de logs e testes manuais por papel.

## Task 3 — contratos e máquina de estados

- **Commit:** `9740530`;
- **RED observado:** módulo `domain/contracts.js` ausente;
- **GREEN:** 13/13 testes de schema, prontidão, referência, transições e permissões;
- **Regressão nativa:** 34/34 testes sem banco e 1/1 teste isolado da matriz em `auth.test.ts`;
- **Typecheck/build:** exit code 0;
- **Diferido para VPS:** os quatro testes restantes de `auth.test.ts`, pois resolvem ator e contexto transacional em PostgreSQL real.

## Task 4 — CRUD, busca e concorrência otimista

- **Commit:** `9b19ec7`;
- **RED/GREEN nativo:** 3/3 testes de normalização de filtros, escape de prefixo e cursor estável;
- **Gate nativo:** 37/37 testes sem banco, typecheck e build aprovados;
- **Coleta dos testes PostgreSQL:** 12 cenários carregados pelo Vitest sem erro de compilação;
- **Implementação:** create progressivo, patch estrito, busca/filtros combináveis, cursor `updated_at/id`, `currentVersion`, transições, reabertura, arquivamento e preflight de autorização para replay idempotente;
- **Ordem de concorrência:** helper de autorização/advisory lock antes de `SELECT ... FOR UPDATE`;
- **Diferido para VPS:** os 8 cenários de `domain.test.ts` e 4 de `campaignTransitions.test.ts`, incluindo RLS, owner principal, auditoria, eventos, idempotência e SQL real.

## Task 5 — participantes e resolução segura de perfis

- **Commit:** `2c119f8`;
- **RED observado:** módulo `domain/participants.js` ausente;
- **Gate nativo:** 37/37 testes de regressão sem banco, 1/1 contrato de participantes e 1/1 matriz de permissões aprovados;
- **Typecheck/build:** exit code 0;
- **Implementação:** listagem, candidatos ativos do tenant, adição, alteração, remoção, transferência atômica do owner principal, versão do agregado, idempotência, auditoria, eventos e rotas REST;
- **Privacidade:** projeção limitada a `id`, nome seguro e avatar; nomes legados iguais a e-mail ou contendo `@` são substituídos por identificador neutro;
- **Hardening de lock:** editor falha no helper reservado a manager/admin antes de adquirir advisory lock;
- **Coleta dos testes PostgreSQL:** 5 cenários carregados pelo Vitest sem erro de compilação;
- **Diferido para VPS:** execução dos 5 cenários de domínio, dos 92 asserts do arquivo RLS e validação real de constraints, RLS, lock, replay e projeções de perfil.

## Task 6 — materiais e Artifact Server

- **Commit:** `aed3e1c`;
- **RED observado:** módulos `integrations/artifactClient.js` e `domain/materials.js` ausentes; configuração privada do Artifact Server também ausente;
- **Gate do Marketing Ops:** 4/4 contratos do cliente HTTP e 4/4 contratos de material sem banco aprovados;
- **Regressão nativa:** 38/38 testes base, 1/1 matriz de permissões e 1/1 contrato de participantes aprovados;
- **Artifact Server:** `npm ci --ignore-scripts` aprovado, zero vulnerabilidade, sintaxe válida e 8/8 testes aprovados;
- **Typecheck/build:** exit code 0;
- **Compose estático:** YAML parseado; URL/chave privadas, dependência `service_healthy` e volume `./data/artifacts:/app/data` confirmados; placeholders de chave foram reconciliados com `.env.example`;
- **Implementação:** upload binário com allowlist MIME/extensão e limite de 25 MiB antes da rede, vínculo de artifact próprio, access link de 300 segundos, unlink lógico, versão do agregado, idempotência, auditoria, eventos e compensação de upload quando a persistência falha;
- **Coleta dos testes PostgreSQL:** 3 cenários carregados pelo Vitest: replay sem duplicação, vínculo/acesso/unlink sem apagar bytes e rejeição de artifact de outro owner;
- **Tentativa da suíte global:** 57 testes passaram, 36 falharam e 2 ficaram skipped; a execução alcançou suítes dependentes do PostgreSQL indisponível em `127.0.0.1:55322` e não foi aceita como gate de regressão;
- **Diferido para VPS:** os 3 cenários PostgreSQL, RLS real, imagem Linux, `docker compose config/build/up`, health, restart e persistência dos bytes/metadados.

## Task 7 — referências oficiais de cursos no RAG

- **Commit:** `5d5cf8f`;
- **RED observado:** módulo `integrations/ragCourseClient.js` ausente, resolução canônica de campanha ausente e configuração RAG indefinida;
- **Gate da Task 7:** 4/4 contratos do cliente MCP, 4/4 contratos puros de resolução canônica e 2/2 contratos da rota aprovados;
- **Regressão nativa segmentada:** 59 checks sem banco aprovados, incluindo contratos anteriores de materiais/participantes e matriz de permissões;
- **RAG MCP:** 8 arquivos, 26/26 testes e typecheck aprovados; o novo cliente referencia somente `ens_rag_search` e `ens_rag_get_document`;
- **Typecheck/build do Marketing Ops:** exit code 0;
- **Compose estático:** endpoint `http://rag-mcp:8000/mcp`, timeout e dependência `rag-mcp: service_healthy` confirmados por parser YAML;
- **Implementação:** busca limitada a `collections=['courses']`, `intent='course_fact'`, evidência obrigatória e actor profile `marketing_ops`; resultados sem `metadata.course_id`, fora do tenant `ens` ou fora de `courses` são descartados;
- **Fail-closed:** documento, tenant, coleção e `course_id` são revalidados antes da persistência; o título do cliente é substituído pelo snapshot canônico; indisponibilidade não bloqueia edições que não tocam a referência;
- **Coleta PostgreSQL:** novo cenário em `domain.test.ts` confirma snapshot/timestamp canônicos e versão do agregado; execução `deferred_to_vps`;
- **Diferido para VPS:** persistência PostgreSQL real, RLS, chamada MCP Marketing Ops → RAG no Compose, indisponibilidade real e inspeção de logs;
- **Supabase do RAG:** nenhuma migration, escrita, deploy ou conexão direta realizada.

## Task 8 — timeline segura e auditoria minimizada

- **Commit:** `42d43f3`;
- **RED observado:** a suíte falhou primeiro pela ausência da rota/módulo; o hardening adicional também falhou ao receber ação e nome de campo não reconhecidos;
- **GREEN da task:** 7/7 testes de minimização, outbox, projeção, cursor, rota, feature gate e contrato público;
- **Regressão nativa segmentada:** 60/60 testes em 11 arquivos, mais 1/1 contrato puro de participantes e 4/4 contratos puros de materiais;
- **Typecheck/build:** exit code 0 após a implementação e após o hardening;
- **Implementação:** `auditSnapshot` reduz texto livre a `{ present, length, sha256 }`, redige campos secret-like e também minimiza payloads do outbox;
- **Projeção:** função privada `SECURITY DEFINER` com `search_path` fixo, ACL somente `authenticated`, autorização por campanha, cursor `(created_at,id)` e retorno sem `before_state`/`after_state`;
- **Defesa em profundidade:** ações desconhecidas viram `campaign.changed` e campos fora da allowlist são descartados tanto no SQL quanto no domínio;
- **Coleta PostgreSQL:** 1 assert estrutural e 6 asserts RLS/timeline adicionados; planos conferidos em 33 e 98, elevando o total esperado para 228;
- **Diferido para VPS:** execução da migration/função, 228 pgTAP, RLS member/manager/admin e cross-tenant, histórico bruto legado, paginação real e inspeção manual de conteúdo proibido.

## Task 9 — REST v1 e OpenAPI

- **Commit:** `6c713e7`;
- **RED observado:** inventário OpenAPI tinha 7 paths em vez de 18, os parsers completos não existiam e schemas/headers públicos estavam ausentes;
- **REDs de hardening:** query desconhecida de referência retornava 200; `archived` era aceito na rota genérica; aspas incompletas de `If-Match` passavam; erro inesperado do verifier vazava a mensagem original;
- **GREEN da task:** 6/6 contratos REST/OpenAPI executáveis sem banco, 2/2 middleware, 2/2 referências e 2/2 contratos MCP sem banco;
- **Regressão nativa segmentada:** 62/62 checks em 12 arquivos, mais 6 REST puros, 2 MCP puros, 1 contrato de participantes e 4 de materiais; total 75 testes executados;
- **Typecheck/build:** exit code 0;
- **OpenAPI:** Redocly CLI `2.18.1` validou 18 paths/22 operações sem erro ou warning; o teste compara método+path do Express com o documento;
- **Implementação:** create/patch/filtros completos, aliases F1 deprecated, transition/archive separados, queries/params strict, ETags e headers de mutação uniformes, erros públicos tipados e capabilities ampliadas;
- **Compatibilidade:** endpoints REST de `campaign_items` da Fase 1 permanecem documentados como deprecated; tools MCP v1 continuam registradas;
- **Diferido para VPS:** 6 testes REST com PostgreSQL, 6 testes MCP com PostgreSQL e 5 cenários de `production-gate.test.ts`, incluindo draft completo, transition, replay, auditoria e tenant forjado.

## Task 10 — client frontend tipado

- **Commit:** `32acff2`;
- **RED observado:** `queryKeys.ts` ausente; `MarketingOpsApiError` sem `currentVersion`; transição, participantes, materiais, timeline e referências inexistentes no client;
- **GREEN focado:** 11/11 testes em `client.test.ts` e `queryKeys.test.ts`;
- **Regressão frontend:** 35 arquivos e 131/131 testes aprovados;
- **Lint:** zero erro; 10 warnings preexistentes fora do módulo da Task 10;
- **Typecheck/build:** exit code 0; build repetiu apenas os warnings conhecidos de chunk grande e importação mista de `supabase.ts`;
- **Implementação:** tipos completos do OpenAPI, campanhas/transições/participantes/materiais/timeline/referências, query keys por recurso, ETag e correlação preservados, 409 com `currentVersion` e upload de `File` sem JSON;
- **Diferido para VPS:** chamada do client contra a API autenticada real, CORS/TLS, ETag/409 reais e upload binário até o Artifact Server no Compose.

## Task 11 — lista, filtros em URL e criação

- **Commit:** `df4903b`;
- **RED observado:** helper de atenção e componentes da lista ausentes; o primeiro teste de interação também revelou uma corrida entre debounce e atualização da URL, corrigida antes do GREEN;
- **GREEN focado:** 5/5 testes da página para URL/criação, paginação, vazio/erro, preservação no erro e limpeza no cancelamento;
- **Regressão frontend:** 36 arquivos e 136/136 testes aprovados; ESLint focado sem achados, lint global com zero erro e 10 warnings preexistentes;
- **Marketing Ops sem banco:** 63/63 em 12 arquivos, mais 6 REST, 2 MCP, 1 contrato de participantes e 4 de materiais; total segmentado de 76 testes aprovados;
- **Intercorrência investigada:** a primeira execução paralela tentou abrir outro worker Vitest após os 63 testes e recebeu `spawn EPERM`; os quatro filtros restantes foram reexecutados isoladamente e aprovaram 13/13, classificando a ocorrência como limite transitório do Windows, não falha de código;
- **OpenAPI e builds:** Redocly `2.18.1 --extends=minimal`, typecheck e build do Marketing Ops aprovados; typecheck/build do frontend aprovados;
- **Regressões adjacentes:** Artifact Server 8/8; RAG MCP 26/26 e typecheck; `security:gate` terminou com zero vulnerabilidade alta e zero erro de lint;
- **QA browser real:** Chrome em 1440×900 e viewport móvel 390×844; busca/status persistiram em `?status=active&q=Corporate`, criação navegou ao UUID, diálogo fechou, rótulos foram localizados, `scrollWidth === clientWidth` e console teve zero warning/erro;
- **Implementação:** lista resumida com owners/alertas após paginação, tabela/cards, filtros combináveis/resetáveis, cursor, estados loading/vazio/erro/403, correlação, retry, criação name-only, rota lazy e sidebar por flag;
- **Coleta PostgreSQL:** `domain.test.ts` agora exige `responsibles` e `attention` da projeção real; execução `deferred_to_vps`;
- **Limite do security gate legado:** o check de RAG executado pelo script com o anon do app comprova apenas negação, não acesso ao Supabase do RAG; a prova oficial do RAG continua sendo MCP read-only na VPS;
- **Diferido para VPS:** auth/CORS/TLS/API real, PostgreSQL/RLS, performance, E2E integrado/axe, Compose e logs.

## Task 12 — workspace, salvamento explícito e conflito

- **Commit:** `7fcbd21`;
- **RED observado:** `CampaignWorkspacePage` e os componentes do workspace ainda não existiam; o teste focado falhou na resolução do módulo antes da implementação;
- **GREEN focado:** 6/6 testes para preservação/reaplicação no 409, save explícito e validação de datas, referência oficial, indisponibilidade do RAG sem bloqueio de campos alheios, transição/archive e estados inválido/404/read-only;
- **Regressão frontend:** 37 arquivos e 142/142 testes aprovados;
- **Lint e tipos:** ESLint focado sem achados; lint global com zero erro e os mesmos 10 warnings legados; typecheck aprovado;
- **Build:** aprovado com chunk lazy próprio `CampaignWorkspacePage` de 28,89 kB, 8,64 kB gzip; warnings legados de bundle principal, Browserslist e importação mista do Supabase permanecem fora desta task;
- **Security gate:** RLS app, negação legada do RAG, lint, build e auditoria com zero vulnerabilidades aprovados após mapear `NEXUS_APP_SUPABASE_*` da raiz somente no processo;
- **QA browser real:** Chrome em 1440×900, 768×900 e 390×844; layout sem overflow, diálogo comparou valor atual/local, reaplicação avançou da versão 4 para 5, transição avançou para 6 e archive para 7/read-only; uma aba limpa terminou sem warning/erro de console;
- **Implementação:** deep link UUID, loading/404/403/retry, formulário em Essenciais/Planejamento/Briefing, patch mínimo sem autosave, course picker com debounce, conflito sem sobrescrita automática, transições/reabertura controlada e confirmação de archive;
- **Diferido para VPS:** auth e capabilities reais por papel, API/PostgreSQL, ETag/`If-Match`/409 concorrente em duas sessões, RAG MCP real, persistência histórica, E2E/axe integrado, Compose e logs.

## Task 13 — participantes, materiais e timeline na UI

- **Commit:** `73fa9ea`;
- **RED observado:** os três módulos de painel ainda não existiam; testes adicionais reproduziram invalidação de timeline com query key incompatível, dois owners principais no cache e erros de mutação ocultos atrás de diálogos;
- **GREEN focado:** 5 arquivos e 22/22 testes para composição/versionamento, permissões fail-closed, gestão de participantes, limites de material, access link, paginação e timeline segura;
- **Regressão frontend:** 40 arquivos e 156/156 testes aprovados;
- **Lint e tipos:** ESLint focado sem achados; lint global com zero erro e os mesmos 10 warnings legados; typecheck aprovado;
- **Build:** aprovado com chunks lazy próprios para lista e workspace; warnings legados de bundle principal, Browserslist e importação mista do Supabase permanecem fora desta task;
- **Security gate:** validadores estáticos RLS app/RAG, lint, build e auditoria com zero vulnerabilidades aprovados, usando as variáveis do app somente no processo;
- **QA browser real:** lista, workspace, painéis e sidebar oficial conferidos no KV visual em 1440×900 e 390×844; sem overflow horizontal, footer sobre conteúdo, sobreposição do botão do menu ou warning/erro de console. A validação funcional da Task 12 permanece como evidência intermediária em 768×900;
- **Implementação:** permissões derivadas de tenant/membership e fail-closed, owner principal único no cache, mutações aninhadas avançando a versão agregada, upload validado antes da rede, URL temporária aberta somente após allowlist HTTP(S), unlink sem apagar bytes e timeline cursor-based com rótulos allowlisted;
- **Diferido para VPS:** auth/capabilities e REST reais, PostgreSQL/RLS por papel/cross-tenant, versão concorrente entre sessões, upload/access/unlink contra Artifact Server, timeline persistida/paginada, E2E/axe, imagens Linux, Compose, restart, persistência e logs.

## Avisos conhecidos

- 81 warnings do advisor já existiam fora dos objetos novos/alterados da Task 2;
- warnings `01007` da extensão `vector` aparecem durante reset/diff;
- nenhum desses avisos autoriza dispensar a prova RED/GREEN do deadlock de `campaign_items` na VPS;
- o Supabase do RAG não foi acessado ou alterado;
- nenhum projeto Supabase remoto foi mutado.

## Auditoria documental após a Task 13

| Verificação | Resultado |
|---|---|
| Pacote exigido pelo design | README, design, progresso, rastreabilidade, riscos, LGPD, SLO, runbook, rollback, validação local, deploy Supabase, validação VPS e handoff presentes |
| Links relativos em `docs/phase-2` | todos os alvos locais resolvidos |
| Estados remotos | Supabase `not_executed`; VPS `pending_user_execution`; nenhuma evidência antecipada |
| Supabase CLI | versão local `2.109.1`; sintaxe de `migration list`, `db dump`, `db push --dry-run`, `test db`, `lint` e `advisors` conferida via `--help` |
| Separação RAG/app | runbook e deploy proíbem variáveis/migrations do RAG |
| Continuidade | README, progresso e handoff apontam Task 14 como próxima frente |

Esta auditoria valida completude e coerência documental, não banco, containers ou deploy.

## Task 14 — observabilidade, E2E e fechamento documental

- **Commit:** `bcd8ca3`;
- **RED observado:** endpoints/métricas ausentes e security_gate não passando (path `.env` errado);
- **GREEN:** todos os gates corrigidos e finalizados na retomada;
- **Regressão nativa backend:** 73/73 `foundation/domain` testes; 8/8 `Artifact Server` testes; 26/26 `RAG MCP` testes; REST/MCP/materials testes; `VPS safety test` 1/1;
- **OpenAPI:** `Redocly CLI` executou validando `marketing-ops.v1.yaml` sem erro (`validated in 70ms`);
- **Regressão frontend:** 156/156 testes unitários passados em 40 arquivos. Typecheck e build completos do frontend passaram; lint sem errors, 10 warnings pre-existentes;
- **Security Gate:** script final executado com as variáveis apontando para a base nativa; validou 0 vulnerabilities no build, test e dependências;
- **Implementação:** Readiness configurado avaliando Supabase/Artifact/RAG; Métricas formatadas e roteadas via `/metrics` exclusivas do prometheus; logs estruturados sem info vazada e Playwright e2e/setup script configurado e pronto para deploy de VPS;
- **Diferido para VPS:** Execução do `test/phase-2-vps.sh` no servidor (valida E2E, linux environment, e integridade compose final).
