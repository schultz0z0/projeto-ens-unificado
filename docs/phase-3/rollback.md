# Rollback da Fase 3

- **Estado:** `ready_for_vps_validation`
- **Princípio:** conter por flags e reimplantar a aplicação anterior; preservar
  migrations aditivas, itens, versões, auditoria, outbox e artifacts

## Gatilhos

- acesso cross-tenant ou elevação de papel;
- perda, alteração ou remoção de versão congelada;
- ciclo/deadlock, sobrescrita silenciosa ou lote com sucesso oculto;
- timezone incorreto em agenda/reagendamento;
- conteúdo, segredo, bearer ou URL assinada em logs/notificações;
- erro 5xx sustentado, `/ready` indisponível ou artifact perdido após restart;
- falha alta/crítica sem mitigação.

## Contenção imediata

1. definir `NEXUS_MARKETING_OPS_FRONTEND_KILL_SWITCH=true`;
2. definir `NEXUS_MARKETING_OPS_FRONTEND_WRITE=false` e
   `NEXUS_MARKETING_OPS_FEATURE_WRITE=false`;
3. se a leitura estiver insegura, desativar também frontend/backend read;
4. reconstruir e recriar `app-frontend` porque flags `VITE_*` são de build;
5. preservar commit, horário, correlation IDs e logs sanitizados;
6. não apagar itens, versões, notificações, auditoria ou bytes para ocultar o
   incidente.

```bash
cd /opt/nexus-ens
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache app-frontend marketing-ops
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate marketing-ops app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
```

## Reimplantar commit anterior

Registrar antes o commit atual e o último commit aprovado. Sem criar branch:

```bash
cd /opt/nexus-ens
git fetch origin
git checkout --detach <commit-anterior-aprovado>
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --pull --no-cache marketing-ops artifact-server rag-mcp app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate artifact-server rag-mcp marketing-ops app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:8091/ready
```

Retornar ao `main` somente após um forward-fix aprovado.

## Banco/Supabase

- as migrations da Fase 3 são aditivas e compatíveis com rollback da imagem;
- não executar `db reset`, down migration destrutiva ou editar o histórico de
  `supabase_migrations`;
- preservar tabelas de itens, dependências, assets, versões, artifacts e
  notificações;
- preferir forward-fix;
- qualquer reversão de dados exige dump verificado, ensaio e aprovação
  explícita;
- o Supabase do RAG não participa das migrations da Fase 3.

## Artifact Server

- preservar `./data/artifacts`, metadata, objetos e permissões;
- não executar `docker compose down -v`;
- unlink não autoriza exclusão de bytes compartilhados;
- rotacionar chave interna/segredo de token se houver suspeita de vazamento e
  recriar Marketing Ops + Artifact Server;
- validar fingerprint e tamanho antes/depois da estabilização.

## Verificação pós-rollback

- quatro serviços running/healthy e `/ready` coerente;
- campanhas/itens anteriores continuam legíveis;
- write desativado realmente impede mutações;
- agenda, dependências, versões, notificações e bytes permanecem;
- logs não contêm secrets/conteúdo;
- causa, impacto, commit e decisão são registrados em
  [vps-validation.md](vps-validation.md) e [risk-register.md](risk-register.md).
