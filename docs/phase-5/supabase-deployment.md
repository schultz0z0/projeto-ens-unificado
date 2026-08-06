# Deploy Supabase — Fase 5

- **Estado:** `deployed_and_verified`
- **Projeto alvo:** `murxwqdevpwjtnnuzzxi` — Nexus AI - Marketing ENS
- **Região/Postgres:** `sa-east-1` / PostgreSQL 17.6
- **Data:** 2026-08-05; forward-fix 2026-08-06
- **Executor:** assistente, com autorização explícita do responsável

## Migrations aplicadas

| Migration local | Migration remota | Resultado |
|---|---|---|
| `20260805175137_phase_5_governance_approvals.sql` | `phase_5_governance_approvals` (`20260805175137`) | aplicada/alinhada |
| `20260805180850_phase_5_approval_fk_indexes.sql` | `phase_5_approval_fk_indexes` | aplicada/alinhada |
| `20260805184508_phase_5_service_write_boundary.sql` | `phase_5_service_write_boundary` | aplicada/alinhada |
| `20260805190517_phase_5_transition_ledger_hardening.sql` | `phase_5_transition_ledger_hardening` | aplicada/alinhada |
| `20260805191130_phase_5_queue_rls_performance.sql` | `phase_5_queue_rls_performance` | aplicada/alinhada |
| `20260805194650_phase_5_system_expiry_worker.sql` | `phase_5_system_expiry_worker` | aplicada/alinhada |
| `20260805195732_phase_5_audit_advisor_followup.sql` | `phase_5_audit_advisor_followup` | aplicada/alinhada |
| `20260806152536_phase_5_notification_rls_parameterized_fix.sql` | `phase_5_notification_rls_parameterized_fix` (`20260806152536`) | aplicada/alinhada |

O `supabase migration list --linked` foi executado após alinhar os filenames aos
versions gerados no deploy: todas as 24 migrations do repositório apresentam
`local = remote`, sem linha pendente ou drift.

A segunda migration foi criada após o advisor apontar nove foreign keys sem
índice de cobertura. Depois do forward-fix, esses avisos desapareceram; restam
somente avisos `unused_index` esperados em tabelas recém-criadas e ainda sem
tráfego de produção.

A quinta migration foi criada depois que um `EXPLAIN ANALYZE` remoto com 10 mil
linhas revelou 2,15 s na política correlacionada da fila. O helper que calcula as
campanhas acessíveis uma vez por consulta e o índice descendente de cursor
reduziram o mesmo cenário para 11,698 ms.

A sexta migration remove autoria humana falsa da expiração: decisões automáticas
recebem `decision_origin=system`, auditorias recebem `actor_type=service`, e o
worker só transiciona lotes limitados sob contexto interno confiável.

A sétima migration cobre a FK `audit_events.actor_user_id` e otimiza a policy de
inserção para avaliar identidade uma vez por statement. Depois dela, o advisor
de performance ficou apenas com `unused_index` informativo em índices novos.

A oitava migration mantém a identidade/tenant como initPlan, mas avalia os
helpers que dependem de `item_id` e `approval_request_id` para cada linha. O
catálogo remoto foi conferido e um insert parametrizado sem o `ON CONFLICT`
incompatível com a policy privada de leitura passou dentro de transação revertida.

## Invariantes verificadas no remoto

- 3 tabelas, 8 policies, 12 triggers nomeadas da Fase 5 e RLS forçada nas 3 tabelas;
- `anon` não possui leitura das tabelas da Fase 5;
- schema versions `5.0.0`, `5.0.1`, `5.0.2`, `5.0.3`, `5.0.4` e `5.0.5` presentes;
- `approval_decisions` não concede `UPDATE` nem `DELETE`;
- autoaprovação operacional pelo solicitante negada;
- segundo aprovador elegível permitido;
- segunda decisão e mutação da decisão negadas;
- mutação do payload congelado negada;
- autorização preserva o pacote/hash original;
- acesso cross-tenant negado;
- smoke executado dentro de transação e integralmente revertido.
- escrita direta sem contexto auditado negada;
- cancelamento registrado no ledger e pacote invalidado;
- notificação de aprovação forjada fora do serviço negada;
- supersessão com alvo inalterado negada pelo banco;
- concorrência remota resultou em exatamente uma decisão efetiva e nenhuma fixture residual;
- benchmark remoto de 10 mil linhas executado em transação revertida.
- worker remoto expirou exatamente uma fixture, registrou origem `system`, audit
  `service`, evento e notificação, e confirmou limpeza residual igual a zero.

## pgTAP e advisors

A extensão pgTAP não está instalada no projeto remoto (`plan(integer)`
inexistente) e Docker/Postgres local não está disponível nesta estação. Os dois
arquivos pgTAP permanecem versionados para CI/ambiente compatível; neste deploy,
o gate foi substituído por consultas de catálogo e smoke SQL transacional com
rollback cobrindo os mesmos contratos.

O advisor de segurança não reporta achado relacionado a `approval_requests`,
`approval_decisions` ou `action_packages`. O projeto já possuía 37 achados fora
do escopo da Fase 5 (34 warnings e 3 errors em objetos legados); eles não foram
introduzidos nem ampliados por estas migrations.

## Rollback

O banco já está expandido e a aplicação antiga ignora as novas tabelas/colunas.
Em incidente, desabilitar `MARKETING_OPS_FEATURE_APPROVALS` e
`VITE_MARKETING_OPS_APPROVALS`, preservar os dados e aplicar forward-fix. Não
remover tipos/tabelas em produção durante a janela de rollback.
