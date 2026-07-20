# Progresso de implementação — Fase 4

- **Estado:** `planned`
- **Progresso de implementação:** 0%
- **Snapshot:** 2026-07-20
- **Branch única:** `main`
- **Próximo gate:** revisão técnica do pacote documental e início da Task 1

## Planejamento por task

| Task | Escopo | Estado | Saída esperada |
|---|---|---|---|
| 1 | contratos MCP, decisão de schema e baseline de auditoria | `not_started` | catálogo congelado, actions v2 do plano e decisão sobre migration |
| 2 | leituras MCP de agenda, timeline, conteúdo e capacidades | `not_started` | tools de leitura expostas sobre domínio existente |
| 3 | expansão do `prepare_plan` e `execute_plan` | `not_started` | novas ações de escrita seguras e idempotentes |
| 4 | deep links, resultados estruturados e mensagens de operador | `not_started` | tool results consistentes com frontend e UX conversacional |
| 5 | integração Hermes runtime e skill do operador | `not_started` | runtime bloqueando caminho errado e usando novas capacidades |
| 6 | observabilidade, auditoria e correlação ponta a ponta | `not_started` | métricas, trilha e evidência de chat → run → tool → audit |
| 7 | frontend/bridge/E2E e falhas controladas | `not_started` | jornada integrada com erros sem falso sucesso |
| 8 | gates locais, operação, VPS e handoff | `not_started` | pacote documental reconciliado e fase pronta para homologação |

## Estratégia de execução

- cada task começa por RED real e termina com GREEN real;
- a documentação da fase deve ser atualizada no mesmo ciclo da task;
- leituras MCP entram antes das novas mutações do plano;
- mutações novas só entram depois do catálogo e do contrato de auditoria
  estarem congelados;
- o runtime Hermes só é ampliado depois que o `marketing-ops` expuser o novo
  contrato de forma estável;
- o frontend e a Bridge fecham a reta final com E2E e correlação.

## Critérios de progresso

A fase não avança para `in_progress` apenas por existir documentação. Esse
estado só deve ser usado quando a Task 1 começar com execução técnica real,
testes RED e arquivos de produto alterados.

## Bloqueadores prévios conhecidos

- congelar o catálogo final de tools de leitura;
- decidir a modelagem final de rastreabilidade em auditoria;
- validar se `campaign_note_add` fecha a necessidade do produto usando
  `campaigns.notes` sem tabela nova;
- confirmar que `artifact_link` da fase opera somente sobre artifact existente,
  sem upload arbitrário pelo MCP.
