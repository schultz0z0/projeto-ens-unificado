# Registro de riscos — Fase 4

- **Estado:** `reconciled_with_residuals`
- **Revisão:** 2026-07-29

## Riscos de implementação

| ID | Risco | Impacto | Mitigação/gate | Owner | Estado |
|---|---|---|---|---|---|
| F4-R-01 | tool de leitura retorna estado incompleto ou divergente do REST | alto | reutilizar domínio existente, nunca reimplementar query no MCP | Marketing Ops | `open` |
| F4-R-02 | o modelo tenta chamar caminho de mutação direta | alto | manter bloqueio no runtime e expor novas mutações só via plano | Hermes Runtime | `mitigated_runtime_tested` |
| F4-R-03 | schema do plano cresce demais e vira superfície frágil | alto | actions pequenas, allowlist estrita, limite por plano e testes de contrato; previews inválidos permanecem fail-closed | Marketing Ops/Bridge | `mitigated_campaign_item_production_content_retest_pending` |
| F4-R-04 | conflito de versão gera overwrite silencioso | alto | leitura prévia obrigatória, `expected_version`, nova confirmação após conflito | Marketing Ops | `open` |
| F4-R-05 | retry duplica campanha, item, versão ou artifact link | alto | idempotência por plano/ação e testes de replay | Marketing Ops | `campaign_retry_production_validated_remaining_objects_pending` |
| F4-R-06 | `campaign_note_add` vira overwrite disfarçado de append | médio | contrato append-only e revisão de UX antes da execução | Product/Marketing Ops | `open` |
| F4-R-07 | `artifact_link` permita anexar artifact fora do contexto autorizado | alto | usar somente link de artifact existente e owned metadata validada | Marketing Ops | `open` |
| F4-R-08 | a auditoria não consiga ligar chat, run e tool ao objeto | alto | decidir cedo a modelagem de correlação e testar trilha completa | Marketing Ops/Bridge | `mitigated_production_validated` |
| F4-R-09 | deep link apontar para rota inconsistente com o frontend real | médio | gerar links no `marketing-ops` com contrato revisado pelo frontend | Frontend | `campaign_and_item_production_validated_content_pending` |
| F4-R-10 | descrição de tool grande ou ambígua induz uso incorreto pelo modelo | médio | ferramentas pequenas, nomenclatura estável, skill e contrato sistêmico da Bridge revisados; retestes reais e regressões RED/GREEN orientam o wire shape | Hermes Runtime/Bridge | `campaign_item_production_validated_content_skill_retest_pending` |
| F4-R-11 | indisponibilidade do `marketing-ops` aparecer como sucesso conversacional | alto | falha explícita, testes E2E e mensagens seguras de fallback | Bridge/Hermes Runtime | `mitigated_e2e_fake_validated` |
| F4-R-12 | scope/papel forjados passarem pela delegação | crítico | revalidação backend de tenant, role, scopes, run e expiração | Marketing Ops | `mitigated_production_three_roles_validated` |
| F4-R-13 | tools diretas legadas contornarem o plano confirmado | crítico | retirar do catálogo MCP e testar chamada ausente/bloqueada | Marketing Ops/Hermes Runtime | `mitigated_catalog_and_runtime` |
| F4-R-14 | rate limit por IP permitir abuso de uma tool por ator | alto | limite adicional por ator + tool com `retry_after_seconds` | Marketing Ops | `implemented_unit_validated` |
| F4-R-15 | instrução maliciosa em briefing/RAG/Graph ampliar autoridade | crítico | tratar conteúdo como dado, manter guardrails server-side e E2E de prompt injection | Hermes Runtime/Marketing Ops | `mitigated_production_validated` |
| F4-R-16 | revisão ENS inventar fato ou não usar fonte oficial | alto | RAG obrigatório, referências mínimas e cenário golden | Hermes Runtime | `source_call_validated_revision_retest_pending` |
| F4-R-17 | falha parcial reexecutar/duplicar ações concluídas | alto | resultado por ação, dependências e replay idempotente | Marketing Ops | `executor_unit_validated_vps_pending` |
| F4-R-18 | logs/auditoria persistirem copy ou briefing integral | alto | fingerprint de texto, redaction e testes de ausência | Marketing Ops/Bridge | `mitigated_unit_validated` |
| F4-R-19 | conteúdo receber deep link sem rota frontend canônica | médio | mapear asset para item + query `contentAssetId` | Frontend | `mitigated_production_validated` |
| F4-R-20 | histórico remoto de migration divergir do arquivo versionado e bloquear futuro `db push` | alto | reparar apenas `schema_migrations`, listar local/remoto antes do deploy e nunca reaplicar DDL já presente | Supabase/Marketing Ops | `mitigated_history_aligned_2026-07-28` |
| F4-R-21 | resposta coloquial aprovar plano errado ou pergunta/ressalva ser interpretada como execução | crítico | classificador contextual restrito ao plano pendente, sem tools/persistência, enum fechado, delegação emitida somente para `approve` e falha fechada | Hermes Runtime/Bridge | `production_matrix_validated` |
| F4-R-22 | provedor serializar `actions` fora do array nativo e bloquear preview seguro | alto | normalizar exclusivamente `{ item: ... }`, objeto tipado direto ou JSON desses formatos antes do mesmo schema allowlisted; contrato da skill e Bridge explícito | Marketing Ops/Bridge/Hermes Runtime | `production_preview_validated_with_terra` |
| F4-R-23 | schema visível exigir credenciais efêmeras que o modelo não deve preencher e induzir tool call vazia | alto | remover somente `delegation_token` e o `plan_token` já vinculados pelo runtime do schema apresentado ao modelo; manter schema/validação reais intactos | Hermes Runtime | `production_validated_with_terra` |
| F4-R-24 | referência da skill citar ações de conteúdo sem congelar seus campos canônicos | alto | documentar wire shape exato, proibir aliases e manter regressão do pacote gerenciado | Hermes Runtime | `mitigated_production_validated` |
| F4-R-25 | revisão de conteúdo ler somente resumo do asset e perder o corpo versionado | alto | exigir seletor exclusivo, `include_versions=true`, limite e tipo canônico de capacidade | Hermes Runtime | `skill_1_2_2_local_validated_vps_pending` |

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
