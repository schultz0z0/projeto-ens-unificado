# Handoff de continuação — Fase 2

Este documento é a fonte de continuidade da Fase 2. Ele registra o estado versionado, o baseline histórico, a correção atual, as provas pendentes na VPS e a ordem dos próximos passos.

## 1. Ponto de retomada

- **Branch única:** `main`
- **Último commit de código da Task 2:** `c921294 fix: fecha concorrencia de itens da fase 2`
- **Commit de handoff:** o HEAD de `main` que contém este documento
- **Estado do worktree no snapshot:** limpo
- **Plano:** [2026-07-13-phase-2-workspace-operacional-mvp-implementation.md](../plans/2026-07-13-phase-2-workspace-operacional-mvp-implementation.md)
- **Estado de execução:** Task 1 concluída; Task 2 em `implemented_pending_vps_validation`; Task 3 `completed_reviewed`; Task 4 não iniciada
- **Ambientes remotos:** nenhum deploy Supabase ou VPS da Fase 2

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

Permanecem `deferred_to_vps`: observação RED/GREEN, reset/migrations, 217 asserts pgTAP, RLS real, harness concorrente, DB lint/advisors/diff, upgrade legado e writer autenticado contra PostgreSQL.

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

Neste computador, executar `npm test`, `npm run typecheck`, `npm run build`, lint e verificações estáticas que não abram conexão com PostgreSQL. Suítes de integração que usam `MARKETING_OPS_TEST_DATABASE_URL` ficam `deferred_to_vps`.

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

## 8. Trabalho restante após a Task 2

As Tasks 3–15 permanecem integralmente pendentes: contratos e estados no serviço, CRUD/busca, participantes, Artifact Server, RAG, timeline, REST/OpenAPI, cliente frontend, lista, workspace, UI completa, observabilidade/E2E/documentação, deploy Supabase, integração final e handoff VPS.

Não inferir que frontend ou backend da Fase 2 já existem apenas porque o schema está avançado.

## 9. Git e publicação

O usuário determinou branch única `main`. Não criar branch de feature. O agente pode criar commits locais testados, mas não executa `git push`; o usuário publicará manualmente. Antes de continuar:

```powershell
git status --short
git branch --show-current
git log --oneline -12
```

O esperado é worktree limpo e branch `main`. Commits futuros devem ser pequenos e testados. Depois de cada gate documentado, o agente entrega o commit local e o usuário decide quando enviá-lo para `origin/main`.
