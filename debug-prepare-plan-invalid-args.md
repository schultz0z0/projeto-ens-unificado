# Debug Session: prepare-plan-invalid-args
- **Status**: [OPEN]
- **Issue**: No cenario 2 da Fase 4, o Hermes entra em varias tentativas de `marketing_ops_prepare_plan_v1` e recebe `MCP error -32602` por argumentos invalidos (`invalid_union`) em vez de montar o plano corretamente.
- **Debug Server**: not_started
- **Log File**: .dbg/trae-debug-log-prepare-plan-invalid-args.ndjson

## Reproduction Steps
1. Abrir o chat com o Hermes em producao.
2. Enviar um pedido mutavel no formato do cenario 2, por exemplo criar campanha em rascunho com checklist inicial.
3. Observar no log do Hermes repetidas chamadas para `marketing_ops_prepare_plan_v1`.
4. Verificar que a tool retorna `-32602 invalid_union` e o Hermes passa a tentar corrigir a chamada varias vezes.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | O Hermes esta montando uma `action.type` ou shape de `actions[]` que nao existe no union aceito pelo `marketing_ops_prepare_plan_v1`. | High | Low | Pending |
| B | O Hermes esta incluindo campos nao permitidos ou com nome errado dentro de uma action valida, por exemplo payload/patch/slug em formato diferente do schema. | High | Low | Pending |
| C | O prompt/skill esta levando o modelo a tentar montar um plano multi-etapas com semantica acima do contrato real, incluindo dependencias que o schema nao representa desse jeito. | Medium | Medium | Pending |
| D | O contrato textual do operador esta correto, mas falta um exemplo canonicamente valido para `campaign.create_draft` seguido de `campaign_item.create`, fazendo o modelo improvisar JSON invalido. | Medium | Medium | Pending |
| E | Existe divergencia entre o nome/shape documentado para a tool no runtime Hermes e o schema realmente registrado no `marketing-ops`. | Medium | Low | Pending |

## Log Evidence
- O erro recorrente no Hermes e: `Tool mcp_nexus_marketing_ops_marketing_ops_prepare_plan_v1 returned error ... -32602 ... invalid_union`.
- O tool `marketing_ops_prepare_plan_v1` registra `inputSchema.actions = marketingOpsPlanActionsSchema` em `services/marketing-ops/src/mcp/createServer.ts`.
- O union aceito em `services/marketing-ops/src/plans/contracts.ts` tem exatamente 8 actions estritas:
  `campaign.create_draft`, `campaign.update`, `campaign_item.create`,
  `campaign_item.reschedule`, `content.create_draft`,
  `content.version_create`, `artifact.link_existing`, `campaign.note_add`.
- A action `campaign.create_draft` aceita somente `type`, `ref`, `name` e `course_slug` opcional; qualquer campo extra invalida a action porque o schema e `strict()`.
- Na resposta do Hermes observada pelo usuario, ele passou a falar em "identificador interno" para a campanha. Esse campo nao existe no schema da action `campaign.create_draft`, o que reforca shape invalido.
- O mesmo texto sugere tentativa de embutir etapas futuras e semantica de checklist/briefing na mesma chamada, o que aumenta a chance de o modelo estar montando JSON fora do contrato estrito.

## Verification Conclusion
- Hipotese A: **CONFIRMED**. O Hermes esta emitindo uma action ou shape fora do union aceito pelo `marketing_ops_prepare_plan_v1`.
- Hipotese B: **CONFIRMED**. Ha forte evidencia de campo invalido dentro de action valida, especialmente o "identificador interno" nao suportado em `campaign.create_draft`.
- Hipotese C: **LIKELY**. O pedido do cenario 2 induz um plano composto demais para a primeira action, e o modelo tenta incluir semantica adicional antes de obter IDs reais.
- Hipotese D: **LIKELY**. Falta um exemplo canonico mais restritivo no contrato/skill para esse fluxo de campanha + item de email em duas etapas.
- Hipotese E: **REJECTED por ora**. O catalogo e os testes do runtime/listTools batem com o schema exposto; o problema parece estar na chamada gerada pelo modelo, nao em divergencia de registro da tool.
