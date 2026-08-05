# Validação VPS e navegador — Fase 5

- **Estado:** `hotfix_ready_for_redeploy`
- **Deploy:** responsabilidade do usuário/responsável autorizado
- **Homologação manual final:** assistente, após o deploy

## Pré-condições

- [ ] commit implantado identificado;
- [x] gate local completo;
- [x] migrations remotas e invariantes registrados;
- [x] serviços web e Hermes acessíveis;
- [x] usuários/tenant e fixtures de homologação identificados;
- [x] tentativa confirmou ausência de envio/publicação e rollback integral;

## Infraestrutura

- [ ] Compose efetivo e imagens corretas;
- [ ] health/readiness;
- [ ] rede, TLS, CORS e envs;
- [ ] Supabase do app com migration e RLS;
- [x] logs/correlation ID;
- [ ] restart e persistência;
- [ ] backup e rollback verificáveis.

## Homologação manual pelo navegador

O assistente executará:

- [ ] **BLOQUEADO:** member cria solicitação editorial — Hermes e REST retornam `500`;
- [ ] preview mostra campanha, asset, versão e hash corretos;
- [ ] manager/admin elegível aprova;
- [ ] rejeição e ajuste exigem comentário;
- [ ] novo ciclo preserva histórico;
- [x] controles de filtro por tipo/status/campanha/risco/vencimento carregam; filtros manager sincronizam com a URL;
- [ ] solicitante operacional recebe bloqueio de autoaprovação;
- [ ] segundo aprovador autoriza o mesmo pacote congelado;
- [ ] expiração impede decisão/liberação;
- [ ] usuário sem acesso e cross-tenant recebem negação segura;
- [ ] **PARCIAL:** Hermes prepara após confirmação e não oferece decisão, mas a submissão falha no serviço;
- [ ] modal técnico do Hermes continua independente;
- [ ] desktop, mobile, teclado e acessibilidade;
- [ ] **PARCIAL:** deep link inexistente recebe negação segura; deep link/notificação real dependem da submissão;
- [x] nenhuma execução externa é produzida pela tentativa;

## Conferência de evidência

- [ ] Supabase confirma versão/payload/hash;
- [ ] exatamente uma decisão efetiva;
- [ ] auditoria/outbox/notificações correlacionadas;
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
