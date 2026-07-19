# Progresso de implementação da Fase 3

- **Estado:** `in_progress`
- **Subestado:** `implementation_complete_pending_vps_validation`
- **Progresso de implementação:** 100%
- **Snapshot:** 2026-07-19
- **Branch única:** `main`
- **Próximo gate:** deploy e homologação manual na VPS

| Task | Entregável | Estado | Evidência |
|---:|---|---|---|
| 1 | gate, tipos, migration, RLS e backfill | `validated_locally` | 295 pgTAP; 19 contratos; reset/lint/diff verdes |
| 2 | CRUD e máquina de estados | `validated_locally` | 7 cenários novos; 142 testes do serviço verdes |
| 3 | agenda, query canônica e timezone | `validated_locally` | 299 pgTAP; p95 40,02 ms/10 mil itens; 153 testes verdes |
| 4 | grafo de dependências | `validated_locally` | 4 cenários; concorrência A↔B sem deadlock; 307 pgTAP |
| 5 | conteúdo, versões e artifacts | `validated_locally` | 320 pgTAP; 166 testes do serviço; smoke real do Artifact Server |
| 6 | REST/OpenAPI e client tipado | `validated_locally` | 26 paths/38 operações; 15 REST; 13 SDK; smoke Docker |
| 7 | lista acessível | `validated_locally` | 7 focados; 167 frontend; browser desktop/mobile e Docker |
| 8 | views semana e mês | `validated_locally` | 7 focados; 174 frontend; 2 E2E + axe desktop/mobile |
| 9 | notificações in-app e lote | `validated_locally` | 5 domínio; 16 REST; 22 focados; 175 serviço + 179 frontend; smoke browser/Docker |
| 10 | E2E, performance, observabilidade, operação e handoff VPS | `validated_locally` | 181 serviço; 179 frontend; 322 pgTAP; E2E Docker; restart; Supabase remoto |

## Protocolo

Ao concluir uma task:

1. registrar teste RED realmente observado;
2. registrar GREEN e comandos frescos;
3. atualizar rastreabilidade/riscos/evidência;
4. criar commit local pequeno;
5. não promover gate remoto sem execução real.

## Ciclo Task 1 — 2026-07-18

- RED de aplicação observado: 5 falhas em 19 testes pela ausência dos schemas e
  da matriz de transição de item.
- RED de banco observado: os dois arquivos novos falharam antes da migration
  por ausência de tipos, campos, tabelas e RLS.
- Migration gerada pelo CLI:
  `20260718193003_phase_3_calendar_production_pipeline.sql`.
- Conversão in-place preserva `id`/`version`, normaliza kind legado e mapeia
  `archived` para `cancelled`, mantendo `archived_at` como evidência compatível.
- GREEN: reset completo, 295/295 pgTAP, 19/19 contratos, 135/135 testes do
  serviço, typecheck e build.
- Banco: lint sem erros e diff vazio.
- Incidente corrigido: duas execuções simultâneas de `supabase test db`
  disputaram a ativação do pgTAP. A reprodução isolada confirmou concorrência
  do CLI; os gates Supabase passam quando serializados.
- Advisors remotos consultados em modo read-only. Os achados são baseline
  legado fora das tabelas da Fase 3; a migration ainda não foi promovida.
- O clone não possui link local do Supabase CLI; `migration list --linked`
  retorna `LegacyProjectNotLinkedError`. O deploy remoto permanece bloqueado
  até o gate final da fase.

## Ciclo Task 2 — 2026-07-18

- RED observado: 7/7 cenários novos falharam porque
  `createProductionItem`/get/patch/transition/cancel ainda não existiam; os 5
  testes do production gate anterior permaneceram verdes.
- Implementados create/get/patch/transition/cancel com transação de ator,
  idempotência, versão otimista, readiness, terminalidade, auditoria minimizada
  e outbox.
- Compatibilidade mantida nos adapters legados
  `createCampaignItemDraft`/`updateCampaignItemDraft`, inclusive para `content`.
- Autoridade de member exige campanha editável e, para transição, assignee ou
  owner; manager/admin operam no tenant autorizado. Cross-tenant retorna 404.
- GREEN focado: 12/12 (`items.test.ts` + `production-gate.test.ts`).
- GREEN amplo: 142/142 testes do serviço, 2 E2E condicionais skipped,
  typecheck e build.
- Bug corrigido: o teste antigo de paginação reutilizava “Nexus Alpha” e
  acumulava fixtures entre execuções. O termo agora é único por teste e o gate
  pode ser repetido sem reset.
- Decisão documental: os cenários da Fase 3 ficam em `items.test.ts`; o arquivo
  `production-gate.test.ts` continua representando os testes manuais 15–20 da
  Fase 1 e não recebeu cenários de semântica diferente.

## Ciclo Task 3 — 2026-07-18

- RED funcional observado: o módulo de scheduling e
  `listProductionSchedule` não existiam.
- RED de volume observado: a primeira consulta canônica atingiu p95 de
  2.566,34 ms com 10.000 itens, acima do limite de 500 ms.
- O `EXPLAIN (ANALYZE, BUFFERS)` identificou chamadas RLS por linha:
  2.401,49 ms e 195.471 buffer hits.
- A correção centralizou autorização e consulta na função privada
  `list_production_schedule`, `security definer`, `search_path` vazio e EXECUTE
  somente para `authenticated`. O isolamento cross-tenant foi exercitado.
- Pós-correção: função em 18,68 ms no EXPLAIN e gate dedicado com p95 de
  40,02 ms/10.000 itens. Não foi criado índice especulativo.
- Range `[from,to)`, filtros combinados, cursor estável, itens sem data,
  viradas de mês/ano, atraso/bloqueio e IANA/DST ficaram cobertos.
- Timezone padrão explícito em Compose/.env:
  `America/Sao_Paulo`, ainda configurável por ambiente.
- GREEN amplo: 299/299 pgTAP, lint vazio, diff vazio, 153/153 testes de
  serviço, 2 E2E condicionais skipped, typecheck e build.

## Ciclo Task 4 — 2026-07-18

- RED de domínio observado: `dependencies.ts` inexistente.
- RED de concorrência observado: o banco aceitou simultaneamente A→B e B→A,
  persistindo duas arestas cíclicas.
- RED de banco observado: 7/45 contratos falharam pela ausência dos helpers e
  trigger do grafo.
- Migration gerada pelo CLI:
  `20260718201158_enforce_acyclic_item_dependencies.sql`.
- O trigger autoriza e adquire primeiro o lock do agregado da campanha, depois
  advisory locks dos dois UUIDs em ordem crescente. O grafo é validado na mesma
  transação, com `security definer`, `search_path` vazio e sem EXECUTE público.
- Add/remove/list usam RLS/RBAC, idempotência, versão do item, auditoria e
  outbox; duplicata, self-loop, campanhas/tenants diferentes, terminais e ciclo
  indireto falham fechados.
- O harness concorrente foi repetido com vencedores A→B e B→A; em ambos os
  casos terminou sem deadlock, persistiu uma aresta e rejeitou a outra pelo
  constraint `item_dependencies_acyclic`.
- Bug do próprio harness corrigido: o timeout pendente mantinha o processo vivo
  por 10 segundos e falhas podiam deixar fixtures. O timer agora é cancelado e
  o cleanup roda em `finally`.
- GREEN amplo: reset completo, 307/307 pgTAP, lint vazio, diff vazio, 157/157
  testes do serviço, 2 E2E condicionais skipped, typecheck e build.

## Ciclo Task 5 — 2026-07-18

- RED de domínio observado: `content.ts` e `itemArtifacts.ts` não existiam e o
  client do Artifact Server não expunha metadata com ownership.
- RED de banco observado: a função atômica de criação de versão, os grants
  mínimos e o vínculo composto asset/item ainda não existiam.
- Migration gerada:
  `20260718202716_add_content_versioning_and_item_artifact_guards.sql`.
- Conteúdo agora separa asset mutável de versões append-only, calcula SHA-256
  do corpo, congela versões na criação e incrementa número/ponteiro sob lock.
- O backfill converte conteúdo legado de forma determinística, preserva o JSON
  original, cria versão congelada e pode ser reexecutado sem duplicação.
- Artifacts validam tamanho/MIME, ownership e vínculo ao mesmo item. Falha após
  upload aciona compensação; unlink é lógico e não remove bytes compartilhados.
- Bug de concorrência otimista corrigido: `expectedVersion = null` podia
  contornar uma comparação SQL com semântica ternária. A função agora rejeita
  explicitamente null e o caso ganhou pgTAP negativo.
- Na regressão executada junto de build/typecheck, um teste antigo de
  dependências ultrapassou o timeout de 5 s por contenção do host. O teste
  focado passou em aproximadamente 504 ms e a regressão completa serializada
  passou com 166/166; não foi reproduzido defeito de produto.
- O primeiro smoke local de URL assinada retornou 404 porque o `.env` apontava
  a URL pública do Artifact Server para produção. O container foi recriado com
  override local; upload, ownership, URL assinada, download de 27 bytes e
  cleanup passaram.
- GREEN amplo: 320/320 pgTAP, lint vazio, diff vazio, 166/166 testes do
  serviço, 8/8 do Artifact Server, typecheck, build e imagens Docker.

## Ciclo Task 6 — 2026-07-18

- RED inicial observado: a suíte de contrato não foi coletada porque as rotas
  canônicas de dependências/conteúdo não existiam; após criar os adapters,
  OpenAPI e SDK ainda falharam por inventário/métodos ausentes.
- Expostos `campaign-items`, agenda canônica, detalhe/patch/transição,
  dependências, content assets/versions e artifacts. Os endpoints legados
  aninhados em campanha permanecem compatíveis.
- Query/body desconhecidos falham; mutações usam `Idempotency-Key`, entidades
  existentes usam `If-Match`, e o ETag acompanha a versão do agregado correto.
- OpenAPI e router ficaram em lockstep com 26 paths e 38 operações. O SDK
  preserva token fresco, tenant, correlação, ETag, `currentVersion` e uma única
  query key de agenda para lista/semana/mês.
- Notificações e lote não receberam endpoint vazio: seus paths serão adicionados
  junto do domínio da Task 9, mantendo o contrato público sempre executável.
- Bug corrigido: o domínio aceitava corpo de conteúdo de 1 MiB, mas o parser
  JSON global limitava 256 KiB e retornava 500. O envelope HTTP agora comporta
  o contrato e excesso retorna `413 payload_too_large`.
- Gate instável corrigido: um teste de integração com várias transações
  ultrapassava o timeout genérico de 5 s sob paralelismo. Isolado passou em
  495 ms; recebeu timeout explícito de 15 s e a regressão passou 170/170.
- Gate de segurança Docker recusou o `.env` por destinos Supabase não locais.
  O smoke usou overrides de processo, rede do Supabase local e
  `sslmode=disable` explícito. `createPool` agora honra esse modo sem enfraquecer
  TLS de URLs remotas.
- Smoke manual real: login local, campanha, item, agenda/timezone, patch, asset,
  versão congelada e conflito 409 passaram; reset removeu fixtures e o
  container permaneceu healthy.
- GREEN: 15/15 REST, 13/13 SDK/query keys, 170/170 serviço, 2 E2E condicionais
  skipped, p95 367,39 ms, typechecks/builds, Redocly, Docker build/health.

## Ciclo Task 7 — 2026-07-18

- RED inicial observado: os testes não eram coletados porque
  `ProductionListPage` e `scheduleUrl` ainda não existiam.
- Implementada rota lazy `/marketing-ops/production` e deep link
  `/marketing-ops/production/items/:itemId`, com entrada na sidebar.
- Lista e cards reutilizam `listProductionSchedule` e a query key canônica;
  filtros allowlisted ficam na URL, paginação preserva páginas anteriores e
  itens sem data/atrasados/bloqueados têm estados explícitos.
- O diálogo compartilhado cria, edita, reagenda e transiciona com
  `Idempotency-Key`/`If-Match`, exibe timezone e trata 403/404/409 com
  correlação/currentVersion.
- Bug corrigido no ciclo TDD: o carregamento tardio de campanhas reidratava o
  formulário de detalhe e podia sobrescrever uma edição digitada. A hidratação
  do item foi separada do default de campanha e bloqueia interação até concluir.
- Bug encontrado no smoke: o container local mantém CORS restrito à origem de
  produção. Foi adicionado proxy somente ao servidor Vite, que remove `Origin`
  no salto interno same-origin; build/produção não foram afrouxados.
- Smoke manual real no navegador: login manager, lista, paginação,
  atraso/bloqueio, criação, deep link, edição, rejeição de prontidão incompleta,
  cancelamento e filtros URL passaram. Em 390×844 a tabela ficou oculta e o card
  equivalente permaneceu visível.
- Fixture manual `F3 UI manual validado` foi removida pelo reset; o serviço
  retornou `healthy`.
- GREEN: 7/7 focados, 167/167 frontend, lint sem erros, typecheck/build,
  Supabase reset e health Docker.

## Ciclo Task 8 — 2026-07-18

- RED inicial observado: os três arquivos de teste não eram coletados porque
  `timezone`, `ProductionWeekPage` e `ProductionMonthPage` ainda não existiam.
- Semana e mês agora são agrupamentos de `listProductionSchedule`, com a mesma
  query key, filtros allowlisted e limites locais convertidos para UTC `[from,to)`.
- Funções puras cobrem São Paulo, virada de mês/ano, timezone com DST, wall time
  inexistente, grade mensal de 42 dias e navegação sem pular mês curto.
- O diálogo compartilhado passou a apresentar e receber horários no IANA do
  tenant; a conversão local → UTC ocorre antes do SDK e a API continua
  persistindo ISO 8601 UTC.
- Grade e lista acessível apresentam os mesmos itens; mês limita três cards por
  célula e informa o overflow, enquanto a lista equivalente mantém todos.
- O calendário vazio continua navegável, itens sem data permanecem na lista e
  nenhuma ação depende de drag-and-drop.
- Smoke real no browser: login manager, cinco itens, semana, mês, horário local,
  filtros/intervalo na URL, overflow `+2` e diálogo sem perder contexto passaram.
- O primeiro E2E axe encontrou `gridcell` sem `row`; a grade recebeu linhas ARIA
  explícitas e o segundo gate eliminou as violações estruturais.
- O segundo E2E encontrou contraste 3,25:1 no estado ativo/CTA. Texto escuro
  preservou a cor da marca e elevou o contraste; axe passou em desktop e mobile.
- GREEN: 7/7 focados, 174/174 frontend, 2/2 E2E Playwright, axe WCAG A/AA,
  documento limitado a 390 px com scroll interno, lint sem erros, typecheck e
  build.

## Ciclo Task 9 — 2026-07-19

- RED inicial observado: os testes não eram coletados porque os domínios de
  notificações/lote e os componentes correspondentes ainda não existiam.
- A projeção de notificações cobre atribuição, prazo próximo e atraso, é
  reexecutável por `event_key`, pertence ao destinatário e persiste somente
  payload allowlisted. Títulos, conteúdo, nomes, artifacts e URLs não entram no
  evento ou no rótulo apresentado.
- A leitura é idempotente e limitada ao próprio usuário. A listagem usa cursor
  estável `(occurred_at,id)` e respeita RLS/tenant.
- O lote aceita no máximo 100 itens únicos e somente as ações reversíveis de
  reatribuição, prioridade e reagendamento. Manager/admin recebem resultado
  explícito por item; cada mutação preserva autorização, versão otimista,
  idempotência, auditoria e outbox.
- REST/OpenAPI/SDK foram publicados junto do domínio executável: 28 paths e 41
  operações em lockstep, sem placeholder.
- A interface oferece sino in-app, badge/leitura, seleção equivalente em
  tabela/card e diálogo de lote. A permissão visual é conveniência; o backend
  continua sendo a autoridade.
- GREEN focado: 5/5 de domínio, 16/16 REST e 22/22 de frontend/SDK.
- GREEN amplo: 175 testes do Marketing Ops e 179 do frontend; 2 E2E externos
  condicionais skipped; typecheck/build/Redocly verdes e lint com zero erro
  (10 warnings históricos).
- Smoke real no navegador/Docker: manager autenticado, quatro notificações com
  rótulo genérico, leitura zerando o badge, lote com `1 atualizado / 0
  falharam`, prioridade refletida na lista e viewport 390×844 com cards,
  seleção e menu móvel.
- Após o smoke, `supabase db reset --local` reaplicou todas as migrations e
  removeu fixtures; o container Marketing Ops permaneceu healthy.
- Bugs/correções do ciclo:
  1. a composição inicial do schema discriminado com refinamento era
     incompatível com Zod; a validação cruzada foi movida para o parser;
  2. uma projeção com limite global criava interferência entre fixtures
     paralelas; o harness passou a isolar dados e paginação;
  3. `npm test` incluía inadvertidamente o benchmark de agenda em paralelo e
     media contenção do host. Os dois benchmarks agora ficam fora da suíte
     funcional e são executados isoladamente, como definido no plano;
  4. o primeiro `docker compose up` herdou destinos remotos do `.env`. A
     requisição da UI falhou antes de qualquer mutação; o container foi
     imediatamente recriado com Supabase local explícito e os hosts foram
     conferidos antes do smoke;
  5. o Vite local iniciou sem as variáveis Supabase e depois com o nome antigo
     da URL do Marketing Ops. O processo foi reiniciado com credenciais locais
     em memória e `VITE_MARKETING_OPS_URL` correto.

## Ciclo Task 10 — 2026-07-19

- RED de observabilidade: `/metrics` real retornou 503. A consulta agregada
  referenciava `domain_events.created_at`, mas a coluna canônica é
  `occurred_at`. O collector foi isolado, coberto por teste e corrigido.
- RED de agenda: campanhas E2E arquivadas ainda deixavam itens visíveis na
  esteira. O teste de domínio reproduziu a regressão e a forward migration
  `20260719013000_exclude_archived_campaigns_from_production_schedule.sql`
  passou a excluir campanhas arquivadas na função canônica.
- Hardening de notificações:
  `20260719012000_harden_in_app_notification_projection.sql` restringe a
  projeção/insert e os testes RLS comprovam ownership e payload seguro.
- O popover de notificações recebeu semântica/label acessível; o E2E integrado
  cobre carregamento, leitura e erro seguro.
- Métricas allowlisted agora cobrem agenda por view, lote por resultado,
  versões, notificações, itens por status/kind e readiness, sem IDs pessoais.
- Logs e erros usam correlação, redaction e labels finitas. O scanner real
  verificou sete categorias sensíveis e encontrou zero ocorrência.
- Readiness comprova banco, Artifact Server e RAG. Compose e Traefik usam
  `/ready`; os serviços recebem grace period de 30 segundos.
- O script `scripts/test/phase-3-vps.sh` é fail-closed: exige Linux, `main`
  limpo, confirmação literal, `.env` restrito, migrations, RLS, probes,
  métricas e logs. E2E mutante, banco isolado e restart ficam desligados por
  padrão e exigem opt-in.
- E2E real em Docker aprovou criação de campanha/itens, dependência,
  bloqueio/desbloqueio, versão congelada, artifact, notificação, lote,
  reagendamento, semana, mobile/axe e cleanup. Campanhas arquivadas não
  reaparecem na agenda.
- Persistência real: fingerprint do banco permaneceu idêntico após restart; um
  artifact foi criado, reiniciado, relido e removido, sem metadata residual.
- Gate final de banco: reset completo, 6 arquivos e 322/322 pgTAP, lint sem
  erro e schema diff vazio.
- Gate final de serviço: 181 pass, 2 E2E condicionais skipped, typecheck e
  build. Artifact Server 8/8; RAG MCP 26/26.
- Gate frontend: 179/179, lint zero erro/10 warnings históricos,
  typecheck/build e security gate sem vulnerabilidade.
- Performance isolada final: 5.000 campanhas p95 38,41 ms e 10.000 itens p95
  45,45 ms, ambos abaixo do limite de 500 ms.
- Quatro imagens foram construídas com `--no-cache`; Compose ficou
  running/healthy e os quatro probes responderam.
- Supabase remoto: backup com hash, dry-run de oito migrations, push e
  invariantes pós-deploy concluídos. O histórico remoto está sincronizado até
  `20260719013000`.
- Smoke final após reset: novo login manager, 0 itens, timezone ENS, estado
  vazio e notificações vazias, sem banner nem erro/warning no navegador.
- Incidentes de ambiente corrigidos sem mutação remota indevida:
  1. resets locais invalidaram JWTs do navegador; novo login é obrigatório;
  2. um primeiro container herdou URL remota do `.env`, mas a requisição
     falhou antes de criar dados e o serviço foi recriado com endpoints locais;
  3. a URL pública local de artifact herdou produção, provocando somente um
     GET 404; o override local foi corrigido;
  4. uma senha de banco apareceu no terminal durante diagnóstico. Ela não foi
     gravada no Git, mas sua rotação é pré-condição obrigatória da VPS.

## Decisão de fechamento interno

As dez tasks estão implementadas e validadas. A fase permanece `in_progress`,
no subestado `implementation_complete_pending_vps_validation`, porque o
deploy/build, os smokes manuais, logs e restart na VPS ainda dependem do
usuário. Não iniciar a Fase 4 antes desse aceite.

## Saneamento após o primeiro gate VPS — 2026-07-19

- O gate não mutante do commit `a5183c1` revelou uma configuração inválida:
  executava 181 testes e dois benchmarks dependentes de
  `127.0.0.1:55322`, embora o Supabase local isolado estivesse desativado.
- As 71 falhas recebidas foram classificadas como cascata da conexão recusada;
  nenhum teste foi redirecionado ao banco de produção.
- O bloco nativo agora preserva instalação, typecheck, build, OpenAPI e audit;
  a cobertura com banco permanece integral no bloco isolado local.
- O safety test passou de 1 para 2 casos e impede a reintrodução dessa
  duplicidade insegura, exige o DSN local literal e proíbe E2E mutante herdado
  no bloco nativo.
- A continuação do gate encontrou uma corrida de frontend entre debounce da
  busca e mudança de status. A atualização foi tornada atômica e a regressão
  passou na suíte completa, em cinco repetições focadas e no navegador.
- Supabase local: reset, 322 pgTAP, lint sem erro, diff vazio, 181 testes e
  benchmarks p95 de 28,70/37,40 ms.
- Docker: quatro imagens `--pull --no-cache`, containers healthy e readiness
  com banco/Artifact/RAG `ok`.
- O próprio `phase-3-vps.sh` passou integralmente em Linux descartável com
  isolated DB, E2E mutante e restart desativados; os sete Playwright E2E foram
  comprovadamente skipped e o scanner de logs passou.
- O status permanece `implementation_complete_pending_vps_validation`; o
  próximo passo é publicar o commit corretivo e repetir o gate não mutante na
  VPS com log integral.
