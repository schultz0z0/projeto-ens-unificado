# Nexus Marketing Ops Documentation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidar o roadmap aprovado do Nexus AI e produzir um PRD completo, rastreável e verificável para cada fase de 0 a 8.

**Architecture:** A documentação será organizada em três camadas: `Roadmap.md` como visão executiva e ordem de entrega, um design consolidado em `docs/plans` como contrato arquitetural e `docs/prds` como fonte detalhada dos requisitos de cada fase. Cada fase terá gates locais e de produção, mas somente será planejada em nível de implementação depois que sua fase anterior satisfizer os critérios de saída.

**Tech Stack:** Markdown, Git, PowerShell, ripgrep (`rg`).

---

### Task 1: Reestruturar o roadmap executivo

**Files:**
- Modify: `Roadmap.md`

**Step 1: Verificar a ausência da nova estrutura**

Run: `rg -n "Fase 8: Hermes Proativo|Marketing Ops" Roadmap.md`
Expected: nenhuma correspondência completa para a estrutura aprovada.

**Step 2: Reescrever o roadmap**

Substituir a mistura de visão, backlog e arquitetura por: norte do produto, arquitetura-alvo, princípios, fases 0–8, gates e índice de PRDs.

**Step 3: Verificar as nove fases**

Run: `rg -n "^### Fase [0-8]:" Roadmap.md`
Expected: exatamente nove resultados, em ordem de 0 a 8.

### Task 2: Registrar o design aprovado

**Files:**
- Create: `docs/plans/2026-07-10-nexus-marketing-ops-roadmap-design.md`

**Step 1: Criar o documento de design**

Registrar contexto atual, alternativas consideradas, arquitetura aprovada, modelo de domínio, fluxos, estados, segurança, falhas e validação local/VPS.

**Step 2: Verificar decisões obrigatórias**

Run: `rg -n "Chat Bridge|marketing-ops|delegação|Definition of Done|VPS" docs/plans/2026-07-10-nexus-marketing-ops-roadmap-design.md`
Expected: todas as decisões aparecem no documento.

### Task 3: Criar o catálogo de PRDs

**Files:**
- Create: `docs/prds/README.md`

**Step 1: Criar o índice**

Listar as fases 0–8, dependências, estados possíveis e links relativos para todos os PRDs.

**Step 2: Verificar os links esperados**

Run: `rg -n "phase-[0-8]-" docs/prds/README.md`
Expected: nove links de fase.

### Task 4: Criar os PRDs das fases 0–2

**Files:**
- Create: `docs/prds/phase-0-diagnostico-contrato-evolucao.md`
- Create: `docs/prds/phase-1-fundacao-marketing-ops.md`
- Create: `docs/prds/phase-2-workspace-operacional-mvp.md`

**Step 1: Escrever os PRDs**

Cada documento deve conter problema, objetivo, usuários, escopo, não objetivos, requisitos, dados, permissões, observabilidade, riscos, testes, gates e critérios de aceite.

**Step 2: Verificar os contratos mínimos**

Run: `rg -l "## Critérios de aceite" docs/prds/phase-[0-2]-*.md`
Expected: três arquivos.

### Task 5: Criar os PRDs das fases 3–5

**Files:**
- Create: `docs/prds/phase-3-calendario-esteira-producao.md`
- Create: `docs/prds/phase-4-hermes-campaign-operator.md`
- Create: `docs/prds/phase-5-governanca-aprovacoes.md`

**Step 1: Escrever os PRDs**

Detalhar calendário, conteúdo versionado, ferramentas MCP, delegação confiável e separação entre aprovação técnica, editorial e operacional.

**Step 2: Verificar os contratos mínimos**

Run: `rg -l "## Critérios de aceite" docs/prds/phase-[3-5]-*.md`
Expected: três arquivos.

### Task 6: Criar os PRDs das fases 6–8

**Files:**
- Create: `docs/prds/phase-6-execucao-assistida-piloto.md`
- Create: `docs/prds/phase-7-performance-diagnostico-aprendizado.md`
- Create: `docs/prds/phase-8-hermes-proativo-escala.md`

**Step 1: Escrever os PRDs**

Detalhar execução idempotente, LGPD, métricas, aprendizado validado, alertas proativos e controles de frequência.

**Step 2: Verificar os contratos mínimos**

Run: `rg -l "## Critérios de aceite" docs/prds/phase-[6-8]-*.md`
Expected: três arquivos.

### Task 7: Validar a documentação integrada

**Files:**
- Test: `Roadmap.md`
- Test: `docs/plans/2026-07-10-nexus-marketing-ops-roadmap-design.md`
- Test: `docs/prds/*.md`

**Step 1: Verificar arquivos e títulos**

Run: `Get-ChildItem docs/prds -File | Select-Object Name`
Expected: `README.md` e nove PRDs.

**Step 2: Verificar termos obsoletos e inconsistências**

Run: `rg -n "n8n como pilar|aprovação.*comando.*editorial|fase concluída sem.*VPS" Roadmap.md docs/prds docs/plans/2026-07-10-nexus-marketing-ops-roadmap-design.md -i`
Expected: nenhuma orientação conflitante.

**Step 3: Inspecionar o diff**

Run: `git diff --check; git diff --stat`
Expected: nenhuma falha de whitespace e apenas arquivos documentais esperados.

### Task 8: Commitar a documentação

**Files:**
- Add: `Roadmap.md`
- Add: `docs/plans/2026-07-10-nexus-marketing-ops-roadmap-design.md`
- Add: `docs/plans/2026-07-10-nexus-marketing-ops-program.md`
- Add: `docs/prds/*.md`

**Step 1: Adicionar somente os arquivos produzidos**

Run: `git add Roadmap.md docs/plans/2026-07-10-nexus-marketing-ops-roadmap-design.md docs/plans/2026-07-10-nexus-marketing-ops-program.md docs/prds`
Expected: somente documentação do programa no stage.

**Step 2: Revisar o stage**

Run: `git diff --cached --stat`
Expected: roadmap, design, plano e dez arquivos em `docs/prds`.

**Step 3: Commit**

Run: `git commit -m "docs: estrutura roadmap e prds do marketing ops"`
Expected: commit criado com sucesso.
