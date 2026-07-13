# Validação VPS da Fase 1

- **Estado:** `validation_in_progress`
- **Ambiente alvo:** Ubuntu Linux, Docker Engine/Compose e Traefik
- **Supabase:** app separado; RAG fora do escopo

## Pré-condições

- [x] branch/commit final disponível no remoto;
- [x] migrations do Supabase do app aplicadas e verificadas;
- [x] `.env` raiz contém URLs/chaves do app e segredos fortes do Marketing Ops;
- [ ] flags de frontend permanecem desligadas;
- [x] backup pré-deploy está preservado fora do repositório.

## Deploy

```bash
cd /opt/nexus-ens
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
- a primeira correção foi publicada no commit `424061b`: o Marketing Ops passou a solicitar uma única renovação interna ao Bridge, limitada à run pai ativa, ao contexto idêntico e ao mesmo `jti`;
- após o deploy de `424061b`, o passo 13 passou em uma nova sessão, mas o passo 14 falhou na rodada seguinte com `delegation_invalid`;
- os containers estavam saudáveis, a rota interna existia, as duas chaves estavam configuradas e uma sonda com token deliberadamente inválido retornou o 401 esperado `delegation_refresh_denied`;
- uma consulta somente leitura ao `state.db` encontrou blocos `[MARKETING_OPS_DELEGATION]` em quatro sessões, com contagens 1, 2, 1 e 9. Nenhum token foi exibido;
- causa raiz final: a Bridge enviava a delegação dentro da mensagem do usuário para a Session API, que a persistia. Em uma rodada posterior, o modelo podia reutilizar um token ligado a uma run já terminal, cuja renovação era corretamente negada;
- correção local: a delegação atual segue em `system_message` efêmero e nunca entra em `message`; no startup, o `hermes-api` remove de modo idempotente somente os blocos técnicos legados e preserva o conteúdo conversacional;
- regressões locais: Marketing Ops 38 testes + 2 E2E, Bridge 66, Hermes 5, RAG 26, Graph 18, Artifact 8, frontend 125, 97 pgTAP, typechecks/builds/audits, Compose base/produção e imagens Linux aprovados.
- o commit `fa04953` foi publicado em `main` e implantado na VPS; `hermes-api`, `app-bridge` e `marketing-ops` permaneceram saudáveis;
- no primeiro startup corrigido, o scrub removeu 13 mensagens com delegações legadas;
- o passo 13 listou em nova sessão a campanha `2da6ee84-5783-4556-a47d-8d7beff06d16`, nome `Teste Fase 1 Produção Atualizado`, versão 2;
- o passo 14 consultou os detalhes da mesma campanha na rodada seguinte, sem `delegation_invalid`;
- a consulta sanitizada posterior ao SessionDB retornou `persisted_delegation_messages: 0`, comprovando que a delegação atual não voltou ao histórico.

Os passos 13 e 14 estão aprovados. Restam os testes manuais 15–20 para item, auditoria, concorrência, idempotência, matriz de permissões e isolamento de tenant. As falhas anteriores não criaram, alteraram ou removeram registros de domínio, e a correção não exigiu `.env`, migration, bootstrap ou deploy Supabase.

## Fechamento

Anexar saída sanitizada de commit, `docker compose ps`, probes, REST/MCP/RBAC/restart e rollback. Só então alterar este documento, o PRD e o roadmap para `production_validated`/`completed`.
