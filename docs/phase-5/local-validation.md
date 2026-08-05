# Validação local — Fase 5

- **Estado:** `passed_with_documented_environment_substitution`
- **Responsável:** assistente
- **Snapshot:** 2026-08-05 17:07 BRT

## Banco e contratos

- [x] migrations aditivas e sem `DROP`;
- [x] migrations aplicadas no Supabase remoto do app;
- [x] sete migrations remotas, incluindo barreira de escrita, ledger terminal, performance da fila, worker de expiração e advisor follow-up;
- [x] `supabase migration list --linked` sem drift: 23/23 versions locais e remotos alinhados;
- [x] smoke remoto de hardening com rollback;
- [x] imutabilidade de versão/payload/decisão;
- [x] segregação de papel, autoaprovação e cross-tenant;
- [x] idempotência e decisão única;
- [x] catálogo remoto e smoke SQL transacional com rollback;
- [x] advisors após DDL e forward-fix dos índices de FK;
- [ ] pgTAP executável — bloqueado porque a extensão pgTAP não está instalada no
  remoto e não há Docker/Postgres local; testes estão versionados e os mesmos
  invariantes foram aprovados no smoke remoto equivalente.

## Marketing Ops

- [x] testes dirigidos após revisão — 8 arquivos / 52 testes;
- [x] contratos de migration — 8/8 no total, 7/7 específicos da Fase 5;
- [x] máquinas de estado, expiração e alvo congelado;
- [x] hashes canônicos e payload estrito;
- [x] idempotência/replay e guarda de decisão concorrente;
- [x] RBAC de member/manager/admin;
- [x] REST/OpenAPI, SDK, capabilities e MCP;
- [x] métrica de transição com cardinalidade limitada;
- [x] typecheck;
- [x] build;
- [x] performance real remota: fila RLS com 10.000 linhas, 20 amostras e p95 de 16,01 ms (limite 500 ms; baseline 2,15 s);
- [x] expiração remota: origem `system`, audit `service`, evento/notificação e limpeza 0;

## Frontend

- [x] SDK/query keys e feature flag;
- [x] fila, filtros, paginação e deep links;
- [x] detalhe e preview do alvo congelado;
- [x] comentários obrigatórios para rejeição/ajustes;
- [x] estados de carregamento, vazio e falha;
- [x] testes dirigidos — 6 arquivos / 20 testes;
- [x] contrato local de UI desktop/mobile no Chromium com backend controlado — 2/2;
- [x] axe sem violação crítica no fluxo E2E;
- [x] sem overflow horizontal mobile;
- [x] typecheck e build;
- [x] ESLint dos arquivos alterados — zero issue;
- [x] ESLint global — zero erros; `.design_library` vendorizada excluída do lint;

## Hermes, segurança e operação

- [x] Hermes pode preparar/submeter, mas não decidir;
- [x] delegação contém `approval:submit` e nenhuma permissão de decisão;
- [x] contratos/executor/deep links do Hermes aprovados;
- [x] Bridge/delegação — 89/89;
- [x] superfície de aprovação sem provider/worker/executor de ação externa;
- [x] logs redigem `comment`, `reason`, payloads e segredos;
- [x] métricas protegidas e labels allowlisted;
- [x] advisors Supabase executados;
- [x] regressão final frontend — 59 arquivos / 212 testes;
- [x] regressão final Bridge — 89/89;
- [x] serviço dirigido + foundation — 10 arquivos / 52 testes;
- [x] security gate completo com RLS app/RAG, lint, build e audit high;
- [x] audit do `marketing-ops` — zero vulnerabilidades;
- [x] frontend — zero high; 2 moderadas aceitas no React Router client-only;
- [ ] Compose/health/restart/persistência — gate da VPS após deploy.

## Comandos principais aprovados

```text
services/marketing-ops: vitest Phase 5 + foundation              52/52
services/marketing-ops: npm run typecheck                        OK
services/marketing-ops: npm run build                            OK
services/marketing-ops: npm run test:approvals-performance        p95 16,01 ms / 10k
services/marketing-ops: npm run test:approvals-expiry-worker      OK / cleanup 0
apps/chat-web: npm test                                           212/212
apps/chat-web: npm run typecheck                                 OK
apps/chat-web: npm run build                                     OK
apps/chat-web: eslint dos arquivos alterados                     OK
apps/chat-web: Playwright phase-5-approvals                      2/2
services/chat-bridge: npm test                                    89/89
apps/chat-web: npm run security:gate                              OK
```

## Parecer atual

Tasks 1–8 e o deploy do Supabase estão concluídos. A suíte ampla do serviço que
depende do Postgres local não pôde executar porque `127.0.0.1:55322` não está
disponível; não houve falha funcional diferente dessa conexão. O gate de banco
foi executado no Supabase remoto autorizado com transação/rollback. A
homologação real continua separada em `vps-validation.md`.
