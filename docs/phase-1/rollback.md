# Rollback da Fase 1

1. Desativar `NEXUS_MARKETING_OPS_FEATURE_WRITE=false` e recriar somente `marketing-ops`.
2. Se necessário, desativar leitura e habilitar o kill switch frontend.
3. Preservar logs, correlation IDs, dump do banco e `docker compose ps`.
4. Reimplantar a imagem/commit anterior de Bridge, Hermes e Marketing Ops.
5. Não apagar auditoria, outbox ou idempotência para “limpar” o incidente.

```bash
git checkout <commit-anterior-aprovado>
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build marketing-ops app-bridge hermes-api hermes-kanban app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d marketing-ops hermes-api hermes-kanban app-bridge app-frontend
```

As migrations são aditivas. O rollback normal é de aplicação/flags, mantendo as tabelas. Reversão destrutiva de schema exige dump verificado e aprovação explícita.

Em chave comprometida: gerar novo kid/segredo, substituir active simultaneamente nos dois serviços, não manter a chave comprometida como previous, reiniciar e auditar `delegation_uses`/`audit_events`.
