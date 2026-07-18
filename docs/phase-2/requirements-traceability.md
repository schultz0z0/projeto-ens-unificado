# Rastreabilidade final da Fase 2

- **Estado:** `closed`
- **Revisão:** 2026-07-18
- **Fonte:** [PRD da Fase 2](../prds/phase-2-workspace-operacional-mvp.md)
- **Evidência local:** [local-validation.md](local-validation.md)
- **Evidência VPS:** [vps-validation.md](vps-validation.md)

## Requisitos funcionais

| Requisito | Implementação principal | Evidência | Estado |
|---|---|---|---|
| F2-RF-01 Lista | query resumida, cursor, owners/alertas, tabela/cards | VPS + p95 local com 5.000 campanhas | `production_validated` |
| F2-RF-02 Busca e filtros | filtros combináveis e URL persistente | VPS/manual + testes frontend | `production_validated` |
| F2-RF-03 Criação | draft name-only, idempotência, owner e deep link | VPS/manual + integração | `production_validated` |
| F2-RF-04 Dados da campanha | schemas estritos e patch explícito | VPS/manual + testes de domínio/UI | `production_validated` |
| F2-RF-05 Workspace | visão, briefing, pessoas, materiais e atividade | VPS desktop/mobile | `production_validated` |
| F2-RF-06 Transições | máquina de estados e archive terminal | VPS + banco/domínio | `production_validated` |
| F2-RF-07 Participantes | owner principal único, papéis e locks | VPS + RLS/concorrência | `production_validated` |
| F2-RF-08 Materiais | metadata, Artifact Server, ownership e unlink | VPS + restart/persistência | `production_validated` |
| F2-RF-09 Timeline | projeção allowlisted e paginada | VPS/logs + pgTAP 228/228 | `production_validated` |
| F2-RF-10 Concorrência | versão, `If-Match`, 409 e reaplicação explícita | VPS + harness local | `production_validated` |
| F2-RF-11 Exclusão | hard delete ausente; archive preserva histórico | VPS + rollback | `production_validated` |
| F2-RF-12 Deep links | rota estável por UUID e estados 403/404 | VPS + testes frontend | `production_validated` |

## Critérios de aceite

Os 13 critérios do PRD estão aceitos. A matriz de homologação VPS registra
Compose, gate automatizado, smokes por papel, desktop/mobile/axe, restart,
persistência, rollback, cleanup e aceite do usuário como `approved`.

O critério “workspace mostra configurações” foi reconciliado como controles
funcionais de estado, reabertura e arquivamento no cabeçalho. A decisão evita
uma seção vazia e está registrada em [decision-log.md](decision-log.md).

## Gates transversais

| Gate | Evidência final | Estado |
|---|---|---|
| Segurança/RLS | três papéis, viewer, membership inativa e cross-tenant | `production_validated` |
| Concorrência | campanha/participante/item sem deadlock | `production_validated` |
| Artifact Server | ownership, upload/access/unlink e persistência | `production_validated` |
| RAG MCP | lookup read-only, hotfix de consulta e logs seguros | `production_validated` |
| Frontend | testes, lint, typecheck, build, desktop/mobile/axe | `production_validated` + `verified_local_2026-07-18` |
| Performance | 5.000 campanhas; p95 <= 500 ms | 21,38–23,36 ms `verified_local_2026-07-18` |
| Banco local | reset, 228 pgTAP, lint e diff | `verified_local_2026-07-18` |
| Supabase app | migration base e hotfix de perfil homologados | `production_validated` |
| VPS | Compose, auth, smokes, logs, restart e rollback | `production_validated` |

## Resíduos aceitos

| Resíduo | Owner | Impacto sobre Fase 3 |
|---|---|---|
| Índice local de performance ainda não aplicado no Supabase remoto | Data/DevOps | não bloqueia implementação; aplicar antes do próximo gate de produção |
| 79 warnings de advisors, dos quais 8 em Marketing Ops, todos `auth_rls_initplan`; zero erro | Data/Security | dívida de otimização; não relaxa RLS e não bloqueia o corte atual |
| Adoção ampla sem planilha paralela não possui medição longitudinal | Produto/Operação | métrica contínua; piloto funcional já aceito |
| Prazos jurídicos definitivos de retenção permanecem abertos | Jurídico/Compliance | não bloqueia implementação; impede expurgo automático não aprovado |

Não há requisito obrigatório `not_evidenced`, nem falha alta/crítica conhecida.
