# Progresso de implementação — Fase 5

- **Estado:** `ready_for_vps_deploy`
- **Snapshot:** 2026-08-05 17:07 BRT
- **Design:** aprovado
- **Implementação:** Tasks 1–8 concluídas; Task 9 pronta para deploy/homologação VPS

Os estados abaixo refletem evidência executada nesta sessão. A fase continua
aberta até o deploy e a homologação real na VPS.

| Task | Escopo | Estado | Evidência atual |
|---:|---|---|---|
| 1 | Contratos, migration, RLS e pgTAP | `completed` | 7 migrations aditivas; contrato estático ampliado; migrations remotas; catálogo/RLS e smoke transacional remoto aprovados. Extensão pgTAP não está instalada no projeto, portanto os mesmos invariantes foram executados por SQL transacional com rollback. |
| 2 | Domínio editorial e fila de leitura | `completed` | schemas estritos, versão congelada, cursores estáveis, filtros, detalhe e histórico; testes dirigidos verdes. |
| 3 | Pacote operacional, decisão e concorrência | `completed` | payload/hash canônicos e imutáveis, autoaprovação bloqueada, decisão única, `If-Match`, expiração e idempotência; testes unitários e smoke concorrencial/invariantes remotos verdes. |
| 4 | REST, OpenAPI, SDK e capabilities | `completed` | 6 rotas REST, OpenAPI, feature flag, capability, SDK/query keys; testes de contratos e typecheck verdes. |
| 5 | Frontend da fila e detalhe | `completed` | rotas lazy, menu, filtros, preview, diálogo de decisão, notificações/deep links e estados de erro; 20/20 testes dirigidos do frontend. |
| 6 | Ajustes, expiração, notificações e observabilidade | `completed` | ajustes/rejeição com comentário, cancelamento/expiração, projeções mínimas de notificação, logs redigidos e métrica allowlisted/instrumentada. |
| 7 | Hermes/MCP para submissão controlada | `completed` | somente `approval.submit_editorial` e `approval.submit_operational`; scope `approval:submit`; nenhuma decisão; contratos/executor e Bridge verdes. |
| 8 | E2E, segurança, performance e gate local | `completed` | frontend 212/212, Bridge 89/89, serviço dirigido 52/52, contrato de navegador local 2/2, fila RLS remota de 10 mil linhas com p95 de 16,01 ms, security gate, builds/typechecks e audits aprovados. |
| 9 | Deploy controlado e homologação VPS no navegador | `ready_for_vps_deploy` | Supabase implantado, revisão e regressão local aprovadas; aguarda execução do runbook na VPS e homologação manual. |

## Evidências acumuladas

- serviço dirigido após revisão: 8 arquivos, 52 testes aprovados;
- contrato de migrations: 8/8, sendo 7 contratos específicos da Fase 5;
- frontend completo: 59 arquivos, 212 testes aprovados;
- Bridge completo: 89/89;
- contrato de UI em navegador real com backend controlado: 2/2;
- builds de produção: `marketing-ops` e `chat-web` aprovados;
- typecheck: `marketing-ops` e `chat-web` aprovados;
- ESLint global: aprovado, somente 10 warnings legados;
- security gate completo: aprovado;
- Supabase: sete migrations remotas da Fase 5 aplicadas, incluindo barreira de
  escrita, ledger de todas as transições terminais, otimização da fila sob RLS e
  expiração limitada com identidade explícita de sistema.
- advisor follow-up adicionou cobertura à FK de ator da auditoria e eliminou a
  reavaliação de autenticação por linha; restam apenas avisos informativos de
  índices novos ainda não usados.

## Hardening de performance — 16:31 BRT

- o primeiro `EXPLAIN ANALYZE` real com 10 mil solicitações expôs 2,15 s de
  execução por avaliação correlacionada de acesso à campanha;
- a migration `phase_5_queue_rls_performance` materializa o conjunto de campanhas
  acessíveis uma vez e adiciona índice descendente compatível com o cursor;
- a repetição do mesmo benchmark remoto caiu para 11,698 ms, sempre dentro de
  transação revertida, sem deixar fixtures no projeto.
- o gate versionado executou 20 amostras da consulta real sob RLS com 10 mil
  solicitações e mediu p95 de 16,01 ms, também com rollback integral.

## Hardening da revisão final — 16:08 BRT

- idempotência corrigida nos schemas internos sem alterar os payloads REST;
- toda transição terminal (`approved`, `rejected`, `changes_requested`,
  `cancelled`, `expired`) exige uma decisão imutável correlacionada;
- cancelamento agora gera ledger, notificação e invalidação do pacote;
- expiração não produz escrita em leitura; o worker interno e o caminho de
  decisão vencida consolidam a transição durável;
- ciclos `supersedesRequestId` exigem mesma campanha/tipo/solicitante, predecessor
  em `changes_requested` e hash efetivamente alterado;
- notificações de aprovação forjadas fora da transação auditada são bloqueadas;
- resposta de decisão operacional devolve o pacote atualizado;
- rotas REST alinhadas ao design em `/v1/approval-requests` e `/decisions`;
- fila/detalhe receberam filtros completos, preview congelado, histórico,
  cancelamento e confirmação reforçada para risco crítico;
- smoke remoto com rollback aprovou segundo aprovador, autorização, cancelamento,
  barreira de escrita, barreira de notificação e rejeição de supersessão inválida.
- expiração saiu dos GETs, passou para worker reexecutável de 100 itens com
  `SKIP LOCKED`, respeita as flags `write + approvals` e registra decisão de
  origem `system`, auditoria `service`, evento e notificação; smoke remoto aprovado.
- mutações editoriais preservam o alvo congelado no cache e revalidam o detalhe;
  solicitante operacional não recebe notificação para uma decisão inelegível.

## Próximo ponto exato

1. publicar o commit da implementação;
2. executar o runbook na VPS;
3. liberar a URL ao assistente para o gate manual no navegador.
