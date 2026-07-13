# Validação VPS da Fase 1

- **Estado:** `validation_in_progress`
- **Ambiente alvo:** Ubuntu Linux, Docker Engine/Compose e Traefik
- **Supabase:** app separado; RAG fora do escopo

## Pré-condições

- [ ] branch/commit final disponível no remoto;
- [x] migrations do Supabase do app aplicadas e verificadas;
- [x] `.env` raiz contém URLs/chaves do app e segredos fortes do Marketing Ops;
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

- [x] `marketing-ops` fica `healthy` após build Linux;
- [x] `curl -fsS http://127.0.0.1:8091/health` retorna `ok`;
- [x] `curl -fsS http://127.0.0.1:8091/ready` retorna `ready`;
- [x] `https://ops.solucoes-nexus.tech/health` responde via Traefik;
- [ ] chamada REST autenticada lista/cria draft com tenant ENS;
- [ ] replay da mesma idempotency key não duplica campanha/outbox;
- [ ] update com versão obsoleta retorna 409;
- [x] Hermes lista o mesmo draft via MCP;
- [ ] member/manager/admin cumprem a matriz e tenant forjado falha;
- [ ] `/metrics` rejeita acesso sem chave e responde internamente com chave;
- [x] restart apenas do `marketing-ops` preserva o registro;
- [ ] logs não contêm bearer, delegação ou segredo;
- [ ] procedimento de rollback pode ser executado sem remover schema/dados.

## Evidência de 13 de julho de 2026

- Compose de produção validado e containers `marketing-ops`, `hermes-api`, `app-bridge` e `app-frontend` saudáveis;
- probes internas e públicas responderam `ok`/`ready`; capabilities publicou contrato v1 com leitura e escrita ativas; rota de domínio sem autenticação respondeu 401;
- Hermes criou a campanha `2da6ee84-5783-4556-a47d-8d7beff06d16`, listou o mesmo registro, atualizou o nome e confirmou a versão de 1 para 2;
- consulta somente leitura no Supabase do app confirmou tenant `ens`, status `draft`, versão 2, auditorias `campaign.created`/`campaign.updated` e os dois eventos correspondentes no outbox;
- após restart, a campanha permaneceu no banco. A primeira consulta de uma nova sessão falhou porque o JWT de 90 segundos expirou durante o raciocínio do Hermes;
- causa raiz: o token era emitido no início da rodada, sem renovação no momento da tool. A correção mantém o TTL curto e permite um retry interno apenas enquanto a run pai estiver ativa, com contexto idêntico e o mesmo `jti`;
- regressões locais da correção: Marketing Ops 38 testes, typecheck/build; Bridge 65 testes; Compose base/produção válido.

O reteste da consulta após restart permanece obrigatório depois do deploy da correção. A falha não criou, alterou ou removeu registros.

## Fechamento

Anexar saída sanitizada de commit, `docker compose ps`, probes, REST/MCP/RBAC/restart e rollback. Só então alterar este documento, o PRD e o roadmap para `production_validated`/`completed`.
