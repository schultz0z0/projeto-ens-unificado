# Phase 2 Workspace Operacional MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in the current session. Steps use checkbox (`- [ ]`) syntax for tracking. Parallel agents are not used in this execution.

**Goal:** Entregar o Workspace Operacional MVP completo para criar, localizar, editar, acompanhar, concluir e arquivar campanhas reais com participantes, materiais, referências oficiais e histórico seguro.

**Architecture:** O frontend React consome somente a API REST do MarketingOps. O serviço TypeScript/Node mantém o Supabase do app como fonte operacional, consulta o RAG MCP somente para referências oficiais de curso e usa o Artifact Server para bytes; todas as mutações passam pela mesma camada de domínio, com RLS/RBAC, idempotência, auditoria e versão otimista.

**Tech Stack:** Node.js 22, TypeScript 5.9, Express 4.22, React 18, React Router 6, TanStack Query 5, Zod 3.25, PostgreSQL 17/Supabase CLI 2.109, pgTAP, Vitest 3/4, Testing Library, Playwright, axe-core, MCP SDK 1.29, Docker Compose.

## Execution Snapshot — 2026-07-14

- **Estado:** `in_progress`.
- **Branch canônica:** `main`, por decisão explícita do usuário.
- **Task 1:** `completed_reviewed`.
- **Task 2:** `implemented_pending_vps_validation`; o commit `c921294` corrige o caminho concorrente de `campaign_items`, o abuso de advisory lock, os grants e a progressão de versão. Checks nativos e revisão estática estão verdes; RED/GREEN PostgreSQL e gate de banco estão `deferred_to_vps`.
- **Task 3:** `completed_reviewed` no commit `9740530`; RED observado, 13 testes de contrato, regressão isolada de permissões, typecheck e build verdes.
- **Task 4:** `implemented_pending_vps_validation` no commit `9b19ec7`; filtros/cursores em RED/GREEN nativo, 12 testes PostgreSQL coletados, 37 testes nativos, typecheck e build verdes.
- **Task 5:** `implemented_pending_vps_validation` no commit `2c119f8`; RED de módulo ausente observado, domínio/rotas implementados, 39 testes nativos relevantes, typecheck e build verdes. Os cinco cenários PostgreSQL e os novos asserts pgTAP estão `deferred_to_vps`.
- **Task 6:** `implemented_pending_vps_validation` no commit `aed3e1c`; cliente e domínio de materiais, compensação, rotas, configuração privada, lockfile e integração Compose implementados. Oito contratos do Marketing Ops e oito testes do Artifact Server passaram; três cenários PostgreSQL e a prova Linux/Compose/persistência estão `deferred_to_vps`.
- **Task 7:** `implemented_pending_vps_validation` no commit `5d5cf8f`; busca e verificação read-only no RAG MCP, snapshot canônico, rota/configuração e fail-closed implementados. Dez contratos da Task 7 e 26 testes do RAG passaram; persistência PostgreSQL e chamada MCP real no Compose estão `deferred_to_vps`.
- **Task 8:** `implemented_pending_vps_validation` no commit `42d43f3`; minimização de auditoria/outbox, projeção privada, cursor, rota e allowlists implementados. Sete testes da task e 65 checks nativos segmentados passaram; 7 novos asserts pgTAP e a prova do histórico/RLS real estão `deferred_to_vps`.
- **Task 9:** `implemented_pending_vps_validation` no commit `6c713e7`; adapters REST estritos, transição, ETags, erros, capabilities e OpenAPI 3.1 completos. Setenta e cinco testes nativos e o lint Redocly passaram; 17 cenários REST/MCP/production-gate estão `deferred_to_vps`.
- **Task 10:** `implemented_pending_vps_validation` no commit `32acff2`; client tipado completo, query keys, headers de mutação, upload binário, ETag/correlação e `currentVersion` implementados. Onze testes focados, regressão frontend 131/131, lint sem erro, typecheck e build passaram; integração real client/API está `deferred_to_vps`.
- **Task 11:** `implemented_pending_vps_validation` no commit `df4903b`; lista responsiva, filtros em URL, cursor, criação name-only, estados operacionais e projeção resumida implementados. Cinco testes de jornada, regressão frontend 136/136, QA Chrome desktop/mobile e gates nativos passaram; API/PostgreSQL/E2E integrados estão `deferred_to_vps`.
- **Tasks 12–15:** `not_started`.
- **Deploy Supabase/VPS:** não executado.
- **Próxima frente:** Task 12, preservando a lista nominal de provas de banco, integração e Linux que deverão rodar na VPS.

Os checkboxes abaixo descrevem o plano original e não substituem este snapshot de execução. As Tasks 2 e 4–11 só podem ser promovidas ao aceite final depois dos respectivos gates PostgreSQL/integração/Linux/VPS; as revisões estáticas atuais terminaram sem achados `Critical` ou `Important`.

## Global Constraints

- A Fase 2 implementa somente o escopo de `docs/phase-2/design.md` e `docs/prds/phase-2-workspace-operacional-mvp.md`.
- Calendário, tarefas, conteúdo estruturado, aprovações, execução de canais, dashboards, automações, tags, hard delete e restore de arquivadas permanecem fora desta fase.
- O Supabase do app é a única fonte de verdade operacional; o Supabase do RAG permanece separado e somente leitura.
- O frontend nunca recebe service role, segredo interno do Artifact Server ou autoridade de tenant enviada pelo cliente.
- Toda mutação REST exige `Idempotency-Key`; mutações de agregado existente também exigem `If-Match`.
- Campanha, participante e vínculo de material compartilham a versão do agregado campanha.
- `member` acessa somente campanhas das quais participa; `manager` e `admin` acessam o tenant.
- Toda função de produção nasce depois de um teste RED observado e passa pelo ciclo RED–GREEN–REFACTOR.
- O upload de material aceita até 25 MiB e somente PDF, DOCX, XLSX, PPTX, TXT, CSV, PNG, JPEG e WEBP.
- O endpoint público permanece em `/v1`; mudanças são aditivas e o contrato OpenAPI é obrigatório.
- A busca usa cursor estável, limite padrão 25, máximo 100 e índice apropriado para 5.000 campanhas por tenant.
- Toda a execução ocorre diretamente em `main`, por autorização explícita do usuário; nenhuma branch adicional será criada.
- O agente pode criar commits locais pequenos e testados, mas não executa `git push`; a publicação é manual pelo usuário.
- Depois do fechamento interno dos checks nativos, revisão das migrations, backup e dry-run, o agente pode aplicar e validar as migrations no Supabase do app. O deploy VPS permanece reservado ao usuário.
- Este computador não usa Docker Desktop, WSL ou Podman. Testes de banco, imagens Linux, Compose, restart e persistência são preparados durante as tasks e executados na VPS após o fechamento interno.
- Testes devem continuar sendo escritos antes da implementação. Quando dependerem de PostgreSQL/Docker real, registrar `execution_deferred_to_vps`; não alegar RED/GREEN local.
- Uma task pode avançar para `implemented_pending_vps_validation` após revisão estática e checks nativos verdes. O aceite final continua pendente até a VPS.
- Depois das Tasks 1–15, o subestado é `implementation_complete_pending_vps_validation`, ainda dentro de `in_progress`; não usar `ready_for_production` ou `completed` antes do gate VPS diferido.

## File Map

- `apps/chat-web/supabase/migrations/20260714020344_phase_2_workspace_operational_mvp.sql`: evolução atômica do schema, índices, RLS, helpers e grants.
- `apps/chat-web/supabase/tests/marketing_ops_workspace.test.sql`: contrato pgTAP de schema, RLS, transições, imutabilidade e isolamento.
- `services/marketing-ops/src/domain/contracts.ts`: tipos, enums e schemas Zod do agregado.
- `services/marketing-ops/src/domain/campaigns.ts`: create/update/transitions/archive.
- `services/marketing-ops/src/domain/participants.ts`: candidatos, papéis e proprietário principal.
- `services/marketing-ops/src/domain/materials.ts`: vínculos de artefatos e acesso.
- `services/marketing-ops/src/domain/timeline.ts`: projeção segura de auditoria.
- `services/marketing-ops/src/domain/queries.ts`: lista, busca, detalhe e paginação.
- `services/marketing-ops/src/integrations/artifactClient.ts`: cliente interno do Artifact Server.
- `services/marketing-ops/src/integrations/ragCourseClient.ts`: cliente MCP somente leitura para cursos.
- `services/marketing-ops/src/http/routes/*.ts`: adaptação HTTP estrita sem regra de negócio.
- `services/marketing-ops/openapi/marketing-ops.v1.yaml`: contrato público completo.
- `apps/chat-web/src/lib/marketingOps/*.ts`: tipos, cliente, query keys, flags e deep links.
- `apps/chat-web/src/pages/marketing-ops/*.tsx`: lista, criação e workspace.
- `apps/chat-web/src/components/marketing-ops/*.tsx`: seções focadas de UI.
- `apps/chat-web/e2e/marketing-ops.spec.ts`: jornada desktop/mobile e acessibilidade.
- `docs/phase-2/*.md`: rastreabilidade, riscos, LGPD, SLO, runbooks e evidências.

---

### Task 1: Fixar o gate de entrada e o contrato aprovado

**Files:**
- Modify: `apps/chat-web/supabase/config.toml`
- Modify: `apps/chat-web/vite.config.ts`
- Modify: `services/marketing-ops/src/config.ts`
- Modify: `scripts/test/phase-1-local.sh`
- Modify: `docs/phase-2/design.md`
- Modify: `docs/prds/phase-2-workspace-operacional-mvp.md`
- Test: `services/marketing-ops/src/foundation.test.ts`

**Interfaces:**
- Produces: Supabase local em `55321`, Postgres local em `55322` e defaults de teste coerentes.

- [ ] **Step 1: Escrever o teste RED dos defaults locais**

```ts
it('uses the repository local Supabase port block outside Windows exclusions', () => {
  const config = loadConfig({ NODE_ENV: 'test' });
  expect(config.databaseUrl).toBe('postgresql://postgres:postgres@127.0.0.1:55322/postgres');
  expect(config.supabaseUrl).toBe('http://127.0.0.1:55321');
});
```

- [ ] **Step 2: Executar e observar a falha**

Run: `cd services/marketing-ops && npm test -- src/foundation.test.ts -t "repository local Supabase port block"`

Expected: FAIL mostrando os defaults antigos `54322` e `54321`.

- [ ] **Step 3: Alinhar todos os defaults locais**

Substituir o bloco `54320–54329` por `55320–55329` no `config.toml`, usar `55321` no Vitest/Vite e `55321/55322` nos defaults e scripts locais. URLs de produção continuam exclusivamente por variáveis.

- [ ] **Step 4: Verificar baseline**

Run: `cd apps/chat-web && npx supabase status && npx supabase test db --local supabase/tests`

Expected: stack ativo em `55321/55322` e 97 testes pgTAP passando.

- [ ] **Step 5: Commit**

```powershell
git add apps/chat-web/supabase/config.toml apps/chat-web/vite.config.ts services/marketing-ops/src/config.ts services/marketing-ops/src/foundation.test.ts scripts/test/phase-1-local.sh docs/phase-2/design.md docs/prds/phase-2-workspace-operacional-mvp.md
git commit -m "chore: estabiliza gate local da fase 2"
```

### Task 2: Evoluir o schema do agregado de campanha

**Files:**
- Modify: `apps/chat-web/supabase/migrations/20260714020344_phase_2_workspace_operational_mvp.sql`
- Modify: `apps/chat-web/supabase/tests/marketing_ops_foundation.test.sql`
- Create: `apps/chat-web/supabase/tests/marketing_ops_workspace.test.sql`
- Create: `apps/chat-web/supabase/tests/marketing_ops_workspace_rls.test.sql`
- Create: `apps/chat-web/scripts/test_campaign_aggregate_concurrency.mjs`
- Modify: `apps/chat-web/package.json`
- Modify: `apps/chat-web/supabase/seed.sql`

**Interfaces:**
- Produces: `campaign_status = draft|planned|active|completed|archived`, `reference_type`, `campaign_channel`, `campaign_material_source = upload|existing_artifact`, `campaign_materials`, `campaign_members.is_primary` e busca indexada.

- [ ] **Step 1: Criar o teste pgTAP RED**

```sql
begin;
select plan(32);
select has_column('marketing_ops', 'campaigns', 'objective');
select has_column('marketing_ops', 'campaigns', 'reference_type');
select has_column('marketing_ops', 'campaigns', 'reference_key');
select has_column('marketing_ops', 'campaigns', 'reference_title_snapshot');
select has_column('marketing_ops', 'campaigns', 'reference_document_id');
select has_column('marketing_ops', 'campaigns', 'reference_verified_at');
select has_column('marketing_ops', 'campaigns', 'audience');
select has_column('marketing_ops', 'campaigns', 'starts_on');
select has_column('marketing_ops', 'campaigns', 'ends_on');
select has_column('marketing_ops', 'campaigns', 'primary_channel');
select has_column('marketing_ops', 'campaigns', 'secondary_channels');
select has_column('marketing_ops', 'campaigns', 'briefing');
select has_column('marketing_ops', 'campaigns', 'notes');
select has_column('marketing_ops', 'campaign_members', 'is_primary');
select has_table('marketing_ops', 'campaign_materials');
select has_column('marketing_ops', 'campaign_materials', 'artifact_owner_id');
select has_column('marketing_ops', 'campaign_materials', 'source');
select has_index('marketing_ops', 'campaigns', 'campaigns_tenant_search_idx');
select has_index('marketing_ops', 'campaign_materials', 'campaign_materials_campaign_active_idx');
select has_index('marketing_ops', 'campaign_members', 'campaign_members_one_primary_idx');
select * from finish();
rollback;
```

- [ ] **Step 2: Executar e observar a falha de objetos ausentes**

Run: `cd apps/chat-web && npx supabase test db --local supabase/tests/marketing_ops_workspace.test.sql && npm run test:campaign-concurrency`

Expected: FAIL para colunas, tabela e índices ainda inexistentes; o harness concorrente reproduz `40P01` na ordem inversa campanha/participante.

- [ ] **Step 3: Implementar a migração**

Adicionar:

```sql
alter type marketing_ops.campaign_status add value if not exists 'planned' before 'archived';
alter type marketing_ops.campaign_status add value if not exists 'active' before 'archived';
alter type marketing_ops.campaign_status add value if not exists 'completed' before 'archived';
create type marketing_ops.reference_type as enum ('course', 'product', 'initiative');
create type marketing_ops.campaign_channel as enum ('email', 'instagram', 'linkedin', 'facebook', 'whatsapp', 'website', 'paid_media', 'events', 'press', 'other');
create type marketing_ops.campaign_material_source as enum ('upload', 'existing_artifact');
alter table marketing_ops.campaigns
  add column objective text,
  add column reference_type marketing_ops.reference_type,
  add column reference_key text,
  add column reference_title_snapshot text,
  add column reference_document_id uuid,
  add column reference_verified_at timestamptz,
  add column audience text,
  add column starts_on date,
  add column ends_on date,
  add column primary_channel marketing_ops.campaign_channel,
  add column secondary_channels marketing_ops.campaign_channel[] not null default '{}',
  add column briefing text,
  add column notes text;
alter table marketing_ops.campaign_members add column is_primary boolean not null default false;
create unique index campaign_members_one_primary_idx
  on marketing_ops.campaign_members (campaign_id) where is_primary;
create table marketing_ops.campaign_materials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  campaign_id uuid not null,
  artifact_id uuid not null,
  artifact_owner_id text not null,
  filename text not null,
  content_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  source marketing_ops.campaign_material_source not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unlinked_by uuid,
  unlinked_at timestamptz,
  constraint campaign_materials_campaign_fk foreign key (tenant_id, campaign_id)
    references marketing_ops.campaigns(tenant_id, id) on delete cascade,
  constraint campaign_materials_created_by_fk foreign key (created_by) references auth.users(id),
  constraint campaign_materials_unlinked_by_fk foreign key (unlinked_by) references auth.users(id),
  constraint campaign_materials_artifact_owner check (
    btrim(artifact_owner_id) <> '' and char_length(artifact_owner_id) <= 200
  ),
  constraint campaign_materials_size check (size_bytes between 1 and 26214400),
  constraint campaign_materials_sha256 check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint campaign_materials_unlink_consistent check ((unlinked_at is null) = (unlinked_by is null))
);
```

Adicionar checks de tamanho/período/referência e canais (máximo 9 secundários, sem duplicidade nem repetição do principal), `search_vector` gerado apenas de `name` e `reference_title_snapshot`, GIN, índices parciais, RLS/grants por coluna e revogação de `PUBLIC` em helpers. Mutações do agregado adquirem um advisory transaction lock derivado do UUID da campanha antes dos row locks; colisões do hash de 64 bits apenas serializam agregados distintos, pois autorização e acesso continuam usando UUID e tenant originais. O primeiro owner é promovido com segurança, o índice parcial limita a um principal e constraint triggers `DEFERRABLE INITIALLY DEFERRED` exigem exatamente um owner principal no commit.

- [ ] **Step 4: Resetar e verificar schema/RLS**

Run: `cd apps/chat-web && npx supabase db reset && npx supabase test db --local supabase/tests && npm run test:campaign-concurrency && npx supabase db lint --local --schema marketing_ops,marketing_ops_private --level warning --fail-on error`

Expected: todos os arquivos pgTAP passam; o harness termina sem `40P01`, deixa os dados intactos por `ROLLBACK` e confirma as invariantes unique/exactly-one/deferred; lint sem erros.

- [ ] **Step 5: Commit**

```powershell
git add apps/chat-web/package.json apps/chat-web/scripts/test_campaign_aggregate_concurrency.mjs apps/chat-web/supabase/migrations/20260714020344_phase_2_workspace_operational_mvp.sql apps/chat-web/supabase/tests/marketing_ops_foundation.test.sql apps/chat-web/supabase/tests/marketing_ops_workspace.test.sql apps/chat-web/supabase/tests/marketing_ops_workspace_rls.test.sql apps/chat-web/supabase/seed.sql docs/plans/2026-07-13-phase-2-workspace-operacional-mvp-implementation.md
git commit -m "feat: evolui schema operacional de campanhas"
```

### Task 3: Definir contratos e máquina de estados

**Files:**
- Create: `services/marketing-ops/src/domain/contracts.ts`
- Create: `services/marketing-ops/src/domain/contracts.test.ts`
- Modify: `services/marketing-ops/src/auth/permissions.ts`
- Modify: `services/marketing-ops/src/auth.test.ts`

**Interfaces:**
- Produces: `CampaignInputSchema`, `CampaignStatus`, `assertTransitionAllowed(actor, participant, from, to)` e `validatePlanningReadiness(campaign)`.

- [ ] **Step 1: Escrever testes RED de campos, prontidão e transições**

```ts
it('requires the planning minimum and enforces reopen authority', () => {
  expect(() => validatePlanningReadiness({
    name: 'Lançamento', objective: null, referenceTitleSnapshot: null,
    startsOn: null, endsOn: null, hasPrimaryOwner: true
  })).toThrowErrorMatchingObject({ code: 'campaign_requirements_missing' });
  expect(() => assertTransitionAllowed(
    { role: 'member' }, { memberRole: 'owner', isPrimary: true }, 'planned', 'draft'
  )).toThrowErrorMatchingObject({ code: 'forbidden' });
  expect(assertTransitionAllowed({ role: 'manager' }, null, 'planned', 'draft')).toBeUndefined();
});
```

- [ ] **Step 2: Observar RED**

Run: `cd services/marketing-ops && npm test -- src/domain/contracts.test.ts`

Expected: FAIL porque o módulo não existe.

- [ ] **Step 3: Implementar schemas e matriz**

```ts
export const CampaignStatusSchema = z.enum(['draft', 'planned', 'active', 'completed', 'archived']);
export const ReferenceTypeSchema = z.enum(['course', 'product', 'initiative']);
export const CampaignChannelSchema = z.enum(['email', 'instagram', 'linkedin', 'facebook', 'whatsapp', 'website', 'paid_media', 'events', 'press', 'other']);
export const CampaignPatchSchema = z.object({
  name: z.string().trim().min(1).max(200),
  objective: z.string().trim().max(2000).nullable(),
  referenceType: ReferenceTypeSchema.nullable(),
  referenceKey: z.string().trim().max(200).nullable(),
  referenceTitleSnapshot: z.string().trim().max(300).nullable(),
  referenceDocumentId: z.string().uuid().nullable(),
  audience: z.string().trim().max(2000).nullable(),
  startsOn: z.string().date().nullable(),
  endsOn: z.string().date().nullable(),
  primaryChannel: CampaignChannelSchema.nullable(),
  secondaryChannels: z.array(CampaignChannelSchema).max(9),
  briefing: z.string().trim().max(20000).nullable(),
  notes: z.string().trim().max(10000).nullable()
}).strict();
```

Codificar explicitamente as arestas `draft→planned→active→completed`, reaberturas de manager/admin e arquivamento terminal.

- [ ] **Step 4: Verificar GREEN e regressão de auth**

Run: `cd services/marketing-ops && npm test -- src/domain/contracts.test.ts src/auth.test.ts && npm run typecheck`

Expected: arquivos passam e TypeScript sai com código 0.

- [ ] **Step 5: Commit**

```powershell
git add services/marketing-ops/src/domain/contracts.ts services/marketing-ops/src/domain/contracts.test.ts services/marketing-ops/src/auth/permissions.ts services/marketing-ops/src/auth.test.ts
git commit -m "feat: define contratos e estados de campanha"
```

### Task 4: Expandir CRUD, busca e concorrência do agregado

**Files:**
- Modify: `services/marketing-ops/src/domain/campaigns.ts`
- Modify: `services/marketing-ops/src/domain/queries.ts`
- Modify: `services/marketing-ops/src/domain.test.ts`
- Create: `services/marketing-ops/src/domain/campaignTransitions.test.ts`

**Interfaces:**
- Produces: `createCampaignDraft`, `updateCampaign`, `transitionCampaign`, `archiveCampaign`, `listCampaigns`, `getCampaign`.

- [ ] **Step 1: RED para create mínimo, patch completo, busca e conflito**

```ts
it('creates a name-only draft with the creator as primary owner', async () => {
  const campaign = await createCampaignDraft(context(), { name: 'MVP', idempotencyKey: randomUUID() });
  const owner = await pool.query('select member_role::text, is_primary from marketing_ops.campaign_members where campaign_id = $1', [campaign.id]);
  expect(campaign).toMatchObject({ name: 'MVP', status: 'draft', version: 1 });
  expect(owner.rows[0]).toEqual({ member_role: 'owner', is_primary: true });
});
```

Adicionar testes para busca `q`, filtros `referenceType/referenceKey/status/channel/responsible/periodFrom/periodTo`, cursor inválido, `draft→planned`, reabertura, arquivamento de qualquer não arquivada e 409 contendo `currentVersion`.

- [ ] **Step 2: Observar RED**

Run: `cd services/marketing-ops && npm test -- src/domain.test.ts src/domain/campaignTransitions.test.ts`

Expected: FAIL nas novas propriedades e transições.

- [ ] **Step 3: Implementar consultas e comandos**

As queries usam parâmetros posicionais, `search_vector @@ websearch_to_tsquery('simple', $q)` com fallback de prefixo seguro, ordenação `updated_at desc, id desc`, `limit + 1` e nunca concatenam entrada.

Todas as mutações executam, na mesma transação:

```ts
const before = await lockCampaign(client, id);
assertExpectedVersion(before.version, expectedVersion);
const updated = await client.query<CampaignRow>(UPDATE_SQL, values);
await writeAudit(client, context, 'campaign', id, action, auditSnapshot(before), auditSnapshot(updated.rows[0]!));
await writeDomainEvent(client, context, 'campaign', id, eventType, campaignEventPayload(updated.rows[0]!));
return mapCampaign(updated.rows[0]!);
```

- [ ] **Step 4: Verificar GREEN, atomicidade e plano de busca**

Run: `cd services/marketing-ops && npm test -- src/domain.test.ts src/domain/campaignTransitions.test.ts && npm run typecheck`

Run: `docker exec supabase_db_chat-web psql -U postgres -d postgres -c "explain select id from marketing_ops.campaigns where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and search_vector @@ websearch_to_tsquery('simple','curso') order by updated_at desc,id desc limit 25"`

Expected: testes passam; plano é elegível ao GIN/índice tenant sem sequential scan obrigatório em volume.

- [ ] **Step 5: Commit**

```powershell
git add services/marketing-ops/src/domain/campaigns.ts services/marketing-ops/src/domain/queries.ts services/marketing-ops/src/domain.test.ts services/marketing-ops/src/domain/campaignTransitions.test.ts
git commit -m "feat: completa ciclo de vida de campanhas"
```

### Task 5: Implementar participantes e resolução segura de perfis

**Files:**
- Create: `services/marketing-ops/src/domain/participants.ts`
- Create: `services/marketing-ops/src/domain/participants.test.ts`
- Create: `services/marketing-ops/src/http/routes/participants.ts`
- Modify: `services/marketing-ops/src/http/routes/index.ts`

**Interfaces:**
- Produces: `listParticipants`, `listParticipantCandidates`, `addParticipant`, `updateParticipant`, `removeParticipant`.

- [x] **Step 1: RED da regra de proprietário principal**

```ts
it('moves primary ownership atomically and protects the last primary owner', async () => {
  const added = await addParticipant(context(), campaign.id, 1, {
    userId: managerId, memberRole: 'owner', isPrimary: true, idempotencyKey: randomUUID()
  });
  expect(added.campaignVersion).toBe(2);
  expect(await primaryOwnerIds(campaign.id)).toEqual([managerId]);
  await expect(removeParticipant(context(), campaign.id, managerId, 2, randomUUID()))
    .rejects.toMatchObject({ code: 'primary_owner_required' });
});
```

- [x] **Step 2: Observar RED**

Run: `cd services/marketing-ops && npm test -- src/domain/participants.test.ts`

Expected: FAIL porque o domínio não existe.

- [x] **Step 3: Implementar domínio e candidatos**

`listParticipantCandidates` lê apenas memberships ativas e `public.profiles(id, full_name, avatar_url)`, retornando:

```ts
export interface ParticipantCandidate {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  tenantRole: 'member' | 'manager' | 'admin';
}
```

Nunca retornar email, metadados do Auth ou registros de outro tenant. O owner principal pode gerenciar viewer/editor; somente manager/admin altera owner ou remove o proprietário principal.

- [ ] **Step 4: Verificar GREEN e RLS** — contrato, matriz, typecheck e build aprovados; cinco cenários PostgreSQL/RLS e o total atual de 228 asserts pgTAP `deferred_to_vps`.

Run: `cd services/marketing-ops && npm test -- src/domain/participants.test.ts src/auth.test.ts && npm run typecheck`

Expected: testes passam incluindo membro não participante, owner, manager e admin.

- [x] **Step 5: Commit** — `2c119f8 feat: adiciona participantes de campanha`.

```powershell
git add services/marketing-ops/src/domain/participants.ts services/marketing-ops/src/domain/participants.test.ts services/marketing-ops/src/http/routes/participants.ts services/marketing-ops/src/http/routes/index.ts
git commit -m "feat: adiciona participantes de campanha"
```

### Task 6: Integrar materiais ao Artifact Server

**Files:**
- Create: `services/artifact-server/package-lock.json`
- Create: `services/marketing-ops/src/integrations/artifactClient.ts`
- Create: `services/marketing-ops/src/integrations/artifactClient.test.ts`
- Create: `services/marketing-ops/src/domain/materials.ts`
- Create: `services/marketing-ops/src/domain/materials.test.ts`
- Create: `services/marketing-ops/src/http/routes/materials.ts`
- Modify: `services/marketing-ops/src/http/routes/index.ts`

**Interfaces:**
- Produces: `ArtifactClient.upload/getMetadata/createAccessLink/delete`, `attachUploadedMaterial`, `linkExistingMaterial`, `unlinkMaterial`, `listMaterials`.

- [x] **Step 1: RED do cliente HTTP e compensação**

```ts
it('deletes a newly uploaded artifact when the database transaction fails', async () => {
  const artifact = fakeArtifact();
  artifactServer.post('/v1/artifacts').reply(201, artifact);
  await expect(attachUploadedMaterial(failingContext(), campaign.id, 1, file(), randomUUID()))
    .rejects.toThrow('injected database failure');
  expect(artifactServer.isDone()).toBe(true);
  expect(deletedArtifactIds).toEqual([artifact.id]);
});
```

- [x] **Step 2: Observar RED**

Run: `cd services/marketing-ops && npm test -- src/integrations/artifactClient.test.ts src/domain/materials.test.ts`

Expected: FAIL por módulos ausentes.

- [x] **Step 3: Implementar adaptador e domínio**

```ts
export interface ArtifactMetadata {
  id: string; ownerId: string; filename: string; contentType: string;
  size: number; sha256: string; createdAt: string; source: string;
}
export interface ArtifactAccessLink { url: string; expiresAt: string }
export const CampaignMaterialSourceSchema = z.enum(['upload', 'existing_artifact']);
export interface CampaignMaterial {
  artifactId: string;
  artifactOwnerId: string;
  source: z.infer<typeof CampaignMaterialSourceSchema>;
}
```

O upload envia bytes como corpo, `Authorization: Bearer <internal key>`, `X-Nexus-Owner-Id`, `X-Nexus-Filename`, `X-Nexus-Content-Type`, `X-Nexus-Source: marketing_ops`. Validar MIME/extensão e 25 MiB antes da rede. `unlink` marca `unlinked_at/unlinked_by` e não apaga o binário compartilhado.

- [x] **Step 4: Verificar GREEN nativo e coletar cenários PostgreSQL**

Run: `cd services/artifact-server && npm install --package-lock-only && npm test`

Run: `cd services/marketing-ops && npm test -- src/integrations/artifactClient.test.ts src/domain/materials.test.ts && npm run typecheck`

Expected: Artifact Server 8 testes passando; materiais e compensação passando.

Resultado em 2026-07-14: 8/8 testes do Artifact Server, 4/4 contratos do `ArtifactClient` e 4/4 contratos de material sem banco aprovados. Os três cenários de material que usam PostgreSQL foram coletados e permanecem `deferred_to_vps`; imagem Linux, Compose, restart e persistência também aguardam a VPS.

- [x] **Step 5: Commit** — `aed3e1c feat: vincula materiais de campanha`.

```powershell
git add services/artifact-server/package-lock.json services/marketing-ops/src/integrations/artifactClient.ts services/marketing-ops/src/integrations/artifactClient.test.ts services/marketing-ops/src/domain/materials.ts services/marketing-ops/src/domain/materials.test.ts services/marketing-ops/src/http/routes/materials.ts services/marketing-ops/src/http/routes/index.ts
git commit -m "feat: vincula materiais de campanha"
```

### Task 7: Integrar referências oficiais do RAG em leitura

**Files:**
- Create: `services/marketing-ops/src/integrations/ragCourseClient.ts`
- Create: `services/marketing-ops/src/integrations/ragCourseClient.test.ts`
- Create: `services/marketing-ops/src/http/routes/references.ts`
- Modify: `services/marketing-ops/src/http/routes/index.ts`
- Modify: `services/marketing-ops/src/domain/campaigns.ts`

**Interfaces:**
- Produces: `searchCourses(query, limit)`, `verifyCourseReference(documentId, referenceKey)` e `GET /v1/references/courses`.

- [x] **Step 1: RED de normalização e fail-closed**

```ts
it('returns only course results with metadata.course_id and verifies document identity', async () => {
  const results = await client.searchCourses('gestão', 10);
  expect(results).toEqual([{
    referenceKey: 'curso-123', title: 'Gestão', documentId,
    collection: 'courses', verifiedAt: expect.any(String)
  }]);
  await expect(client.verifyCourseReference(otherDocumentId, 'curso-123'))
    .rejects.toMatchObject({ code: 'reference_not_verified' });
});
```

- [x] **Step 2: Observar RED**

Run: `cd services/marketing-ops && npm test -- src/integrations/ragCourseClient.test.ts`

Expected: FAIL porque o adapter não existe.

- [x] **Step 3: Implementar cliente MCP**

Usar `Client` e `StreamableHTTPClientTransport` com timeout, chamar `ens_rag_search` com `collections:['courses']`, `actor_profile:'marketing_ops'`, `require_evidence:true`; verificar seleção com `ens_rag_get_document`. Resultados sem `metadata.course_id` não são selecionáveis.

Se o RAG estiver indisponível, retornar `dependency_unavailable`; o draft continua editável, mas `draft→planned` falha quando uma referência `course` não possui `reference_verified_at`.

- [x] **Step 4: Verificar GREEN e regressão RAG disponível**

Run: `cd services/marketing-ops && npm test -- src/integrations/ragCourseClient.test.ts src/domain/campaignTransitions.test.ts`

Run: `cd services/rag-mcp && npm test && npm run typecheck`

Expected: testes passam sem gravação no Supabase do RAG.

Resultado em 2026-07-14: 10/10 contratos nativos da Task 7 e 26/26 testes do `rag-mcp` aprovados, com typecheck dos dois serviços e build do Marketing Ops. O novo cenário de persistência canônica foi coletado e a chamada MCP real contra o RAG no Compose permanece `deferred_to_vps`; nenhuma escrita ou conexão direta ao Supabase do RAG foi feita.

- [x] **Step 5: Commit** — `5d5cf8f feat: adiciona referencias oficiais de cursos`.

```powershell
git add services/marketing-ops/src/integrations/ragCourseClient.ts services/marketing-ops/src/integrations/ragCourseClient.test.ts services/marketing-ops/src/http/routes/references.ts services/marketing-ops/src/http/routes/index.ts services/marketing-ops/src/domain/campaigns.ts
git commit -m "feat: adiciona referencias oficiais de cursos"
```

### Task 8: Projetar timeline segura e auditoria minimizada

**Files:**
- Modify: `services/marketing-ops/src/domain/audit.ts`
- Modify: `services/marketing-ops/src/domain/events.ts`
- Create: `services/marketing-ops/src/domain/timeline.ts`
- Create: `services/marketing-ops/src/domain/timeline.test.ts`
- Create: `services/marketing-ops/src/http/routes/timeline.ts`
- Modify: `services/marketing-ops/src/http/routes/index.ts`
- Modify: migration e pgTAP da Fase 2 para projeção privada/RLS

**Interfaces:**
- Produces: `auditSnapshot`, `listCampaignTimeline` e itens `CampaignTimelineEvent` sem payload bruto.

- [x] **Step 1: RED de minimização**

```ts
it('never exposes briefing, notes, signed URLs or tokens in timeline events', async () => {
  const timeline = await listCampaignTimeline(context(), campaign.id, { limit: 25 });
  const serialized = JSON.stringify(timeline);
  expect(serialized).not.toContain('briefing secreto');
  expect(serialized).not.toContain('token=');
  expect(timeline.data[0]).toMatchObject({
    action: 'campaign.updated', actor: { displayName: expect.any(String) },
    changes: expect.arrayContaining([{ field: 'briefing', kind: 'changed' }])
  });
});
```

- [x] **Step 2: Observar RED**

Run: `cd services/marketing-ops && npm test -- src/domain/timeline.test.ts`

Expected: FAIL por módulo ausente.

- [x] **Step 3: Implementar snapshots e projeção**

Campos textuais sensíveis entram na auditoria somente como:

```ts
{ present: value !== null && value !== '', length: value?.length ?? 0, sha256: value ? sha256(value) : null }
```

A timeline retorna ação, timestamp, ator resolvido, origem e nomes de campos alterados. Nunca retorna `before_state`/`after_state` crus, content URL, access link, tokens ou texto integral.

- [ ] **Step 4: Verificar GREEN**

Run: `cd services/marketing-ops && npm test -- src/domain/timeline.test.ts src/domain.test.ts && npm run typecheck`

Expected: timeline segura e regressão de atomicidade passando.

Resultado parcial executado: 7/7 testes da task, 65 checks nativos segmentados, typecheck e build passaram. `domain.test.ts`, os 228 pgTAP e a validação PostgreSQL/RLS permanecem `deferred_to_vps`; por isso este passo e a task não recebem aceite final.

- [x] **Step 5: Commit**

```powershell
git add services/marketing-ops/src/domain/audit.ts services/marketing-ops/src/domain/timeline.ts services/marketing-ops/src/domain/timeline.test.ts services/marketing-ops/src/http/routes/timeline.ts services/marketing-ops/src/http/routes/index.ts
git commit -m "feat: adiciona timeline segura de campanhas"
```

### Task 9: Fechar REST v1 e OpenAPI

**Files:**
- Modify: `services/marketing-ops/src/domain/contracts.ts`
- Modify: `services/marketing-ops/src/http/routes/campaigns.ts`
- Modify: `services/marketing-ops/src/http/routes/participants.ts`
- Modify: `services/marketing-ops/src/http/routes/materials.ts`
- Modify: `services/marketing-ops/src/http/routes/references.ts`
- Review (sem mudança necessária): `services/marketing-ops/src/http/routes/timeline.ts`
- Modify: `services/marketing-ops/src/http/middleware.ts`
- Create: `services/marketing-ops/src/http/middleware.test.ts`
- Modify: `services/marketing-ops/src/http/routes/audit.ts`
- Modify: `services/marketing-ops/src/http/routes/capabilities.ts`
- Modify: `services/marketing-ops/openapi/marketing-ops.v1.yaml`
- Modify: `services/marketing-ops/src/rest.test.ts`

**Interfaces:**
- Produces: endpoints descritos na seção 10 de `docs/phase-2/design.md` com envelopes e ETags uniformes; itens REST da Fase 1 permanecem como compatibilidade deprecated.

- [x] **Step 1: RED do inventário público**

```ts
expect(Object.keys(document.paths).sort()).toEqual([
  '/audit-events', '/campaigns', '/campaigns/{campaignId}/items',
  '/campaigns/{campaignId}/items/{itemId}', '/campaigns/{campaignId}/materials',
  '/campaigns/{campaignId}/materials/link', '/campaigns/{campaignId}/materials/upload',
  '/campaigns/{campaignId}/materials/{materialId}',
  '/campaigns/{campaignId}/materials/{materialId}/access-link',
  '/campaigns/{campaignId}/participant-candidates',
  '/campaigns/{campaignId}/participants',
  '/campaigns/{campaignId}/participants/{userId}',
  '/campaigns/{campaignId}/timeline', '/campaigns/{id}',
  '/campaigns/{id}/archive', '/campaigns/{id}/transitions',
  '/capabilities', '/references/courses'
]);
```

- [x] **Step 2: Observar RED**

Run: `cd services/marketing-ops && npm test -- src/rest.test.ts -t "keeps every public REST operation|parses the complete strict campaign REST contract|documents required mutation headers"`

Observed: três falhas por paths, parsers e schemas/headers ausentes.

- [x] **Step 3: Implementar adapters e contrato**

Usar Zod `.strict()`; UUID, datas, enum, cursor e limite são validados. Multipart/bytes de material usa limite de 25 MiB e não passa pelo parser JSON de 256 KiB. Respostas de mutação retornam ETag da campanha. Erros públicos estáveis: `validation_error`, `forbidden`, `not_found`, `invalid_transition`, `campaign_requirements_missing`, `primary_owner_required`, `participant_role_invalid`, `reference_not_verified`, `artifact_not_owned`, `material_type_not_allowed`, `material_too_large`, `version_conflict` e `dependency_unavailable` para indisponibilidade de integração.

- [ ] **Step 4: Verificar REST e MCP Fase 1**

Run: `cd services/marketing-ops && npm test -- src/rest.test.ts src/mcp.test.ts src/production-gate.test.ts && npm run typecheck && npm run build`

Expected: REST novo passa; ferramentas MCP v1 existentes continuam verdes.

Resultado parcial executado: 75 testes nativos segmentados, typecheck, build e Redocly sem erro/warning passaram. Os 6 testes REST, 6 MCP e 5 production-gate dependentes de PostgreSQL permanecem `deferred_to_vps`; por isso este passo e a task não recebem aceite final.

- [x] **Step 5: Commit**

```powershell
git add services/marketing-ops/src/domain/contracts.ts services/marketing-ops/src/http services/marketing-ops/openapi/marketing-ops.v1.yaml services/marketing-ops/src/rest.test.ts
git commit -m "feat: publica api rest do workspace operacional"
```

### Task 10: Expandir o cliente frontend tipado

**Files:**
- Modify: `apps/chat-web/src/lib/marketingOps/types.ts`
- Modify: `apps/chat-web/src/lib/marketingOps/client.ts`
- Create: `apps/chat-web/src/lib/marketingOps/queryKeys.ts`
- Modify: `apps/chat-web/src/lib/marketingOps/client.test.ts`
- Create: `apps/chat-web/src/lib/marketingOps/queryKeys.test.ts`

**Interfaces:**
- Produces: cliente de campanhas, transições, participantes, materiais, timeline, referências e `MarketingOpsApiError` com versão atual.

- [x] **Step 1: RED de headers, upload e erro 409**

```ts
it('keeps local values and exposes currentVersion on a version conflict', async () => {
  fetch.mockResolvedValue(response(409, {
    error: { code: 'version_conflict', message: 'stale', details: { currentVersion: 7 } }
  }));
  await expect(client.updateCampaign(id, 6, patch, 'idem'))
    .rejects.toMatchObject({ code: 'version_conflict', currentVersion: 7 });
});
```

- [x] **Step 2: Observar RED**

Run: `cd apps/chat-web && npm test -- src/lib/marketingOps/client.test.ts src/lib/marketingOps/queryKeys.test.ts`

Expected: FAIL nas APIs novas.

Resultado observado: suite de query keys falhou por módulo ausente; client falhou por `currentVersion`, transição e APIs de recursos inexistentes.

- [x] **Step 3: Implementar cliente e query keys**

```ts
export const marketingOpsKeys = {
  all: ['marketing-ops'] as const,
  campaigns: (filters: MarketingOpsCampaignFilters) => ['marketing-ops', 'campaigns', filters] as const,
  campaign: (id: string) => ['marketing-ops', 'campaign', id] as const,
  participants: (id: string) => ['marketing-ops', 'campaign', id, 'participants'] as const,
  materials: (id: string) => ['marketing-ops', 'campaign', id, 'materials'] as const,
  timeline: (id: string) => ['marketing-ops', 'campaign', id, 'timeline'] as const
};
```

O upload envia `File` como corpo com headers de filename/content-type, sem serializar bytes em JSON. Cada mutação gera correlação preservada, `Idempotency-Key` e `If-Match`.

- [x] **Step 4: Verificar GREEN**

Run: `cd apps/chat-web && npm test -- src/lib/marketingOps && npm run typecheck`

Expected: cliente e tipos passam.

Resultado executado: 11/11 testes focados, regressão frontend 131/131, ESLint sem erro, typecheck e build passaram. Dez warnings de lint e os warnings de bundle são preexistentes e estão fora do módulo. A integração real client/API permanece `deferred_to_vps`, portanto a task não recebe aceite final.

- [x] **Step 5: Commit**

```powershell
git add apps/chat-web/src/lib/marketingOps
git commit -m "feat: expande cliente web de marketing ops"
```

### Task 11: Implementar lista, filtros e criação de campanha

**Files:**
- Create: `apps/chat-web/src/pages/marketing-ops/CampaignListPage.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/CampaignFilters.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/CampaignTable.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/CreateCampaignDialog.tsx`
- Create: `apps/chat-web/src/pages/marketing-ops/CampaignListPage.test.tsx`
- Modify: `apps/chat-web/src/App.tsx`
- Modify: `apps/chat-web/src/components/Sidebar.tsx`

**Interfaces:**
- Produces: rota `/marketing-ops/campaigns`, filtros em URL, paginação cursor e criação name-only.

- [x] **Step 1: RED da jornada de lista**

```tsx
it('syncs filters to the URL and opens the created campaign', async () => {
  renderApp('/marketing-ops/campaigns');
  await user.type(screen.getByRole('searchbox', { name: /buscar campanhas/i }), 'gestão');
  await user.selectOptions(screen.getByLabelText(/status/i), 'planned');
  expect(location.search).toContain('q=gest%C3%A3o');
  expect(location.search).toContain('status=planned');
  await user.click(screen.getByRole('button', { name: /nova campanha/i }));
  await user.type(screen.getByLabelText(/nome/i), 'Lançamento');
  await user.click(screen.getByRole('button', { name: /^criar$/i }));
  expect(location.pathname).toBe(`/marketing-ops/campaigns/${campaignId}`);
});
```

- [x] **Step 2: Observar RED**

Run: `cd apps/chat-web && npm test -- src/pages/marketing-ops/CampaignListPage.test.tsx`

Expected: FAIL porque rota/componentes não existem.

- [x] **Step 3: Implementar UI responsiva**

Usar `React.lazy` no `App.tsx`, TanStack Query, tabela no desktop e cards no mobile. Estados obrigatórios: loading skeleton, empty, error com correlation ID, lista, “carregar mais”. Sidebar exibe o item apenas quando `marketingOpsFlags(import.meta.env).read` for verdadeiro.

- [x] **Step 4: Verificar GREEN e navegação por teclado**

Run: `cd apps/chat-web && npm test -- src/pages/marketing-ops/CampaignListPage.test.tsx && npm run typecheck`

Expected: jornada passa; controles possuem label, foco e ordem de tabulação.

Resultado executado: 5/5 testes da página e regressão frontend 136/136 passaram. QA Chrome em desktop/mobile confirmou filtros na URL, criação/deep link, labels, cartões/tabela, ausência de overflow e console limpo. API real, axe e E2E no Compose permanecem `deferred_to_vps`.

- [x] **Step 5: Commit** — `df4903b feat: adiciona lista e criacao de campanhas`.

```powershell
git add apps/chat-web/src/pages/marketing-ops/CampaignListPage.tsx apps/chat-web/src/pages/marketing-ops/CampaignListPage.test.tsx apps/chat-web/src/components/marketing-ops/CampaignFilters.tsx apps/chat-web/src/components/marketing-ops/CampaignTable.tsx apps/chat-web/src/components/marketing-ops/CreateCampaignDialog.tsx apps/chat-web/src/App.tsx apps/chat-web/src/components/Sidebar.tsx
git commit -m "feat: adiciona lista e criacao de campanhas"
```

### Task 12: Implementar workspace, salvamento explícito e conflito

**Files:**
- Create: `apps/chat-web/src/pages/marketing-ops/CampaignWorkspacePage.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/CampaignHeader.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/CampaignFieldsForm.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/CourseReferencePicker.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/StatusTransitionMenu.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/VersionConflictDialog.tsx`
- Create: `apps/chat-web/src/pages/marketing-ops/CampaignWorkspacePage.test.tsx`
- Modify: `apps/chat-web/src/App.tsx`

**Interfaces:**
- Produces: rota `/marketing-ops/campaigns/:campaignId`, edição de campos, transições e resolução de 409 sem autosave.

- [ ] **Step 1: RED de salvamento e conflito**

```tsx
it('preserves local values on 409 and allows reapply over the fresh version', async () => {
  renderWorkspace(campaignV3);
  await user.clear(screen.getByLabelText(/objetivo/i));
  await user.type(screen.getByLabelText(/objetivo/i), 'Objetivo local');
  await user.click(screen.getByRole('button', { name: /salvar alterações/i }));
  expect(await screen.findByRole('dialog', { name: /conflito de versão/i })).toBeVisible();
  expect(screen.getByText('Objetivo local')).toBeVisible();
  await user.click(screen.getByRole('button', { name: /reaplicar minhas alterações/i }));
  expect(api.updateCampaign).toHaveBeenLastCalledWith(campaignId, 4, expect.objectContaining({ objective: 'Objetivo local' }), expect.any(String));
});
```

- [ ] **Step 2: Observar RED**

Run: `cd apps/chat-web && npm test -- src/pages/marketing-ops/CampaignWorkspacePage.test.tsx`

Expected: FAIL por rota/componentes ausentes.

- [ ] **Step 3: Implementar workspace**

Layout: header com status/versão/ações; formulário em seções “Essenciais”, “Planejamento” e “Briefing”; rodapé sticky com “Descartar” e “Salvar alterações”. Course picker busca com debounce, mostra indisponibilidade do RAG e grava snapshot/document id. O diálogo de conflito oferece somente “Descartar minhas alterações” e “Reaplicar minhas alterações”.

- [ ] **Step 4: Verificar GREEN**

Run: `cd apps/chat-web && npm test -- src/pages/marketing-ops/CampaignWorkspacePage.test.tsx && npm run typecheck`

Expected: save explícito, transições, deep link inválido/404 e conflito passam.

- [ ] **Step 5: Commit**

```powershell
git add apps/chat-web/src/pages/marketing-ops/CampaignWorkspacePage.tsx apps/chat-web/src/pages/marketing-ops/CampaignWorkspacePage.test.tsx apps/chat-web/src/components/marketing-ops/CampaignHeader.tsx apps/chat-web/src/components/marketing-ops/CampaignFieldsForm.tsx apps/chat-web/src/components/marketing-ops/CourseReferencePicker.tsx apps/chat-web/src/components/marketing-ops/StatusTransitionMenu.tsx apps/chat-web/src/components/marketing-ops/VersionConflictDialog.tsx apps/chat-web/src/App.tsx
git commit -m "feat: adiciona workspace editavel de campanha"
```

### Task 13: Completar participantes, materiais e timeline na UI

**Files:**
- Create: `apps/chat-web/src/components/marketing-ops/ParticipantsPanel.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/MaterialsPanel.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/TimelinePanel.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/ParticipantsPanel.test.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/MaterialsPanel.test.tsx`
- Create: `apps/chat-web/src/components/marketing-ops/TimelinePanel.test.tsx`
- Modify: `apps/chat-web/src/pages/marketing-ops/CampaignWorkspacePage.tsx`

**Interfaces:**
- Produces: gestão de papéis, upload/link/unlink/download seguro e histórico paginado.

- [ ] **Step 1: RED das três seções**

```tsx
it('blocks an oversized file before network and renders a safe timeline', async () => {
  renderWorkspace(campaign);
  const oversized = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' });
  await user.upload(screen.getByLabelText(/adicionar material/i), oversized);
  expect(api.uploadMaterial).not.toHaveBeenCalled();
  expect(screen.getByText(/máximo de 25 miB/i)).toBeVisible();
  expect(screen.queryByText(/token=/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Observar RED**

Run: `cd apps/chat-web && npm test -- src/components/marketing-ops/ParticipantsPanel.test.tsx src/components/marketing-ops/MaterialsPanel.test.tsx src/components/marketing-ops/TimelinePanel.test.tsx`

Expected: FAIL por componentes ausentes.

- [ ] **Step 3: Implementar painéis**

Participantes mostram avatar/nome/papel/principal e escondem ações não autorizadas. Materiais mostram nome, MIME, tamanho, autor/data, upload progress, abrir via access link sob demanda e unlink com confirmação. Timeline usa lista semântica, paginação e descrições localizadas por ação.

- [ ] **Step 4: Verificar GREEN**

Run: `cd apps/chat-web && npm test -- src/components/marketing-ops && npm run typecheck`

Expected: painéis passam em 390 px, 768 px e desktop nos testes de layout/comportamento.

- [ ] **Step 5: Commit**

```powershell
git add apps/chat-web/src/components/marketing-ops apps/chat-web/src/pages/marketing-ops/CampaignWorkspacePage.tsx
git commit -m "feat: completa colaboracao e historico no workspace"
```

### Task 14: Observabilidade, Compose, E2E e documentação final

**Files:**
- Modify: `services/marketing-ops/src/config.ts`
- Modify: `services/marketing-ops/src/index.ts`
- Modify: `services/marketing-ops/src/observability/metrics.ts`
- Modify: `services/marketing-ops/src/foundation.test.ts`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `.env.example`
- Modify: `apps/chat-web/package.json`
- Modify: `apps/chat-web/package-lock.json`
- Create: `apps/chat-web/playwright.config.ts`
- Create: `apps/chat-web/e2e/marketing-ops.spec.ts`
- Create: `docs/phase-2/README.md`
- Create: `docs/phase-2/requirements-traceability.md`
- Create: `docs/phase-2/risk-register.md`
- Create: `docs/phase-2/lgpd-retention.md`
- Create: `docs/phase-2/slo.md`
- Create: `docs/phase-2/runbook.md`
- Create: `docs/phase-2/rollback.md`
- Create: `docs/phase-2/local-validation.md`
- Create: `docs/phase-2/supabase-deployment.md`
- Create: `docs/phase-2/vps-validation.md`
- Modify: `Roadmap.md`

**Interfaces:**
- Produces: implementação fechada, métricas e dependências configuradas, testes/E2E preparados e pacote documental `implementation_complete_pending_vps_validation`.

- [ ] **Step 1: RED de config/readiness/métricas e E2E**

```ts
it('requires artifact and RAG integration settings in production', () => {
  expect(() => loadConfig(productionEnvWithoutIntegrations())).toThrow(/ARTIFACT_INTERNAL_URL/);
});
```

```ts
test('manager completes the phase-2 happy path on desktop and mobile', async ({ page }) => {
  await page.goto('/marketing-ops/campaigns');
  await page.getByRole('button', { name: 'Nova campanha' }).click();
  await page.getByLabel('Nome').fill('Campanha E2E');
  await page.getByRole('button', { name: 'Criar' }).click();
  await expect(page.getByRole('heading', { name: 'Campanha E2E' })).toBeVisible();
});
```

- [ ] **Step 2: Observar RED**

Run: `cd services/marketing-ops && npm test -- src/foundation.test.ts`

Run: `cd apps/chat-web && npm run e2e -- e2e/marketing-ops.spec.ts`

Expected: config e script E2E ausentes/falhando.

- [ ] **Step 3: Implementar operação e E2E**

Configurar `RAG_MCP_URL`, `ARTIFACT_INTERNAL_URL`, `ARTIFACT_INTERNAL_KEY`, timeout e limite. Healthcheck do MarketingOps usa `/ready`; `depends_on` inclui RAG e Artifact Server saudáveis. Métricas:

```text
marketing_ops_campaign_mutations_total{operation,status}
marketing_ops_campaign_conflicts_total
marketing_ops_dependency_requests_total{dependency,status}
marketing_ops_artifact_bytes_total
marketing_ops_request_duration_seconds_{count,sum}
```

Instalar versões fixadas de `@playwright/test` e `@axe-core/playwright`, commitar lockfile e cobrir member/manager/admin, criação, busca, edição, transição, participantes, material, timeline, 409, 390 px e desktop.

- [ ] **Step 4: Executar o gate nativo deste computador**

Executar testes sem banco, lint, typecheck, builds e validações estáticas. Arquivos que exigem `MARKETING_OPS_TEST_DATABASE_URL`, Supabase local, browser em Compose ou containers Linux devem ser listados nominalmente como `deferred_to_vps`, sem sucesso presumido.

- [ ] **Step 5: Preparar o gate automatizado e seguro da VPS**

Criar um script dedicado de gate VPS. Ele deve usar dados marcados como teste, correlation IDs próprios, rollback transacional nos probes de banco e cleanup explícito para qualquer fixture que precise ser visível entre sessões. Não apontar suítes genéricas que assumem o seed local para produção.

```bash
cd /opt/projeto-ens-unificado
bash scripts/test/phase-2-vps.sh
```

O script deverá validar migration aplicada, invariantes/RLS, concorrência campanha-participante-item, probes de lock indevido, health/readiness, Compose, logs, restart/persistência e smokes por papel. Expected na VPS: zero falhas; warnings existentes documentados sem erro novo; nenhuma fixture de teste residual.

- [ ] **Step 6: Implantar e validar o Supabase do app**

No projeto já vinculado:

```powershell
cd apps/chat-web
npx supabase migration list --linked
npx supabase db dump --linked --schema marketing_ops,marketing_ops_private --file ../../tmp/phase-2-predeploy-schema.sql
npx supabase db push --linked --dry-run
npx supabase db push --linked
npx supabase migration list --linked
npx supabase test db --linked supabase/tests/marketing_ops_workspace.test.sql
npx supabase db lint --linked --schema marketing_ops,marketing_ops_private --level warning --fail-on error
```

Expected: somente `20260714020344_phase_2_workspace_operational_mvp.sql` pendente no dry-run; push aplicado uma vez; pgTAP e lint remotos passam. O dump fica em `tmp/`, que é ignorado.

- [ ] **Step 7: Completar documentação e rastreabilidade**

`requirements-traceability.md` deve mapear cada `F2-RF-01..12` para schema, API, UI, teste e evidência. `risk-register.md` deve reconciliar os riscos antigos, registrar dependências RAG/Artifact, concorrência e rollout. `local-validation.md` e `supabase-deployment.md` registram comandos, data, contagens e hashes sem secrets. `vps-validation.md` permanece com estado `pending_user_execution`.

Atualizar `Roadmap.md` e `docs/phase-2/README.md` para `implementation_complete_pending_vps_validation` dentro de `in_progress`, nunca `ready_for_production` ou `completed` antes do gate VPS diferido.

- [ ] **Step 8: Commit do fechamento interno**

```powershell
git add services/marketing-ops docker-compose.yml docker-compose.prod.yml .env.example apps/chat-web docs/phase-2 Roadmap.md
git commit -m "docs: fecha gate interno da fase 2"
```

### Task 15: Revisão final no main e handoff VPS

**Files:**
- Review: todos os arquivos alterados desde `26a5041`
- Update: `docs/phase-2/local-validation.md`
- Update: `docs/phase-2/vps-validation.md`

**Interfaces:**
- Produces: `main` revisado e validado localmente, commit pronto para o push manual do usuário e comandos exatos para o usuário executar na VPS.

- [ ] **Step 1: Revisar requisitos e diff**

Run: `git diff --check 26a5041..HEAD && git diff --stat 26a5041..HEAD && git log --oneline 26a5041..HEAD`

Expected: sem whitespace errors; commits correspondem às Tasks 1–14.

- [ ] **Step 2: Executar novamente o gate nativo fresco**

Repetir integralmente os checks nativos da Task 14 Step 4 após qualquer correção de review. Conferir também que todos os checks diferidos estão enumerados no runbook VPS e possuem script reproduzível.

Expected: todos os checks executáveis neste computador com código 0; checks de banco/Linux explicitamente `deferred_to_vps`, sem sucesso presumido.

- [ ] **Step 3: Verificar o estado final diretamente no main**

```powershell
git branch --show-current
git status --short
git log -1 --oneline
```

Expected: branch `main`, apenas mudanças deliberadas da Task 15 antes do commit final e histórico coerente com as Tasks 1–14.

Reexecutar no `main` o gate nativo de serviço/frontend e as validações estáticas. Confirmar que os scripts de banco/Compose/VPS estão versionados, mas manter seu resultado como `deferred_to_vps`. Somente após o resultado nativo verde, criar o commit local final. O agente não executa push. Entregar ao usuário:

```powershell
git status --short --branch
git log -1 --oneline
git push origin main
```

O último comando é uma instrução para execução manual do usuário, não uma ação do agente.

- [ ] **Step 4: Entregar comandos VPS sem executá-los**

O handoff deve instruir o usuário a:

```bash
cd /opt/projeto-ens-unificado
git fetch origin
git checkout main
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build marketing-ops app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d marketing-ops app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=10m marketing-ops app-frontend
curl -fsS https://ops.solucoes-nexus.tech/health
curl -fsS https://ops.solucoes-nexus.tech/ready
```

O usuário executará smoke manual por papel, logs e aceite. Só depois atualizar `vps-validation.md` e promover a fase a `production_validated`.

## Plan Self-Review

- Cobertura: F2-RF-01..12 aparecem nas Tasks 2–14; requisitos transversais aparecem nas Tasks 1, 9, 14 e 15.
- Consistência: `CampaignStatus`, campos, endpoints, ETag/`If-Match`, `Idempotency-Key`, limites e papéis coincidem com o design aprovado.
- Separação: RAG é somente leitura; Artifact Server guarda bytes; MarketingOps guarda metadata; frontend não acessa os dois diretamente.
- Segurança: RLS, grants, `SECURITY DEFINER`, dados pessoais, tokens, timeline, upload e isolamento de tenant possuem testes explícitos.
- Operação: baseline, reset local, lint, pgTAP, regressão, E2E, deploy Supabase, integração Git e handoff VPS têm comandos e resultados esperados.
