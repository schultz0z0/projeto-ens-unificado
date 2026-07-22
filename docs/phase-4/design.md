# Design — Fase 4 Hermes Campaign Operator

- **Data:** 2026-07-22
- **Estado:** `approved_baseline`
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
- transformação de briefing em calendário/checklist e de resposta do chat em
  conteúdo versionado;
- revisão pelo tom de voz ENS, fundamentada no RAG;
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
- rate limit MCP por ator e ferramenta, além do limite HTTP por origem;
- contratos E2E explícitos para RAG, Graph, tom ENS e conversão do chat em
  objeto operacional.

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

### 4.4 Schema aditivo de rastreabilidade

A correlação atual somente por `correlation_id` não fecha F4-RF-11. A fase terá
uma migration aditiva em `marketing_ops.audit_events` com campos opcionais para
`operator_origin`, `chat_session_id`, `run_id`, `tool_name`, `tool_call_id`,
`plan_id` e `plan_action_index`.

Regras:

- `origin='mcp'` identifica o transporte;
- `operator_origin='hermes'` identifica o operador conversacional;
- cada invocação MCP recebe `tool_call_id` UUID gerado pelo `marketing-ops`;
- leituras registram tool/chat/run/correlação sem persistir conteúdo integral;
- ações de plano registram também `plan_id` e `plan_action_index`;
- chamadas REST existentes permanecem compatíveis com os campos nulos.

### 4.5 RAG, Graph e tom de voz ENS

- fatos institucionais, de curso, oferta e tom de voz são consultados no RAG
  antes de o Hermes afirmar ou incorporar esses fatos;
- o Graph é consultado quando a solicitação envolver relações ou trabalhos
  validados; ausência de relação aplicável deve ser informada e não autoriza
  usar o Graph como fonte transacional;
- estado de campanha, agenda, item, conteúdo e versão sempre vem do MCP do
  `marketing-ops`;
- revisão pelo tom ENS produz primeiro uma proposta com referências mínimas;
  salvar a revisão cria nova versão em rascunho somente após o fluxo de plano e
  confirmação em turno posterior.

### 4.6 Encerramento das mutações diretas legadas

As tools legadas `marketing_ops_create_campaign_draft_v1`,
`marketing_ops_update_campaign_draft_v1` e
`marketing_ops_create_campaign_item_draft_v1` serão retiradas do catálogo MCP.
O domínio REST continua intacto. Testes de contrato e runtime devem provar que
nenhuma mutação MCP é possível fora de `prepare_plan_v1` e `execute_plan_v1`.

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
- o Graph é usado quando relações/memória validada forem necessárias, nunca
  para estado transacional;
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

O catálogo publicado não inclui as três tools diretas legadas descritas em
4.6. Compatibilidade será mantida apenas na camada de domínio/REST.

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
- `completed[]` com `action_index`, `action_type`, recurso real e
  `idempotency_hit`;
- `failed[]` com `action_index`, `action_type`, código e mensagem segura;
- `pending[]` com ações não executadas e motivo `dependency_failed`;
- `deep_links[]` por recurso confirmado.

Semântica de execução:

- cada ação é uma transação atômica no domínio;
- ações independentes continuam após falha de outra ação;
- ação que referencia recurso cuja criação falhou não executa e vira `pending`;
- status final é `completed` sem falhas, `partial` com qualquer combinação de
  sucesso e falha/pending, e `failed` quando nenhuma ação conclui;
- retry do mesmo plano reexecuta a lista inteira com as mesmas chaves
  idempotentes; ações concluídas retornam hit e não duplicam objetos.

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

O trecho anexado é limitado a 2.000 caracteres, separado por uma quebra de
linha quando já houver nota e sujeito ao limite canônico de 10.000 caracteres.
Exceder o limite falha sem alterar a nota.

### 8.8 Briefing → calendário e checklist

O Hermes lê a campanha e o período atuais, consulta o RAG quando houver fatos
institucionais e propõe uma lista de `campaign_item.create`. A proposta deve
exibir título, tipo, canal, responsável quando conhecido e datas. Nada é
persistido antes da confirmação do plano completo.

### 8.9 Resposta do chat, conteúdo e revisão ENS

Salvar uma resposta/copy do chat exige item alvo explícito. O plano usa
`content.create_draft` e `content.version_create`; a versão guarda somente
referências mínimas de origem (`chat_session_id`, `run_id` e referências RAG),
nunca tokens. Revisão de tom segue o mesmo fluxo e sempre cria nova versão,
sem sobrescrever uma versão anterior.

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

Rotas congeladas:

| Recurso | `href` | `open_in` |
|---|---|---|
| campanha | `/marketing-ops/campaigns/{campaign_id}` | `campaign_workspace` |
| item | `/marketing-ops/production/items/{item_id}` | `campaign_item` |
| conteúdo | `/marketing-ops/production/items/{item_id}?contentAssetId={asset_id}` | `content_asset` |

IDs são UUIDs validados e o frontend deve rejeitar qualquer rota fora desses
templates.

## 10. Segurança

- delegação curta, escopada e validada server-side;
- nenhum papel, tenant ou versão confiado ao modelo;
- descrição de tool pequena e schema estrito;
- conteúdo, URLs e artifacts tratados como dados não confiáveis;
- instruções contidas em briefing, notas, conteúdo, RAG, Graph ou artifact não
  alteram papel, scope, confirmação nem seleção de tools;
- mutações administrativas continuam fora do escopo;
- retry só com idempotência derivada de plano/ação;
- nenhuma mutação direta liberada no runtime do Hermes.
- o limite HTTP por IP continua ativo e cada tool MCP aplica também janela de
  60 segundos por `actor_user_id + tool_name`: 60 leituras, 20 prepares e 10
  executes; excesso retorna `rate_limited` e `retry_after_seconds`;
- logs e auditoria guardam IDs, códigos, tamanho e hash quando necessário, sem
  texto integral de briefing, copy, nota, conteúdo ou token.

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
- `tool_call_id` é UUID gerado pelo `marketing-ops` em cada invocação;
- `tool_name`, `operator_origin='hermes'`, `plan_id` e `plan_action_index`
  aparecem na auditoria aplicável;
- os mesmos identificadores aparecem no resultado seguro da tool e nos logs
  estruturados, permitindo chat → run → tool → audit → objeto.

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
- deep link apontando para o objeto correto;
- delegação expirada e replay rejeitados;
- rate limit independente por ator e tool;
- prompt injection em briefing/conteúdo incapaz de ampliar autoridade;
- logs sem texto integral ou tokens;
- briefing convertido em calendário/checklist após confirmação;
- resposta do chat convertida em versão vinculada;
- revisão pelo tom ENS fundamentada no RAG;
- Graph consultado em cenário relacional e nunca usado como estado atual.

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

A Fase 4 está pronta para começar porque:

- este design foi aceito como baseline técnico em 2026-07-22;
- o plano datado da fase foi reconciliado com Roadmap e PRD;
- a superfície de tools, ações, deep links e resultados está congelada;
- a migration aditiva e a estratégia de correlação estão decididas;
- segurança, jornadas e gates possuem critérios rastreáveis.
