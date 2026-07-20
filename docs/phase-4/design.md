# Design — Fase 4 Hermes Campaign Operator

- **Data:** 2026-07-20
- **Estado:** `planned`
- **Dependência:** Fase 3 `production_validated`
- **PRD base:** [phase-4-hermes-campaign-operator.md](../prds/phase-4-hermes-campaign-operator.md)

## 1. Objetivo

Conectar o Hermes ao `marketing-ops` por MCP para que o agente leia campanhas,
agenda, timeline e conteúdo reais, e execute mutações controladas sobre esses
mesmos objetos sem acesso direto ao banco e sem contornar confirmação humana.

## 2. Limites desta fase

Inclui:

- leitura MCP do estado operacional atual;
- mutações planejadas e confirmadas para rascunhos, itens, conteúdo, artefatos
  e notas;
- deep link para frontend e retorno estruturado de sucesso/parcial/falha;
- correlação ponta a ponta entre Hermes, MCP e auditoria.

Não inclui:

- aprovação editorial, institucional ou operacional;
- publicação, disparo, execução externa ou workers;
- concessão de permissões ou papel ampliado;
- acesso direto do Hermes ao Supabase;
- substituição das telas por conversa.

## 3. Baseline herdado

### 3.1 O que já existe

- `marketing_ops_capabilities_v1`, `marketing_ops_list_campaigns_v1`,
  `marketing_ops_get_campaign_v1`, `marketing_ops_prepare_plan_v1`,
  `marketing_ops_execute_plan_v1`,
  `marketing_ops_create_campaign_draft_v1`,
  `marketing_ops_update_campaign_draft_v1`,
  `marketing_ops_create_campaign_item_draft_v1` e `marketing_ops_list_audit_v1`
  já existem no MCP atual.
- A Fase 3 já entregou domínio e REST para agenda canônica, timeline,
  conteúdo versionado e artifacts.
- O fork do Hermes já possui:
  `marketing-ops-operator` como skill;
  binding automático da delegação do turno atual;
  binding do último `plan_token` preparado;
  bloqueio de mutações diretas fora de `prepare_plan_v1` e
  `execute_plan_v1`.

### 3.2 Lacunas reais da Fase 4

- leituras MCP para agenda, timeline, conteúdo e capacidades por objeto;
- ampliação do plano assinado para novas mutações do domínio;
- retorno com deep links e resultados mais ricos para o operador;
- trilha de correlação mais explícita entre run do chat e auditoria do
  `marketing-ops`.

## 4. Decisões técnicas

### 4.1 Fonte única de verdade

O `marketing-ops` permanece a única fonte transacional. O Hermes consulta o
MCP do serviço e nunca o Supabase diretamente.

### 4.2 Leituras diretas, escritas via plano assinado

Leituras MCP continuam diretas. Escritas não serão expostas como tools
mutáveis de baixo nível; o catálogo de escrita do PRD será implementado como
novos tipos de ação aceitos por `marketing_ops_prepare_plan_v1` e executados
por `marketing_ops_execute_plan_v1`.

Essa decisão preserva:

- confirmação em turno posterior;
- bloqueio local no runtime;
- revalidação backend da delegação e do plano;
- idempotência por ação e por plano;
- defesa em profundidade já validada desde a Fase 1.

### 4.3 Sem nova fonte de dados para notas

`campaign_note_add` não introduz nova tabela nesta fase. A operação usará o
campo existente `campaigns.notes` com contrato estreito, append-only e
concorrência otimista.

### 4.4 Schema aditivo somente quando a rastreabilidade exigir

O domínio operacional da Fase 4 pode reutilizar quase todo o schema atual. A
única evolução de banco planejada é um bloco aditivo e mínimo de metadados de
correlação em auditoria/eventos caso a correlação atual por `correlation_id`
não seja suficiente para fechar os critérios de aceite do PRD.

## 5. Arquitetura

```text
Frontend Nexus AI
   │ chat / deep link
   ▼
Chat Bridge
   │ JWT usuário + delegação curta + classificação conservadora de confirmação
   ▼
Hermes Runtime / hermes-agent-fork
   │ skill marketing-ops-operator
   │ leituras MCP diretas
   │ prepare_plan / execute_plan
   ▼
Marketing Ops MCP HTTP
   │ mesma camada de domínio do REST
   ▼
Marketing Ops Domain
   │ campanhas, itens, agenda, timeline, conteúdo, artifacts, auditoria
   ▼
Supabase do app
```

Regras arquiteturais:

- o MCP reutiliza a mesma camada de domínio usada pelo REST;
- o Hermes não chama REST do `marketing-ops` diretamente;
- o RAG continua sendo usado para fatos institucionais;
- o Graph continua opcional para relações/memória validada, nunca para estado
  transacional;
- o frontend continua sendo a superfície oficial de navegação do objeto final.

## 6. Catálogo MCP da fase

## 6.1 Leituras

Ferramentas existentes mantidas:

- `marketing_ops_capabilities_v1`
- `marketing_ops_list_campaigns_v1`
- `marketing_ops_get_campaign_v1`

Ferramentas novas planejadas:

- `marketing_ops_list_campaign_items_v1`
- `marketing_ops_get_campaign_timeline_v1`
- `marketing_ops_get_content_v1`
- `marketing_ops_get_object_capabilities_v1`

### 6.1.1 `marketing_ops_list_campaign_items_v1`

Objetivo: expor ao Hermes a agenda canônica da Fase 3.

Contrato planejado:

- filtros opcionais por `campaign_id`, `kind`, `status`, `priority`,
  `assignee_id`, `channel`;
- intervalo obrigatório por `from`/`to`;
- `cursor` e `limit`;
- timezone IANA opcional, com fallback do tenant;
- resposta com itens, paginação, estados derivados e IDs necessários para
  deep link posterior.

Implementação: reaproveitar `listProductionSchedule()`.

### 6.1.2 `marketing_ops_get_campaign_timeline_v1`

Objetivo: permitir que o Hermes leia mudanças relevantes, ator, origem e
`correlation_id` da campanha antes de afirmar histórico recente.

Implementação: reaproveitar o domínio de timeline já entregue na Fase 3.

### 6.1.3 `marketing_ops_get_content_v1`

Objetivo: resumir assets e versões do item sem obrigar o Hermes a conhecer
detalhes REST.

Contrato planejado:

- seletor por `item_id` ou `asset_id`, exatamente um;
- `include_versions` opcional;
- `version_limit` para evitar respostas enormes;
- resposta com assets, versão atual, histórico resumido e artifacts vinculados.

Implementação: reaproveitar `listContentAssets()`, `listContentVersions()` e
`listItemArtifacts()`.

### 6.1.4 `marketing_ops_get_object_capabilities_v1`

Objetivo: substituir um `user_permissions_get` genérico por uma consulta segura
e contextual.

Contrato planejado:

- seletor por `resource_type` (`campaign`, `campaign_item`, `content_asset`);
- `resource_id`;
- retorno com booleans de ações permitidas ao ator atual sobre aquele objeto.

Implementação: combinar matriz de permissões atual com estado do objeto e
autoridade contextual já verificada pelo domínio.

## 6.2 Escritas controladas

O PRD nomeia capacidades de escrita. Nesta fase elas serão representadas como
ações de plano:

- `campaign.create_draft`
- `campaign.update`
- `campaign_item.create`
- `campaign_item.reschedule`
- `content.create_draft`
- `content.version_create`
- `artifact.link_existing`
- `campaign.note_add`

Nenhuma dessas mutações será executável diretamente por uma tool MCP sem o
fluxo `prepare_plan_v1` → confirmação → `execute_plan_v1`.

## 7. Contrato de plano assinado

## 7.1 Expansão do schema

`services/marketing-ops/src/plans/contracts.ts` será ampliado para aceitar os
novos tipos de ação, mantendo:

- `ref` local para dependências intra-plano;
- allowlist estrita de campos;
- limite de ações por plano;
- cálculo de scopes mínimos por ação;
- validação de referências anteriores dentro do mesmo plano.

## 7.2 Resultado do `prepare_plan_v1`

O resultado planejado continua sem persistência de domínio e passa a incluir:

- `plan_token` assinado;
- resumo estruturado por ação;
- recursos alvo previstos;
- riscos de conflito conhecidos;
- indicação se há dependência de confirmação humana.

## 7.3 Resultado do `execute_plan_v1`

O resultado planejado será normalizado para:

- `status`: `completed`, `partial` ou `failed`;
- `completed[]` com recurso real criado/alterado;
- `failed` com erro seguro e item afetado;
- `pending[]` quando houver interrupção parcial;
- `deep_links[]` por recurso confirmado.

## 8. Estratégia por capacidade

### 8.1 `campaign.update`

Usar `updateCampaign()` com patch allowlisted e `expected_version` resolvido
internamente pelo Hermes após leitura.

### 8.2 `campaign_item.create`

Reaproveitar `createCampaignItemDraft()` e o mecanismo já existente de
referência a campanha criada no mesmo plano.

### 8.3 `campaign_item.reschedule`

Reaproveitar o domínio/REST da Fase 3 para reagendamento e edição mínima do
item, com conflito por versão e resultado parcial por item quando em lote.

### 8.4 `content.create_draft`

Mapear para criação de `content_asset` vinculada a item existente, com título e
tipo de asset allowlisted.

### 8.5 `content.version_create`

Mapear para `createContentVersion()` com `freeze` explícito e corpo/metadata
limitados por tamanho e allowlist.

### 8.6 `artifact.link_existing`

Escopo da fase: somente vínculo de artifact já existente no Artifact Server e
já pertencente ao ator/contexto autorizado. Não haverá upload arbitrário por
MCP nesta fase.

### 8.7 `campaign.note_add`

Escopo da fase: append-only em `campaigns.notes`, com delimitação clara do
trecho adicionado pelo Hermes e sem sobrescrever notas existentes sem nova
decisão explícita.

## 9. Deep links

Cada recurso criado/alterado deverá retornar:

- `resource_type`;
- `resource_id`;
- `label`;
- `href` relativo ao frontend;
- `open_in` com a tela prevista (`campaign_workspace`, `campaign_calendar`,
  `content_asset`).

Os deep links serão gerados no `marketing-ops`, não no Hermes, para evitar
divergência entre tool output e roteamento real da aplicação.

## 10. Segurança

- delegação curta, escopada e validada server-side;
- nenhum papel, tenant ou versão confiado ao modelo;
- descrição de tool pequena e schema estrito;
- conteúdo, URLs e artifacts tratados como dados não confiáveis;
- mutações administrativas continuam fora do escopo;
- retry só com idempotência derivada de plano/ação;
- nenhuma mutação direta liberada no runtime do Hermes.

## 11. Observabilidade e auditoria

Métricas planejadas:

- chamadas MCP por ferramenta e resultado;
- negação por scope, papel ou contrato;
- tempo entre `prepare` e `execute`;
- `idempotency_hit`;
- `version_conflict`;
- objetos criados/alterados via Hermes;
- falhas por indisponibilidade do `marketing-ops`.

Rastreabilidade planejada:

- `correlation_id` continua obrigatório;
- `chat_session_id` e `run_id` já vêm da delegação;
- `tool_name`, `plan_id` e `plan_action_index` devem aparecer na trilha de
  auditoria ou em metadados correlacionáveis;
- `tool_call_id` fica condicionado ao que o MCP SDK expuser de forma estável;
  se não houver superfície segura, a fase fecha com `tool_name` + `plan_id` +
  `correlation_id` como identificadores canônicos.

## 12. Testes

O desenho da fase exige testes em quatro níveis:

- contratos MCP e validação de schema;
- domínio e executor de plano para ações novas;
- runtime Hermes para binding, bloqueio e confirmação;
- E2E frontend → bridge → Hermes → MCP → `marketing-ops` → frontend.

Casos obrigatórios:

- leitura autorizada de campanha e agenda;
- campanha/item/conteúdo criados via confirmação;
- conflito de versão com nova leitura e nova confirmação;
- retry idempotente sem duplicidade;
- indisponibilidade do `marketing-ops` sem falso sucesso;
- tentativa de mutação direta bloqueada no runtime;
- tenant/papel forjados rejeitados;
- artifacts não autorizados rejeitados;
- deep link apontando para o objeto correto.

## 13. Gate local

- tools MCP descobertas e documentadas;
- testes MCP, domínio, runtime Hermes e E2E verdes;
- correlação observável entre chat, run, tool e audit;
- redaction de delegação e logs sem segredo;
- rollback de configuração documentado;
- evidência registrada no pacote da fase.

## 14. Gate VPS

- `marketing-ops` e runtime Hermes com MCP configurado persistentemente;
- secrets e refresh de delegação validados;
- rede interna e health checks aprovados;
- smoke com usuários de teste por papel;
- deep links funcionais no ambiente real;
- logs correlacionados e rollback verificável;
- aceite manual do usuário registrado.

## 15. Critério de prontidão para execução

A Fase 4 está pronta para começar quando:

- este design for aceito como baseline técnico;
- o plano datado da fase estiver revisado;
- a superfície inicial de tools e ações estiver congelada;
- a estratégia de auditoria/correlação estiver decidida antes da primeira
  migration ou do primeiro patch de runtime.
