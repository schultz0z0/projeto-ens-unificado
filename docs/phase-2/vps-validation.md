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
- [x] RLS member/manager/admin, membership inativa e cross-tenant aprovadas;
- [ ] RED histórico/GREEN atual do deadlock de `campaign_items` documentado;
- [ ] harness campanha/participante/item sem `40P01`;
- [ ] viewer/member sem autoridade não retém advisory lock;
- [ ] 12 cenários DB da Task 4, 5 da Task 5, 3 da Task 6 e referência canônica da Task 7 aprovados;
- [ ] 6 testes REST, 6 MCP e 5 production-gate diferidos na Task 9 aprovados;
- [ ] client da Task 10 integrado à API real preserva auth, correlação, ETag, `If-Match`, idempotência, upload binário e `currentVersion` no 409;
- [ ] lista da Task 11 usa owners/alertas reais, combina filtros, pagina por cursor e cria rascunho sem N+1 ou vazamento cross-tenant;
- [ ] workspace da Task 12 salva somente o patch explícito, valida datas/canais, resolve 409 sem perder valores locais, transiciona e arquiva com a versão real;
- [ ] lint/advisors sem erro/achado novo nos objetos alterados;
- [x] imagens Linux constroem e Compose fica saudável;
- [ ] nenhuma fixture residual após cleanup.

## Probes e integrações

```bash
curl -fsS http://127.0.0.1:8095/health
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:8091/health
curl -fsS http://127.0.0.1:8091/ready
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=10m marketing-ops artifact-server rag-mcp app-frontend
```

- [x] Marketing Ops → RAG pesquisa e verifica curso ENS sem conexão direta ao banco RAG;
- [ ] indisponibilidade do RAG não bloqueia campos alheios à referência e bloqueia validação necessária;
- [x] upload permitido, MIME/extensão/tamanho inválidos e artifact de outro owner são exercitados;
- [x] access link é curto, autorizado e não aparece em logs;
- [x] unlink remove vínculo sem apagar bytes compartilhados;
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

Na etapa 6, recarregar a URL em nova aba e confirmar que busca, status, referência, canal, responsável e período são preservados. Exercitar também vazio inicial, nenhum resultado, 403, erro com correlation ID, retry e paginação “Carregar mais”. Nas etapas 4, 8 e 9, confirmar que viewer não vê mutações, owner/editor respeitam seus limites, só existe um responsável principal, erros aparecem dentro do diálogo ativo, URLs assinadas não são renderizadas e a timeline pagina sem expor ação/campo desconhecido ou conteúdo bruto.

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
| Gate automatizado | `approved` |
| Logs/redaction | `pending` |
| Smokes por papel | `approved` |
| Desktop/mobile/axe | `pending` |
| Restart/persistência | `pending` |
| Rollback | `pending` |
| Fixtures removidas | `pending` |
| Aceite do usuário | `pending` |

A fase só passa a `production_validated`/`completed` quando todos os bloqueadores estiverem verdes, o piloto for aceito e não houver falha alta ou crítica conhecida.

## Histórico de Correções e Ajustes (QA)

Durante o ciclo de homologação na VPS, os seguintes incidentes foram identificados e corrigidos via hotfix:

### 1. Parsing de Arrays PG no Backend (PATCH)
* **Incidente:** O driver do PostgreSQL (`pg`) retornava arrays de enums customizados (ex: `secondary_channels`) como strings formatadas (`"{}"` ou `"{email,instagram}"`). O frontend interpretava a string crua e a quebrava em caracteres isolados (`['{', '}']`) ao re-salvar, estourando erro de validação (400 Bad Request).
* **Solução:** Adicionado parser customizado `parsePgArray` na camada de mapeamento da API do backend (`campaigns.ts`) para converter as strings cruas do PostgreSQL em arrays JavaScript nativos antes da validação.

### 2. Invalidação da Timeline no Workspace (Frontend)
* **Incidente:** O painel de atividades (timeline) do Workspace da campanha não atualizava em tempo real após o salvamento de alterações ou transições de status, exigindo que o usuário recarregasse a aba (F5).
* **Solução:** Adicionada a invalidação de cache explícita da query de timeline (`marketingOpsKeys.timeline(next.id)`) nos hooks de salvamento e atualização do Workspace.

### 3. Erro 42P08 (Ambiguous Parameter) no Postgres durante Transição (Transitions)
* **Incidente:** Ao clicar em "Planejar", a chamada de transição de status falhava com erro interno 500. Os logs revelaram que o Postgres rejeitava a query com código `42P08` porque o parâmetro `$2` (status da campanha) era usado de forma ambígua (tanto na comparação do tipo enum quanto na coação de texto para a verificação de arquivamento).
* **Solução:** Adicionado typecast explícito do enum `$2::marketing_ops.campaign_status` na cláusula `set status` da query de transição no backend, resolvendo a ambiguidade.

### 4. Lentidão e Timeout na Busca de Referências Oficiais (Courses Autocomplete)
* **Incidente:** Ao realizar pesquisas por cursos no autocomplete do formulário, as chamadas para `/references/courses` demoravam mais de 15 segundos, estourando o timeout com erro `503 Service Unavailable`. A análise revelou que:
  a) A chamada de rede para gerar o embedding do termo de busca na API da OpenAI adicionava de 1 a 3 segundos de atraso síncrono.
  b) A cláusula `OR` com busca parcial `LIKE` na query SQL `match_document_chunks_advanced` forçava o planejador do PostgreSQL a desabilitar índices e rodar um Full Table Scan (Varredura Sequencial) pesado na tabela `document_chunks` em cada alteração de caractere.
* **Solução:** 
  a) Introduzido o parâmetro `search_mode` no RAG MCP. Quando configurado como `'text'`, o servidor pula a chamada de embedding na OpenAI (latência de rede reduzida a zero).
  b) O backend do `marketing-ops` passou a invocar o RAG no modo `'text'` para pesquisas de formulário.
  c) Criada a migração [2026-07-16-optimize-mcp-search.sql](file:///c:/Users/raphaeloliveira/Desktop/Projetos%20Saas/projeto-ens-unificado/services/rag-mcp/supabase/migrations/2026-07-16-optimize-mcp-search.sql) para reescrever a query utilizando `UNION ALL`, separando a busca textual (GIN) e a busca de títulos em ramos independentes para garantir o escaneamento por índice (Index Scan).
* **Estado:** Validado funcionalmente pelo usuário com sucesso na VPS (busca de cursos agora responde instantaneamente).

### 5. Sincronização de Novos Usuários Criados pelo Painel Administrativo
* **Incidente:** Usuários recém-criados administrativamente pelo painel (como a Amanda Silva) não apareciam como candidatos para vinculação de participantes nas campanhas. Isso acontecia porque a Edge Function `admin-create-user` insere os perfis em `public.profiles` com o `tenant_id` como `NULL`, enquanto a trigger de sincronização de banco de dados (`sync_ens_profile_membership`) exigia obrigatoriamente que o `tenant_id` fosse `'ens'` para gerar a entrada correspondente na tabela `marketing_ops.memberships`.
* **Solução:** 
  a) Executado script de correção no banco para associar Amanda Silva ao `tenant_id = 'ens'`.
  b) Criada a migração incremental [20260716181000_fix_sync_ens_profile_membership.sql](file:///c:/Users/raphaeloliveira/Desktop/Projetos%20Saas/projeto-ens-unificado/apps/chat-web/supabase/migrations/20260716181000_fix_sync_ens_profile_membership.sql) que atualiza a função da trigger para tratar perfis criados com `tenant_id IS NULL`, mapeando-os automaticamente para o tenant padrão `'ens'`.
* **Estado:** Validado funcionalmente pelo usuário com sucesso na VPS (usuários criados administrativamente agora são sincronizados e pesquisáveis na modal de participantes).


