# Progresso de implementação da Fase 3

- **Estado:** `in_progress`
- **Progresso:** 70%
- **Snapshot:** 2026-07-18
- **Branch única:** `main`
- **Próxima task:** Task 8 — views semana e mês

| Task | Entregável | Estado | Evidência |
|---:|---|---|---|
| 1 | gate, tipos, migration, RLS e backfill | `validated_locally` | 295 pgTAP; 19 contratos; reset/lint/diff verdes |
| 2 | CRUD e máquina de estados | `validated_locally` | 7 cenários novos; 142 testes do serviço verdes |
| 3 | agenda, query canônica e timezone | `validated_locally` | 299 pgTAP; p95 40,02 ms/10 mil itens; 153 testes verdes |
| 4 | grafo de dependências | `validated_locally` | 4 cenários; concorrência A↔B sem deadlock; 307 pgTAP |
| 5 | conteúdo, versões e artifacts | `validated_locally` | 320 pgTAP; 166 testes do serviço; smoke real do Artifact Server |
| 6 | REST/OpenAPI e client tipado | `validated_locally` | 26 paths/38 operações; 15 REST; 13 SDK; smoke Docker |
| 7 | lista acessível | `validated_locally` | 7 focados; 167 frontend; browser desktop/mobile e Docker |
| 8 | views semana e mês | `not_started` | — |
| 9 | notificações in-app e lote | `not_started` | — |
| 10 | E2E, performance, docs e handoff VPS | `not_started` | — |

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
