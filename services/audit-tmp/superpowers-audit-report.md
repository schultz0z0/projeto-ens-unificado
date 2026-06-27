# Auditoria Superpowers (obra/superpowers) vs Hermes Agent

**Data:** 2026-06-27
**Superpowers:** https://github.com/obra/superpowers (clonado em /home/nexusai/Nexus-white-label/services/superpowers)
**Hermes fork:** /home/nexusai/Nexus-white-label/services/hermes-runtime/vendor/hermes-agent
**Tamanho superpowers:** 2.7MB | **Skills:** 14

## TL;DR

- **4 skills** ja estao adaptadas no Hermes (requesting-code-review, systematic-debugging, test-driven-development, plan/writing-plans)
- **1 skill** tem match parcial (writing-skills → hermes-agent-skill-authoring)
- **9 skills** faltam completamente
- As 4 adaptadas tem **diferencas significativas** em escopo: superpowers cobre mais ceremony, hermes cobre mais automation

## Mapeamento completo das 14 skills

| # | Superpowers | Hermes fork | Status | Veredito |
|---|-------------|-------------|--------|----------|
| 1 | brainstorming | (nenhum) | FALTA | **IMPORTAR** |
| 2 | dispatching-parallel-agents | (nenhum) | FALTA | **IMPORTAR** |
| 3 | executing-plans | (nenhum) | FALTA | **IMPORTAR** |
| 4 | finishing-a-development-branch | (nenhum, github/* cobre parcial) | FALTA | **IMPORTAR** |
| 5 | receiving-code-review | (nenhum) | FALTA | **IMPORTAR** |
| 6 | requesting-code-review | software-development/requesting-code-review (ADAPTADO) | PARCIAL | **MERGEAR** |
| 7 | subagent-driven-development | (nenhum, autonomous-ai-agents cobre parcial) | FALTA | **IMPORTAR** |
| 8 | systematic-debugging | software-development/systematic-debugging (ADAPTADO) | PARCIAL | **MERGEAR** |
| 9 | test-driven-development | software-development/test-driven-development (ADAPTADO) | PARCIAL | **MERGEAR** |
| 10 | using-git-worktrees | github/github-repo-management cobre parcial | FALTA | **IMPORTAR** |
| 11 | using-superpowers (meta) | (nenhum) | FALTA | **IMPORTAR** |
| 12 | verification-before-completion | (nenhum) | FALTA | **IMPORTAR** |
| 13 | writing-plans | software-development/plan (ADAPTADO) | PARCIAL | **MERGEAR** |
| 14 | writing-skills | software-development/hermes-agent-skill-authoring (parcial) | FALTA | **IMPORTAR + estender** |

## Diferencas detalhadas nas 4 adaptadas

### 1. systematic-debugging

**SUPER (9.9KB):** 4 fases clasicas. Inclui secoes extras:
- RedFlags-STOPandFollowProcess (sinais de alarme)
- yourhumanpartnersSignalsYouredoingitwrong (auto-check)
- WhenProcessRevealsNoRootCause (parada forcada)
- SupportingTechniques (multi-componente debugging)

**HERMES (10.5KB):** Mesmas 4 fases mas **comandos praticos**:
- Run specific failing test
- Run with verbose output
- Recent commits / uncommitted changes
- Trace data flow (numbered steps)

**Veredito:** Hermes é mais executavel. Super tem mais ceremony.
**Acao:** MERGEAR - adicionar secoes RedFlags + WhenProcessReveals do super ao hermes

### 2. test-driven-development

**SUPER (9.9KB):** Red-Green-Refactor puro. Inclui:
- RedFlags-STOPandStartOver (quando desistir e recomecar)
- Example:BugFix (TDD aplicado a bug, nao feature)
- DebuggingIntegration (TDD + debug)
- GoodTests (heuristicas de qualidade do teste)

**HERMES (9.6KB):** Red-Green-Refactor + comandos praticos:
- Use terminal tool to run specific test
- Then run ALL tests for regressions
- (mesmo conceito, menos ceremony)

**Veredito:** Hermes é mais pratico. Super tem casos edge importantes.
**Acao:** MERGEAR - adicionar Example:BugFix + GoodTests do super ao hermes

### 3. writing-plans (= plan no Hermes)

**SUPER (7.1KB):** Skill de "escrita de plano". Foco:
- Scope Check (quebrar em sub-projetos)
- File Structure (decomposicao em arquivos)
- Task Right-Sizing (tamanho ideal de task)
- Self-Review (checklist final)

**HERMES (8.9KB):** Skill de "plan mode" (NAO executa). Foco:
- Core behavior (regra de NAO implementar)
- Output requirements (estrutura do plano)
- Save location (.hermes/plans/)
- Interaction style
- Writing the Plan Well (qualidade)

**Veredito:** **Skills DIFERENTES em escopo**:
- Super = "como escrever um plano"
- Hermes = "como entrar em modo plan sem executar"

**Acao:** NAO mergear - manter separadas, mas linkar como related. A do hermes é um complemento (modo), nao duplicata (escrita).

### 4. requesting-code-review

**SUPER (2.8KB):** Leve. Foco:
- "Dispatch a code reviewer subagent"
- Template code-reviewer.md (enviado)
- When to Request (mandatory vs optional)
- Example e Integration

**HERMES (8.5KB):** Pesado. Foco:
- Pre-commit verification (3x maior)
- Step 1-2-3: get diff, security scan, baseline tests
- Static security scan (hardcoded secrets, shell injection, etc)
- Auto-fix loop
- Independent reviewer subagent

**Veredito:** Hermes é **MELHOR** que super nesta (3x mais conteudo pratico).
**Acao:** MANTER hermes, opcionalmente cherry-pick Red Flags do super.

## Recomendacao final

### Para as 4 ADAPTADAS (estrategia "merge selectivo")

| Skill | Acao | Razao |
|-------|------|-------|
| systematic-debugging | MERGEAR secoes RedFlags + WhenProcessReveals do super | Hermes ganha ceremony sem perder praticidade |
| test-driven-development | MERGEAR Example:BugFix + GoodTests do super | Hermes ganha casos edge importantes |
| writing-plans (=plan) | MANTER SEPARADAS, linkar como related | Skills DIFERENTES em escopo |
| requesting-code-review | MANTER hermes (superior), cherry-pick Red Flags | Hermes ja cobre tudo do super + mais |

### Para as 10 FALTANDO (estrategia "importar e adaptar")

| # | Skill | Acao | Categoria destino |
|---|-------|------|-------------------|
| 1 | brainstorming | IMPORTAR (puro, sem adaptacao) | software-development/ |
| 2 | dispatching-parallel-agents | IMPORTAR (puro) | software-development/ |
| 3 | executing-plans | IMPORTAR (puro) | software-development/ |
| 4 | finishing-a-development-branch | IMPORTAR (puro) | software-development/ |
| 5 | receiving-code-review | IMPORTAR (puro) | software-development/ |
| 7 | subagent-driven-development | IMPORTAR (puro) | software-development/ |
| 10 | using-git-worktrees | IMPORTAR (puro) | software-development/ |
| 11 | using-superpowers | IMPORTAR (puro) - meta skill | software-development/ |
| 12 | verification-before-completion | IMPORTAR (puro) | software-development/ |
| 14 | writing-skills | IMPORTAR + estender hermes-agent-skill-authoring | software-development/ |

**Total a importar:** 9 skills puras (ja que 10 e writing-skills vai consolidar com existente)
**Total a mergear:** 2 skills (systematic-debugging + test-driven-development)

## Resultado esperado

Apos executar este plano:
- Hermes tera **14 skills superpowers completas** (mesmo numero do upstream)
- 4 delas serao **versao melhorada** da adaptacao atual
- 10 delas serao **novas no Hermes**
- Licenca MIT mantida (obra/superpowers)

## Arquivos desta auditoria

- /home/nexusai/Nexus-white-label/services/superpowers/ - repo clonado (referencia)
- /home/nexusai/Nexus-white-label/services/audit-tmp/superpowers-compare/*.diff - 4 diffs completos
- /home/nexusai/Nexus-white-label/services/audit-tmp/superpowers-audit-report.md - este arquivo
