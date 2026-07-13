# PRD — Fase 1: Fundação do Marketing Ops

- **Status:** ready_for_production
- **Dependência:** Fase 0 concluída
- **Resultado:** domínio operacional seguro e compartilhado pelo frontend e pelo Hermes

## Resumo

Esta fase cria o serviço `marketing-ops`, o modelo transacional mínimo e os controles transversais necessários para todas as funcionalidades futuras. Ela entrega fundação e contratos, não uma experiência completa de campanhas.

## Problema

O frontend e o Hermes ainda não possuem uma camada comum para operar campanhas. Colocar regras na Chat Bridge aumentaria acoplamento; acessar tabelas diretamente por múltiplos clientes poderia produzir autorização e comportamento divergentes.

## Objetivos

- criar um domínio único de operações de marketing;
- expor API autenticada para o frontend e MCP para o Hermes;
- garantir tenant, RBAC, RLS e auditoria;
- propagar o ator de forma confiável;
- padronizar idempotência, concorrência e erros;
- instrumentar eventos desde o início;
- permitir evolução segura para workspace, aprovações e execução.

## Não objetivos

- entregar todas as telas do workspace;
- criar calendário completo;
- permitir disparos;
- implementar aprovação editorial;
- criar dashboards;
- mover responsabilidades de streaming para o Marketing Ops.

## Usuários

- frontend Nexus AI;
- Hermes por meio do MCP;
- desenvolvedores e operadores;
- futuros workers;
- administradores responsáveis por diagnóstico.

## Capacidades funcionais

### F1-RF-01 — Serviço independente

O monorepo deve conter um serviço/container `marketing-ops` com health check, configuração validada, encerramento gracioso e rede interna definida.

### F1-RF-02 — API autenticada

A API deve validar JWT Supabase e resolver servidor-side `user_id`, `tenant_id` e papel. Identificadores enviados pelo navegador não substituem a identidade autenticada.

### F1-RF-03 — Interface MCP

O MCP deve expor ferramentas versionadas para a evolução do domínio. Nesta fase, ferramentas mínimas de health, capacidades e leitura/escrita de registros de teste controlados são suficientes para validar o contrato.

### F1-RF-04 — Delegação do Hermes

Chamadas de mutação originadas pelo Hermes devem carregar contexto assinado, curto, não reutilizável fora do escopo e correlacionado à sessão/run. A delegação é contexto técnico efêmero e não pode ser persistida no histórico conversacional.

### F1-RF-05 — Modelo transacional

Criar schemas iniciais para campanhas, participantes, auditoria, eventos e idempotência, deixando extensões de itens e conteúdo para as fases correspondentes quando apropriado.

### F1-RF-06 — Tenant

Todas as entidades do domínio devem possuir tenant confiável. Consultas e constraints devem impedir leitura ou mutação cruzada.

### F1-RF-07 — Papéis

Aplicar matriz `member`, `manager` e `admin` com negação por padrão. A fonte do papel é o perfil validado, não o argumento da requisição.

### F1-RF-08 — RLS

Habilitar RLS em todas as tabelas acessíveis por clientes autenticados. Service role será limitada a serviços internos e nunca enviada ao frontend.

### F1-RF-09 — Auditoria

Toda mutação deve gerar registro append-only com ator, papel, tenant, origem, entidade, ação, estado anterior/novo quando permitido, correlation ID e timestamp.

### F1-RF-10 — Idempotência

Comandos mutáveis aceitam chave de idempotência. Repetições com mesmo ator, operação e payload devolvem o resultado anterior; payload diferente gera conflito.

### F1-RF-11 — Concorrência otimista

Entidades mutáveis possuem versão. Update com versão obsoleta retorna conflito explícito.

### F1-RF-12 — Eventos de domínio

Mutação e evento são confirmados na mesma transação. Eventos possuem tipo, versão, aggregate ID, tenant e correlation ID.

### F1-RF-13 — Contrato de erros

Erros devem ter código estável, mensagem segura, status HTTP/MCP, correlation ID e detalhes de campo quando aplicável.

### F1-RF-14 — Capacidades

API e MCP devem informar versão e capacidades habilitadas para permitir rollout compatível.

## Modelo inicial

### `campaigns`

Campos mínimos: `id`, `tenant_id`, `name`, `status`, `version`, `created_by`, `updated_by`, `created_at`, `updated_at`, `archived_at`.

### `campaign_members`

Campos mínimos: `campaign_id`, `user_id`, `member_role`, `created_by`, `created_at`.

### `audit_events`

Campos mínimos: `id`, `tenant_id`, `actor_user_id`, `actor_role`, `actor_type`, `origin`, `entity_type`, `entity_id`, `action`, `before`, `after`, `correlation_id`, `created_at`.

### `domain_events`

Campos mínimos: `id`, `tenant_id`, `aggregate_type`, `aggregate_id`, `event_type`, `event_version`, `payload`, `correlation_id`, `occurred_at`, `published_at`.

### `idempotency_records`

Campos mínimos: `tenant_id`, `actor_id`, `operation`, `key`, `request_hash`, `response_ref`, `status`, `expires_at`.

Campos finais e SQL serão decididos no design técnico, mantendo estes invariantes.

## Permissões mínimas

| Ação | Member | Manager | Admin |
|---|---:|---:|---:|
| Ler campanha da qual participa | Sim | Sim | Sim |
| Criar rascunho | Sim | Sim | Sim |
| Editar rascunho permitido | Sim | Sim | Sim |
| Arquivar | Não por padrão | Sim | Sim |
| Consultar auditoria ampla | Não | Escopo gerenciado | Sim |
| Configurar serviço | Não | Não | Sim |

## Segurança

- JWT validado contra Supabase;
- delegação assinada para MCP;
- anti-replay e expiração;
- transporte efêmero da delegação, sem token no histórico do Hermes;
- allowlist de origins;
- limites de payload;
- rate limiting;
- logs sem secrets ou conteúdo sensível desnecessário;
- queries parametrizadas;
- RLS validada com testes negativos;
- acesso interno autenticado.

## Observabilidade

- health e readiness separados quando necessário;
- logs estruturados;
- `correlation_id` em todas as camadas;
- métricas de latência, erro, autorização negada, conflito e idempotência;
- versão do serviço e schema no diagnóstico;
- alertas básicos de indisponibilidade.

## Critérios de aceite

- [x] Container sobe localmente e responde health/readiness.
- [x] API rejeita token ausente, inválido ou expirado.
- [x] Tenant enviado pelo cliente não permite acesso cruzado.
- [x] Matriz de papéis possui testes positivos e negativos.
- [x] MCP lê o mesmo registro criado pela API.
- [x] Mutação MCP exige delegação válida.
- [x] Idempotência impede duplicidade.
- [x] Versão obsoleta gera conflito, sem sobrescrita.
- [x] Auditoria e evento são gravados na mesma transação.
- [x] Falha transacional não deixa evento órfão.
- [x] Logs permitem rastrear API/MCP até o banco.
- [x] Nenhum secret aparece no bundle do frontend.
- [x] Migrations possuem caminho de rollback validado.

## Testes

### Unitários

Schemas, matriz de permissão, assinatura/expiração, idempotência, concorrência e erros.

### Banco

Migrations limpas, upgrade, constraints, índices, RLS, tenant, papéis e rollback.

### Contrato

OpenAPI ou equivalente, schemas MCP, eventos e compatibilidade de versão.

### Integração

API e MCP sobre a mesma entidade, transação/auditoria/evento e falhas do Supabase.

### Segurança

Token inválido, tenant forjado, papel forjado, delegação expirada, replay, mass assignment e payload excessivo.

## Gate local

- build/lint/typecheck/testes verdes;
- Compose com Marketing Ops saudável;
- migrations e rollback;
- testes de API/MCP/RLS;
- reinício preservando dados;
- diagnóstico e logs;
- documentação de env atualizada.

## Gate VPS

- imagem Linux construída;
- serviço saudável na rede interna;
- secrets presentes sem exposição;
- migrations confirmadas;
- frontend e Hermes alcançam o serviço;
- volume/restart verificados;
- smoke com usuários de teste dos três papéis;
- rollback testável.

## Riscos

| Risco | Mitigação |
|---|---|
| Serviço duplicar regras do banco | Definir invariantes e testes de contrato |
| Contexto MCP forjável | Delegação assinada e anti-replay |
| RLS divergir da API | Matriz única e suíte cruzada |
| Auditoria armazenar dados sensíveis | Redação e allowlist de campos |
| Infra antecipada demais | Implementar apenas capacidades consumidas pela Fase 2 |

## Decisões bloqueantes resolvidas

- serviço em TypeScript/Node.js 22 com Express;
- delegação JWT HS256 curta, versionada, com rotação por `kid` e anti-replay;
- delegação entregue por prompt efêmero da run e scrub seletivo de blocos legados do SessionDB;
- auditoria append-only sem expurgo automático nesta fase;
- publicação inicial por outbox PostgreSQL, preparada para polling futuro.

A matriz completa de decisão e os trade-offs estão em `docs/phase-1/design.md`.

## Gate de saída

O gate local está aprovado e a fundação está `ready_for_production`, permitindo preparar a Fase 2 sem ativar superfícies de usuário. A homologação VPS já confirmou probes, criação, leitura, atualização, auditoria/outbox, persistência após restart e os passos 13 e 14 do transporte efêmero, com zero delegações novas no SessionDB. Restam os testes manuais 15–20; a Fase 1 só fica `completed` após o fechamento registrado em `docs/phase-1/vps-validation.md`.
