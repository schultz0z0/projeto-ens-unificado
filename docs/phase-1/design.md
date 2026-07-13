# Design técnico — Fase 1: Fundação do Marketing Ops

- **Status:** `implemented_and_validated_locally`
- **Data:** 2026-07-11
- **Origem:** PRD da Fase 1, backlog F1-001–F1-108 e ADRs 0001–0005

## Resultado

A Fase 1 adiciona um serviço independente `marketing-ops` que oferece REST ao frontend e MCP ao Hermes sobre a mesma camada de domínio e a mesma transação PostgreSQL. O serviço entrega campanhas e itens em rascunho apenas como objetos de prova da fundação; workspace completo, aprovações editoriais e execução externa continuam fora do escopo.

## Decisões fechadas

| Tema | Decisão |
|---|---|
| Linguagem | TypeScript em Node.js 22 |
| HTTP | Express, seguindo os MCPs existentes |
| MCP | SDK oficial `@modelcontextprotocol/sdk` com Streamable HTTP |
| Banco operacional | Supabase do app, em schema privado `marketing_ops` |
| Supabase do RAG | permanece separado e não é acessado pelo novo serviço |
| Autenticação REST | validação do bearer pelo Supabase Auth do app |
| Tenant e papel | resolvidos por `marketing_ops.memberships`, nunca por argumento ou `user_metadata` |
| Persistência | PostgreSQL direto com transações e contexto RLS por requisição |
| Delegação Hermes | JWT interno HS256 curto, versionado, com rotação por `kid`, claims mínimos e transporte efêmero fora do histórico |
| Anti-replay | `jti` associado à mutação e à idempotency key; reuso divergente é conflito |
| Eventos | tabela outbox `domain_events`, preparada para polling com `FOR UPDATE SKIP LOCKED` |
| Retenção de auditoria | sem expurgo automático na Fase 1; registros permanecem imutáveis até política de compliance posterior |
| Rollout | flags desligadas por padrão; leitura e escrita ativadas separadamente |

## Fronteiras de dados e ambiente

```text
Supabase do app
  auth.users / public.profiles / chat_* / validated_works
  marketing_ops.tenants / memberships / campaigns / campaign_items
  marketing_ops.audit_events / domain_events / idempotency_records

Supabase do RAG
  documents / chunks / rag_queries / rag_audit_events
  acesso exclusivo do rag-mcp
```

O `.env` raiz continua global. O Compose traduz variáveis para cada container. O frontend recebe apenas `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, URL pública do Marketing Ops e flags públicas. Service role, conexão PostgreSQL, chave interna de métricas e chaves de delegação nunca entram em `build.args` do frontend.

## Componentes

### Configuração

`services/marketing-ops/src/config.ts` valida ambiente, URLs, limites, origins, banco, Auth e keyring antes de abrir a porta. Produção falha no startup se Auth, banco, segredo interno ou chave de delegação estiverem ausentes ou forem placeholders.

### Identidade

O middleware REST valida o token no endpoint `/auth/v1/user` do Supabase do app. O `sub` autenticado é usado para buscar memberships ativas. `X-Tenant-Id` pode selecionar uma membership existente, mas nunca criar autoridade. Ausência de membership, tenant cruzado ou papel forjado falha fechado.

O serviço abre uma transação e configura claims locais antes de executar regras e SQL com RLS. Nenhuma operação de domínio usa uma conexão fora desse wrapper.

### Delegação Hermes

A Chat Bridge emite um token com:

- `iss=nexus-chat-bridge`;
- `aud=nexus-marketing-ops`;
- `sub`, `tenant_id` e `actor_role` verificados;
- `scopes` mínimos;
- `chat_session_id`, `run_id` e `correlation_id`;
- `jti`, `iat`, `nbf`, `exp`, `kid` e `contract_version=1`.

O token expira em no máximo 120 segundos. A Bridge nunca persiste o token em seu ledger e redige diagnósticos. Na Session API, o token atual é enviado em `system_message`, convertido pelo Hermes em prompt efêmero da run; ele não entra em `message` nem no SessionDB. Um scrub idempotente no startup do `hermes-api` remove exclusivamente blocos técnicos `[MARKETING_OPS_DELEGATION]` persistidos por versões anteriores e preserva o restante das mensagens. Se o JWT expirar durante o raciocínio do Hermes, o Marketing Ops faz um único pedido interno autenticado ao Bridge. A renovação só ocorre enquanto a run pai estiver `running`, dentro da janela máxima configurada, com usuário, tenant, papel, sessão e correlação idênticos; o `jti` é preservado para não enfraquecer o anti-replay. O Marketing Ops então verifica novamente assinatura, key id, issuer, audience, janela temporal, scopes, membership atual e replay antes de qualquer acesso de domínio.

### Domínio transacional

Entidades iniciais:

- `tenants` e `memberships`;
- `campaigns` e `campaign_members`;
- `campaign_items`;
- `audit_events` append-only;
- `domain_events` como outbox;
- `idempotency_records`;
- `delegation_uses` para anti-replay;
- `schema_versions` para diagnóstico.

Campanhas e itens usam `version bigint`. Updates exigem a versão observada e retornam `version_conflict` quando obsoletos. Toda mutação grava entidade, auditoria, evento e idempotência na mesma transação. Erro em qualquer etapa reverte tudo.

### RBAC

| Operação | Member | Manager | Admin |
|---|---:|---:|---:|
| Criar campanha draft | sim | sim | sim |
| Ler campanha participante | sim | sim | sim |
| Editar draft participante | sim | sim | sim |
| Listar campanhas do tenant | apenas participantes | todas | todas |
| Arquivar campanha | não | sim | sim |
| Criar/editar item draft permitido | sim | sim | sim |
| Ler auditoria | não | tenant | todos os tenants autorizados |
| Gerenciar membership/configuração | não | não | sim |

RLS replica as fronteiras essenciais. Funções auxiliares `SECURITY DEFINER`, quando necessárias para evitar recursão de membership, ficam em schema privado, têm `search_path` fixo, `EXECUTE` revogado de `PUBLIC` e testes negativos.

## Contratos REST

- `GET /health` — liveness sem dependência externa;
- `GET /ready` — configuração e banco;
- `GET /v1/capabilities` — versões e flags;
- `GET /metrics` — métricas Prometheus com autenticação interna;
- `GET/POST /v1/campaigns`;
- `GET/PATCH /v1/campaigns/:id`;
- `POST /v1/campaigns/:id/archive`;
- `GET/POST /v1/campaigns/:id/items`;
- `PATCH /v1/campaigns/:campaignId/items/:itemId`;
- `GET /v1/audit-events`.

Mutações exigem `Idempotency-Key`; todas aceitam/retornam `X-Correlation-Id`. Paginação é por cursor, com limite máximo. Filtros iniciais cobrem status, curso, owner e período.

## Contratos MCP

- `marketing_ops_health`;
- `marketing_ops_capabilities`;
- `marketing_ops_list_campaigns`;
- `marketing_ops_get_campaign`;
- `marketing_ops_create_campaign_draft`;
- `marketing_ops_update_campaign_draft`;
- `marketing_ops_create_item_draft`.

Health/capabilities não recebem autoridade de negócio. Todas as tools de domínio exigem delegação; mutações também exigem idempotency key e scope específico. REST e MCP chamam os mesmos comandos/queries.

## Erros

O envelope estável contém `code`, `message`, `correlation_id` e `details` seguros. Códigos principais: `unauthorized`, `forbidden`, `tenant_required`, `tenant_not_allowed`, `validation_failed`, `not_found`, `idempotency_conflict`, `version_conflict`, `delegation_invalid`, `delegation_expired`, `delegation_replay`, `rate_limited`, `payload_too_large`, `dependency_unavailable` e `internal_error`.

## Segurança

- deny-by-default para CORS, RLS, grants e scopes;
- payload máximo e rate limiting por ator/IP;
- queries parametrizadas;
- nenhum secret em bundle, respostas ou logs;
- `audit_events` e `domain_events` sem update/delete por clientes;
- schema privado fora da Data API por padrão;
- grants explícitos na mesma migration;
- service role nunca enviada ao navegador;
- keyring aceita chave ativa e anterior durante rotação;
- delegações técnicas não são persistidas no histórico; blocos legados são removidos seletivamente no startup;
- flags não substituem autorização.

## Observabilidade

Logs JSON incluem serviço, versão, request ID, correlation ID, origem, rota/tool, status, duração, tenant e ator quando permitido. Métricas incluem requests, latência, erros, negações, conflitos, idempotency hits, delegações rejeitadas e outbox pendente. Tokens, payloads completos, bearer e PII desnecessária são redigidos.

## Testes e gates

- unitários para config, erros, RBAC, hash, idempotência, versão e delegação;
- pgTAP para schema, constraints, grants, RLS, imutabilidade e cross-tenant;
- integração com Supabase local descartável;
- contrato OpenAPI e MCP;
- API e MCP lendo o mesmo registro;
- falha injetada provando rollback sem audit/event órfão;
- hardening negativo da Bridge;
- Compose local, health/readiness, restart e persistência;
- audit de dependências e verificação de bundle;
- runbook local/VPS, backup e rollback.

## Rollback

O serviço nasce atrás de flags desligadas. Rollback de aplicação para a imagem anterior não remove dados. O schema é aditivo; uma falha antes de tráfego usa restore do backup ou forward fix. Limpeza de legado só é aplicada depois de dump validado e possui restauração da quarentena. Nenhum rollback apaga migrations já registradas.
