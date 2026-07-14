# Registro de riscos da Fase 2

- **Estado:** `active`
- **Revisão:** 2026-07-14
- **Regra:** risco só é encerrado com evidência executada; inspeção estática não substitui prova PostgreSQL/Linux/VPS

| ID | Risco | Impacto | Mitigação e evidência exigida | Residual atual | Owner |
|---|---|---|---|---|---|
| F2-R-01 | acesso cross-tenant ou papel excessivo | crítico | membership servidor-side, RLS forçada, preflight, grants por coluna e matriz negativa nos três papéis | alto até pgTAP/VPS | Backend/Security |
| F2-R-02 | deadlock ou abuso de advisory lock no agregado | alto | ordem única de lock em campanha/participante/item/material, autorização antes do lock e harness de duas sessões | médio; correção implementada, prova real pendente | Backend/Data |
| F2-R-03 | briefing, notas, tokens ou URLs vazarem na auditoria/timeline | alto | Task 8 minimiza snapshots/outbox, usa projeção privada com allowlists e testes procuram conteúdo proibido | médio; mitigação implementada, pgTAP/logs/histórico VPS pendentes | Backend/Security |
| F2-R-04 | escrita ou migration acidental no Supabase do RAG | crítico | somente MCP `ens_rag_search`/`ens_rag_get_document`, endpoint interno e proibição documental de conexão direta | baixo no código; validar env/Compose na VPS | Plataforma/Data |
| F2-R-05 | material órfão, de outro owner ou perdido após restart | alto | ownership verificado, compensação de upload, unlink lógico, volume persistente e cleanup explícito | médio; integração/persistência VPS pendentes | Backend/DevOps |
| F2-R-06 | sobrescrita silenciosa por edição concorrente | alto | versão do agregado, `If-Match`, `version_conflict` e UX de recarregar/reaplicar sem descartar valores locais | médio; frontend e E2E pendentes | Backend/Frontend |
| F2-R-07 | falsa confiança por ausência de Docker/PostgreSQL local | alto | status `implemented_pending_vps_validation`, lista nominal dos testes diferidos e proibição de alegar RED/GREEN não executado | médio até gate VPS | Engenharia/QA |
| F2-R-08 | testes na VPS afetarem dados reais | alto | fixtures marcadas, tenant/atores de teste, correlation IDs próprios, rollback transacional quando possível e cleanup verificado | alto até script seguro da Task 14 | QA/DevOps |
| F2-R-09 | migration aplicada no projeto Supabase errado | crítico | confirmar inequivocamente ref/host do app, backup com hash, `migration list`, dry-run e revisão; nunca usar variáveis `NEXUS_RAG_*` | médio até deploy | Data/Responsável pelo deploy |
| F2-R-10 | ativação prematura da superfície incompleta | alto | flags read/write/frontend default-off, kill switch e rollout por etapas | baixo enquanto flags estiverem desligadas | Produto/DevOps |
| F2-R-11 | lista lenta ou bundle frontend regressivo | médio | payload resumido, índices, 5.000 campanhas, lazy loading e medição de bundle/p95 | médio; Tasks 11 e 14 pendentes | Frontend/Backend |
| F2-R-12 | drift entre Roadmap, PRD, plano e implementação | médio | README-index, rastreabilidade e progresso atualizados por task; design prevalece sobre plano divergente | baixo com o pacote atual | Liderança técnica |
| F2-R-13 | logs ou métricas conterem conteúdo, filename, IDs pessoais ou secrets | alto | labels allowlisted, logger redigido, correlação sem payload e inspeção de logs VPS | médio; observabilidade final pendente | Backend/Security |
| F2-R-14 | equipe continuar usando planilhas paralelas | médio | piloto com uma ou duas campanhas reais, feedback e aceite antes de ampliar | alto até rollout real | Produto/Operação |
| F2-R-15 | warnings legados esconderem regressão nova | médio | comparar por escopo, exigir zero erro e zero achado novo nos objetos alterados; registrar baseline de 15/81 warnings | médio até advisors pós-deploy | Data/Security |

## Riscos herdados

- a limpeza destrutiva de legado continua `planned_not_applied` e não entra nas migrations da Fase 2;
- os warnings legados da Fase 1 permanecem dívida conhecida, sem autorização para ampliar a superfície;
- o bundle frontend F1-201 continua dívida e deve ser medido quando as novas rotas forem adicionadas;
- a confirmação conversacional e as tools MCP da Fase 1 são baseline de regressão, embora a UI da Fase 2 use REST.

## Critérios de bloqueio

Impedem rollout, mesmo que os demais testes estejam verdes:

- qualquer acesso cross-tenant ou elevação de papel;
- timeline/auditoria contendo texto livre, token, URL assinada ou payload bruto proibido;
- deadlock reproduzível, perda de bytes/metadados ou fixture residual na VPS;
- migration/dry-run apontando para projeto inesperado;
- falha crítica/alta conhecida sem mitigação aprovada;
- flags frontend/write ativas antes do gate correspondente.
