# Open-Design Arsenal Import — Relatorio Final

Data: 2026-06-27
Origem: https://github.com/nexu-io/open-design (Apache 2.0)
Destino: /home/nexusai/Nexus-white-label/services/hermes-runtime/vendor/hermes-agent/

## Resumo executivo

| Categoria | Total OD | Vale importar | Importado | Notas |
|-----------|----------|---------------|-----------|-------|
| Skills | 159 | 13 (+ 1 wrapper) | 14 | 70% sao catalogo vazio |
| Atoms (plugins) | 13 | 1 (criar nativo) | 0 | 9 duplicados, 3 SKIP, 1 vale |
| Examples | 165 | 0 | 0 | Dependem do app desktop open-design |
| Image templates | 47 | 0 | 0 | Mesma restricao |
| Video templates | 64 | 0 | 0 | Mesma restricao |
| Scenarios | 13 | 0 | 0 | Workflows do app desktop |
| Design systems | 152 | 6 (referencia) | 6 salvos | Como STUDY, nao install |
| TOTAL | 473 | 20 | 14 | 97% economia de ruido |

## FASE 1 — SKILLS IMPORTADAS (14)

### MUST-IMPORT (5) — preencheram lacunas graves
1. frontend-design (5244 bytes) — Anthropic 6-step workflow
2. impeccable-design-polish (2941 bytes) — post-gen audit/critique/polish
3. taste-skill (87915 bytes / 1233 linhas) — anti-slop dials, brief inference
4. gsap-react (6867 bytes) — useGSAP hook, SSR cleanup
5. gsap-scrolltrigger (18799 bytes) — scroll-driven animation

### ADAPTABLE (8) — uteis com adaptacao
6. brand-extract (12523 bytes) + templates/
7. theme-factory (1314 bytes) — 10 pre-set themes
8. canvas-design (1360 bytes) — PNG/PDF visual art
9. ui-skills (1161 bytes) — ibelick opinionated constraints
10. marketing-psychology (1267 bytes) — persuasive copy heuristics
11. paywall-upgrade-cro (1240 bytes) — conversion paywalls
12. competitive-ads-extractor (1375 bytes) — pull competitor ad patterns
13. agent-browser (8677 bytes) — drive live browser via Playwright/CDP

### WRAPPER CRIADO (1)
14. nexus-frontend-arsenal (3464 bytes) — ROUTER

## FASE 2 — ATOMS (13)

| Atom | Veredito | Razao |
|------|----------|-------|
| build-test | DUPLICADO | Hermes ja tem terminal + simplify-code |
| code-import | DUPLICADO | github-repo-management faz isso |
| critique-theater | DUPLICADO | requesting-code-review faz 5D |
| design-extract | IMPORTADO | brand-extract (FASE 1) cobre |
| diff-review | DUPLICADO | github-code-review faz |
| direction-picker | VALE CRIAR | nexus-direction-picker (Passo 2) |
| discovery-question-form | DUPLICADO | Hermes ja tem clarify tool |
| figma-extract | SKIP | Nao usa Figma |
| handoff | DUPLICADO | autonomous-ai-agents ja delega |
| patch-edit | DUPLICADO | patch tool nativa |
| rewrite-plan | DUPLICADO | plan skill nativa |
| todo-write | DUPLICADO | todo tool nativa |
| token-map | VALE CRIAR | nexus-token-map (futuro) |

Net: 9 duplicados, 3 SKIP, 1 criado nativamente, 1 planejado.

## FASE 3 — TEMPLATES (276)

Nenhum compensa importar. Dependem do app desktop open-design.
Ficam em services/open-design/ como REFERENCIA/inspiracao.

## FASE 4 — DESIGN SYSTEMS (6 salvos como referencia)

Em /home/nexusai/Nexus-white-label/services/audit-tmp/nexus-ds-reference/

| DS | DESIGN.md | tokens.css | Estilo | Proposito Nexus |
|----|-----------|------------|--------|-----------------|
| neon | 3.0KB | 1.7KB | Dark + glowing purple | Inspiracao direta (trocar accent purple por cyber teal) |
| futuristic | 3.0KB | 1.7KB | Generic futuristic | Patterns genericos |
| spacex | 11.4KB | 10.0KB | Industrial dark | O MAIS rico, estudar a fundo |
| hud | 6.8KB | 1.7KB | Heads-up display | Combina com JetBrains Mono do PRD |
| mission-control | 13.1KB | 1.7KB | Dashboard-style | Padroes UI data-dense |
| trading-terminal | 6.5KB | 1.7KB | Financial dark | Patterns tabela/dashboard |

## FASE 5 — PROXIMOS PASSOS

### Imediato (FEITO nesta sessao)
- [x] 14 skills importadas (13 + 1 wrapper)
- [x] DESCRIPTION.md da categoria creative/ atualizado
- [x] Backup das skills originais em skills/_backup-pre-frontend-import-20260627-140942/
- [x] Relatorio consolidado salvo (este arquivo)
- [x] nexus-direction-picker criado (Passo 2)
- [x] taste-skill splitada em SKILL.md + references/ (Passo 3)
- [x] Teste runtime de carregamento (Passo 4)

### Curto prazo (1-2 dias)
- [ ] Criar nexus-token-map skill nativa
- [ ] Testar brand-extract de verdade (precisa agent-browser)
- [ ] Adaptar taste-skill pra ignorar purple-blue gradients

### Medio prazo (1-2 semanas)
- [ ] Estudar spacex DESIGN.md + tokens.css a fundo
- [ ] Estudar mission-control (dashboard patterns)
- [ ] Integrar arsenal com claude-design nativo

### Longo prazo (1 mes+)
- [ ] Criar nexus-design-system que carrega tokens automaticamente
- [ ] Criar pipeline de preview (Python http.server + watch)
- [ ] Replicar critique-theater (5D) como skill nativa

## Decisoes de arquitetura

1. Imports em skills/creative/ — categoria mais logica
2. Wrapper criado (nexus-frontend-arsenal) — router, nao duplica logica
3. Backup preservado em _backup-pre-frontend-import-20260627-140942/
4. DESCRIPTION.md atualizado
5. Nenhum plugin/atom importado — dependem do runtime open-design
6. Design systems nao instalados — salvos como referencia
7. taste-skill splitada — SKILL.md magro, detalhes em references/

## Validacao

- [x] Todas as 14 skills tem SKILL.md com frontmatter valido
- [x] Licenses preservadas (Apache 2.0 Anthropic, Leonxlnx, MIT etc)
- [x] taste-skill splitada (reducao de ~75% no system prompt quando carregada)
- [x] Backup completo das originais
- [x] Estrutura de pasta mantida (sem mexer no core do hermes-agent)
- [x] AGENTS.md respeitado: skills live in their own directory
- [x] Hermes carrega as 14 sem erro (Passo 4)

## Honest notes

- taste-skill original 87.9KB foi splitada em SKILL.md (~6KB) + references/ (~80KB)
- Nenhum dos 13 atoms funciona sem o runtime open-design. Enganam na propaganda de 261 plugins.
- Design systems sao o verdadeiro OURO deste repo. 152 DESIGN.md com tokens.css funcionais valem mais que 100 skills.
- Recomendacao: apos 2 semanas de uso real, revisar quais ADAPTABLE viraram MUST e vice-versa.

