# Handoff de continuação — Fase 2

Este documento é a fonte de retomada da Fase 2 em outro computador. Ele registra o estado versionado que deve ser clonado, o que já foi comprovado, o bloqueio atual e a ordem obrigatória dos próximos passos.

## 1. Ponto de retomada

- **Branch única:** `main`
- **Último commit de código da Task 2:** `1a49c4d fix: serializa mutacoes do agregado de campanha`
- **Commit de handoff:** o HEAD de `main` que contém este documento
- **Estado do worktree no snapshot:** limpo
- **Plano:** [2026-07-13-phase-2-workspace-operacional-mvp-implementation.md](../plans/2026-07-13-phase-2-workspace-operacional-mvp-implementation.md)
- **Estado de execução:** Task 1 concluída; Task 2 com `changes_requested`; Task 3 não iniciada
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

Os relatórios em `.superpowers/` eram scratch local ignorado pelo Git. Toda evidência necessária para continuar foi consolidada neste documento e em [local-validation.md](local-validation.md).

## 2. O que está pronto

### Task 1 — concluída e revisada

- contrato local Supabase movido para `55320–55329` por conflito de portas reservadas no Windows;
- Marketing Ops, Vite, scripts e testes usam API `55321` e DB `55322`;
- fail-closed de produção preservado;
- regressões de serviço, frontend e pgTAP passaram.

### Task 2 — implementada, mas ainda não aceita

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

## 3. Bloqueio atual — não pular

### Deadlock residual em `campaign_items`

O review de aceite foi interrompido após reproduzir `40P01` neste ciclo:

1. sessão A atualiza `marketing_ops.campaigns` e mantém o lock do agregado;
2. sessão B atualiza o mesmo `marketing_ops.campaign_items` sem passar pelo helper com advisory lock;
3. sessão B tenta atualizar a campanha e espera o lock da sessão A;
4. sessão A tenta atualizar o item já bloqueado pela sessão B;
5. PostgreSQL detecta o ciclo e aborta uma sessão com `40P01`.

As policies legadas estão na migration de fundação e ainda usam `can_access_campaign`:

- `campaign_items_insert`;
- `campaign_items_update`.

O harness atual cobre participante, não item. Por isso ele passa apesar do deadlock residual.

### Auditoria de abuso de advisory lock pendente

`marketing_ops_private.lock_campaign_aggregate(uuid)` pré-valida UUID, tenant e membership ativa. Ainda deve ser comprovado se viewer ou member não participante consegue chamar um helper autorizado a `authenticated`, adquirir o advisory lock de uma campanha do mesmo tenant e mantê-lo sem possuir capacidade de mutação. O aceite exige probe de duas sessões e fail-closed antes do lock.

## 4. Ordem obrigatória para retomar

1. Clonar e confirmar `main`/HEAD.
2. Ler PRD, design, plano, este handoff e [local-validation.md](local-validation.md).
3. Subir o Supabase local e reproduzir o baseline verde.
4. Escrever/ampliar testes antes do SQL:
   - harness concorrente para `campaign_items` que falha com `40P01` no código atual;
   - pgTAP de viewer/editor/owner/manager para INSERT/UPDATE de item;
   - probe de advisory lock por usuário sem autoridade de mutação.
5. Observar RED válido e registrar o código/espera do deadlock.
6. Corrigir a Task 2, sem iniciar a Task 3:
   - substituir policies de escrita de `campaign_items` por autorização que adquira o lock do agregado antes do row lock, alinhada a owner/editor/manager/admin e archived read-only;
   - ampliar o harness oficial para campanha/participante **e** campanha/item;
   - endurecer a pré-validação do helper se o probe de abuso confirmar aquisição indevida;
   - auditar grants de coluna de `campaign_items` para mass assignment, preservando o writer da Fase 1.
7. Obter GREEN focado e completo.
8. Executar novo review independente da Task 2. Zero `Critical`/`Important` é requisito para concluir.
9. Atualizar README/evidência para `task_2_completed_reviewed`.
10. Somente então iniciar a Task 3 do plano.

## 5. Setup no outro computador

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
npx supabase start
npx supabase db reset --local
```

Se o Docker Desktop/Hyper-V reservar as portas padrão, não reverta a configuração versionada: a Fase 2 usa o bloco local `55320–55329`.

## 6. Comandos de baseline

A partir de `apps/chat-web`:

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
- nenhum deploy remoto antes do gate local integral;
- o agente não executa deploy VPS; entrega comandos ao usuário no fechamento.

## 8. Trabalho restante após a Task 2

As Tasks 3–15 permanecem integralmente pendentes: contratos e estados no serviço, CRUD/busca, participantes, Artifact Server, RAG, timeline, REST/OpenAPI, cliente frontend, lista, workspace, UI completa, observabilidade/E2E/documentação, deploy Supabase, integração final e handoff VPS.

Não inferir que frontend ou backend da Fase 2 já existem apenas porque o schema está avançado.

## 9. Git e publicação

O usuário determinou branch única `main`. Não criar branch de feature. Antes de continuar:

```powershell
git status --short
git branch --show-current
git log --oneline -12
```

O esperado é worktree limpo e branch `main`. Commits futuros devem ser pequenos, testados e enviados para `origin/main` somente após cada gate documentado.
