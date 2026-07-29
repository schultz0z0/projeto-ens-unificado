# Fase 4 — Plano de fechamento do gate de release

> **Estado final:** `completed_production_validated` em 2026-07-29.

> **Para execução:** seguir em `main`, registrar evidência em `docs/phase-4`
> antes de avançar para o próximo item. A validação conversacional real só
> acontece após o deploy da VPS.

**Objetivo:** deixar a Fase 4 pronta para um deploy reproduzível, sem promover
o status antes da homologação real.

**Arquitetura:** não há ampliação funcional nesta etapa. O trabalho corrige o
histórico da migration remota, reconcilia a documentação com o código já
entregue e prepara os checks de VPS que exercitarão `frontend → bridge →
Hermes → MCP → Marketing Ops → Supabase`.

**Stack:** Supabase CLI 2.110, PostgreSQL/Supabase, Docker Compose, Node,
TypeScript, Python e os documentos da Fase 4.

---

### Task 1 — Corrigir o histórico remoto de migrations

**Arquivos:**

- Verificar: `apps/chat-web/supabase/migrations/20260722130000_phase_4_hermes_operator_audit.sql`
- Atualizar: histórico remoto `supabase_migrations.schema_migrations`
- Registrar: `docs/phase-4/supabase-deployment.md`

1. Comparar `supabase migration list --linked` com os arquivos locais.
2. Reverter somente a entrada remota órfã `20260722183310`.
3. Marcar `20260722130000` como aplicada, sem reaplicar DDL.
4. Repetir a listagem e exigir alinhamento local/remoto.

**Resultado de 2026-07-28:** concluída; a listagem agora mostra
`20260722130000` nos dois lados.

### Task 2 — Reconciliar documentação e configuração de produção

**Arquivos:**

- Modificar: `docs/prds/phase-4-hermes-campaign-operator.md`
- Modificar: `docs/phase-4/{README,design,implementation-progress,local-validation,runbook,supabase-deployment,vps-validation,continuation-handoff,risk-register}.md`

1. Eliminar estados contraditórios de PRD/design/README.
2. Registrar a correção de histórico da migration e sua evidência.
3. Exigir flags Marketing Ops e URL pública antes do build do frontend.
4. Preservar todos os requisitos ainda pendentes para o gate VPS como
   pendentes, sem promover a fase.

**Resultado de 2026-07-28:** concluída; PRD, design, runbook, risco,
rastreabilidade e handoff passaram a descrever o estado intermediário e
preservaram o gate real como pendência naquele snapshot.

### Task 3 — Executar regressões pré-deploy

**Arquivos:**

- Verificar: `services/marketing-ops/src/{mcp,plans,production-gate}.test.ts`
- Verificar: `services/chat-bridge`
- Verificar: `apps/chat-web`
- Registrar: `docs/phase-4/local-validation.md`

1. Rodar testes dirigidos dos contratos do plano, MCP, executor e deep links.
2. Rodar typecheck/build dos serviços afetados.
3. Não marcar como executados os casos que requerem serviços reais da VPS.

**Resultado de 2026-07-28:** concluída dentro das limitações do ambiente.
`marketing-ops` passou em typecheck/build e 12 testes unitários dirigidos;
`chat-bridge` passou 85 testes; `chat-web` passou 12 testes dirigidos e
typecheck/build; runtime Hermes passou 13 testes e `compileall`. A suíte MCP
que consulta PostgreSQL continua bloqueada exclusivamente pela ausência do
Supabase local em `127.0.0.1:55322`; a confirmação JWT isolada passou.

### Task 4 — Deploy e homologação real (bloqueada até a VPS)

**Arquivos:**

- Executar: `docs/phase-4/runbook.md`
- Executar e registrar: `docs/phase-4/vps-validation.md`

1. O responsável atualiza a VPS para o commit da release e confirma os health
   checks.
2. Executar uma nova sessão de chat com contas de teste e os cenários de
   leitura, preview, confirmação, conteúdo `email_html` e deep link.
3. Executar retry, conflito e indisponibilidade apenas em janela controlada.
4. Atualizar a rastreabilidade para `verified` somente com evidência real e
   promover a fase apenas após aceite.

**Resultado de 2026-07-29:** concluída. Health, skill `1.2.4`, catálogo MCP,
leituras, preview sem escrita, confirmação contextual, campanha/item/conteúdo,
RAG, Graph, RBAC, prompt injection, resolução exata, append-only, auditoria,
Supabase e deep link clicável passaram. Conflito, rate limit e indisponibilidade
foram mantidos em testes automatizados para não degradar o site público. A Fase
4 foi promovida para `production_validated`.
