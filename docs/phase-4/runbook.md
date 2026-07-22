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

## Comandos base

Use sempre os dois arquivos Compose do monorepo em produção:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build app-frontend app-bridge marketing-ops hermes-api hermes-kanban
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
```

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

Se a VPS apontar para o mesmo projeto Supabase já conectado neste workspace, não
reaplique cegamente a migration da Fase 4. Primeiro confirme que
`20260722130000_phase_4_hermes_operator_audit.sql` já está refletida no schema
remoto; só repita o push se o ambiente alvo for diferente ou estiver defasado.

## Smoke mínimo esperado

- Hermes lista campanhas autorizadas;
- Hermes lê agenda real de uma campanha;
- Hermes prepara um plano sem persistir nada;
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
curl -fsS http://127.0.0.1:8091/ready
curl -fsS http://127.0.0.1:8081/health
curl -fsS http://127.0.0.1:8652/health
```

Se o health HTTP não estiver publicado diretamente na VPS, execute os curls via
`docker compose exec -T <service>`.

## Logs e segurança

- nunca registrar `delegation_token` ou `plan_token`;
- não copiar respostas integrais com conteúdo sensível para a documentação;
- logs devem permitir correlação por `correlation_id`, ferramenta e run.

## Critério de execução

Este runbook só muda para `executed_and_reusable` quando houver deploy real,
smoke real e aceite do usuário no gate VPS.
