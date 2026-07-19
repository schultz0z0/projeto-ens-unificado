# PRD — Fase 3: Calendário e Esteira de Produção

- **Status:** `approved`
- **Prontidão:** `implementation_complete_pending_vps_validation`
- **Implementação:** `tasks_1_to_10_validated_locally`
- **Aprovação do escopo:** 2026-07-18
- **Dependência:** Fase 2 `production_validated`
- **Resultado:** trabalho de campanha planejado, produzido e acompanhável

## Resumo

A Fase 3 evolui o agregado `campaign_items` existente para organizar tarefas,
mensagens, peças, revisões e marcos em lista, semana e mês. Ela entrega
planejamento manual e conteúdo versionado, sem disparos, aprovação
institucional ou operação autônoma do Hermes.

## Problema

Uma campanha registrada sem itens, datas, responsáveis e versões ainda não é
uma referência diária de produção. O time precisa transformar objetivos em
trabalho executável sem perder prazos, dependências e versões em conversas ou
arquivos soltos.

## Objetivos

- criar agenda operacional ligada às campanhas;
- atribuir responsáveis, prioridade e prazos;
- oferecer lista acessível, semana e mês sobre a mesma query;
- representar bloqueios e atrasos;
- versionar conteúdo sem alterar versões congeladas;
- produzir eventos internos para atribuição e prazo;
- preparar o domínio para Hermes e aprovações posteriores.

## Não objetivos

- disparar mensagens ou publicar conteúdo;
- aprovar institucionalmente;
- integrar provedores externos;
- calcular performance de campanha;
- automação proativa do Hermes;
- recorrência de itens;
- timeline de recursos/capacidade;
- drag-and-drop obrigatório;
- notificações por e-mail, WhatsApp ou push externo.

## Personas

- **Member:** opera itens de campanhas em que pode editar.
- **Manager:** redistribui e corrige itens do tenant.
- **Admin:** possui diagnóstico e operação ampla autorizada.

Papéis desta fase não concedem aprovação editorial nem execução de canal.

## Jornadas prioritárias

1. Criar item em campanha autorizada.
2. Agendar e atribuir responsável.
3. Encontrar o mesmo item na lista, semana e mês.
4. Reagendar com justificativa e histórico.
5. Criar dependência e identificar bloqueio.
6. Produzir conteúdo e criar versão.
7. Mover item pela esteira permitida.
8. Executar ação segura em lote.
9. Consultar notificações internas.

## Requisitos funcionais

### F3-RF-01 — Tipos

Suportar `task`, `email`, `whatsapp`, `post`, `creative`, `review` e
`milestone`. Metadata específica é validada por tipo; valores desconhecidos
falham fechados.

### F3-RF-02 — Campos

Título obrigatório, campanha, tipo, status, responsável opcional, início,
prazo/horário, prioridade, canal opcional, descrição, metadata validada e
versão otimista.

### F3-RF-03 — Visualizações

Lista, semana e mês representam a mesma consulta canônica por intervalo.
Filtros por campanha, canal, tipo, responsável, status, prioridade e período
combinam e persistem na URL. A lista é a referência funcional e acessível.

### F3-RF-04 — Timezone

Instantes são persistidos em `timestamptz`/UTC. A API retorna timestamps ISO
8601; o frontend exibe o timezone efetivo do tenant. No primeiro corte, o
timezone do tenant é configuração explícita com fallback `America/Sao_Paulo`.
Operações sensíveis mostram data, hora e fuso.

### F3-RF-05 — Reagendamento

Alterações de início/prazo exigem `If-Match`, geram auditoria e evento. Não
existe reagendamento silencioso.

### F3-RF-06 — Dependências

Um item pode depender de outro item ativo da mesma campanha e tenant.
Self-loop, duplicata e ciclos são proibidos. Item fica bloqueado enquanto
alguma dependência não estiver `completed`.

### F3-RF-07 — Conteúdo

Itens podem possuir `content_assets` com identidade estável. Texto e metadata
são gravados em `content_versions`; conteúdo binário permanece no Artifact
Server.

### F3-RF-08 — Versões

Cada salvamento explícito cria nova versão numerada. Uma versão congelada não
é alterada nem removida. O asset aponta para sua versão corrente; histórico
continua consultável.

### F3-RF-09 — Artefatos

`item_artifacts` vincula item/asset a artifact ID, owner, MIME, tamanho e hash.
Ownership e access link seguem o contrato validado na Fase 2.

### F3-RF-10 — Estados

Estados disponíveis na Fase 3:

`draft → ready → in_review → completed`

`draft`, `ready` e `in_review` podem ir para `cancelled`; `cancelled` e
`completed` são terminais nesta fase. `approved`, `scheduled`, `executing` e
`failed` ficam reservados às Fases 5/6 e não podem ser enviados pela API.

### F3-RF-11 — Notificações internas

Persistir projeções in-app para atribuição, prazo próximo e atraso. A entrega
externa não faz parte desta fase. Eventos são deduplicáveis e não carregam
conteúdo sensível.

### F3-RF-12 — Ações em lote

Permitir somente operações reversíveis e enumeradas:

- reatribuir responsável;
- alterar prioridade;
- reagendar início/prazo.

Cada item é autorizado e versionado individualmente. A resposta informa
sucesso/falha por item; não existe sucesso parcial oculto.

## Regras de negócio

- item pertence a uma campanha não arquivada;
- responsável precisa ter acesso ativo à campanha;
- prazo não antecede início;
- datas ausentes ficam fora das views semana/mês, mas aparecem na lista;
- dependência concluída desbloqueia, sem concluir automaticamente;
- conteúdo congelado é append-only;
- item terminal não aceita mutação comum;
- hard delete não é exposto;
- toda mutação usa idempotência, auditoria, outbox e versão otimista;
- tenant e autoridade são derivados no servidor.

## UX e acessibilidade

- lista funcional antes das views de calendário;
- semana e mês possuem alternativa tabular/lista equivalente;
- cores não são o único indicador;
- filtros e intervalo persistem na URL;
- detalhes abrem sem perder contexto;
- toda mudança possível por teclado e formulário, sem depender de drag;
- loading, vazio, sem resultado, erro, acesso negado e conflito;
- desktop, tablet e mobile;
- locale `pt-BR`, com timezone sempre visível em edição/reagendamento.

## Permissões

| Ação | Member autorizado | Manager | Admin |
|---|---:|---:|---:|
| Ler item | Sim | Sim no tenant | Sim no tenant autorizado |
| Criar/editar | Conforme campanha | Sim | Sim |
| Reatribuir | Conforme capability | Sim | Sim |
| Gerenciar dependência | Conforme edição | Sim | Sim |
| Versionar conteúdo | Conforme edição | Sim | Sim |
| Lote | Não por padrão | Sim | Sim |

## Observabilidade

- itens criados por tipo;
- atraso e bloqueio agregados;
- tempo por estado;
- reagendamentos;
- conflitos de versão;
- versões por asset;
- eventos in-app produzidos;
- latência e cardinalidade de lista/semana/mês;
- resultado por item em lote.

Labels não incluem título, conteúdo, nome pessoal, artifact ID ou URL assinada.

## Critérios de aceite

- [x] Usuário cria item em campanha autorizada.
- [x] Tipo e metadata inválidos são rejeitados.
- [x] Lista, semana e mês usam dados e filtros consistentes.
- [x] Filtros e intervalo persistem na URL.
- [x] Datas usam UTC e timezone explícito.
- [x] Reagendamento gera auditoria e respeita versão.
- [x] Dependências inválidas e cíclicas são bloqueadas.
- [x] Bloqueio é derivado corretamente.
- [x] Conteúdo possui histórico imutável de versões.
- [x] Artefatos mantêm ownership e referência.
- [x] Estados reservados às Fases 5/6 são rejeitados.
- [x] Itens atrasados e bloqueados são identificáveis.
- [x] Lista oferece jornada equivalente sem drag-and-drop.
- [x] Ação em lote retorna resultado por item.
- [x] Notificações in-app são persistidas e deduplicáveis.
- [x] Reinício local não perde agenda, dependências, versões ou eventos.

Os critérios acima estão aceitos no gate local/Docker. O aceite operacional na
VPS permanece pendente e não está implícito nestes checkboxes.

## Gates

### Local

- migration aditiva, reset, pgTAP, RLS e schema diff;
- unitários, integração, contratos, OpenAPI, frontend e E2E;
- lista/semana/mês, timezone, dependências e versões;
- concorrência e idempotência;
- performance com volume representativo;
- Compose, restart, persistência, logs e security gate;
- documentação e rollback atualizados.

### VPS

- backup/dry-run/push do Supabase do app;
- build e deploy dos serviços;
- smoke por papel e cross-tenant;
- agenda no timezone ENS;
- dependências, conteúdo, artifacts, eventos e lote;
- desktop/mobile/axe;
- logs/correlation ID;
- restart, persistência, cleanup e rollback.

## Riscos principais

| Risco | Mitigação |
|---|---|
| calendário dominar o escopo | lista canônica primeiro e uma query compartilhada |
| timezone deslocar prazo | UTC + timezone efetivo visível + testes de borda |
| grafo complexo/deadlock | dependência simples, ordem de lock e detecção transacional |
| versões confusas | identidade do asset separada de versões append-only |
| estados anteciparem aprovação/execução | enum e API rejeitam estados reservados |
| lote ocultar falhas | autorização/versão/resultados por item |

## Gate de saída

A Fase 4 só inicia quando itens, agenda, dependências, versões e eventos internos
estiverem validados localmente e homologados na VPS, sem falha alta/crítica.
