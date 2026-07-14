# Validação VPS da Fase 2

- **Estado:** `pending_user_execution`
- **Ambiente alvo:** Ubuntu Linux, Docker Engine/Compose e Traefik
- **Responsável pelo deploy:** usuário
- **Responsável por conduzir validação/análise:** agente após o deploy
- **Supabase:** app separado; RAG sem migration ou escrita

## Pré-condições

- [ ] Tasks 1–15 em `implementation_complete_pending_vps_validation`;
- [ ] commit final publicado manualmente em `origin/main`;
- [ ] deploy Supabase do app concluído e registrado;
- [ ] `.env` validado sem imprimir valores e sem placeholders;
- [ ] flags read/write/frontend inicialmente desligadas;
- [ ] backup Supabase e backup/permissões de `data/artifacts` confirmados;
- [ ] script `scripts/test/phase-2-vps.sh` criado na Task 14, revisado e seguro para produção;
- [ ] usuários/tenant/fixtures de teste identificados e cleanup definido.

## Deploy

```bash
cd /opt/nexus-ens
git fetch origin
git checkout main
git pull --ff-only origin main
git rev-parse --short HEAD
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build marketing-ops artifact-server rag-mcp app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d artifact-server rag-mcp marketing-ops app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
```

Não executar ainda o script citado acima: ele será implementado e revisado na Task 14. Este documento registra o contrato que o script deve cumprir.

## Gate automatizado esperado

- [ ] migration e invariantes do schema confirmadas;
- [ ] total pgTAP final aprovado, incluindo baseline atual de 228 asserts;
- [ ] RLS member/manager/admin, membership inativa e cross-tenant aprovadas;
- [ ] RED histórico/GREEN atual do deadlock de `campaign_items` documentado;
- [ ] harness campanha/participante/item sem `40P01`;
- [ ] viewer/member sem autoridade não retém advisory lock;
- [ ] 12 cenários DB da Task 4, 5 da Task 5, 3 da Task 6 e referência canônica da Task 7 aprovados;
- [ ] 6 testes REST, 6 MCP e 5 production-gate diferidos na Task 9 aprovados;
- [ ] client da Task 10 integrado à API real preserva auth, correlação, ETag, `If-Match`, idempotência, upload binário e `currentVersion` no 409;
- [ ] lint/advisors sem erro/achado novo nos objetos alterados;
- [ ] imagens Linux constroem e Compose fica saudável;
- [ ] nenhuma fixture residual após cleanup.

## Probes e integrações

```bash
curl -fsS http://127.0.0.1:8095/health
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:8091/health
curl -fsS http://127.0.0.1:8091/ready
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=10m marketing-ops artifact-server rag-mcp app-frontend
```

- [ ] Marketing Ops → RAG pesquisa e verifica curso ENS sem conexão direta ao banco RAG;
- [ ] indisponibilidade do RAG não bloqueia campos alheios à referência e bloqueia validação necessária;
- [ ] upload permitido, MIME/extensão/tamanho inválidos e artifact de outro owner são exercitados;
- [ ] access link é curto, autorizado e não aparece em logs;
- [ ] unlink remove vínculo sem apagar bytes compartilhados;
- [ ] falha entre upload e commit aciona compensação;
- [ ] logs não contêm bearer, delegação, chaves, briefing, notas, filename bruto, URL assinada ou payload RAG.

## Testes manuais por papel

| Cenário | Member | Manager | Admin |
|---|---|---|---|
| Criar rascunho name-only | permitido | permitido | permitido |
| Ler campanha | somente participante | tenant | tenant autorizado |
| Editar campos | owner/editor | permitido | permitido |
| Avançar estado | owner principal | permitido | permitido |
| Reabrir/arquivar | negado | permitido | permitido |
| Gerenciar viewer/editor | owner principal | permitido | permitido |
| Alterar owners/principal | negado | permitido | permitido |
| Timeline segura | participante | tenant | tenant autorizado |
| Auditoria detalhada | negado | tenant | tenants autorizados |

Jornada funcional mínima:

1. criar rascunho e abrir por deep link;
2. completar objetivo, público, período, canais e briefing;
3. buscar/verificar curso oficial;
4. adicionar owner e transferir principal;
5. planejar e ativar;
6. filtrar por URL e reabrir a campanha;
7. provocar 409 em duas páginas e preservar valores locais;
8. enviar, abrir e desvincular material;
9. conferir timeline sem conteúdo proibido;
10. concluir/arquivar e confirmar read-only;
11. negar usuário/papel/tenant indevido;
12. repetir idempotency key sem duplicar entidade, auditoria ou evento.

Executar em desktop e viewport mobile de 390 px, com teclado nos fluxos essenciais. Registrar somente IDs/correlation IDs de fixtures de teste e resultados sanitizados.

## Restart e persistência

Com uma campanha e material de teste identificados:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml restart artifact-server rag-mcp marketing-ops app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
```

- [ ] campanha, participantes, timeline e metadata permanecem;
- [ ] bytes permanecem no volume e access link novo funciona;
- [ ] nenhuma duplicação de outbox/idempotência;
- [ ] readiness recupera e dependências ficam saudáveis;
- [ ] permissões Linux do volume permanecem corretas.

## Rollback verificável

- [ ] write/frontend podem ser desligados sem remover dados;
- [ ] imagem anterior pode ser reimplantada conforme [rollback.md](rollback.md);
- [ ] backup Supabase e volume estão acessíveis;
- [ ] forward-fix é preferido a down migration destrutiva;
- [ ] evidência do exercício não contém secrets.

## Registro do aceite

| Evidência | Resultado |
|---|---|
| Data/hora e commit | `pending` |
| Compose config/build/up | `pending` |
| Gate automatizado | `pending` |
| Logs/redaction | `pending` |
| Smokes por papel | `pending` |
| Desktop/mobile/axe | `pending` |
| Restart/persistência | `pending` |
| Rollback | `pending` |
| Fixtures removidas | `pending` |
| Aceite do usuário | `pending` |

A fase só passa a `production_validated`/`completed` quando todos os bloqueadores estiverem verdes, o piloto for aceito e não houver falha alta ou crítica conhecida.
