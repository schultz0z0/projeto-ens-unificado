# Validação local — Fase 5

- **Estado:** `not_started`
- **Responsável:** assistente
- **Snapshot:** 2026-08-05

Este documento receberá somente evidências executadas. O desenho aprovado e a
existência de testes planejados não contam como validação.

## Banco

- [ ] reset limpo do Supabase local;
- [ ] migration da Fase 5 aplicada em banco vazio e upgrade;
- [ ] pgTAP de tipos, constraints, funções, grants e RLS;
- [ ] imutabilidade de versão/payload/decisão;
- [ ] segregação e cross-tenant;
- [ ] lint e schema diff;
- [ ] rollback/forward-fix documentado.

## Marketing Ops

- [ ] testes unitários e integração;
- [ ] máquinas de estado e expiração com relógio controlado;
- [ ] hashes canônicos;
- [ ] idempotência e replay;
- [ ] duas decisões concorrentes;
- [ ] RBAC dos três papéis;
- [ ] REST/OpenAPI e MCP;
- [ ] typecheck e build.

## Frontend

- [ ] SDK/query keys;
- [ ] fila, filtros, paginação e URL;
- [ ] detalhe e preview;
- [ ] comentários obrigatórios;
- [ ] estados 403/404/409/expirado;
- [ ] desktop/mobile;
- [ ] teclado e axe;
- [ ] lint, typecheck, testes e build.

## Segurança e operação

- [ ] mass assignment, XSS, tenant/papel forjados e replay;
- [ ] Hermes sem tool/action de decisão;
- [ ] nenhum endpoint chama provider/worker;
- [ ] logs sem secrets, payload ou conteúdo integral indevido;
- [ ] métricas protegidas e labels allowlisted;
- [ ] Compose, health/readiness, restart e persistência;
- [ ] security gate;
- [ ] documentação e links coerentes.

## Parecer

Pendente. A fase não pode mudar para `ready_for_production` até todos os itens
aplicáveis possuírem resultado e evidência.
