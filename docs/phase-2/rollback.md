# Rollback da Fase 2

- **Estado:** `verified_in_vps`
- **Princípio:** rollback normal é de flags e aplicação; dados, auditoria e migrations aditivas são preservados

## Gatilhos

- acesso cross-tenant ou elevação de papel;
- perda/sobrescrita silenciosa de dados;
- timeline/log contendo conteúdo ou segredo proibido;
- erro 5xx sustentado, readiness indisponível ou dependência em cascata;
- material inacessível/perdido após restart;
- migration inesperada ou falha alta/crítica.

## Contenção imediata

1. definir `NEXUS_MARKETING_OPS_FRONTEND_KILL_SWITCH=true` e reconstruir o frontend quando necessário;
2. definir `NEXUS_MARKETING_OPS_FRONTEND_WRITE=false` e `NEXUS_MARKETING_OPS_FEATURE_WRITE=false`;
3. se leituras também estiverem inseguras, desligar frontend read/backend read;
4. preservar `docker compose ps`, logs sanitizados, correlation IDs, commit e horário;
5. não apagar campanha, auditoria, outbox, idempotência, metadata ou bytes para ocultar o incidente.

Flags `VITE_*` são embutidas no build: mudar somente `.env` não altera um frontend já construído. O container `app-frontend` precisa ser reconstruído/recriado para o kill switch surtir efeito.

## Reimplantar aplicação anterior

Na VPS, usar o commit anterior aprovado sem criar branch:

```bash
cd /opt/nexus-ens
git fetch origin
git checkout --detach <commit-anterior-aprovado>
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build marketing-ops artifact-server rag-mcp app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d artifact-server rag-mcp marketing-ops app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
```

Após estabilizar, o responsável retorna o checkout para `main` somente quando houver forward-fix aprovado.

## Banco e Supabase

- migrations da Fase 2 são aditivas e o rollback de aplicação mantém tabelas/colunas;
- não editar manualmente `supabase_migrations.schema_migrations` para simular reversão;
- não executar down migration destrutiva sem dump verificado, plano testado e aprovação explícita;
- preferir forward-fix compatível com a imagem anterior;
- em falha do `db push`, registrar exatamente a migration aplicada antes de decidir qualquer ação;
- o Supabase do RAG nunca participa do rollback da Fase 2.

## Artifact Server

- preservar `./data/artifacts` e suas permissões;
- não remover o volume durante `down/up`;
- unlink de metadata não autoriza apagar bytes compartilhados;
- se houver upload órfão, identificar por correlation ID/hash e usar cleanup explícito após confirmar ausência de vínculos;
- em suspeita de chave vazada, rotacionar chave interna e segredo de access token, recriar Marketing Ops/Artifact e invalidar links antigos.

## RAG indisponível

Manter edição de campos não relacionados à referência, mas impedir lookup/validação e avanço para `planned` quando uma referência de curso exigir verificação. Não liberar conexão direta ao Supabase do RAG como atalho.

## Verificação pós-rollback

- serviços saudáveis e `/ready` coerente;
- leitura de campanhas anteriores preservada;
- nenhuma nova mutação quando write estiver desligado;
- bytes e metadata existentes continuam acessíveis aos owners autorizados;
- logs não contêm secrets;
- causa, impacto, commit e decisão registrados em [vps-validation.md](vps-validation.md) e no registro de riscos.
