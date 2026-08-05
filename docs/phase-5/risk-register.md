# Registro de riscos — Fase 5

- **Estado:** `seeded`
- **Revisão:** 2026-08-05

| ID | Risco | Impacto | Mitigação/gate | Estado |
|---|---|---|---|---|
| F5-R-01 | approval técnico ser confundido com decisão de negócio | crítico | nomes, rotas, componentes e ledger separados; regressão do modal Hermes | `open` |
| F5-R-02 | versão/payload mudar depois da decisão | crítico | alvo imutável, hash canônico, triggers e revalidação transacional | `open` |
| F5-R-03 | autoaprovação operacional | crítico | `decided_by <> requested_by` no domínio e banco | `open` |
| F5-R-04 | papel revogado ainda decidir | crítico | revalidar membership/papel dentro da transação | `open` |
| F5-R-05 | duas decisões concorrentes vencerem | alto | row lock, versão otimista e estado terminal | `open` |
| F5-R-06 | retry duplicar solicitação/decisão/pacote | alto | idempotência por ator/operação/hash | `open` |
| F5-R-07 | expiração liberar pacote | crítico | expiração revalidada na decisão e consumo futuro | `open` |
| F5-R-08 | comentário causar XSS ou vazamento | alto | limite, sanitização, texto puro e redaction | `open` |
| F5-R-09 | fila vazar solicitações cross-tenant/escopo | crítico | RLS, queries autorizadas e testes negativos | `open` |
| F5-R-10 | payload sensível aparecer em logs/auditoria | alto | snapshots minimizados, hashes e scan de logs | `open` |
| F5-R-11 | Hermes decidir ou contornar UI | crítico | nenhuma action de decisão no MCP; catálogo e runtime testados | `open` |
| F5-R-12 | endpoint de aprovação causar efeito externo | crítico | ausência de provider/worker; E2E e inspeção de outbox | `open` |
| F5-R-13 | workflow genérico ampliar escopo | médio | dois tipos e decisão única no primeiro corte | `mitigated_by_design` |
| F5-R-14 | fila virar gargalo | médio | filtros, risco, expiração e métricas de tempo | `open` |
| F5-R-15 | timezone expirar solicitação incorretamente | alto | UTC no banco, ISO/IANA na UI e relógio controlado | `open` |
| F5-R-16 | pacote aprovado não servir à Fase 6 | alto | contrato canônico, hash e gate de saída explícito | `open` |

## Bloqueadores de promoção

- qualquer acesso cross-tenant ou elevação de papel;
- autoaprovação operacional;
- decisão sobre versão/payload diferente do preview;
- mais de uma decisão efetiva para a mesma solicitação;
- Hermes capaz de decidir;
- execução externa causada por endpoint da Fase 5;
- segredo, audiência integral ou conteúdo sensível indevido em logs;
- gate local ou VPS sem evidência.

## Critério de fechamento

`closed_with_accepted_residuals` exige mitigação comprovada dos riscos
altos/críticos, resíduos nomeados com owner e gate VPS aprovado.
