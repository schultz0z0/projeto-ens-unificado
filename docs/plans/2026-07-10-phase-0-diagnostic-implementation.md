# Phase 0 Diagnostic and Evolution Contract Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produzir uma linha de base verificável do Nexus AI, classificar o que será mantido ou migrado e entregar as decisões, riscos e backlog necessários para iniciar a Fundação do Marketing Ops.

**Architecture:** A Fase 0 é documental e baseada em evidências. Os inventários serão construídos a partir do código, migrations, Compose e testes locais, sem consultar ou imprimir secrets; decisões aprovadas serão registradas como ADRs e todas as lacunas de ambiente permanecerão explicitamente pendentes.

**Tech Stack:** Markdown, Git, PowerShell, ripgrep, Node.js 24, npm, Python 3.11, YAML; Docker/Bash quando disponíveis.

---

## Restrições da execução

- Trabalhar no checkout local atual por decisão explícita do usuário.
- Não criar worktree.
- Não executar `git push`.
- Não fazer deploy.
- Não imprimir o conteúdo de `.env`.
- Não acessar a VPS sem solicitação e autorização posteriores.
- Commit local somente depois da validação documental e técnica.

### Task 1: Criar o índice e o contrato de evidências da Fase 0

**Files:**
- Create: `docs/phase-0/README.md`
- Create: `docs/phase-0/local-validation.md`
- Create: `docs/phase-0/vps-validation.md`

**Step 1: Verificar que os artefatos ainda não existem**

Run: `Test-Path docs/phase-0/README.md`
Expected: `False`.

**Step 2: Criar o índice**

Documentar objetivo, status, entregáveis, fontes, convenção de classificação e links.

**Step 3: Criar os registros de validação**

`local-validation.md` recebe ambiente, comandos, resultados e bloqueios. `vps-validation.md` inicia como `pending_user_deploy` com checklist não destrutivo.

**Step 4: Verificar a estrutura**

Run: `rg -n "^## (Status|Entregáveis|Evidências|Critérios de saída)" docs/phase-0/README.md`
Expected: quatro seções obrigatórias.

### Task 2: Inventariar o frontend

**Files:**
- Create: `docs/phase-0/frontend-inventory.md`

**Step 1: Coletar rotas e navegação**

Run: `rg -n "<Route|path=|title=|aria-label=" apps/chat-web/src/App.tsx apps/chat-web/src/components/Sidebar.tsx apps/chat-web/src/pages/Index.tsx -S`
Expected: rotas `/login`, `/`, `/admin/users`, `/manager/validated-works` e navegação atual.

**Step 2: Coletar páginas e módulos**

Run: `rg --files apps/chat-web/src/pages apps/chat-web/src/components apps/chat-web/src/services apps/chat-web/src/lib | Sort-Object`
Expected: catálogo de arquivos do frontend.

**Step 3: Classificar superfícies**

Para cada rota/módulo relevante registrar: responsabilidade, acesso, dependências, evidência, classificação (`keep`, `adapt`, `migrate`, `archive`, `remove_candidate`) e fase-alvo.

**Step 4: Verificar cobertura**

Run: `rg -n "\| /(login|admin/users|manager/validated-works|) \|" docs/phase-0/frontend-inventory.md`
Expected: rotas ativas classificadas.

### Task 3: Inventariar serviços e Compose

**Files:**
- Create: `docs/phase-0/services-catalog.md`

**Step 1: Coletar serviços do Compose**

Run: `rg -n "^  [a-zA-Z0-9_-]+:$|container_name:|depends_on:|healthcheck:|volumes:|ports:" docker-compose.yml docker-compose.prod.yml`
Expected: catálogo de serviços e relações.

**Step 2: Coletar runtimes e comandos**

Run: `rg -n "^FROM |^EXPOSE |ENTRYPOINT|CMD" apps services -g "Dockerfile" -g "*.Dockerfile" -g "!services/hermes-runtime/vendor/**"`
Expected: runtimes de frontend, designer, bridge, artifact, RAG, Graph e Hermes.

**Step 3: Documentar cada serviço**

Registrar finalidade, runtime, porta, health check, dependências, volumes, dados, consumidor, criticidade, owner proposto e classificação.

**Step 4: Verificar cobertura**

Run: `rg -n "app-frontend|app-bridge|designer-api|artifact-server|hermes-api|rag-mcp|graph-mcp|neo4j" docs/phase-0/services-catalog.md`
Expected: todos os serviços principais descritos.

### Task 3.1: Avaliar remoção de código residual

**Files:**
- Create: `docs/phase-0/residual-cleanup-assessment.md`
- Modify: `docs/phase-0/frontend-inventory.md`

**Step 1: Calcular o grafo estático alcançável**

Partir de `apps/chat-web/src/main.tsx`, resolver imports relativos e alias `@/`, excluir testes e listar módulos não alcançados.

**Step 2: Confirmar referências globais**

Run: `rg -n "Campaigns|EmailGenerator|LandingPageGenerator|marketIntelligenceService|generateEmailMarketing|NexusDesign" . -S -g "!services/hermes-runtime/vendor/**" -g "!docs/**"`
Expected: referências restritas às próprias ilhas residuais e documentos/workflows históricos.

**Step 3: Confirmar o bundle de produção**

Run: `npm run build` em `apps/chat-web`, seguido de busca por textos exclusivos no `dist`.
Expected: build passa; textos das ilhas residuais não aparecem no bundle.

**Step 4: Classificar remoção**

Separar código seguro para remoção, utilitários opcionais, dependências a manter e dados/migrations que exigem confirmação externa.

**Step 5: Não apagar sem aprovação**

Apresentar a lista ao usuário. Caso aprovada, criar tarefa de limpeza separada com testes antes/depois e nenhuma alteração destrutiva no Supabase.

### Task 4: Inventariar Supabase e dados

**Files:**
- Create: `docs/phase-0/supabase-inventory.md`
- Create: `docs/phase-0/data-map.md`

**Step 1: Catalogar migrations oficiais, manuais e ignoradas**

Run: `rg --files apps/chat-web/supabase services/rag-mcp/supabase | Sort-Object`
Expected: listas separáveis de migrations ativas, manuais, ignoradas e schema RAG.

**Step 2: Extrair objetos SQL sem executar o banco**

Run: `rg -n "CREATE (TABLE|VIEW|OR REPLACE VIEW|FUNCTION|OR REPLACE FUNCTION|TRIGGER|POLICY|INDEX)|ALTER TABLE .*ENABLE ROW LEVEL SECURITY|storage\.buckets" apps/chat-web/supabase/migrations services/rag-mcp/supabase -i`
Expected: objetos e controles de segurança declarados.

**Step 3: Registrar inventário**

Para cada domínio registrar objetos, migration de origem, finalidade, evidência de uso, RLS/policies, classificação, risco e fase-alvo.

**Step 4: Registrar mapa de dados**

Mapear identidade, chat, anexos, Hermes state, trabalhos validados, RAG, Graph, artifacts, imagens, campanhas legadas e dados futuros.

**Step 5: Verificar riscos históricos**

Run: `rg -n "DROP TABLE.*campaign|CREATE TABLE.*campaign|ignored_migrations|manual" docs/phase-0/supabase-inventory.md -i`
Expected: histórico de campanhas e áreas fora do fluxo oficial explicitados.

### Task 5: Consolidar a integração Hermes

**Files:**
- Create: `docs/phase-0/hermes-integration.md`

**Step 1: Rastrear frontend e bridge**

Run: `rg -n "sendMessageToChatbotStream|/api/chat/runs|/events|/api/approvals|X-Hermes|X-Nexus|createRun|executeRun" apps/chat-web/src services/chat-bridge/src -S`
Expected: pontos do fluxo e aprovação técnica.

**Step 2: Rastrear sessão, memória e artefatos**

Run: `rg -n "chat_session_hermes_state|mcp_servers|nexus_graph|nexus_rag|artifact|memory" services/chat-bridge services/hermes-runtime/docker services/graph-mcp services/rag-mcp apps/chat-web/supabase/migrations -S -g "!services/hermes-runtime/vendor/**"`
Expected: persistência, MCPs e limites de memória.

**Step 3: Documentar sequência e falhas**

Registrar autenticação, criação do run, sessão, SSE, reconexão, anexos, artifact import, approvals, RAG, Graph e deleção.

**Step 4: Documentar limites**

Explicitar Chat Bridge como transporte, Marketing Ops como domínio futuro e aprovação técnica separada de negócio.

### Task 6: Formalizar linguagem e responsabilidades

**Files:**
- Create: `docs/phase-0/glossary.md`
- Create: `docs/phase-0/responsibility-matrix.md`

**Step 1: Criar glossário**

Definir campanha, item, conteúdo, versão, aprovação editorial, autorização operacional, pacote, execução, memória, tenant, ator e papéis.

**Step 2: Criar matriz**

Mapear ownership de frontend, Chat Bridge, Hermes, Marketing Ops, Supabase, Artifact Server, RAG, Graph e workers.

**Step 3: Verificar termos críticos**

Run: `rg -n "aprovação técnica|aprovação editorial|autorização operacional|fonte de verdade|tenant" docs/phase-0/glossary.md docs/phase-0/responsibility-matrix.md -i`
Expected: diferenças e owners explícitos.

### Task 7: Registrar ADRs aprovadas

**Files:**
- Create: `docs/phase-0/adrs/0001-marketing-ops-service-boundary.md`
- Create: `docs/phase-0/adrs/0002-operational-source-of-truth.md`
- Create: `docs/phase-0/adrs/0003-trusted-hermes-delegation.md`
- Create: `docs/phase-0/adrs/0004-approval-separation.md`
- Create: `docs/phase-0/adrs/0005-local-and-vps-gates.md`

**Step 1: Registrar contexto, decisão e consequência**

Cada ADR deve conter status, data, contexto, decisão, alternativas e consequências.

**Step 2: Verificar headers**

Run: `rg -l "^## (Contexto|Decisão|Consequências)$" docs/phase-0/adrs -g "*.md"`
Expected: cinco arquivos.

### Task 8: Consolidar riscos, transição e backlog

**Files:**
- Create: `docs/phase-0/risk-register.md`
- Create: `docs/phase-0/transition-plan.md`
- Create: `docs/phase-0/phase-1-backlog.md`
- Create: `docs/phase-0/vps-deployment-runbook.md`

**Step 1: Criar registro de riscos**

Incluir severidade, probabilidade, evidência, mitigação, owner e fase.

**Step 2: Criar plano de transição**

Definir compatibilidade, feature flags, migrations, coexistência, remoção e rollback.

**Step 3: Criar backlog da Fase 1**

Priorizar épicos de serviço, identidade/delegação, schema, RBAC/RLS, auditoria, idempotência, eventos, observabilidade e contrato MCP/API.

**Step 4: Verificar bloqueadores**

Run: `rg -n "BLOCKER|HIGH|decisão aberta|owner" docs/phase-0/risk-register.md docs/phase-0/phase-1-backlog.md -i`
Expected: bloqueadores e owners propostos explícitos.

**Step 5: Criar o runbook de deploy da VPS**

Consolidar pré-requisitos, backup, `git pull`, uso idempotente do `bootstrap`, validação do Compose, estratégia de build com cache, critérios para `--no-cache`, `--pull` e `--force-recreate`, migrations, subida gradual, health checks, logs, smoke tests e rollback. Diferenciar deploy somente documental de deploy com alterações de imagem, configuração ou banco.

**Step 6: Verificar decisões de deploy**

Run: `rg -n "bootstrap|--no-cache|--pull|--force-recreate|backup|rollback|health" docs/phase-0/vps-deployment-runbook.md -i`
Expected: todas as decisões operacionais solicitadas estão documentadas.

### Task 9: Executar validações locais

**Files:**
- Modify: `docs/phase-0/local-validation.md`

**Step 1: Validar estrutura do monorepo sem Bash**

Run: `Test-Path apps/chat-web/package.json; Test-Path services/chat-bridge/package.json; Test-Path docker-compose.yml; git ls-files .env`
Expected: arquivos requeridos `True`; `.env` não rastreado.

**Step 2: Validar YAML do Compose estaticamente**

Run: `python -c "import yaml; yaml.safe_load(open('docker-compose.yml', encoding='utf-8')); yaml.safe_load(open('docker-compose.prod.yml', encoding='utf-8')); print('compose-yaml-ok')"`
Expected: `compose-yaml-ok`.

**Step 3: Executar testes Node dos serviços**

Run: `npm test` em `services/chat-bridge` e `services/artifact-server`.
Expected: todos os testes passam.

**Step 4: Executar testes/typecheck dos MCPs**

Run: `npm test` e `npm run typecheck` em `services/rag-mcp` e `services/graph-mcp`.
Expected: todos passam.

**Step 5: Executar validações do frontend**

Run: `npx vitest run`, `npm run build`, `npm run lint`, `npm run security:gate` em `apps/chat-web`.
Expected: registrar resultados reais; falhas preexistentes são documentadas, não ocultadas.

**Step 6: Executar testes Python aplicáveis**

Run: `pytest -q` nos testes do Designer/Hermes disponíveis sem serviços externos.
Expected: registrar quantidade e resultado.

**Step 7: Registrar limitações do runtime**

Docker e Bash estão ausentes no início da execução. Registrar `not_run_environment_missing` para Compose runtime e `scripts/validate.sh`, sem declarar esses checks aprovados.

### Task 10: Validar a documentação integrada

**Files:**
- Test: `docs/phase-0/**/*.md`
- Test: `docs/plans/2026-07-10-phase-0-diagnostic-implementation.md`

**Step 1: Verificar entregáveis**

Run: `Get-ChildItem docs/phase-0 -Recurse -File | Select-Object FullName`
Expected: índice, 13 documentos principais e cinco ADRs.

**Step 2: Verificar links Markdown**

Executar verificador PowerShell de links relativos em `docs/phase-0`.
Expected: nenhum link quebrado.

**Step 3: Verificar whitespace e secrets**

Run: `git diff --check` e busca por padrões de chaves/tokens apenas no diff.
Expected: sem whitespace inválido e sem valor de secret.

**Step 4: Revisar status de gates**

`local-validation.md` deve separar `pass`, `fail`, `not_run` e `blocked`. `vps-validation.md` permanece pendente.

### Task 11: Criar commit local sem push

**Files:**
- Add: `docs/plans/2026-07-10-phase-0-diagnostic-implementation.md`
- Add: `docs/phase-0/**`

**Step 1: Adicionar somente os artefatos da Fase 0**

Run: `git add docs/plans/2026-07-10-phase-0-diagnostic-implementation.md docs/phase-0`
Expected: nenhum código ou secret no stage.

**Step 2: Verificar stage**

Run: `git diff --cached --check; git diff --cached --name-status`
Expected: somente documentos da Fase 0.

**Step 3: Commit local**

Run: `git commit -m "docs: executa diagnostico da fase 0"`
Expected: commit local criado.

**Step 4: Confirmar ausência de push**

Run: `git status --short; git log -1 --oneline`
Expected: worktree limpo e commit somente local; não executar `git push`.
