# Progresso de implementação — Fase 5

- **Estado:** `not_started`
- **Snapshot:** 2026-08-05
- **Design:** aprovado
- **Implementação:** não iniciada

Os estados abaixo registram somente evidência executada. Uma task não muda
para `completed` por código escrito sem seus testes e documentos aplicáveis.

| Task | Escopo | Estado | Evidência |
|---:|---|---|---|
| 1 | Contratos, migration, RLS e pgTAP | `not_started` | — |
| 2 | Domínio editorial e fila de leitura | `not_started` | — |
| 3 | Pacote operacional, decisão e concorrência | `not_started` | — |
| 4 | REST, OpenAPI, SDK e capabilities | `not_started` | — |
| 5 | Frontend da fila e detalhe | `not_started` | — |
| 6 | Ajustes, expiração, notificações e observabilidade | `not_started` | — |
| 7 | Hermes/MCP para submissão controlada | `not_started` | — |
| 8 | E2E, segurança, performance e gate local | `not_started` | — |
| 9 | Deploy controlado e homologação VPS no navegador | `not_started` | — |

## Regra de atualização

Cada fechamento registra:

- arquivos e contratos efetivamente alterados;
- testes RED→GREEN e regressão executada;
- resultados de build, lint e typecheck;
- evidência de banco/segurança aplicável;
- riscos ou desvios encontrados;
- próximo ponto exato de continuação.

Task 9 depende do deploy realizado pelo responsável. O assistente executará a
homologação manual pós-deploy e somente então poderá promover a fase.
