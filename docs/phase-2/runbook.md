# Runbook da Fase 2

- **Estado:** `prepared_through_task_8_not_executed_in_vps`
- **Ambiente local atual:** Windows + PowerShell + Node; sem Docker Desktop, WSL ou Podman
- **Produção:** Ubuntu Linux + Docker Engine/Compose + Traefik
- **Checkout VPS canônico conhecido da Fase 1:** `/opt/nexus-ens`; confirmar o path real antes do deploy

## Responsabilidades

| Ação | Responsável |
|---|---|
| Implementar, testar nativamente, revisar e documentar | agente |
| Criar commits locais em `main` | agente |
| Executar `git push` | usuário |
| Aplicar migrations no Supabase do app após gates/backup/dry-run | agente autorizado |
| Executar deploy na VPS | usuário |
| Inspecionar logs, conduzir smokes e atualizar evidência após deploy | agente com comandos executados pelo usuário |

## Fronteiras de ambiente

- `.env` da raiz é a fonte global e nunca entra em logs/documentos;
- Marketing Ops usa `NEXUS_APP_SUPABASE_*` e `NEXUS_SUPABASE_DATABASE_URL` do app;
- RAG usa exclusivamente `NEXUS_RAG_SUPABASE_*`; Marketing Ops acessa apenas `NEXUS_MARKETING_OPS_RAG_URL` por MCP read-only;
- Artifact Server usa chave interna e volume próprio; access links são efêmeros;
- flags de backend e frontend permanecem `false` até rollout controlado;
- valores `CHANGE_ME_*` são inválidos para produção.

## Gate nativo no Windows

Não executar `npm test` sem filtro no Marketing Ops como prova local: há suítes que exigem PostgreSQL em `127.0.0.1:55322`. Usar arquivos explicitamente sem banco e registrar a lista na evidência da task.

```powershell
Set-Location services/marketing-ops
npx vitest run src/domain/contracts.test.ts src/domain/queries.test.ts src/domain/participants.test.ts src/domain/materials.test.ts src/domain/campaignReferences.test.ts src/domain/timeline.test.ts src/integrations/artifactClient.test.ts src/integrations/ragCourseClient.test.ts src/http/routes/references.test.ts
npm run typecheck
npm run build

Set-Location ../artifact-server
npm test

Set-Location ../rag-mcp
npm test
npm run typecheck

Set-Location ../../apps/chat-web
npm test -- src/lib/marketingOps
npm run typecheck
npm run lint
npm run build
npm run security:gate
```

A lista cresce conforme Tasks 8–14. Toda falha deve ser investigada; testes que tentarem abrir banco são separados e marcados `deferred_to_vps`, não ignorados como se tivessem passado.

## Gate diferido de banco e Linux

Executar somente depois do fechamento interno, com fixtures identificadas e cleanup:

- reset/upgrade e migration da Fase 2;
- 228 asserts pgTAP atuais, acrescidos de qualquer teste criado nas Tasks 9–14;
- RLS nos três papéis, membership inativa e cross-tenant;
- harness concorrente campanha/participante/item e abuso de lock;
- cenários PostgreSQL das Tasks 4–7;
- build das imagens Linux e `docker compose config`;
- integrações Marketing Ops → Artifact/RAG;
- restart e persistência de banco, metadata e bytes.

O script dedicado `scripts/test/phase-2-vps.sh` será criado na Task 14. Até ele existir e ser revisado, não apontar suítes genéricas com seed local para produção.

## Deploy Supabase do app

Seguir [supabase-deployment.md](supabase-deployment.md). A ordem obrigatória é identificação inequívoca do projeto do app, backup externo com hash, listagem remota, dry-run revisado, push e validação pós-deploy. Nenhuma etapa usa o projeto do RAG.

## Publicação Git

O agente não executa push. Após o commit final e o gate nativo fresco, o usuário publica:

```powershell
git status --short --branch
git log -1 --oneline
git push origin main
```

## Deploy VPS

Os comandos abaixo assumem o path já usado na Fase 1. Se o checkout real diferir, alterar apenas a primeira linha depois de confirmar o repositório.

```bash
cd /opt/nexus-ens
git fetch origin
git checkout main
git pull --ff-only origin main
git rev-parse --short HEAD
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build marketing-ops artifact-server rag-mcp app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d artifact-server rag-mcp marketing-ops app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:8095/health
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:8091/health
curl -fsS http://127.0.0.1:8091/ready
```

Depois, seguir integralmente [vps-validation.md](vps-validation.md), incluindo logs, papéis, conflito, Artifact/RAG, restart, persistência, cleanup e rollback verificável.

## Rollout

1. manter backend read/write e frontend desligados durante migration/build;
2. ativar backend read apenas para usuários de teste;
3. validar lista/detalhe, RAG e isolamento;
4. ativar backend write e validar mutações/idempotência;
5. reconstruir frontend com enabled/read para piloto;
6. habilitar frontend write somente após smokes por papel;
7. usar uma ou duas campanhas reais controladas;
8. ampliar somente sem bloqueador alto/crítico.

## Diagnóstico

- `/health`: processo vivo;
- `/ready`: banco e dependências obrigatórias prontas conforme contrato final;
- `401`: bearer/delegação ausente, inválida ou expirada;
- `403`: tenant, membership, papel, scope ou ownership negado;
- `409`: versão, idempotência ou replay em conflito;
- `422`: requisito de domínio/transição inválido;
- `503`: feature ou dependência indisponível.

Em incidente, preservar correlation IDs e saídas sanitizadas e seguir [rollback.md](rollback.md).
