# Fase 0 — Diagnóstico e Contrato de Evolução

Este diretório reúne a linha de base verificável do Nexus AI antes da implementação do Marketing Ops.

## Status

- **Fase:** `ready_for_production`
- **Gate local:** `pass`
- **Gate VPS:** `pending_user_deploy`
- **Branch:** `main`, por decisão explícita do usuário
- **Publicação:** nenhum `git push` ou deploy autorizado nesta etapa
- **Plano:** [2026-07-10-phase-0-diagnostic-implementation.md](../plans/2026-07-10-phase-0-diagnostic-implementation.md)
- **PRD:** [phase-0-diagnostico-contrato-evolucao.md](../prds/phase-0-diagnostico-contrato-evolucao.md)

## Entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Inventário do frontend | [frontend-inventory.md](frontend-inventory.md) | `completed` |
| Catálogo de serviços | [services-catalog.md](services-catalog.md) | `completed` |
| Avaliação de código residual | [residual-cleanup-assessment.md](residual-cleanup-assessment.md) | `completed` |
| Inventário Supabase | [supabase-inventory.md](supabase-inventory.md) | `completed_repository_inventory` |
| Plano de limpeza Supabase | [supabase-cleanup-plan.md](supabase-cleanup-plan.md) | `planned_not_applied` |
| Mapa de dados | [data-map.md](data-map.md) | `completed` |
| Integração Hermes | [hermes-integration.md](hermes-integration.md) | `completed` |
| Glossário | [glossary.md](glossary.md) | `completed` |
| Matriz de responsabilidades | [responsibility-matrix.md](responsibility-matrix.md) | `completed` |
| ADRs | [adrs](adrs) | `completed` |
| Registro de riscos | [risk-register.md](risk-register.md) | `completed` |
| Plano de transição | [transition-plan.md](transition-plan.md) | `completed` |
| Backlog da Fase 1 | [phase-1-backlog.md](phase-1-backlog.md) | `completed` |
| Runbook de deploy VPS | [vps-deployment-runbook.md](vps-deployment-runbook.md) | `completed` |
| Evidência local | [local-validation.md](local-validation.md) | `pass` |
| Validação VPS | [vps-validation.md](vps-validation.md) | `pending_user_deploy` |

## Evidências

### Fontes primárias

- código e configuração versionados no commit base `fc04ad9`;
- `docker-compose.yml` e `docker-compose.prod.yml`;
- migrations ativas de `apps/chat-web/supabase/migrations`;
- schema/migrations de `services/rag-mcp/supabase`;
- rotas do frontend em `apps/chat-web/src/App.tsx`;
- integração do chat em `apps/chat-web/src/components/chat` e `services/chat-bridge`;
- configuração Hermes em `services/hermes-runtime/docker` e `infra/hermes`;
- testes existentes nos apps e serviços.

### Regras de evidência

- secrets e conteúdo de `.env` não são copiados;
- uma afirmação recebe caminho de origem ou comando reproduzível;
- ausência de Docker/Bash é registrada como `not_run_environment_missing`;
- código presente, mas não alcançável por rota/importação, não é tratado como funcionalidade ativa;
- uma migration histórica não prova que o objeto ainda existe em produção;
- o estado da VPS só será confirmado depois do deploy/acesso autorizado pelo usuário.

### Classificações

| Classificação | Significado |
|---|---|
| `keep` | Continua com a mesma responsabilidade principal |
| `adapt` | Continua, mas precisa integrar-se ao novo domínio |
| `migrate` | Dados/comportamento devem migrar para a arquitetura-alvo |
| `archive` | Histórico útil, fora do runtime ativo |
| `remove_candidate` | Candidato à remoção após evidência, teste e rollback |
| `unknown_runtime` | Código conhecido, estado real do ambiente ainda não confirmado |

## Critérios de saída

- inventários de frontend, serviços e Supabase concluídos;
- integração Hermes documentada ponta a ponta;
- glossário e ownership definidos;
- ADRs aprovadas registradas;
- riscos severos com mitigação e owner proposto;
- transição e backlog da Fase 1 priorizados;
- validações locais executadas ou explicitamente bloqueadas;
- runbook VPS completo;
- gate VPS executado após ação do usuário;
- nenhuma remoção ou migration destrutiva realizada nesta fase.
