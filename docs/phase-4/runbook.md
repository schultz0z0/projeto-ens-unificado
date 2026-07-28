# Runbook — Fase 4

- **Estado:** `ready_for_execution`
- **Implementação:** `completed_pending_vps_gate`
- **Objetivo:** executar deploy e operação controlada do operador Hermes sobre o `marketing-ops`

## Escopo operacional

Este runbook cobre a parte operacional da Fase 4:

- configuração MCP do `marketing-ops` no runtime Hermes;
- secrets e refresh de delegação;
- validação de rede interna e health;
- smoke da jornada conversacional em ambiente real;
- migration aditiva de correlação;
- build das imagens afetadas;
- testes manuais de RAG, Graph, calendário, conteúdo e tom ENS;
- rollback de configuração.

## Pré-deploy

Antes do deploy da fase:

- revisar o catálogo final de tools e actions;
- confirmar URLs internas do MCP e da Bridge;
- validar rotação e presença apenas dos secrets necessários;
- confirmar que o runtime Hermes continua bloqueando mutações diretas;
- revisar o plano de rollback;
- executar backup do Supabase e checagem da migration remota já aplicada;
- confirmar que `git status` e o commit implantado correspondem à evidência.

## Conferência segura da configuração da VPS

No diretório do checkout da VPS, valide a presença e o formato das variáveis
sem imprimir secrets. As flags `VITE_*` são resolvidas durante o build do
frontend, portanto uma alteração nelas exige rebuild de `app-frontend`.

```bash
cd /opt/nexus-ens
chmod 600 .env
grep -q '^NEXUS_PUBLIC_MARKETING_OPS_URL=https://.\+' .env
grep -q '^NEXUS_MARKETING_OPS_FEATURE_READ=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FEATURE_WRITE=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FRONTEND_ENABLED=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FRONTEND_READ=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FRONTEND_WRITE=true$' .env
grep -q '^NEXUS_MARKETING_OPS_FRONTEND_KILL_SWITCH=false$' .env
```

Também confirme, sem exibir valores, os segredos de delegação e as URLs
internas esperadas pelo `marketing-ops`, Bridge, Hermes e Artifact Server.
Pare o deploy se qualquer comando acima falhar.

## Comandos de deploy da Fase 4

Use sempre os dois arquivos Compose do monorepo em produção. A reconstrução sem
cache atualiza as flags públicas embutidas no frontend e a skill copiada para a
imagem Hermes; a recriação é limitada aos cinco serviços afetados.

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache app-frontend app-bridge marketing-ops hermes-api hermes-kanban
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate app-frontend app-bridge marketing-ops hermes-api hermes-kanban
```

Não use `docker compose down`, nem `--remove-orphans`, neste deploy: a Fase 4
não requer remover serviços fora do conjunto listado.

### Rebuild pontual do classificador contextual

Para o endurecimento da confirmação contextual de 28/07/2026, reconstrua os
dois serviços envolvidos: `hermes-api` executa o classificador com prompt
exclusivo, sem tools ou persistência, e a Bridge usa somente a decisão fechada
para assinar a delegação.

```bash
cd /opt/nexus-ens
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache hermes-api app-bridge
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate hermes-api app-bridge
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps hermes-api app-bridge
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=5m --tail=200 hermes-api app-bridge
curl -fsS http://127.0.0.1:8652/health
curl -fsS http://127.0.0.1:8081/health
```

Não recrie `hermes-kanban`, frontend ou Marketing Ops para essa alteração. A
correção não altera MCP, schema, migration ou configuração; usa a chave Hermes
que a Bridge já possui.

Depois do rebuild, em conversas novas, valide que `vamos nessa` e `pode ser`
executam somente o plano pendente exato; pergunta (`pode ser?`), negação,
ressalva e alteração não executam. Uma alteração deve gerar novo preview.
Se houver recusa, consulte `hermes-api` por
`Marketing Ops confirmation classified`: o log contém somente `decision` e
`output_contract`, suficientes para separar falha de classificação de uma
falha posterior de propagação, sem revelar a mensagem, tokens ou delegação.

### Rebuild pontual do Marketing Ops

Para o sexto hotfix de 28/07/2026, que normaliza o envelope `actions.item` do
MiniMax antes da validação estrita do plano, reconstrua apenas o serviço MCP:

```bash
cd /opt/nexus-ens
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache marketing-ops
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate marketing-ops
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps marketing-ops
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=5m --tail=200 marketing-ops
curl -fsS http://127.0.0.1:8091/ready
```

Não recrie Bridge ou Hermes nesse caso: o contrato conversacional e a skill já
foram publicados; a mudança é limitada ao handler MCP do `marketing-ops`.

### Nono release candidato: compatibilidade, agenda e skill estruturada

O release atual deve ser publicado como uma unidade de três serviços:

- `marketing-ops`: aceita a serialização real do provedor para action única
  (array nativo, `{ item: ... }`, objeto tipado direto ou JSON desses formatos)
  antes da mesma validação estrita;
- `app-bridge`: instrui o Hermes a usar `from` e `to` como instantes ISO 8601
  completos com offset para a agenda;
- `hermes-api`: contém a skill `marketing-ops-operator` com referências e
  template carregáveis.

```bash
cd /opt/nexus-ens
set -euo pipefail
git pull --ff-only origin main
git rev-parse --short HEAD
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache marketing-ops app-bridge hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate marketing-ops app-bridge hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps marketing-ops app-bridge hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=5m --tail=250 marketing-ops app-bridge hermes-api
curl -fsS http://127.0.0.1:8091/ready
curl -fsS http://127.0.0.1:8081/health
curl -fsS http://127.0.0.1:8652/health
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api hermes mcp test nexus_marketing_ops
```

Não recrie `app-frontend` nem `hermes-kanban` para esse release candidato: não
há mudança em seus artefatos. A mudança da skill só entra em execução ao
reconstruir e recriar **`hermes-api`**; não basta atualizar o checkout ou
recriar `marketing-ops`.

Depois dos health checks, confirme a carga sem expor conteúdo interno:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=5m --tail=250 hermes-api | grep -E "marketing-ops-operator|skill_view|Marketing Ops confirmation classified" || true
```

O `|| true` evita falhar apenas porque ainda não houve interação que produza
uma linha de log; ele não substitui o smoke conversacional. Em seguida, o
assistente deve executar a matriz real de preview, confirmação contextual,
negação/revisão, agenda, deep link e auditoria descrita em
`vps-validation.md`.

Validações de build fora do container, antes do deploy, quando o checkout da VPS
ou de uma máquina de release permitir:

```bash
cd apps/chat-web && npm ci && npm run typecheck && npm run build && cd ../..
cd services/marketing-ops && npm ci && npm run typecheck && npm run build && cd ../..
cd services/chat-bridge && npm ci && npm test && cd ../..
python -m compileall services/hermes-runtime/docker services/hermes-runtime/skills
```

## Deploy recomendado

1. publicar imagem/configuração do `marketing-ops` com MCP atualizado;
2. publicar configuração do runtime Hermes com skill/contrato atualizados;
3. reiniciar serviços de forma controlada;
4. validar `/health`, `/ready` e descoberta do catálogo MCP;
5. executar smoke de leitura antes de qualquer mutação.

Se a VPS apontar para o mesmo projeto Supabase já conectado neste workspace, o
histórico de `20260722130000_phase_4_hermes_operator_audit.sql` já está
alinhado. Não execute `supabase db push` para esta fase; só aplique schema se o
ambiente alvo for diferente ou comprovadamente estiver defasado.

## Smoke mínimo esperado

- Hermes lista campanhas autorizadas;
- Hermes lê agenda real de uma campanha;
- Hermes prepara um plano sem persistir nada;
- uma campanha nova é preparada primeiro apenas como rascunho (`name` e
  `course_slug` opcional); objetivo, público, canais, briefing, notas e datas
  são uma segunda operação de atualização, após leitura e nova confirmação;
- Hermes executa um plano confirmado e devolve deep link;
- frontend abre o objeto retornado.
- briefing vira itens somente após confirmação;
- resposta do chat vira versão vinculada;
- revisão ENS usa RAG e cenário relacional usa Graph;
- conflito, rate limit e indisponibilidade não produzem falso sucesso.

## Verificações pós-deploy

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 marketing-ops app-bridge hermes-api app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api hermes mcp test nexus_marketing_ops
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api hermes mcp test nexus_rag
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api hermes mcp test nexus_graph
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api hermes mcp test nexus_picture
curl -fsS http://127.0.0.1:8091/ready
curl -fsS http://127.0.0.1:8081/health
curl -fsS http://127.0.0.1:8652/health
```

Se o health HTTP não estiver publicado diretamente na VPS, execute os curls via
`docker compose exec -T <service>`.

Os quatro comandos `hermes mcp test` confirmam transporte e discovery. Execute
também uma leitura real no chat antes de qualquer mutação, pois só ela valida o
handler de `CallToolResult` e a delegação ponta a ponta.

## Logs e segurança

- nunca registrar `delegation_token` ou `plan_token`;
- não copiar respostas integrais com conteúdo sensível para a documentação;
- logs devem permitir correlação por `correlation_id`, ferramenta e run.
- a decisão contextual pode registrar apenas `decision` e
  `output_contract=true|false`; não registrar prompt, mensagem humana, plano
  nem a delegação para diagnóstico.

## Critério de execução

Este runbook só muda para `executed_and_reusable` quando houver deploy real,
smoke real e aceite do usuário no gate VPS.
