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

### Décimo release candidato: timeout contextual e sincronização da skill

> Registro histórico substituído pelo décimo primeiro release abaixo. Não use
> este bloco para um novo deploy: a instalação na raiz de `skills/` provocou
> colisão com a cópia categorizada já existente.

O gate real de 29/07/2026 provou que `app-bridge` e `hermes-api` precisam ser
publicados juntos. A Bridge passa a aguardar até 15 segundos pela decisão
contextual, e o Hermes passa a substituir a cópia persistida antiga da skill
por seu pacote `1.2.0` a cada inicialização. Não há mudança de schema,
migration, frontend ou serviço `marketing-ops`.

```bash
cd /opt/nexus-ens
set -euo pipefail
git pull --ff-only origin main
git rev-parse --short HEAD
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache app-bridge hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate app-bridge hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps app-bridge hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=5m --tail=250 app-bridge hermes-api
curl -fsS http://127.0.0.1:8081/health
curl -fsS http://127.0.0.1:8652/health
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api \
  sh -lc 'grep -q "^version: 1.2.0$" /opt/data/skills/marketing-ops-operator/SKILL.md &&
    test -f /opt/data/skills/marketing-ops-operator/references/mcp-contract.md &&
    test -f /opt/data/skills/marketing-ops-operator/references/conversation-safety.md &&
    test -f /opt/data/skills/marketing-ops-operator/references/diagnostics.md &&
    test -f /opt/data/skills/marketing-ops-operator/templates/plan-preview.md'
```

O bloco final não imprime o conteúdo da skill nem qualquer segredo; exit 0
confirma que a cópia gerenciada correta chegou ao volume persistente. A
variável `NEXUS_MARKETING_OPS_DECISION_TIMEOUT_MS=15000` é opcional porque o
mesmo valor já é o default da imagem. Se ela for declarada na `.env`, o Compose
a propaga para `app-bridge`.

Depois desses checks, abra uma conversa nova e repita primeiro o preview sem
persistência e `vamos nessa`. Não aceite o workaround de pedir uma segunda
confirmação: o contrato da Fase 4 exige uma única confirmação no turno seguinte.

### Décimo primeiro release candidato: skill canônica e decisão inequívoca

O pós-deploy do décimo release comprovou que o timeout de 15 segundos está
ativo, porém revelou duas causas residuais no `hermes-api`:

- a skill gerenciada foi instalada em `skills/marketing-ops-operator`, enquanto
  a cópia categorizada histórica permaneceu em
  `skills/marketing/marketing-ops-operator`; o loader recusou a resolução
  simples por colisão;
- `vamos nessa`, embora seja uma resposta completa e sem ressalva ao plano
  pendente, foi enviado ao modelo classificador e retornou `clarify`.

O décimo primeiro release instala e atualiza atomicamente somente o caminho
categorizado, remove a cópia gerenciada obsoleta da raiz e resolve localmente
respostas curtas inequívocas. Frases com pergunta, ressalva, alteração ou
qualificador continuam no classificador contextual e qualquer falha continua
fechada como `clarify`. Apenas `hermes-api` mudou.

```bash
cd /opt/nexus-ens
set -euo pipefail
git pull --ff-only origin main
git rev-parse --short HEAD
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps hermes-api app-bridge
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=5m --tail=250 hermes-api
curl -fsS http://127.0.0.1:8652/health
curl -fsS http://127.0.0.1:8081/health
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api \
  sh -lc 'test ! -e /opt/data/skills/marketing-ops-operator &&
    grep -q "^version: 1.2.0$" /opt/data/skills/marketing/marketing-ops-operator/SKILL.md &&
    test -f /opt/data/skills/marketing/marketing-ops-operator/references/mcp-contract.md &&
    test -f /opt/data/skills/marketing/marketing-ops-operator/references/conversation-safety.md &&
    test -f /opt/data/skills/marketing/marketing-ops-operator/references/diagnostics.md &&
    test -f /opt/data/skills/marketing/marketing-ops-operator/templates/plan-preview.md'
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api \
  hermes mcp test nexus_marketing_ops
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=5m --tail=250 hermes-api \
  | grep -E "Skill name collision|Marketing Ops confirmation classified" || true
```

O último `grep` não deve mostrar nova linha `Skill name collision` após a
recriação. Durante os smokes, a decisão inequívoca deve aparecer como
`decision=approve output_contract=True source=deterministic`, sem registrar a
mensagem humana. Não é necessário rebuildar `app-bridge`, `marketing-ops`,
frontend ou `hermes-kanban`.

### Décimo segundo release candidato: schema visível sem credenciais efêmeras

O décimo primeiro release já está implantado e validou skill, health, discovery
e leitura real. O preview seguinte revelou que o modelo ainda recebia
`delegation_token` como parâmetro obrigatório, apesar de o runtime sempre
vincular esse segredo imediatamente antes da chamada. A sessão enviou `{}` e o
MCP recusou `actions` ausente. O décimo segundo release corrige somente o
conversor de schema do `hermes-api`; servidor Marketing Ops, Bridge, frontend,
banco e migrations não mudam.

```bash
cd /opt/nexus-ens
set -euo pipefail
git pull --ff-only origin main
git rev-parse --short HEAD
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps hermes-api app-bridge marketing-ops
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=5m --tail=250 hermes-api
curl -fsS http://127.0.0.1:8652/health
curl -fsS http://127.0.0.1:8081/health
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api \
  hermes mcp test nexus_marketing_ops
```

Depois do deploy, use conversa nova. O primeiro preview deve registrar
`marketing_ops_prepare_plan_v1` com `actions` preenchido, retornar um plano
real e manter zero persistência. No turno seguinte, `vamos nessa` deve executar
uma única vez. Não reinicie nem reconstrua `marketing-ops`: a alteração está no
schema que o Hermes apresenta ao modelo, não no schema que o servidor valida.

### Décimo terceiro release candidato: wire shape de conteúdo na skill

O décimo segundo release passou na criação/atualização de campanha, confirmação
contextual e criação de item vinculado. O primeiro plano de conteúdo falhou
antes da assinatura porque a referência da skill nomeava
`content.create_draft` e `content.version_create`, mas não congelava os campos
canônicos. O serviço permaneceu fail-closed e nenhum conteúdo foi persistido.

O pacote `1.2.1` acrescenta à referência MCP o wire shape exato para criar um
asset e sua versão inicial no mesmo plano. Não há mudança em schema, migration,
`marketing-ops`, Bridge ou frontend.

```bash
cd /opt/nexus-ens
set -euo pipefail
git pull --ff-only origin main
git rev-parse --short HEAD
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps hermes-api app-bridge marketing-ops
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=5m --tail=250 hermes-api
curl -fsS http://127.0.0.1:8652/health
curl -fsS http://127.0.0.1:8081/health
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api \
  sh -lc 'test ! -e /opt/data/skills/marketing-ops-operator &&
    grep -q "^version: 1.2.1$" /opt/data/skills/marketing/marketing-ops-operator/SKILL.md &&
    grep -q "\"expected_item_version\"" /opt/data/skills/marketing/marketing-ops-operator/references/mcp-contract.md &&
    grep -q "\"expected_asset_version\"" /opt/data/skills/marketing/marketing-ops-operator/references/mcp-contract.md'
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api \
  hermes mcp test nexus_marketing_ops
```

Depois do deploy, abra uma conversa nova e repita somente a criação de
`email_html` + versão inicial no item já existente. O preview deve conter as
duas ações, nada deve existir antes da confirmação e a execução deve retornar o
deep link do conteúdo vinculado ao item.

### Décimo quarto release candidato: leitura de versões para revisão ENS

O pacote `1.2.1` foi publicado e comprovou a criação do asset `email_html`, sua
versão inicial, deep link, auditoria e idempotência. Na jornada seguinte, RAG e
Graph foram consultados corretamente, mas a revisão não avançou porque o Hermes
leu apenas o resumo do asset: a referência não exigia
`include_versions: true` nem congelava o seletor exclusivo de
`marketing_ops_get_content_v1`.

O pacote `1.2.2` corrige somente essa referência, incluindo:

- exatamente um de `item_id` ou `asset_id`;
- `include_versions: true` e `version_limit` para revisão;
- `resource_type` canônico para capacidades.

Não há mudança de backend, schema, migration, Bridge ou frontend.

```bash
cd /opt/nexus-ens
set -euo pipefail
git pull --ff-only origin main
git rev-parse --short HEAD
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps hermes-api app-bridge marketing-ops
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=5m --tail=250 hermes-api
curl -fsS http://127.0.0.1:8652/health
curl -fsS http://127.0.0.1:8081/health
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api \
  sh -lc 'test ! -e /opt/data/skills/marketing-ops-operator &&
    grep -q "^version: 1.2.2$" /opt/data/skills/marketing/marketing-ops-operator/SKILL.md &&
    grep -q "\"include_versions\": true" /opt/data/skills/marketing/marketing-ops-operator/references/mcp-contract.md &&
    grep -q "exactly one of.*item_id.*asset_id" /opt/data/skills/marketing/marketing-ops-operator/references/mcp-contract.md'
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api \
  hermes mcp test nexus_marketing_ops
```

Depois do deploy, repita apenas a revisão ENS do asset existente. O Hermes deve
ler o corpo da versão 1, consultar RAG e Graph, preparar uma versão 2 sem
persistência, aguardar confirmação e preservar a versão 1.

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
curl -fsS http://127.0.0.1:8091/ready
curl -fsS http://127.0.0.1:8081/health
curl -fsS http://127.0.0.1:8652/health
```

Se o health HTTP não estiver publicado diretamente na VPS, execute os curls via
`docker compose exec -T <service>`.

Os três comandos `hermes mcp test` confirmam transporte e discovery. Execute
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
