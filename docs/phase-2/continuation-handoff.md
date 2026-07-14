# Handoff de continuação — Fase 2

Este documento é a fonte de continuidade da Fase 2. Ele registra o estado versionado, o baseline histórico, a correção atual, as provas pendentes na VPS e a ordem dos próximos passos.

## 1. Ponto de retomada

- **Branch única:** `main`
- **Último commit de código da fase:** `73fa9ea feat: completa colaboracao e historico no workspace`
- **Commit de handoff:** o HEAD de `main` que contém este documento
- **Estado do worktree no snapshot:** limpo
- **Plano:** [2026-07-13-phase-2-workspace-operacional-mvp-implementation.md](../plans/2026-07-13-phase-2-workspace-operacional-mvp-implementation.md)
- **Estado de execução:** Task 1 concluída; Tasks 2 e 4–13 em `implemented_pending_vps_validation`; Task 3 `completed_reviewed`; Task 14 é a próxima frente
- **Ambientes remotos:** nenhum deploy Supabase ou VPS da Fase 2
- **Progresso detalhado:** [implementation-progress.md](implementation-progress.md)
- **Rastreabilidade:** [requirements-traceability.md](requirements-traceability.md)

Commits relevantes, em ordem:

| Commit | Conteúdo |
|---|---|
| `32c2ae4` | design técnico aprovado da Fase 2 |
| `4ed2829` | plano detalhado aprovado |
| `ccf20d1` | gate local estabilizado nas portas `55320–55329` |
| `e70a496` | primeira evolução do schema |
| `c648121` | alinhamento do schema ao design aprovado |
| `c17fe5f` | hardening de mutações, RLS e máquina de estados |
| `1a49c4d` | grants de INSERT e serialização do agregado com advisory lock |
| `c921294` | fecha `campaign_items`, abuso de lock, grants e progressão de versão |
| `9740530` | contratos de entrada, prontidão e máquina de estados da campanha |
| `9b19ec7` | CRUD operacional, busca, filtros, versões e transições de campanha |
| `2c119f8` | participantes, owner principal, perfis seguros, locks e rotas REST |
| `aed3e1c` | materiais, Artifact Client, compensação, rotas REST e integração Compose |
| `5d5cf8f` | referências oficiais read-only, snapshot canônico, rota REST e integração RAG MCP |
| `42d43f3` | snapshots minimizados, timeline privada segura, rota REST, cursor e testes de não vazamento |
| `6c713e7` | REST v1 completo, transições, adapters estritos, ETags, erros e OpenAPI válido |
| `32acff2` | client frontend tipado, query keys, upload binário e conflito 409 com versão atual |
| `df4903b` | lista responsiva, filtros em URL, criação name-only e resumo de owners/alertas |
| `7fcbd21` | workspace editável, referência oficial, transições, archive read-only e resolução de conflito 409 |

Os relatórios em `.superpowers/` eram scratch local ignorado pelo Git. Toda evidência necessária para continuar foi consolidada neste documento e em [local-validation.md](local-validation.md).

## 2. O que está pronto

### Task 1 — concluída e revisada

- contrato local Supabase movido para `55320–55329` por conflito de portas reservadas no Windows;
- Marketing Ops, Vite, scripts e testes usam API `55321` e DB `55322`;
- fail-closed de produção preservado;
- regressões de serviço, frontend e pgTAP passaram.

### Task 2 — implementada, revisão estática aceita e prova VPS pendente

Implementação versionada:

- enum de status `draft|planned|active|completed|archived`;
- campos aprovados `starts_on`, `ends_on`, `primary_channel`, `secondary_channels`;
- canais exatos do design e validação de secundários;
- busca gerada somente sobre `name` e `reference_title_snapshot`;
- `campaign_materials` com `artifact_owner_id`, source controlada, 25 MiB, SHA-256, RLS e unlink lógico;
- backfill determinístico e exatamente um primary owner com índice único parcial e constraints diferidas;
- compatibilidade do writer da Fase 1;
- máquina de estados e `version + 1` protegidos no banco para sessões autenticadas;
- memberships inativas, viewer e cross-tenant falham fechados nos cenários cobertos;
- grants por coluna para campanhas e participantes;
- advisory lock do agregado para campanhas, participantes e materiais;
- harness versionado em `apps/chat-web/scripts/test_campaign_aggregate_concurrency.mjs`.

Correção versionada em `c921294`:

- `campaign_items` usa o mesmo advisory lock antes do row lock em INSERT/UPDATE;
- viewer, membership inativa e member sem participação falham antes de consumir o lock;
- owner/editor/manager/admin preservam escrita de item em campanha ativa;
- campanha e item arquivados permanecem read-only;
- INSERT/UPDATE de item têm grants por coluna;
- updates autenticados de item exigem incremento de versão exatamente em uma unidade;
- o harness cobre campanha/participante, campanha/item e abuso de lock em duas sessões;
- o harness recusa banco remoto por padrão e limpa as fixtures de teste.

Gates já verdes no código `1a49c4d`:

```text
Task 2 pgTAP: 100/100
pgTAP completo: 197/197
DB lint: 0 erros
Schema diff: vazio
Harness campanha/participante: PASS
Upgrade legado: PASS
Writer F1 autenticado: PASS
```

Checks nativos da correção `c921294`:

```text
Harness node --check: PASS
Harness ESLint: PASS
Serviço sem banco: 21/21
Typecheck do serviço: PASS
Build do serviço: PASS
Contagem estrutural do pgTAP RLS: 88/88 declarações
Revisão estática: 0 Critical / 0 Important
```

Permanecem `deferred_to_vps`: observação RED/GREEN, reset/migrations, 228 asserts pgTAP, RLS real, harness concorrente, testes de participantes, DB lint/advisors/diff, upgrade legado e writer autenticado contra PostgreSQL.

### Task 3 — concluída e revisada

- contratos estritos de campanha, referência, datas, canais e prontidão;
- matriz de transições, reabertura e arquivamento;
- 13 testes de contrato, regressão nativa, typecheck e build aprovados no commit `9740530`.

### Task 4 — implementada, prova VPS pendente

- CRUD progressivo, patch estrito, filtros combináveis e cursor estável;
- concorrência otimista, preflight de autorização, transições, auditoria e eventos;
- 37 testes nativos aprovados e 12 cenários PostgreSQL coletados no commit `9b19ec7`.

### Task 5 — implementada, prova VPS pendente

- domínio e rotas REST para listar candidatos/participantes, adicionar, atualizar, remover e transferir o owner principal;
- primary owner gerencia viewer/editor; somente manager/admin altera owners;
- mutações idempotentes incrementam a versão do agregado sob o mesmo advisory lock;
- diretórios usam memberships ativas e projeção segura de `public.profiles`, inclusive redigindo nomes legados com valor de e-mail;
- helper de administração nega editor antes do lock;
- 39 testes nativos relevantes aprovados, 5 cenários PostgreSQL coletados e 92 asserts estruturais no arquivo RLS no commit `2c119f8`.

### Task 6 — implementada, prova VPS pendente

- cliente privado do Artifact Server para upload, metadata, access link e delete idempotente;
- domínio e rotas REST para upload binário, vínculo de artifact próprio, listagem, access link e unlink lógico;
- allowlist PDF/DOCX/XLSX/PPTX/TXT/CSV/PNG/JPEG/WEBP e limite de 25 MiB aplicados antes da rede;
- versão do agregado, preflight de autoridade, idempotência, auditoria e eventos preservados;
- upload novo é apagado por compensação quando a persistência falha antes do commit; unlink nunca apaga bytes compartilhados;
- 8 contratos nativos do Marketing Ops, 8 testes do Artifact Server, typecheck, build e parse estático do Compose aprovados;
- 3 cenários PostgreSQL coletados; imagem Linux, Compose, restart e persistência permanecem `deferred_to_vps`.

### Task 7 — implementada, prova VPS pendente

- cliente MCP read-only usa apenas `ens_rag_search` e `ens_rag_get_document` com timeout e erros públicos estáveis;
- busca retorna somente cursos ENS selecionáveis com `metadata.course_id`, deduplica chunks e reduz metadata de oferta;
- verificação confirma documento, tenant `ens`, coleção `courses` e `course_id` antes de persistir;
- título enviado pelo cliente é substituído pelo snapshot canônico, e mudanças não relacionadas continuam editáveis quando o RAG está indisponível;
- rota autenticada `GET /v1/references/courses`, permissão, configuração e dependência saudável no Compose implementadas;
- 10 contratos da Task 7, 26 testes do RAG, typechecks, build e parse estático do Compose aprovados;
- cenário de persistência PostgreSQL coletado; chamada MCP real e logs permanecem `deferred_to_vps`;
- nenhuma migration, mutação, conexão direta ou deploy foi feito no Supabase do RAG.

### Task 8 — implementada, prova VPS pendente

- auditoria e outbox passam a persistir snapshots minimizados; texto livre vira presença/tamanho/SHA-256 e secrets/URLs assinadas são redigidos;
- função privada projeta timeline por campanha sem conceder leitura bruta de `audit_events` a members;
- rota `GET /v1/campaigns/:campaignId/timeline` usa paginação por cursor, feature gate de leitura e contrato público limitado;
- ações e nomes de campo desconhecidos são normalizados/descartados em SQL e TypeScript;
- 7/7 testes da task, 65 checks nativos segmentados, typecheck e build aprovados;
- 7 asserts pgTAP foram adicionados; PostgreSQL/RLS/cross-tenant e inspeção do histórico real permanecem `deferred_to_vps`.

### Task 9 — implementada, prova VPS pendente

- 18 paths e 22 operações REST estão documentados e comparados automaticamente com o router Express;
- create/patch/list aceitam o contrato completo; aliases de filtros da Fase 1 permanecem deprecated;
- transition e archive são endpoints separados com `If-Match`, idempotência e ETag;
- participantes, materiais, referências, timeline e auditoria usam params/queries strict; erros do verifier são redigidos;
- OpenAPI 3.1 foi validado pelo Redocly sem erro/warning e preserva itens F1 como compatibilidade deprecated;
- 75 testes nativos, typecheck e build passaram;
- 6 testes REST, 6 MCP e 5 production-gate dependentes de PostgreSQL permanecem `deferred_to_vps`.

### Task 10 — implementada, integração VPS pendente

- tipos cobrem o contrato público de campanhas, transições, participantes, materiais, timeline e referências oficiais;
- todas as mutações enviam idempotência e, no agregado existente, `If-Match`; ETag e correlação são preservados no resultado;
- `MarketingOpsApiError` expõe `currentVersion` validada no 409 sem alterar o patch mantido pela futura UI;
- upload envia o `File` como corpo bruto com MIME e filename, sem serializar bytes em JSON;
- query keys separam lista, detalhe e recursos aninhados para invalidação previsível no TanStack Query;
- RED esperado observado; 11/11 testes focados, 131/131 na regressão frontend, lint sem erro, typecheck e build aprovados;
- auth/CORS/TLS, respostas reais, conflito concorrente e upload ponta a ponta permanecem `deferred_to_vps`.

### Task 11 — implementada, integração VPS pendente

- rota lazy e item da sidebar respeitam as flags default-off de leitura;
- lista usa TanStack Query, cursor, busca com debounce, filtros combináveis na URL e reset;
- tabela desktop e cards mobile exibem referência, status, período, canal localizado, owners e indicadores de atenção;
- criação name-only preserva o nome no erro, limpa rascunho cancelado e navega ao deep link da campanha;
- loading, vazio inicial/filtrado, acesso negado, erro com correlação, retry e “carregar mais” estão implementados;
- backend passou a projetar owners e alertas somente depois da paginação, com cenário PostgreSQL nominal coletado;
- RED dos módulos ausentes observado; 5/5 testes da jornada, 136/136 na regressão frontend e 76 testes puros/segmentados do Marketing Ops passaram;
- Chrome desktop/mobile confirmou filtros, criação, semântica, ausência de overflow e console limpo; typecheck, builds, Redocly, Artifact 8/8 e RAG 26/26 também passaram;
- auth/API/PostgreSQL reais, performance com volume, axe e E2E integrado permanecem `deferred_to_vps`.

### Task 12 — implementada, integração VPS pendente

- rota lazy de detalhe valida UUID e trata loading, 404, 403, erro com correlação e retry;
- formulário em Essenciais, Planejamento e Briefing gera patch mínimo e salva somente por ação explícita, sem autosave;
- datas, canal principal/secundários e referência são validados; o course picker preserva snapshot/documento oficial e degrada isoladamente quando o RAG falha;
- transições, reabertura controlada e archive usam versão/idempotência; campanha arquivada fica read-only;
- 409 preserva o patch local, recarrega a campanha e exige descartar ou reaplicar sobre a versão fresca;
- RED do módulo ausente foi observado; 6/6 testes focados, 142/142 na regressão frontend, lint sem erro, typecheck, build e security gate passaram;
- Chrome em 1440×900, 768×900 e 390×844 confirmou conflito/reaplicação, transição, archive, ausência de overflow e console final limpo;
- auth/capabilities reais, API/PostgreSQL, concorrência em duas sessões, RAG MCP real, E2E/axe e histórico persistido permanecem `deferred_to_vps`.

### Task 13 — implementada, integração VPS pendente

- painel de pessoas lista avatar/nome/papel/principal, busca candidatos e permite gestão conforme tenant/membership; viewer falha fechado e somente manager/admin transfere owner principal;
- painel de materiais valida 25 MiB, extensão e MIME antes da rede, cobre upload/vínculo, cria access link sob demanda com allowlist HTTP(S) e confirma unlink sem excluir bytes;
- timeline usa lista semântica, cursor, rótulos allowlisted, ator/origem/data e estados loading/vazio/erro/retry sem renderizar payload bruto;
- mutações aninhadas avançam a versão compartilhada da campanha; a revisão corrigiu query key da timeline, cache de owner principal e erros ocultos por diálogos;
- RED dos painéis ausentes foi observado; 22/22 testes focados, 156/156 na regressão frontend, lint sem erro, typecheck, build e security gate passaram;
- Chrome confirmou KV visual, sidebar oficial, painéis e ausência de overflow em 1440×900 e 390×844; a validação funcional anterior cobre 768×900; console final limpo;
- auth/capabilities, API/PostgreSQL/RLS, upload/Artifact real, paginação persistida, E2E/axe, Compose, restart, persistência e logs permanecem `deferred_to_vps`.

### Pacote documental — completo para o estado atual

- README funciona como índice de entregáveis e estados;
- progresso por task separa código, evidência executada e prova diferida;
- requisitos F2-RF-01..12 e critérios de aceite estão rastreados;
- riscos, LGPD/retenção, SLO, runbook e rollback estão documentados;
- deploy Supabase e validação VPS possuem checklists próprios, ainda não executados;
- Task 14 continuará responsável por atualizar o pacote com E2E, métricas e fechamento interno, não por criá-lo do zero.

## 3. Bloqueio encontrado no handoff — corrigido, prova real pendente

### Deadlock residual em `campaign_items`

O review de aceite foi interrompido após reproduzir `40P01` neste ciclo:

1. sessão A atualiza `marketing_ops.campaigns` e mantém o lock do agregado;
2. sessão B atualiza o mesmo `marketing_ops.campaign_items` sem passar pelo helper com advisory lock;
3. sessão B tenta atualizar a campanha e espera o lock da sessão A;
4. sessão A tenta atualizar o item já bloqueado pela sessão B;
5. PostgreSQL detecta o ciclo e aborta uma sessão com `40P01`.

As policies legadas na migration de fundação usavam `can_access_campaign`:

- `campaign_items_insert`;
- `campaign_items_update`.

O harness anterior cobria participante, não item. O commit `c921294` adiciona o ciclo determinístico de item; a observação RED no schema anterior e GREEN no schema corrigido será feita na VPS.

### Abuso de advisory lock corrigido no código

`marketing_ops_private.lock_campaign_aggregate(uuid)` agora exige autoridade real de mutação ou bootstrap antes do lock. O pgTAP verifica ausência de lock no backend e o harness mantém uma transação não autorizada aberta enquanto um manager tenta adquirir o mesmo lock. A execução real desses probes continua obrigatória na VPS.

## 4. Ordem de retomada executada

1. [x] Atualizar e confirmar `main`/HEAD.
2. [x] Ler PRD, design, plano, este handoff e [local-validation.md](local-validation.md).
3. [x] Confirmar a política deste computador: não usar Docker Desktop, WSL ou Podman; o baseline histórico do outro computador permanece como referência, não como evidência das novas alterações.
4. [x] Escrever/ampliar testes antes do SQL, com execução marcada `deferred_to_vps` quando exigir PostgreSQL real:
   - harness concorrente para `campaign_items` que falha com `40P01` no código atual;
   - pgTAP de viewer/editor/owner/manager para INSERT/UPDATE de item;
   - probe de advisory lock por usuário sem autoridade de mutação.
5. [ ] Observar na VPS o RED determinístico contra o schema anterior e o GREEN contra `c921294`.
6. [x] Corrigir a Task 2, sem iniciar a Task 3:
   - substituir policies de escrita de `campaign_items` por autorização que adquira o lock do agregado antes do row lock, alinhada a owner/editor/manager/admin e archived read-only;
   - ampliar o harness oficial para campanha/participante **e** campanha/item;
   - endurecer a pré-validação do helper se o probe de abuso confirmar aquisição indevida;
   - auditar grants de coluna de `campaign_items` para mass assignment, preservando o writer da Fase 1.
7. [x] Executar todos os checks nativos disponíveis e registrar os gates de banco/Linux como `deferred_to_vps`.
8. [x] Executar novo review estático da Task 2; resultado: zero `Critical`/`Important` após o hardening de versão.
9. [x] Atualizar README/evidência para `task_2_implemented_pending_vps_validation`.
10. [x] Concluir a Task 3 com TDD nativo. O aceite final da Task 2 permanece condicionado ao RED/GREEN e gate completo na VPS.
11. [x] Implementar e testar a Task 4; coletar nominalmente os 12 cenários PostgreSQL para a VPS.
12. [x] Implementar e testar a Task 5; coletar os 5 cenários PostgreSQL e preservar a projeção segura de perfis.
13. [x] Implementar e testar a Task 6; coletar os 3 cenários PostgreSQL e diferir imagem Linux, Compose, restart e persistência para a VPS.
14. [x] Implementar e testar a Task 7; coletar a persistência canônica e diferir a integração MCP real para a VPS.
15. [x] Implementar e testar a Task 8; coletar timeline/RLS e diferir a inspeção real para a VPS.
16. [x] Implementar e testar a Task 9; fechar REST/OpenAPI e coletar 17 cenários integrados para a VPS.
17. [x] Implementar e testar a Task 10; fechar o client tipado e diferir a integração real.
18. [x] Implementar e testar a Task 11; validar lista/criação no browser e coletar a projeção SQL para a VPS.
19. [x] Implementar e testar a Task 12; validar workspace/conflito/transições/archive no browser e diferir a integração real para a VPS.
20. [x] Implementar e testar a Task 13; validar participantes/materiais/timeline e KV visual no browser e diferir integração, E2E/axe e infraestrutura para a VPS.

## 5. Setup no outro computador

Este computador não usará Docker Desktop, WSL ou Podman, por decisão explícita do usuário. Na retomada em 14 de julho de 2026, esses runtimes não estavam instalados. A implementação deve preparar testes reproduzíveis e executar localmente apenas os checks nativos; banco, Linux e Compose serão validados na VPS depois do fechamento interno.

```powershell
git clone https://github.com/schultz0z0/projeto-ens-unificado.git
cd projeto-ens-unificado
git checkout main
git pull --ff-only origin main
git log -1 --oneline
```

Instalar dependências necessárias aos gates atuais:

```powershell
cd apps/chat-web
npm ci
```

Não remover nem reverter o bloco `55320–55329`: ele continua sendo o contrato reproduzível para qualquer ambiente descartável futuro e para os scripts versionados.

## 6. Comandos de baseline

Os comandos abaixo registram o baseline histórico obtido no computador anterior e o gate que deverá ser reexecutado na VPS. Eles não são executáveis neste Windows sem runtime de containers:

```powershell
npx supabase test db --local supabase/tests/marketing_ops_workspace.test.sql supabase/tests/marketing_ops_workspace_rls.test.sql
npx supabase test db --local
npm run test:campaign-concurrency
npx supabase db lint --local --schema marketing_ops,marketing_ops_private --level warning --fail-on error
npx supabase db advisors --local --type all --level warn --fail-on error
npx supabase db diff --local --schema marketing_ops,marketing_ops_private
npx eslint scripts/test_campaign_aggregate_concurrency.mjs
```

Resultados esperados antes da nova correção:

- Task 2: 100/100;
- total pgTAP: 197/197;
- harness atual campanha/participante: PASS;
- lint: vazio;
- diff: vazio;
- advisors: 81 warnings preexistentes e zero nos objetos novos/alterados.

Também validar o serviço quando a Task 2 voltar a ficar verde:

```powershell
cd ../../services/marketing-ops
npm ci
npm test
npm run typecheck
npm run build
```

Neste computador, executar arquivos e filtros Vitest explicitamente sem banco, além de `npm run typecheck`, `npm run build`, lint e verificações estáticas. Não usar `npm test` sem filtro como gate local: ele inclui suítes que abrem conexão com `MARKETING_OPS_TEST_DATABASE_URL`. Essas suítes ficam `deferred_to_vps`.

## 7. Restrições que não podem ser reinterpretadas

- `docs/phase-2/design.md` e o PRD aprovado são a fonte de verdade; o plano deve ser corrigido se divergir deles;
- `course_slug` permanece durante a Fase 2;
- busca usa somente `name` e `reference_title_snapshot`;
- `campaign_materials.source` é `upload|existing_artifact`;
- máximo de material é `26214400` bytes;
- exatamente um primary owner em todos os estados;
- `archived` é terminal e read-only;
- viewer não edita; owner/editor dependem de membership ativa; reabertura/arquivo são manager/admin;
- nenhuma escrita ou migration no Supabase do RAG;
- nenhuma limpeza de legado misturada à Fase 2;
- nenhum deploy remoto antes do fechamento interno dos checks nativos, revisão das migrations, backup e dry-run;
- o agente não executa deploy VPS; entrega comandos ao usuário no fechamento.
- o agente pode executar o deploy do Supabase do app depois desse fechamento interno e da confirmação inequívoca do projeto remoto;

## 8. Trabalho restante após a Task 13

As Tasks 14–15 permanecem pendentes: observabilidade/E2E/documentação, gate seguro de VPS, deploy Supabase do app, integração final e handoff VPS.

O backend das Tasks 3–9, a fundação tipada frontend da Task 10, a lista/criação da Task 11 e o workspace completo das Tasks 12–13 existem, mas as tasks dependentes de banco/integração ainda não possuem aceite VPS. A continuidade imediata é a Task 14, com observabilidade, E2E/axe preparado, Compose e script seguro de validação para a VPS.

Antes de cada próximo commit documental, atualizar [implementation-progress.md](implementation-progress.md), [local-validation.md](local-validation.md), a rastreabilidade afetada e este handoff. O pacote de operação deve permanecer com checkboxes pendentes até a evidência real correspondente.

## 9. Git e publicação

O usuário determinou branch única `main`. Não criar branch de feature. O agente pode criar commits locais testados, mas não executa `git push`; o usuário publicará manualmente. Antes de continuar:

```powershell
git status --short
git branch --show-current
git log --oneline -12
```

O esperado é worktree limpo e branch `main`. Commits futuros devem ser pequenos e testados. Depois de cada gate documentado, o agente entrega o commit local e o usuário decide quando enviá-lo para `origin/main`.
