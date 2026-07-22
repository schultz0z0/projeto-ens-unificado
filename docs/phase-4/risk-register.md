# Registro de riscos — Fase 4

- **Estado:** `reconciled_with_residuals`
- **Revisão:** 2026-07-22

## Riscos de implementação

| ID | Risco | Impacto | Mitigação/gate | Owner | Estado |
|---|---|---|---|---|---|
| F4-R-01 | tool de leitura retorna estado incompleto ou divergente do REST | alto | reutilizar domínio existente, nunca reimplementar query no MCP | Marketing Ops | `open` |
| F4-R-02 | o modelo tenta chamar caminho de mutação direta | alto | manter bloqueio no runtime e expor novas mutações só via plano | Hermes Runtime | `mitigated_runtime_tested` |
| F4-R-03 | schema do plano cresce demais e vira superfície frágil | alto | actions pequenas, allowlist estrita, limite por plano e testes de contrato | Marketing Ops | `open` |
| F4-R-04 | conflito de versão gera overwrite silencioso | alto | leitura prévia obrigatória, `expected_version`, nova confirmação após conflito | Marketing Ops | `open` |
| F4-R-05 | retry duplica campanha, item, versão ou artifact link | alto | idempotência por plano/ação e testes de replay | Marketing Ops | `open` |
| F4-R-06 | `campaign_note_add` vira overwrite disfarçado de append | médio | contrato append-only e revisão de UX antes da execução | Product/Marketing Ops | `open` |
| F4-R-07 | `artifact_link` permita anexar artifact fora do contexto autorizado | alto | usar somente link de artifact existente e owned metadata validada | Marketing Ops | `open` |
| F4-R-08 | a auditoria não consiga ligar chat, run e tool ao objeto | alto | decidir cedo a modelagem de correlação e testar trilha completa | Marketing Ops/Bridge | `mitigated_remote_schema_applied_vps_pending` |
| F4-R-09 | deep link apontar para rota inconsistente com o frontend real | médio | gerar links no `marketing-ops` com contrato revisado pelo frontend | Frontend | `mitigated_component_and_e2e_fake` |
| F4-R-10 | descrição de tool grande ou ambígua induz uso incorreto pelo modelo | médio | ferramentas pequenas, nomenclatura estável e skill revisada | Hermes Runtime | `mitigated_skill_tested` |
| F4-R-11 | indisponibilidade do `marketing-ops` aparecer como sucesso conversacional | alto | falha explícita, testes E2E e mensagens seguras de fallback | Bridge/Hermes Runtime | `mitigated_e2e_fake_validated` |
| F4-R-12 | scope/papel forjados passarem pela delegação | crítico | revalidação backend de tenant, role, scopes, run e expiração | Marketing Ops | `implementation_complete_vps_pending` |
| F4-R-13 | tools diretas legadas contornarem o plano confirmado | crítico | retirar do catálogo MCP e testar chamada ausente/bloqueada | Marketing Ops/Hermes Runtime | `mitigated_catalog_and_runtime` |
| F4-R-14 | rate limit por IP permitir abuso de uma tool por ator | alto | limite adicional por ator + tool com `retry_after_seconds` | Marketing Ops | `implemented_unit_validated` |
| F4-R-15 | instrução maliciosa em briefing/RAG/Graph ampliar autoridade | crítico | tratar conteúdo como dado, manter guardrails server-side e E2E de prompt injection | Hermes Runtime/Marketing Ops | `guardrails_implemented_e2e_pending` |
| F4-R-16 | revisão ENS inventar fato ou não usar fonte oficial | alto | RAG obrigatório, referências mínimas e cenário golden | Hermes Runtime | `policy_implemented_vps_pending` |
| F4-R-17 | falha parcial reexecutar/duplicar ações concluídas | alto | resultado por ação, dependências e replay idempotente | Marketing Ops | `executor_unit_validated_vps_pending` |
| F4-R-18 | logs/auditoria persistirem copy ou briefing integral | alto | fingerprint de texto, redaction e testes de ausência | Marketing Ops/Bridge | `mitigated_unit_validated` |
| F4-R-19 | conteúdo receber deep link sem rota frontend canônica | médio | mapear asset para item + query `contentAssetId` | Frontend | `mitigated_component_and_e2e_fake` |

## Bloqueadores permanentes

Continuam bloqueando qualquer promoção da fase:

- acesso cross-tenant ou elevação de papel;
- mutação direta fora de `prepare_plan_v1` e `execute_plan_v1`;
- falso sucesso em conflito, falha parcial ou indisponibilidade;
- deep link apontando para objeto errado;
- delegação, plan token ou segredo vazados em logs/histórico.

## Ordem recomendada de mitigação

1. F4-R-03, F4-R-08 e F4-R-12 antes da primeira implementação.
2. F4-R-01, F4-R-04, F4-R-05 e F4-R-07 durante o núcleo do `marketing-ops`.
3. F4-R-09, F4-R-10 e F4-R-11 no fechamento E2E.
4. F4-R-13–F4-R-18 antes do gate local.

## Critério de fechamento

Este registro só muda de `seeded` para `closed_with_accepted_residuals` quando:

- todos os riscos altos/críticos estiverem mitigados com evidência;
- eventuais resíduos forem explicitamente aceitos;
- houver gate VPS aprovado e sem falha alta/crítica conhecida.
