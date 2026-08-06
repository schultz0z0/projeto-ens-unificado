# Validação VPS e navegador — Fase 5

- **Estado:** `awaiting_hotfix_redeploy`
- **Deploy:** responsabilidade do usuário/responsável autorizado
- **Homologação manual final:** assistente, após o deploy

## Pré-condições

- [x] commit implantado identificado: `acb5bae`;
- [x] gate local completo;
- [x] migrations remotas e invariantes registrados;
- [x] serviços web e Hermes acessíveis;
- [x] usuários/tenant e fixtures de homologação identificados;
- [x] tentativa confirmou ausência de envio/publicação e rollback integral;

## Infraestrutura

- [x] Compose efetivo e imagens corretas: rebuild de `rag-mcp`, `artifact-server` e `marketing-ops` concluído em 2026-08-06;
- [x] health/readiness: dependências healthy e `GET /ready` do Marketing Ops retornando `200`;
- [ ] rede, TLS, CORS e envs;
- [x] Supabase do app com migration `5.0.5` e RLS verificadas;
- [x] logs/correlation ID;
- [ ] restart e persistência;
- [ ] backup e rollback verificáveis.

## Homologação manual pelo navegador

O assistente executará:

- [x] member cria solicitação editorial pelo Hermes após confirmação em turno posterior;
- [x] preview mostra campanha, asset, versão e hash corretos;
- [ ] **BLOQUEADO:** manager/admin elegível aprova — o `POST /decisions` retorna `500` e faz rollback;
- [x] rejeição e ajuste exigem comentário na UI; persistência da decisão permanece bloqueada pelo `500`;
- [ ] novo ciclo preserva histórico;
- [x] controles de filtro por tipo/status/campanha/risco/vencimento carregam; filtros manager sincronizam com a URL;
- [ ] solicitante operacional recebe bloqueio de autoaprovação;
- [ ] segundo aprovador autoriza o mesmo pacote congelado;
- [ ] expiração impede decisão/liberação;
- [ ] usuário sem acesso e cross-tenant recebem negação segura;
- [x] Hermes prepara/submete após confirmação e não oferece decisão;
- [ ] modal técnico do Hermes continua independente;
- [ ] desktop, mobile, teclado e acessibilidade;
- [x] deep link real e inexistente recebem detalhe ou negação segura, respectivamente;
- [x] nenhuma execução externa é produzida pela tentativa;

## Conferência de evidência

- [x] Supabase confirma versão/payload/hash da solicitação editorial;
- [x] cancelamento pelo solicitante grava exatamente uma decisão efetiva;
- [x] cancelamento grava auditoria, eventos e notificação correlacionados;
- [ ] retry idempotente sem duplicidade;
- [ ] logs sem secrets/conteúdo/audiência indevidos;
- [ ] dados persistem após restart.

## Promoção

A fase somente muda para `production_validated` depois que este checklist,
evidências técnicas e aceite funcional estiverem completos, sem falha
alta/crítica conhecida.

## Execução real — 2026-08-05

- Aplicação e dashboard de logs acessíveis em produção.
- Autenticação aprovada para member (`rodrigolinhares@ens.edu.br`), manager e
  admin; menus respeitam os papéis esperados.
- Fixture: campanha `143d7eb3-6167-40a3-b433-2a40e7df3708`, item
  `93f9ea52-aed7-4ec0-95ca-0c42d286afaa`, asset
  `04fb4c68-2bf2-4e65-a4e4-81ea75ae832a`, versão congelada 2.
- Hermes validou identidade exata, bloqueou alvo inicialmente fora da agenda,
  exibiu preview e exigiu confirmação posterior.
- A submissão editorial falhou com rollback. A reprodução REST retornou
  `internal_error`, correlação `db29bfa3-8c16-423a-84f4-75c7898670a0`.
- O log PostgreSQL registrou: `column "approval_request_id" is of type uuid but
  expression is of type text`.
- Causa localizada: o `select` de `notifyReviewers` fixa o parâmetro da
  solicitação como `text` por causa da concatenação do `event_key`, mas reutiliza
  o mesmo parâmetro sem `::uuid` na coluna `approval_request_id`. O `values` de
  `notifyRequester` possui o mesmo risco.
- A validação de breakpoint mobile em produção não foi aceita como evidência:
  o controle de viewport do navegador permaneceu em 1920 px. O contrato local
  mobile 2/2 continua válido, mas o gate manual mobile deverá ser repetido.
- Hotfix preparado: casts `::uuid` adicionados às duas projeções de notificação;
  regressão RED/GREEN, 52/52 testes dirigidos, typecheck, build e compilação das
  instruções no PostgreSQL remoto aprovados. É necessário redeploy do Marketing
  Ops antes de retomar este checklist.

## Retomada após hotfix — 2026-08-06

- Commit implantado: `acb5bae` (`fix(phase-5): cast approval notification request ids`).
- Compose reportou 6/6 recursos atualizados; `artifact-server` e `rag-mcp`
  ficaram healthy e o `marketing-ops` iniciou normalmente na porta `8091`.
- Readiness confirmado pelo log do serviço com HTTP `200`, correlação
  `a07207f0-365c-48b6-84ae-d7807a920ef9`.
- Homologação manual retomada nos perfis member, manager e admin, com correlação
  pelo dashboard do Hermes.

## Resultado da retomada — 2026-08-06

### Casos aprovados

- O member submeteu pelo Hermes a solicitação editorial
  `d51d3f4d-0d2f-4f7a-bd3a-eebc51bc5779`; a confirmação curta `confirmo` foi
  classificada deterministicamente como `approve` e o plano foi executado uma
  única vez. O dashboard registrou a conclusão do
  `marketing_ops_execute_plan_v1` às `14:41:27Z`.
- O detalhe mostrou a fixture exata: campanha
  `143d7eb3-6167-40a3-b433-2a40e7df3708`, asset
  `04fb4c68-2bf2-4e65-a4e4-81ea75ae832a`, versão congelada `2` e hash
  `5f887fc0958cc15c90b571ab831bbf1ad133979edd0088cba0bf50cb1586b943`.
- Fila, filtros por status/tipo/risco/campanha, sincronização de URL, deep link,
  preview congelado e histórico foram verificados no navegador.
- Os diálogos de `Solicitar ajustes` e `Rejeitar` mantêm a confirmação
  desabilitada sem comentário; o diálogo de `Aprovar` aceita comentário
  opcional e explicita decisão única, auditável e sem efeito externo.
- O member cancelou a própria solicitação. A UI passou a `cancelled`; o banco
  confirmou versão `2`, uma decisão `cancelled`, duas auditorias, dois eventos
  e a notificação `approval-status:...:cancelled` para o solicitante.

### Bloqueadores encontrados

1. **F5-PROD-01 — cache de resposta autenticada entre contas (alto).** O mesmo
   deep link aberto primeiro pelo member continuou mostrando a capability
   `Cancelar solicitação` após logout/login como manager e admin, inclusive
   após reload. Uma requisição REST nova com o token do admin devolveu
   corretamente `decide=true` e `cancel=false`. O serviço não define
   `Cache-Control: private, no-store` nas respostas autenticadas e o middleware
   só varia por `Origin`; a correção deve cobrir serviço, proxy/CDN e política
   de cache do cliente, com regressão de troca de identidade.
2. **F5-PROD-02 — decisão humana faz rollback por RLS de notificação (alto).** A
   primeira visualização, exclusiva do admin, da solicitação
   `ffa5209e-2a9a-4134-96b9-2709b72743e7` mostrou corretamente os três botões
   de decisão. `Aprovar` retornou `500`; reprodução REST válida com `If-Match:
   "1"` confirmou HTTP `500`, corpo vazio e correlação
   `e41eba94-e23d-4efe-883a-1e826d8397ca`. Os logs PostgreSQL registraram três
   ocorrências de `new row violates row-level security policy for table
   "in_app_notifications"`. A transação foi revertida: solicitação ainda
   `pending`, versão `1`, zero decisões, uma auditoria e um evento de criação.
3. **F5-PROD-03 — erro de mutação mascarado como conflito (médio).** O frontend
   apresenta qualquer falha da decisão como `Conflito ao atualizar a
   aprovação`, embora o backend tenha retornado `500`. A UI deve diferenciar
   conflito `409`, indisponibilidade/erro interno e falhas de autorização,
   preservando o correlation ID para suporte.
4. **F5-PROD-04 — confirmação conversacional verbosa (baixo).** Uma confirmação
   longa foi classificada como `clarify`, e o Hermes tentou executar novamente
   no mesmo turno, recebendo repetidamente a barreira de confirmação posterior.
   A confirmação curta `confirmo` concluiu o fluxo; convém impedir retry no
   mesmo turno e melhorar a mensagem de recuperação.

### Casos não promovidos

Decisão por manager/admin, rejeição/ajustes persistidos, novo ciclo,
operacional com segregação de funções, expiração, retry/idempotência terminal,
restart/persistência terminal e aceite mobile permanecem sem aprovação manual.
O controle de viewport não alterou visualmente o Chrome e, portanto, não foi
aceito como evidência mobile. Cross-tenant manual também depende de uma segunda
credencial de tenant. A Fase 5 permanece aberta até correção, novo deploy e
reexecução integral desses casos.

## Correções prontas para o segundo deploy — 2026-08-06

- F5-PROD-01: headers privados/no-store no serviço e cache React Query isolado
  por identidade;
- F5-PROD-02: inserts de notificação de aprovação sem `ON CONFLICT`, preservando
  a policy privada de leitura; migration aditiva `5.0.5` aplicada;
- F5-PROD-03: UI diferencia `409`, `403` e `5xx` e exibe correlation ID;
- F5-PROD-04: confirmação explícita do plano exato aceita contexto verboso e
  turnos `clarify/reject/revise` proíbem retry de execute-plan;
- probe remoto do statement parametrizado corrigido passou com rollback;
- regressões: frontend 214/214, Bridge 90/90, Hermes 32 passed/2 skipped,
  hotfix Marketing Ops 15/15, typechecks e builds aprovados.

Esses itens ainda não contam como aceite de produção. Todos os checkboxes
pendentes devem ser repetidos no navegador após o novo deploy.
