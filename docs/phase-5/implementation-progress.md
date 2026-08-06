# Progresso de implementação — Fase 5

- **Estado:** `production_validation_blocked`
- **Snapshot:** 2026-08-06 12:05 BRT
- **Design:** aprovado
- **Implementação:** Tasks 1–8 concluídas; Task 9 bloqueada por dois defeitos de produção

Os estados abaixo refletem evidência executada nesta sessão. O deploy está
acessível, mas a fase continua aberta até corrigir a decisão humana e o cache
de respostas autenticadas e repetir o gate real.

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
| 9 | Deploy controlado e homologação VPS no navegador | `production_validation_blocked` | Hotfix de submissão implantado e submissão real aprovada. Fila, preview, filtros, deep links, diálogos e cancelamento passaram. Decisão por admin retorna `500` por RLS em `in_app_notifications`; respostas autenticadas também vazam capabilities em cache entre contas. |

## Evidências acumuladas

- homologação real iniciada em `https://app.solucoes-nexus.tech/` com os três
  papéis fornecidos; o e-mail member confirmado é `rodrigolinhares@ens.edu.br`;
- fixture controlada criada pelo navegador: campanha
  `[PHASE5-HOMOLOG] Governança`, item `[PHASE5-HOMOLOG] Aprovação editorial` e
  conteúdo `[PHASE5-HOMOLOG] Email institucional`;
- Hermes recusou alvo não resolvido, preparou preview nominal, aguardou
  confirmação em turno posterior e preservou a ausência de envio/publicação;
- versão editorial 2 congelada pela API autenticada, hash
  `5f887fc0958cc15c90b571ab831bbf1ad133979edd0088cba0bf50cb1586b943`;
- submissão editorial reproduzida pelo Hermes e diretamente no REST, ambas com
  rollback. Correlação REST: `db29bfa3-8c16-423a-84f4-75c7898670a0`;
- logs PostgreSQL: `column "approval_request_id" is of type uuid but expression
  is of type text`; causa localizada nos parâmetros sem cast de
  `notifyReviewers` e com risco equivalente em `notifyRequester`;
- manager/admin carregam a fila; filtros sincronizam corretamente com a URL;
  deep link inexistente termina em erro seguro e o console do frontend não
  registrou erro JavaScript;
- nenhuma solicitação, decisão, notificação de aprovação ou efeito externo foi
  persistido pela tentativa falha.
- hotfix TDD: o novo teste falhou com os casts ausentes e passou após a correção;
  suíte dirigida 8 arquivos / 52 testes, typecheck e build aprovados;
- contrato das duas instruções SQL corrigidas preparado com sucesso no
  PostgreSQL remoto dentro de transação revertida, resultado
  `notification_uuid_cast_contract = ok`.

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

## Retomada em produção — 2026-08-06

- o commit `acb5bae` foi implantado; readiness `200` e submissão editorial real
  pelo Hermes comprovaram que o cast UUID resolveu o bloqueio anterior;
- a solicitação `d51d3f4d-0d2f-4f7a-bd3a-eebc51bc5779` foi criada com a versão
  e o hash esperados e depois cancelada pelo solicitante com ledger, auditoria,
  outbox e notificação íntegros;
- a solicitação nova `ffa5209e-2a9a-4134-96b9-2709b72743e7`, aberta primeiro
  pelo admin, expôs corretamente os controles de decisão, mas `Aprovar` fez
  rollback. Correlação REST: `e41eba94-e23d-4efe-883a-1e826d8397ca`;
- o log PostgreSQL confirmou RLS negando a projeção em
  `in_app_notifications`; a UI mascarou o `500` como conflito;
- o mesmo detalhe previamente aberto pelo member preservou capability de member
  após login como manager/admin. REST sem cache retornou as capabilities certas,
  confirmando contaminação de resposta autenticada entre sessões.

## Próximo ponto exato

1. corrigir a política/caminho de projeção de `notifyRequester` para permitir a
   notificação auditada do solicitante por decisor elegível sem ampliar escrita
   arbitrária, com teste real de RLS e rollback;
2. impedir cache compartilhado em todas as respostas autenticadas (`private,
   no-store`, `Vary` adequado e política do proxy/cliente) e testar troca de
   identidade no mesmo URL;
3. fazer a UI preservar status/código/correlation ID e só rotular `409` como
   conflito;
4. publicar o próximo hotfix e repetir a Task 9 completa: decisão, ajustes,
   novo ciclo, operacional/SoD, expiração, idempotência, notificações,
   persistência, mobile e ausência de efeito externo.
