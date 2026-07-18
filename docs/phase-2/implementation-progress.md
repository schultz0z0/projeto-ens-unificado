# Progresso de implementação da Fase 2

- **Estado:** `production_validated`
- **Snapshot final reconciliado:** 2026-07-18
- **Branch única:** `main`
- **Implementação original:** Tasks 1–15 concluídas
- **Homologação VPS:** aprovada em 2026-07-16
- **Saneamento pós-homologação:** concluído localmente

## Quadro final

| Task | Escopo | Marco principal | Estado final |
|---:|---|---|---|
| 1 | Gate, PRD, design, plano e ambiente | `32c2ae4`, `4ed2829`, `ccf20d1` | `production_validated` |
| 2 | Schema, RLS, agregado e concorrência | `c921294` | `production_validated` |
| 3 | Contratos e máquina de estados | `9740530` | `production_validated` |
| 4 | CRUD, busca, filtros e versão | `9b19ec7` | `production_validated` |
| 5 | Participantes e perfis | `2c119f8` | `production_validated` |
| 6 | Materiais e Artifact Server | `aed3e1c` | `production_validated` |
| 7 | Referências oficiais via RAG MCP | `5d5cf8f` | `production_validated` |
| 8 | Timeline segura | `42d43f3` | `production_validated` |
| 9 | REST v1 e OpenAPI | `6c713e7` | `production_validated` |
| 10 | Cliente frontend tipado | `32acff2` | `production_validated` |
| 11 | Lista, filtros e criação | `df4903b` | `production_validated` |
| 12 | Workspace e conflitos | `7fcbd21` | `production_validated` |
| 13 | Participantes, materiais e timeline na UI | `73fa9ea` | `production_validated` |
| 14 | Observabilidade, Compose e E2E | `bcd8ca3` | `production_validated` |
| 15 | Revisão, Supabase e handoff VPS | `b99de6a`, homologação `9588366` | `production_validated` |

## Saneamento de 18/07/2026

| Frente | RED reproduzido | Correção | GREEN |
|---|---|---|---|
| Frontend | casts inseguros nos erros de validação | parser fail-closed tipado | 10 testes focados, lint sem erro, typecheck verde |
| pgTAP | 226/228 por fixture de usuário e assert da timeline | usuário realmente externo e assert da projeção segura | 228/228, lint DB zero erro, schema diff vazio |
| Performance | lista p95 847,61 ms com 5.000 campanhas | filtro explícito de tenant + índice `(tenant_id, updated_at desc, id desc)` | três execuções p95 entre 21,38 e 23,36 ms |

Commits do saneamento:

- `a3f0e0c` — parser seguro dos validation issues;
- `de0ada4` — fixtures/asserts pgTAP alinhados;
- `3c1d5a2` — gate p95 e índice da lista.

## Estado operacional

- A migration base da Fase 2 e os hotfixes de QA foram homologados na VPS.
- A migration de índice `20260718183937_add_campaign_list_tenant_updated_index.sql`
  está apenas validada localmente e aguarda o próximo deploy controlado.
- Nenhuma migration ou funcionalidade da Fase 3 foi criada.
- Nenhum push ou deploy externo foi executado no ciclo de saneamento.

O detalhe dos comandos e contagens está em [local-validation.md](local-validation.md);
a homologação está em [vps-validation.md](vps-validation.md).
