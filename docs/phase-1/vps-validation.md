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
- a consulta sanitizada posterior ao SessionDB retornou `persisted_delegation_messages: 0`, mas verificava apenas `messages.content` e não cobria `messages.tool_calls`;
- no passo 15, a criação do item não ocorreu: o Hermes recuperou de uma tool call anterior uma delegação já expirada e recebeu `delegation_invalid`;
- causa raiz complementar: o transporte por `system_message` já era efêmero, porém o próprio SessionDB persistia os argumentos gerados pelo modelo na coluna `tool_calls` e os reapresentava em rodadas futuras;
- correção local: imediatamente antes de toda execução de tool Marketing Ops, o runtime substitui o valor escolhido pelo modelo pela delegação efêmera do turno; valores de delegação são redigidos antes de persistência, snapshot e replay;
- o scrub de startup agora cobre tanto blocos em `content` quanto valores aninhados em `tool_calls`, sem imprimir tokens e de forma idempotente;
- os equivalentes aos passos 15–20 passaram via MCP contra o Supabase local real; a regressão completa aprovou Marketing Ops 42 + 2 E2E, Bridge 66, Hermes 10, RAG 26, Graph 18, Artifact 8, frontend 125 e 97 pgTAP;
- imagens Linux de Bridge e Hermes foram reconstruídas sem cache; dentro da imagem, os gates confirmaram binding do token atual, ausência de token bruto na persistência/replay e scrub legado.
- após o redeploy dessa correção, o passo 15 criou o item `35bcfb4f-ff73-47ff-b6b4-6477e907fb11` na campanha de teste;
- o passo 16 retornou os três eventos esperados de criação da campanha, atualização e criação do item para o usuário `admin`;
- o passo 17 recusou `expected_version=1` com `version_conflict`/409 e uma nova leitura confirmou nome e versão inalterados;
- o passo 18 repetiu a chave `teste-idempotencia-fase1-producao`, devolveu a mesma campanha `bd6aacc8-5602-4ad1-9a7f-bf90e9bc8bc4` e a listagem confirmou ausência de duplicata;
- no passo 19, um usuário `member` criou e listou a própria campanha, enquanto a auditoria ampla foi corretamente recusada com 403. A primeira pergunta indevida por `course_slug` expôs uma inconsistência conversacional, embora a operação tenha funcionado após o usuário pedir vínculo nulo.

Os testes de domínio 13–19 acima comprovaram a fundação, mas o pedido técnico de `course_slug` mostrou que o comportamento ainda não era adequado para usuários reais. O hardening posterior transforma toda mutação do Hermes em um plano conversacional com confirmação única e está aprovado apenas localmente. O teste de tenant forjado possui cobertura automatizada local, mas o aceite final de produção será repetido junto com o fluxo conversacional. A correção não exige `.env`, migration, bootstrap ou deploy Supabase.

## Hardening pendente de deploy

- [ ] commit de confirmação conversacional presente na VPS;
- [ ] imagens `marketing-ops`, `app-bridge` e `hermes-api` reconstruídas sem cache;
- [ ] build do `hermes-api` instala `dom-to-pptx` sem baixar Chromium redundante e não mascara falha do `npm ci`;
- [ ] pedido casual com campanha e item apresenta um único plano e informa que nada foi salvo;
- [ ] consulta antes da confirmação comprova ausência dos objetos;
- [ ] confirmação em nova mensagem executa exatamente as duas ações;
- [ ] retry não duplica campanha, item, auditoria ou outbox;
- [ ] `sim, mas altere...` prepara novo plano sem executar o anterior;
- [ ] `member` não é questionado sobre `course_slug` e continua sem acesso à auditoria ampla;
- [ ] tentativa de outro tenant permanece negada/vinculada ao tenant autenticado;
- [ ] logs não contêm segredo, token bruto, `internal_error` ou falso sucesso.

## Fechamento

Anexar saída sanitizada de commit, `docker compose ps`, probes, REST/MCP/RBAC/restart e rollback. Só então alterar este documento, o PRD e o roadmap para `production_validated`/`completed`.
