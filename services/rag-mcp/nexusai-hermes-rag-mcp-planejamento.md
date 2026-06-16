# Planejamento NexusAI: Hermes Agent, RAG Multi-Tenant e Operacao Multiagente

Data: 2026-06-10

## Visao Geral

Este documento consolida o plano para transformar o Hermes Agent em uma camada operacional multiagente para a NexusAI, mantendo o Hermes limpo, atualizavel e sem alteracoes no core.

A ideia central e:

- Usar a memoria padrao do Hermes como ela ja existe.
- Usar profiles do Hermes como especialistas internos da NexusAI.
- Usar Kanban e Cron para coordenacao, rotinas e demandas recorrentes.
- Usar um MCP proprio da NexusAI como porta controlada para conhecimento.
- Usar Supabase como base RAG multi-tenant para documentos, contexto e conhecimento pesado.
- Manter o profile principal como CEO/orquestrador, responsavel por distribuir e validar o trabalho.

## Principio de Arquitetura

O Hermes Agent nao deve ser modificado no core para suportar a NexusAI. A inteligencia proprietaria deve viver fora dele, em uma camada separada:

```text
Hermes Agent
  |
  |-- memoria padrao do Hermes
  |-- profiles especialistas
  |-- skills NexusAI
  |-- Kanban / Cron
  |
  v
NexusAI RAG MCP
  |
  |-- valida contexto ativo
  |-- aplica politicas de tenant
  |-- executa busca hibrida
  |-- retorna fontes e evidencias
  |
  v
Supabase
  |-- Postgres
  |-- pgvector
  |-- full-text search
  |-- documentos
  |-- chunks
  |-- metadados
  |-- politicas de acesso
```

Essa separacao permite atualizar o Hermes normalmente sem perder customizacoes. A NexusAI evolui como uma camada propria, versionada e controlada separadamente.

## Papel da Memoria do Hermes

A memoria do Hermes deve seguir o comportamento padrao do proprio Hermes.

Ela continua sendo usada para:

- Identidade do usuario e da NexusAI.
- Preferencias de comunicacao.
- Aprendizados recorrentes.
- Decisoes permanentes.
- Continuidades curtas, medias e longas conforme o uso normal do Hermes.
- Historico e busca de sessoes, quando aplicavel.

Ela nao deve ser usada como base documental pesada.

Nao devem ficar na memoria nativa do Hermes:

- PDFs inteiros.
- Briefings longos.
- Documentos de cliente.
- Propostas extensas.
- Bases de conhecimento completas.
- Historicos documentais grandes.
- Dados especificos de varios clientes misturados.

Esses dados pertencem ao RAG da NexusAI.

## Profiles como Especialistas

Os profiles nao devem ser organizados principalmente por cliente. A melhor abordagem e organiza-los por papel/especialidade dentro da operacao da NexusAI.

O profile default funciona como CEO/orquestrador.

Profiles planejados:

```text
default / ceo
strategy-specialist
marketing-specialist
dev-specialist
saas-architect
agent-builder
researcher
copywriter
qa-reviewer
ops-automation
```

Cada profile pode ter:

- Persona propria.
- Skills especificas.
- Toolsets adequados ao papel.
- Memoria Hermes propria.
- Responsabilidades claras.
- Forma propria de entregar handoffs.

## Papel do CEO / Orquestrador

O CEO e o profile principal da NexusAI.

Responsabilidades:

- Receber demandas.
- Interpretar prioridade e objetivo.
- Criar tarefas no Kanban.
- Delegar para especialistas.
- Revisar handoffs.
- Pedir ajustes.
- Validar entregas finais.
- Decidir o que vai para o cliente.
- Manter coerencia estrategica da NexusAI.

O CEO nao precisa executar tudo. Ele coordena, valida e decide.

## Papel dos Especialistas

Especialistas executam tarefas dentro de sua area.

Exemplos:

```text
strategy-specialist:
  posicionamento, oferta, funil, diagnostico, crescimento.

marketing-specialist:
  campanhas, calendario editorial, anuncios, copy, canais.

dev-specialist:
  implementacao, sites, apps, integracoes, correcoes.

saas-architect:
  arquitetura de produtos SaaS, multi-tenant, banco, APIs.

agent-builder:
  desenho de agentes, prompts, skills, MCPs, workflows.

researcher:
  pesquisa, benchmarking, levantamento de informacoes.

qa-reviewer:
  revisao tecnica, validacao, riscos, consistencia.
```

Cada especialista acessa o conhecimento por meio do MCP, nunca diretamente pelo banco.

## Kanban como Sistema Operacional Multiagente

O Kanban do Hermes deve ser usado como camada de coordenacao entre profiles.

Fluxo ideal:

```text
CEO recebe demanda
CEO cria task Kanban
Especialista executa
Especialista registra handoff
Reviewer valida quando necessario
CEO revisa estrategicamente
CEO aprova entrega final
```

Casos de uso:

- Planejamento de campanha.
- Desenvolvimento de site.
- Pesquisa de mercado.
- Criacao de SaaS.
- Criacao de agente IA.
- Auditoria de cliente.
- Revisao semanal de performance.
- Propostas comerciais.
- Diagnostico estrategico.

O Kanban e especialmente util porque tarefas sao duraveis, podem sobreviver a reinicios, permitem comentarios, handoffs, dependencias e reexecucao por outro profile.

## Cron como Rotina Operacional

Cron deve ser usado para rotinas recorrentes.

Exemplos:

```text
daily marketing scan
weekly client report
monthly strategy review
daily lead review
nightly codebase health check
weekly content calendar
weekly SaaS backlog grooming
monthly NexusAI strategy review
```

Cron nao precisa tomar decisoes finais sozinho. Ele pode criar tarefas, iniciar analises ou acionar o CEO/orquestrador.

Modelo recomendado:

```text
Cron dispara rotina
  -> cria ou atualiza task
  -> especialista executa
  -> CEO valida
```

## Skills NexusAI

As skills ensinam comportamento, processo e padroes de trabalho. Elas nao devem armazenar a base documental completa.

Skills planejadas:

```text
nexusai-operating-system
client-strategy
marketing-planner
saas-builder
agent-builder
rag-client-workflow
kanban-ceo-orchestration
specialist-handoff-standard
```

### nexusai-operating-system

Define como o Hermes deve pensar e operar pela NexusAI.

Conteudos:

- Missao da NexusAI.
- Forma de trabalhar.
- Padrao de qualidade.
- Tom de comunicacao.
- Como equilibrar estrategia, marketing e tecnologia.
- Como lidar com clientes.
- Como decidir quando delegar.

### rag-client-workflow

Ensina quando e como consultar o RAG.

Regras:

- Buscar fontes antes de responder sobre cliente.
- Declarar tenant/contexto ativo.
- Nao misturar clientes.
- Citar fontes quando a resposta depender de documentos.
- Dizer quando nao ha informacao suficiente.

### kanban-ceo-orchestration

Ensina o CEO a quebrar demandas em tarefas.

Regras:

- Criar tarefas pequenas e claras.
- Delegar por especialidade.
- Definir criterio de sucesso.
- Exigir handoff com evidencias.
- Validar antes de entregar.

### specialist-handoff-standard

Define padrao de entrega dos especialistas.

Formato sugerido:

```text
Resumo
Fontes usadas
Decisoes tomadas
Riscos
Pendencias
Proxima acao recomendada
```

## Supabase RAG Multi-Tenant

O Supabase sera a base pesada de conhecimento.

Ele armazena:

- Conhecimento da NexusAI.
- Briefings de clientes.
- Documentos.
- Propostas.
- PDFs.
- Historico de decisoes.
- Tom de voz.
- Produtos e ofertas.
- Conteudo de sites.
- Materiais comerciais.
- Bases tecnicas.
- Referencias de projetos.

## Modelo de Tenants

Tenants representam escopos de conhecimento.

Exemplos:

```text
nexusai
cliente_acme
cliente_beta
cliente_gamma
```

O tenant `nexusai` e a base comum da empresa. Clientes sao escopos isolados.

Regra principal:

```text
Um trabalho para cliente X pode consultar:
  - nexusai
  - cliente_x

Um trabalho para cliente X nao pode consultar:
  - cliente_y
  - cliente_z
```

## Schema Conceitual

Tabelas principais:

```text
tenants
  id
  slug
  name
  type
  status
  created_at

documents
  id
  tenant_id
  title
  source_type
  source_uri
  visibility
  metadata
  created_at
  updated_at

document_chunks
  id
  tenant_id
  document_id
  content
  embedding
  fts
  metadata
  created_at

rag_queries
  id
  actor_profile
  active_client
  allowed_tenants
  query
  purpose
  result_count
  created_at

rag_audit_events
  id
  actor_profile
  action
  tenant_id
  document_id
  allowed
  reason
  created_at
```

## Busca Hibrida

A busca deve combinar:

- Vetores com pgvector.
- Full-text search com tsvector.
- Filtros por tenant.
- Filtros por metadados.
- Reranking ou Reciprocal Rank Fusion.

Por que hibrida:

- Vector search entende significado.
- Full-text encontra nomes exatos, termos tecnicos, produtos, erros e marcas.
- Metadata filters garantem contexto e isolamento.
- Reranking melhora relevancia.

## MCP NexusAI RAG

O MCP e a porta oficial entre Hermes e Supabase.

O Hermes nao deve acessar o banco diretamente.

Ferramentas planejadas:

```text
nexus_rag_search(query, client_id, purpose, limit)
nexus_rag_ingest(tenant_id, source, metadata)
nexus_rag_list_sources(tenant_id)
nexus_rag_get_document(document_id)
nexus_rag_set_active_client(client_id)
nexus_rag_context_status()
nexus_rag_audit_recent()
```

## Politica de Isolamento no MCP

O MCP sempre calcula tenants permitidos antes da busca.

Exemplo:

```text
profile = marketing-specialist
active_client = cliente_acme

allowed_tenants = ["nexusai", "cliente_acme"]
```

Se uma chamada tentar consultar outro cliente:

```text
requested_tenant = cliente_beta
```

O MCP deve negar antes de consultar o banco.

Resposta esperada:

```text
Access denied: tenant cliente_beta is outside the active task scope.
```

## Controle do CEO

O CEO pode ter permissao ampla, mas ainda assim deve operar com contexto explicito.

Boa regra:

```text
CEO pode consultar todos os tenants, mas precisa declarar o tenant alvo ou modo admin.
```

Isso evita mistura acidental.

Mesmo o CEO deve receber respostas com identificacao clara:

```text
Fonte: nexusai
Fonte: cliente_acme
Fonte: cliente_beta
```

## Fluxo Completo de Trabalho

```text
1. Usuario envia demanda para o CEO
2. CEO identifica objetivo, cliente e tipo de trabalho
3. CEO define active_client quando houver cliente
4. CEO cria tarefas no Kanban
5. Especialistas recebem tasks
6. Especialistas consultam MCP RAG
7. MCP valida allowed_tenants
8. MCP busca no Supabase
9. Especialistas entregam handoff com fontes
10. QA/reviewer valida quando necessario
11. CEO revisa e aprova
12. CEO entrega resposta final ao usuario/cliente
```

## Exemplo de Demanda

Demanda:

```text
Criar estrategia de marketing para Cliente Acme no proximo trimestre.
```

Fluxo:

```text
CEO:
  define active_client = cliente_acme
  cria tasks:
    - researcher: levantar contexto do cliente e mercado
    - marketing-specialist: propor campanhas
    - copywriter: criar mensagens principais
    - qa-reviewer: revisar coerencia e riscos

Especialistas:
  consultam nexusai + cliente_acme
  nao acessam outros clientes

CEO:
  consolida
  ajusta estrategia
  aprova entrega final
```

## Roadmap de Implementacao

### Fase 1: Definicao Estrategica

- Definir papeis dos profiles.
- Definir responsabilidades do CEO.
- Definir padrao de handoff.
- Definir taxonomia de conhecimento.
- Definir politica de isolamento.

### Fase 2: Modelagem RAG

- Definir tenants iniciais.
- Definir schema Supabase.
- Definir metadados obrigatorios.
- Definir tipos de documentos.
- Definir estrategia de chunking.
- Definir embeddings.
- Definir busca hibrida.

### Fase 3: MCP MVP

- Criar MCP com busca.
- Criar controle de contexto ativo.
- Criar validacao de tenants.
- Criar ingestao basica.
- Criar listagem de fontes.
- Criar auditoria minima.

### Fase 4: Skills NexusAI

- Criar `nexusai-operating-system`.
- Criar `rag-client-workflow`.
- Criar `kanban-ceo-orchestration`.
- Criar `specialist-handoff-standard`.
- Criar skills por especialista conforme necessidade.

### Fase 5: Operacao Multiagente

- Criar profiles especialistas.
- Definir quais skills cada profile carrega.
- Definir quais toolsets cada profile pode usar.
- Definir fluxo de Kanban.
- Definir rotinas com Cron.
- Definir revisao final pelo CEO.

### Fase 6: Validacao

- Testar com tenants:
  - `nexusai`
  - `cliente_demo`
  - `cliente_teste`
- Validar que cliente demo nunca acessa cliente teste.
- Validar que especialistas consultam fontes certas.
- Validar que CEO recebe handoffs claros.
- Validar que respostas citam fontes quando necessario.

### Fase 7: Evolucao

- Adicionar reranking melhor.
- Adicionar ingestion pipeline para PDFs/sites.
- Adicionar avaliacao de qualidade de resposta.
- Adicionar dashboards de auditoria.
- Adicionar relatorios por cliente.
- Avaliar memory provider proprio apenas se fizer sentido no futuro.

## Decisao Sobre Core do Hermes

Nao mexer no core no inicio.

Motivos:

- Mantem atualizacoes simples.
- Evita fork dificil de manter.
- Reduz risco tecnico.
- Permite evoluir a NexusAI como produto proprio.
- O MCP ja entrega a integracao necessaria.

Mexer no core so faria sentido no futuro se houver necessidade de:

- Memory provider nativo `supabase_nexus`.
- Pre-fetch automatico antes de todo turno.
- Injecao automatica de contexto no system prompt.
- Integracao mais profunda com lifecycle interno do Hermes.

Mesmo nesse caso, o ideal seria contribuir como plugin/provider, nao como alteracao local isolada.

## Decisao Final Recomendada

Adotar:

```text
Hermes Memory = continuidade padrao do agente
Profiles = especialistas internos
Kanban = coordenacao multiagente
Cron = rotinas recorrentes
Skills = comportamento e processo
MCP = porta controlada para conhecimento
Supabase RAG = base documental multi-tenant
CEO = orquestrador e validador final
```

Essa arquitetura transforma a NexusAI em uma operacao multiagente organizada, com conhecimento isolado por cliente, mantendo o Hermes Agent atualizavel e evitando customizacoes frageis no core.

