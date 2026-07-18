# Registro de riscos da Fase 2

- **Estado:** `closed_with_accepted_residuals`
- **Revisão:** 2026-07-18

## Riscos encerrados por evidência

| ID | Risco | Evidência de encerramento | Estado |
|---|---|---|---|
| F2-R-01 | acesso cross-tenant/papel excessivo | pgTAP/RLS e smokes por papel na VPS | `closed` |
| F2-R-02 | deadlock/advisory lock | harness campanha/participante/item sem `40P01` | `closed` |
| F2-R-03 | vazamento em timeline/auditoria/log | allowlists, pgTAP e inspeção VPS | `closed` |
| F2-R-04 | RAG virar fonte transacional | integração MCP e decisão F2-D-02 | `closed` |
| F2-R-05 | material órfão/perdido | ownership, unlink, restart e persistência VPS | `closed` |
| F2-R-06 | sobrescrita concorrente | versão, 409 e reaplicação explícita | `closed` |
| F2-R-08 | fixtures afetarem produção | gate dedicado e cleanup aprovado | `closed` |
| F2-R-09 | migration no projeto errado | deploy base registrado e homologado | `closed` |
| F2-R-10 | ativação prematura | rollout e kill switch validados | `closed` |
| F2-R-11 | lista lenta | p95 local 21,38–23,36 ms com 5.000 campanhas | `closed_pending_remote_index` |
| F2-R-12 | drift documental | pacote reconciliado em 2026-07-18 | `closed` |
| F2-R-13 | logs/métricas sensíveis | redaction e inspeção VPS | `closed` |

## Resíduos aceitos

| ID | Residual | Impacto | Owner | Tratamento |
|---|---|---|---|---|
| F2-R-14 | adoção ampla sem planilhas não medida longitudinalmente | médio de produto; não técnico | Produto/Operação | acompanhar usuários ativos e campanhas reais |
| F2-R-15 | 79 warnings de advisors; 8 Marketing Ops `auth_rls_initplan` | baixo; custo de execução, sem falha de RLS | Data/Security | otimizar policies em ciclo dedicado |
| F2-R-16 | índice de performance ainda não aplicado remotamente | produção atual não recebe o ganho local | Data/DevOps | aplicar no próximo deploy antes do gate de performance VPS |
| F2-R-17 | retenção jurídica definitiva não definida | impede expurgo automático | Jurídico/Compliance | decidir política sem apagar auditoria |

## Bloqueadores permanentes

Continuam bloqueando qualquer rollout futuro:

- acesso cross-tenant ou elevação de papel;
- conteúdo, token ou URL assinada em timeline/log;
- deadlock reproduzível ou perda de bytes/dados;
- migration destinada a projeto inesperado;
- falha alta/crítica conhecida sem mitigação;
- relaxamento de RLS para atingir performance.

Nenhum desses bloqueadores está aberto no encerramento.
