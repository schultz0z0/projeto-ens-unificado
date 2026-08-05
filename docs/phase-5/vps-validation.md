# Validação VPS e navegador — Fase 5

- **Estado:** `ready_for_deploy`
- **Deploy:** responsabilidade do usuário/responsável autorizado
- **Homologação manual final:** assistente, após o deploy

## Pré-condições

- [ ] commit implantado identificado;
- [x] gate local completo;
- [x] migrations remotas e invariantes registrados;
- [ ] serviços healthy;
- [ ] usuários/tenant e fixtures de homologação identificados;
- [ ] nenhum provedor real configurado para execução.

## Infraestrutura

- [ ] Compose efetivo e imagens corretas;
- [ ] health/readiness;
- [ ] rede, TLS, CORS e envs;
- [ ] Supabase do app com migration e RLS;
- [ ] logs/correlation ID;
- [ ] restart e persistência;
- [ ] backup e rollback verificáveis.

## Homologação manual pelo navegador

O assistente executará:

- [ ] member cria solicitação editorial;
- [ ] preview mostra campanha, asset, versão e hash corretos;
- [ ] manager/admin elegível aprova;
- [ ] rejeição e ajuste exigem comentário;
- [ ] novo ciclo preserva histórico;
- [ ] fila filtra por tipo/status/campanha/risco/vencimento;
- [ ] solicitante operacional recebe bloqueio de autoaprovação;
- [ ] segundo aprovador autoriza o mesmo pacote congelado;
- [ ] expiração impede decisão/liberação;
- [ ] usuário sem acesso e cross-tenant recebem negação segura;
- [ ] Hermes prepara/submete após confirmação e não oferece decisão;
- [ ] modal técnico do Hermes continua independente;
- [ ] desktop, mobile, teclado e acessibilidade;
- [ ] deep links e notificações in-app;
- [ ] nenhuma execução externa é produzida.

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
