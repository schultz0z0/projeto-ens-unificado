# ADR 0001 — Limite do serviço Marketing Ops

- **Status:** `accepted`
- **Data:** 2026-07-10
- **Decisor:** responsável do produto
- **Fases afetadas:** 1–8

## Contexto

O Nexus AI já possui frontend, Chat Bridge, Hermes, RAG, Graph, Artifact Server e serviços de geração. A evolução para uma Central de Operações de Marketing precisa de regras transacionais para campanhas, versões, approvals, autorização e execução. Colocar essas regras na Chat Bridge misturaria transporte conversacional com domínio; mantê-las apenas no frontend permitiria contornar autorização; colocá-las no Hermes faria do agente uma fonte de verdade não determinística.

## Decisão

Criar um serviço/container próprio chamado `marketing-ops`, com:

- API autenticada para o frontend;
- servidor MCP para o Hermes;
- uma camada de domínio compartilhada entre API e MCP;
- autorização server-side, idempotência, auditoria e outbox;
- acesso transacional ao Supabase;
- health/readiness checks e correlação ponta a ponta.

A Chat Bridge continuará responsável por sessões, runs, SSE, anexos, artefatos e approval técnico do Hermes. Ela poderá transportar links/deep links para objetos do Marketing Ops, mas não possuirá seu CRUD nem suas regras.

## Alternativas consideradas

1. **Adicionar o domínio à Chat Bridge:** rejeitada por acoplamento, blast radius e mistura de responsabilidades.
2. **Frontend acessar novas tabelas diretamente:** rejeitada como interface principal porque duplica regras e enfraquece auditoria/idempotência.
3. **Hermes gravar diretamente no Supabase:** rejeitada porque prompts e tool calls não constituem autoridade operacional.
4. **Usar n8n como orquestrador central:** rejeitada; integrações pontuais podem existir, mas o domínio permanece no serviço.

## Consequências

### Positivas

- frontend e Hermes usam as mesmas regras;
- domínio pode ser testado sem runtime do agente;
- falhas de chat não derrubam CRUD operacional;
- workers futuros recebem contratos determinísticos.

### Custos e riscos

- novo container, pipeline, observabilidade e owner;
- autenticação/delegação entre Bridge, Hermes e MCP precisa ser implementada;
- o frontend manterá dois caminhos de backend: Bridge para chat e Marketing Ops para operação.

### Restrições de implementação

- não reutilizar as tabelas históricas `campaigns`/`market_*` como atalho;
- começar aditivo e protegido por feature flag;
- nenhuma execução externa direta no processo do Hermes ou da API web.
