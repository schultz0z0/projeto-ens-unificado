# Runbook de deploy e validação na VPS

## Escopo e autoridade

Este roteiro será executado pelo usuário na VPS Linux. O Codex não faz `git push`, acesso remoto ou deploy sem autorização posterior. Nunca imprimir `.env`, tokens, hashes de senha ou connection strings.

Defina uma abreviação apenas na sessão de shell:

```bash
COMPOSE='docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml'
```

Nos exemplos abaixo, substitua `$COMPOSE` pelo comando completo se o shell não expandir aliases/strings como esperado.

## Decisão rápida por tipo de mudança

| Mudança | Bootstrap | Build | Recreate | Migration |
|---|---|---|---|---|
| somente Markdown/docs | não | não | não | não |
| frontend/código deletado nesta Fase 0 | opcional | `app-frontend` | `up -d --no-deps app-frontend` | não |
| código de um serviço | não | serviço afetado | `up -d --no-deps <serviço>` | não, salvo se houver SQL |
| Dockerfile/dependências | não | serviço afetado | serviço afetado | conforme release |
| `.env`/labels/Compose | talvez | somente se build args mudaram | `up -d` detecta; force somente se necessário | não |
| novos diretórios/config padrão | sim, idempotente | conforme mudança | conforme mudança | não |
| migration Supabase | não | normalmente não | não | sim, com backup |
| mudança Graph/seed | não | Graph/Hermes se código mudou | direcionado | bootstrap Graph apenas se indicado |

## Bootstrap

`bash scripts/bootstrap.sh` é idempotente para o estado atual:

- cria diretórios ausentes;
- preserva `.env` existente;
- preserva `data/hermes/config.yaml` existente;
- ajusta permissões básicas.

Execute no primeiro deploy, após clone limpo ou quando o release adicionar diretórios/config padrão. Para o deploy desta Fase 0 em uma VPS já operacional, não é obrigatório; pode ser executado como verificação porque não sobrescreve os dois arquivos preservados.

O bootstrap do Graph é diferente: `NEXUS_GRAPH_BOOTSTRAP_ON_START=true` garante constraints/seed no startup. Não chamar manualmente em deploy comum; usar `nexus_graph_bootstrap` somente para tenant novo, schema Graph alterado ou recuperação indicada.

## 1. Pré-flight

```bash
cd /opt/projeto-ens-unificado
git status --short
git rev-parse HEAD
docker version
docker compose version
df -h
```

Critérios:

- worktree da VPS sem mudanças inesperadas;
- espaço suficiente para imagens e snapshot;
- commit anterior anotado como `PREVIOUS_COMMIT`;
- `.env` existente com permissão restrita (`chmod 600 .env`);
- Traefik externo saudável.

Se `git status` mostrar mudanças não esperadas, pare. Não use `reset --hard` para ocultá-las.

## 2. Backup

### Fase 0 documental/frontend

Não há migration nem alteração de volume. Ainda assim registre o commit e confirme o backup operacional existente.

### Release com banco ou volume

Antes de migration/destruição:

1. confirmar backup/PITR no Supabase Dashboard;
2. gerar dump direcionado do schema/tabelas afetados em diretório fora do Git;
3. registrar tamanho e SHA-256 do dump;
4. testar leitura/restore em ambiente isolado;
5. para Neo4j/volumes locais, usar janela de manutenção e snapshot consistente.

Exemplo de snapshot dos dados bind-mounted, após parar somente os serviços que escrevem nesses dados:

```bash
mkdir -p ../backups
$COMPOSE stop graph-mcp hermes-api hermes-kanban neo4j
tar -C . -czf ../backups/projeto-ens-data-$(date -u +%Y%m%dT%H%M%SZ).tar.gz data
$COMPOSE start neo4j graph-mcp hermes-api hermes-kanban
```

Confirme health depois de religar. Não copie `.env` para backup sem criptografia.

Para a limpeza do Supabase do app, seguir `supabase-cleanup-plan.md`: nenhum objeto do Supabase do `rag-mcp` pode ser alterado.

## 3. Atualizar código

Depois que o usuário fizer push do commit local validado:

```bash
git fetch --prune
git switch main
git pull --ff-only
git rev-parse HEAD
```

O hash deve ser exatamente o commit aprovado localmente.

## 4. Validar configuração efetiva

```bash
$COMPOSE config --quiet
$COMPOSE config --services
```

Não execute `config` sem redirecionamento/filtragem se houver risco de exibir secrets interpolados. `config --quiet` valida sem imprimir o Compose efetivo.

## 5. Estratégia de build

### Padrão recomendado

Use cache. Para esta Fase 0, somente o frontend precisa de rebuild:

```bash
$COMPOSE build app-frontend
```

Cache reduz tempo e não deixa o build menos correto quando Dockerfile, contexto e lockfile estão íntegros.

### Quando usar `--pull`

Use em janela planejada quando quiser atualizar imagens-base/tags e aceitar mudança de base:

```bash
$COMPOSE build --pull app-frontend
```

Não é obrigatório em todo deploy. Como algumas bases usam tags móveis, `--pull` amplia o diff e exige regressão completa.

### Quando usar `--no-cache`

Somente quando:

- cache está corrompido ou mascarando alteração;
- atualização de dependência/base não é capturada;
- investigação reproduziu diferença entre build limpo e cached.

```bash
$COMPOSE build --no-cache app-frontend
```

Não combinar `--no-cache --pull` por rotina; isso aumenta tempo, indisponibilidade potencial e superfície de mudança.

## 6. Migrations

Esta entrega da Fase 0 não aplica migration. Quando houver SQL:

1. confirmar ambiente/projeto ref sem imprimir credenciais;
2. confirmar backup e migration list;
3. aplicar primeiro no Supabase dev/preview;
4. executar testes RLS/grants/advisors;
5. aplicar em produção uma única vez;
6. registrar versão/horário/resultado;
7. interromper deploy se houver falha; não repetir cegamente.

Não usar scripts antigos de `reset_rag_db`/`apply_rag_*` no Supabase do app. Nunca aplicar schema do RAG MCP no projeto do frontend.

## 7. Subida direcionada

Para a Fase 0:

```bash
$COMPOSE up -d --no-deps app-frontend
```

Para release multi-serviço, suba dependências antes e faça `up -d` direcionado. O Compose recria containers cuja configuração/imagem mudou.

### `--force-recreate`

Não usar por padrão. Use somente se o container não incorporou imagem/env/mount já confirmado ou no teste explícito de persistência:

```bash
$COMPOSE up -d --no-deps --force-recreate app-frontend
```

Nunca force recriação simultânea de todos os serviços stateful sem backup e janela.

## 8. Health e logs

```bash
$COMPOSE ps -a
$COMPOSE logs --tail=200 app-frontend
```

Em release completo:

```bash
$COMPOSE logs --tail=200 rag-mcp graph-mcp neo4j hermes-api hermes-kanban app-bridge designer-api artifact-server app-frontend
```

Verifique `healthy`, ausência de restart loop, falhas de permissão, migration, RLS, CORS e comunicação. Redija qualquer secret antes de anexar logs.

## 9. Smoke tests

- abrir login e autenticar usuário de teste;
- navegar em `/`, `/admin/users` conforme papel e `/manager/validated-works`;
- criar sessão de chat de teste, receber stream e atualizar a página para testar replay;
- anexar arquivo pequeno permitido;
- gerar/abrir artifact e renovar link expirável;
- gerar imagem de teste se provedores estiverem disponíveis;
- consultar RAG e Graph sem expô-los publicamente;
- confirmar que rotas antigas removidas não aparecem;
- verificar DNS/TLS/CORS dos hosts públicos;
- confirmar que RAG MCP/Graph MCP não ganharam router público.

Dados de teste devem ser identificados e removidos conforme política, nunca misturados silenciosamente com produção.

## 10. Persistência após reinício

Para serviços não stateful/selecionados:

```bash
$COMPOSE restart app-frontend app-bridge
$COMPOSE ps -a
```

Confirme histórico de chat, replay de run persistido e links/artefatos. Reinício de Neo4j/Hermes exige janela e backup compatíveis.

## 11. Rollback

### Código/imagem

```bash
git switch --detach "$PREVIOUS_COMMIT"
$COMPOSE build app-frontend
$COMPOSE up -d --no-deps app-frontend
```

Depois do incidente, volte à branch somente com orientação e worktree limpo. Não faça `git reset --hard` na VPS.

### Configuração

- restaurar `.env`/Compose de backup seguro;
- validar com `config --quiet`;
- recriar apenas o serviço afetado.

### Banco

- bloquear writes/feature flag;
- preferir forward fix quando os dados são compatíveis;
- em perda/corrupção, restaurar backup/PITR conforme runbook Supabase;
- limpeza legada volta por quarentena/dump;
- nunca executar um `down` destrutivo sem restore testado.

## 12. Evidência e aceite

Registrar em `vps-validation.md`:

- commit anterior e implantado;
- data/hora UTC e operador;
- comandos executados e exit codes;
- serviços/health;
- smoke tests;
- reinício/persistência;
- backup e rollback disponíveis;
- divergências e logs redigidos;
- aceite do usuário.

Somente depois disso o estado passa de `ready_for_production` para `production_validated`.
