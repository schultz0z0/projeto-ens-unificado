# Design do Roadmap Nexus AI — Marketing Operations

- **Data:** 10 de julho de 2026
- **Status:** aprovado
- **Escopo:** arquitetura do programa, domínio, fases, segurança e validação
- **Documento executivo:** [`../../Roadmap.md`](../../Roadmap.md)

## 1. Contexto

O Nexus AI já possui um frontend integrado ao Hermes, autenticação Supabase, histórico de chat, anexos, artefatos, memória validada, RAG ENS e Nexus Graph. O próximo passo é transformar esse conjunto em uma Central de Operações de Marketing da ENS.

O roadmap anterior tinha uma direção correta, porém misturava visão estratégica, arquitetura, backlog e exemplos detalhados. Algumas dependências importantes não estavam representadas como fase, principalmente modelo de domínio, autorização, auditoria, propagação do ator, idempotência e gates de produção.

Este design registra as decisões aprovadas antes da produção dos PRDs e da implementação.

## 2. Estado atual analisado

### 2.1 Frontend

O frontend:

- autentica usuários pelo Supabase;
- cria e lista sessões de chat;
- persiste mensagens no Supabase;
- envia pedidos para a Chat Bridge;
- cria um run e acompanha eventos por SSE;
- reconecta usando cursor e snapshot;
- renderiza deltas, status, arquivos e artefatos;
- possui papéis `member`, `manager` e `admin`;
- possui memória de trabalhos validados;
- possui aprovação técnica de comandos do Hermes.

### 2.2 Chat Bridge

A Chat Bridge não é um proxy simples. Ela:

- valida o bearer token no Supabase;
- consulta perfil e papel;
- resolve o tenant confiável;
- prepara anexos;
- cria runs assíncronos;
- persiste snapshots dos runs em volume;
- marca runs interrompidos após reinício;
- mantém assinantes SSE e replay por cursor;
- cria e recupera sessões Hermes;
- persiste estado de continuidade no Supabase;
- normaliza eventos do Hermes;
- importa arquivos para o Artifact Server;
- cria links temporários;
- conecta o frontend ao sistema técnico de aprovação do Hermes.

### 2.3 Hermes

O Hermes roda como serviço separado e recebe contexto de tenant, usuário, papel e sessão. O runtime utiliza:

- memória nativa;
- skills e ferramentas;
- ENS RAG MCP;
- Nexus Graph MCP;
- geração de arquivos e imagens;
- API de sessão e streaming.

### 2.4 Dados existentes

Migrations históricas criaram e removeram modelos anteriores de campanhas. Existe código de Market Intelligence e uma página de campanhas que não representam a Central Operacional desejada. Portanto, o novo domínio não deve assumir que tabelas legadas são reutilizáveis sem inventário.

## 3. Problema de design

O produto precisa permitir que telas e Hermes consultem e alterem os mesmos objetos sem:

- transformar a Chat Bridge em um backend monolítico;
- confiar em identidade ou papel produzidos pelo modelo;
- usar RAG, Graph ou memória do Hermes como banco transacional;
- duplicar regras entre frontend e ferramentas;
- permitir execução sensível fora de uma decisão humana rastreável;
- declarar sucesso sem validação no ambiente Linux de produção.

## 4. Alternativas consideradas

### 4.1 Serviço de domínio Marketing Ops

Um serviço próprio expõe API para o frontend e MCP para o Hermes. As duas interfaces usam as mesmas regras e persistência.

**Vantagens:** separação clara, regras centralizadas, evolução para workers, segurança consistente e alinhamento com o monorepo.

**Custo:** novo container, contratos e operação adicional.

### 4.2 Supabase-first com MCP auxiliar

O frontend acessa tabelas/RPCs diretamente e o MCP chama as mesmas RPCs.

**Vantagens:** entrega inicial rápida.

**Riscos:** regras distribuídas entre SQL, frontend e MCP; maior chance de divergência.

### 4.3 Expansão da Chat Bridge

Campanhas e aprovações seriam adicionadas à bridge.

**Vantagem:** menos componentes no início.

**Riscos:** acoplamento entre domínio e transporte, arquivo central ainda maior, deploy e falhas compartilhados.

### 4.4 Decisão

Foi aprovado o serviço de domínio `marketing-ops`.

## 5. Arquitetura aprovada

```text
Frontend
   │ JWT Supabase
   ▼
Marketing Ops API ───────────────┐
   │                             │
   │ regras, permissões          │ ferramentas MCP
   │ auditoria e validação       │
   ▼                             ▼
Supabase                    Hermes Agent
   ▲                             ▲
   │                             │
   │                       Chat Bridge
   │                  sessões, runs, SSE,
   │                  anexos e artefatos
   │
Workers
outbox, agenda e execução
```

### 5.1 Frontend

Responsável por experiência do usuário, cache de leitura, formulários, estados de carregamento, conflitos e apresentação. Não contém autorização definitiva nem secrets internos.

### 5.2 Marketing Ops

Responsável por:

- contratos de API e MCP;
- validação de schemas;
- autorização e tenant;
- regras de transição;
- idempotência;
- concorrência otimista;
- transações;
- auditoria;
- eventos de domínio;
- acesso ao Supabase.

### 5.3 Chat Bridge

Permanece responsável por transporte conversacional. Não recebe CRUD de campanhas, calendário, aprovações de negócio ou execução.

### 5.4 Hermes

Consulta, raciocina, propõe e solicita mutações pelas ferramentas do Marketing Ops. Não executa disparos diretamente e não é fonte do estado operacional.

### 5.5 Workers

Consomem uma outbox transacional e executam payloads aprovados. Não usam o Hermes para reescrever o pacote durante a execução.

## 6. Fontes de verdade

| Camada | Fonte de verdade |
|---|---|
| Operação | Supabase por meio do Marketing Ops |
| Arquivos | Artifact Server ou Storage |
| Fatos oficiais | ENS RAG |
| Relações e memória validada | Nexus Graph |
| Continuidade de conversa | Memória nativa do Hermes e estado de sessão |
| Runs e streaming | Chat Bridge |

Uma campanha ativa sempre é consultada no Marketing Ops. Ela não é reconstruída pelo chat, RAG ou Graph.

## 7. Modelo de domínio

### 7.1 Entidades

- `campaigns`: identidade e estado geral;
- `campaign_members`: responsáveis e participantes;
- `campaign_items`: unidades operacionais e agenda;
- `content_assets`: identidade lógica de um conteúdo;
- `content_versions`: versões congeláveis;
- `approval_requests`: solicitações editoriais ou operacionais;
- `approval_decisions`: decisões e comentários;
- `action_packages`: payload aprovado e imutável;
- `execution_jobs`: item da outbox/fila;
- `execution_attempts`: tentativas e respostas;
- `audit_events`: trilha de mutação;
- `domain_events`: integração interna;
- `campaign_metrics`: métricas normalizadas;
- `campaign_learnings`: hipóteses e aprendizados.

### 7.2 Referências de cursos

Cursos e fatos institucionais continuam no RAG. A campanha guarda identificador estável e snapshot mínimo do título, evitando copiar documentos longos para o domínio transacional.

### 7.3 Estados

- **Campanha:** `draft`, `planned`, `active`, `completed`, `archived`.
- **Item:** `draft`, `ready`, `in_review`, `approved`, `scheduled`, `executing`, `completed`, `failed`, `cancelled`.
- **Conteúdo:** `draft`, `in_review`, `changes_requested`, `approved`, `superseded`.
- **Aprovação:** `pending`, `approved`, `rejected`, `changes_requested`, `cancelled`, `expired`.
- **Execução:** `queued`, `running`, `succeeded`, `failed`, `cancelled`, `dead_letter`.

Estados de níveis diferentes não serão condensados em um único campo.

## 8. Fluxos

### 8.1 Mutação pelo frontend

```text
Usuário → Frontend → Marketing Ops API
→ JWT/tenant/papel/schema/transição
→ transação Supabase
→ auditoria + evento
→ resposta
```

### 8.2 Mutação pelo Hermes

```text
Usuário → Frontend → Chat Bridge → Hermes
→ Marketing Ops MCP
→ delegação/papel/tenant/escopo
→ transação + auditoria ligada ao run
→ resultado → Hermes → Frontend
```

### 8.3 Aprovação e execução

```text
Conteúdo ou ação preparada
→ versão/pacote congelado
→ approval_request
→ decisão humana
→ action_package imutável
→ outbox
→ worker
→ provedor
→ resultado e auditoria
```

Se o conteúdo aprovado mudar, o pacote anterior é invalidado.

## 9. Aprovações separadas

### 9.1 Aprovação técnica do Hermes

Autoriza um comando potencialmente perigoso do runtime. É curta, técnica e ligada à execução do agente. O modal atual atende a essa necessidade.

### 9.2 Aprovação editorial

Decide se uma versão de copy, peça ou calendário está apta para uso.

### 9.3 Autorização operacional

Decide se um pacote sensível pode ser executado, com público, canal, horário e payload congelados.

Os três mecanismos não compartilham estados nem tabelas.

## 10. Identidade e delegação

O frontend envia JWT do Supabase. O Marketing Ops valida o token e resolve tenant e papel no servidor.

Para o Hermes, a Fase 1 implementará contexto de delegação assinado, com duração curta e escopo mínimo. O serviço não confiará apenas em `user_id`, `role` ou `tenant_id` incluídos nos argumentos do modelo.

Claims mínimos esperados:

- ator;
- tenant;
- papel verificado;
- sessão e run;
- operação ou escopo permitido;
- expiração;
- identificador único contra replay.

## 11. Integridade

- transações para mutação, auditoria e evento;
- `idempotency_key` em comandos;
- versão para concorrência otimista;
- timestamps do servidor;
- transições explícitas;
- constraints e índices;
- outbox para efeitos externos;
- auditoria append-only;
- payload aprovado imutável.

Conflitos nunca sobrescrevem silenciosamente outra edição.

## 12. Segurança

- negar por padrão;
- API e RLS em defesa em profundidade;
- `service_role` nunca exposta ao navegador;
- tenant resolvido por identidade confiável;
- matriz de permissão testada;
- schemas estritos;
- ownership de artefatos;
- limites de arquivo e payload;
- rate limiting;
- secrets apenas no servidor;
- correlação de todas as ações;
- consentimento, opt-out e LGPD antes da execução real.

## 13. Tratamento de falhas

| Falha | Resposta |
|---|---|
| Hermes/bridge fora | Telas operacionais continuam disponíveis |
| Marketing Ops fora | Chat informa indisponibilidade da operação; não simula sucesso |
| Supabase fora | Transação falha por inteiro |
| Stream interrompido | Reconexão por cursor/snapshot |
| MCP repetido | Resultado idempotente |
| Worker reiniciado | Job retomado sem duplicidade |
| Provedor fora | Retry, backoff e dead-letter |
| Aprovação expirada | Execução bloqueada |
| Conteúdo alterado | Nova aprovação obrigatória |
| Artefato inválido | Agendamento/execução bloqueados |
| Migration falha | Deploy interrompido e rollback |

Um `correlation_id` conecta usuário, campanha, chat, run, chamada MCP, auditoria e execução.

## 14. Estratégia de testes

### Unitários

Regras de estado, autorização, schemas, idempotência, expiração e erros.

### Banco

Migrations em banco limpo e snapshot compatível, constraints, índices, RLS, tenant, papéis e rollback.

### Contrato

Frontend/API, Hermes/MCP, Marketing Ops/Supabase, bridge/Hermes, worker/provedor e eventos versionados.

### Integração

Objetos criados por uma interface são lidos pela outra; mutações são auditadas; aprovações congelam a versão correta; retries não duplicam.

### E2E local

Jornadas por papel, campanhas, chat, anexos, conflitos, erros, responsividade, acessibilidade básica e reinício dos containers.

### Produção

Smoke tests não destrutivos, com dados marcados como teste, depois do deploy na VPS.

## 15. Gates

### Local

- build, lint e typecheck;
- testes aplicáveis;
- migrations e rollback;
- RLS e papéis;
- persistência;
- falhas e recuperação;
- evidências.

### VPS Linux

- Compose e health checks;
- volumes e permissões;
- migrations;
- rede entre containers;
- DNS, TLS e CORS;
- envs e secrets;
- smoke funcional;
- logs e correlação;
- reinício e persistência;
- backup e rollback;
- aceite.

Sem o gate VPS, a fase fica `pronta para produção`.

## 16. Fases aprovadas

0. Diagnóstico e Contrato de Evolução.
1. Fundação do Marketing Ops.
2. Workspace Operacional MVP.
3. Calendário e Esteira de Produção.
4. Hermes Campaign Operator.
5. Governança e Aprovações.
6. Execução Assistida Piloto.
7. Performance, Diagnóstico e Aprendizado.
8. Hermes Proativo e Escala Operacional.

## 17. Definition of Done

Uma fase só está concluída quando:

- requisitos e critérios de aceite foram atendidos;
- testes estão verdes;
- não existe falha crítica ou alta conhecida;
- segurança, tenant, RLS e papéis foram validados;
- auditoria e observabilidade funcionam;
- documentação, backup e rollback foram atualizados;
- gate local foi registrado;
- deploy na VPS foi realizado;
- gate de produção foi aprovado;
- pendências restantes estão formalmente fora do escopo.

## 18. Decisões adiadas

Serão decididos no PRD e implementação da fase correspondente:

- linguagem e framework finais do Marketing Ops;
- provedor e canal piloto da Fase 6;
- SLAs numéricos de aprovação;
- modelo de atribuição de performance;
- canais de notificação proativa;
- retenção definitiva de auditoria e métricas.

Essas decisões não bloqueiam o roadmap, mas impedem implementação da fase específica até serem resolvidas.
