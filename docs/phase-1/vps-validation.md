# Validação VPS da Fase 1

- **Estado:** `pending_user_deploy`
- **Ambiente alvo:** Ubuntu Linux, Docker Engine/Compose e Traefik
- **Supabase:** app separado; RAG fora do escopo

## Pré-condições

- [ ] branch/commit final disponível no remoto;
- [x] migrations do Supabase do app aplicadas e verificadas;
- [ ] `.env` raiz contém URLs/chaves do app e segredos fortes do Marketing Ops;
- [ ] flags de frontend permanecem desligadas;
- [x] backup pré-deploy está preservado fora do repositório.

## Deploy

```bash
cd /opt/projeto-ens-unificado
git pull --ff-only
git rev-parse --short HEAD
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build marketing-ops app-bridge hermes-api hermes-kanban app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d marketing-ops hermes-api hermes-kanban app-bridge app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
```

## Gate Ubuntu

- [ ] `marketing-ops` fica `healthy` após build Linux;
- [ ] `curl -fsS http://127.0.0.1:8091/health` retorna `ok`;
- [ ] `curl -fsS http://127.0.0.1:8091/ready` retorna `ready`;
- [ ] `https://ops.solucoes-nexus.tech/health` responde via Traefik;
- [ ] chamada REST autenticada lista/cria draft com tenant ENS;
- [ ] replay da mesma idempotency key não duplica campanha/outbox;
- [ ] update com versão obsoleta retorna 409;
- [ ] Hermes lista o mesmo draft via MCP;
- [ ] member/manager/admin cumprem a matriz e tenant forjado falha;
- [ ] `/metrics` rejeita acesso sem chave e responde internamente com chave;
- [ ] restart apenas do `marketing-ops` preserva o registro;
- [ ] logs não contêm bearer, delegação ou segredo;
- [ ] procedimento de rollback pode ser executado sem remover schema/dados.

## Fechamento

Anexar saída sanitizada de commit, `docker compose ps`, probes, REST/MCP/RBAC/restart e rollback. Só então alterar este documento, o PRD e o roadmap para `production_validated`/`completed`.
