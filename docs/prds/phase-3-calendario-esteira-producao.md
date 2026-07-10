# PRD — Fase 3: Calendário e Esteira de Produção

- **Status:** draft
- **Dependência:** Fase 2 concluída
- **Resultado:** trabalho de campanha planejado, produzido e acompanhável

## Resumo

A fase adiciona itens operacionais, calendário e conteúdo versionado. Ela organiza o que precisa ser produzido e quando, sem realizar disparos nem introduzir a aprovação institucional completa da Fase 5.

## Problema

Uma campanha registrada sem tarefas, datas, peças e responsáveis ainda não substitui a operação diária. O time precisa transformar objetivos em itens executáveis e acompanhar produção sem perder versões em conversas ou arquivos soltos.

## Objetivos

- criar agenda operacional ligada às campanhas;
- representar tarefas, mensagens, peças, revisões e marcos;
- atribuir responsáveis e prazos;
- versionar conteúdo;
- visualizar conflitos e pendências;
- preparar o domínio para o Hermes e aprovações.

## Não objetivos

- disparar mensagens;
- aprovar institucionalmente conteúdo;
- integrar provedores externos;
- calcular performance;
- criar automações proativas.

## Jornadas

1. Criar item dentro de uma campanha.
2. Agendar e atribuir responsável.
3. Visualizar agenda mensal, semanal ou lista.
4. Produzir conteúdo e salvar nova versão.
5. Mover item pela esteira permitida.
6. Identificar atraso, bloqueio ou conflito.
7. Reagendar com histórico.

## Requisitos funcionais

### F3-RF-01 — Tipos de item

Suportar inicialmente `task`, `email`, `whatsapp`, `post`, `creative`, `review` e `milestone`, com extensão controlada.

### F3-RF-02 — Campos

Título, campanha, tipo, status, responsável, início, prazo/horário, prioridade, canal, descrição, dependências e metadata específica validada.

### F3-RF-03 — Visualizações

Mensal, semanal e lista devem representar os mesmos dados. Filtros: campanha, canal, tipo, responsável, status e período.

### F3-RF-04 — Timezone

Persistir instantes em UTC e exibir no timezone configurado. A interface deve deixar o fuso explícito em operações sensíveis.

### F3-RF-05 — Reagendamento

Alterações de data geram auditoria. Itens aprovados ou sensíveis terão restrições adicionadas na Fase 5.

### F3-RF-06 — Dependências

Um item pode depender de outro. Ciclos são proibidos. A interface deve indicar bloqueios.

### F3-RF-07 — Conteúdo

Itens podem vincular um ou mais `content_assets`. Conteúdo textual e metadata possuem versões.

### F3-RF-08 — Versões

Cada edição confirmada cria ou atualiza rascunho conforme regra técnica; versões submetidas a revisão futura ficam imutáveis.

### F3-RF-09 — Artefatos

Peças e arquivos usam Artifact Server/Storage. O domínio guarda ID, owner, tipo, checksum quando disponível e vínculo.

### F3-RF-10 — Estados

Item: `draft`, `ready`, `in_review`, `approved`, `scheduled`, `executing`, `completed`, `failed`, `cancelled`. Nesta fase, `approved` e posteriores podem permanecer indisponíveis até a Fase 5/6.

### F3-RF-11 — Notificações básicas

Gerar eventos internos para atribuição, prazo próximo e atraso. A entrega pode ser apenas in-app inicialmente.

### F3-RF-12 — Ações em lote

Somente operações seguras e reversíveis aprovadas no design técnico; toda ação respeita permissões e retorna resultado por item.

## Dados

- `campaign_items`;
- `item_dependencies`;
- `content_assets`;
- `content_versions`;
- `item_artifacts`;
- eventos e auditoria.

Conteúdo binário não será armazenado em colunas JSON/base64.

## Regras

- item pertence a uma campanha;
- campanha arquivada não recebe novo item;
- responsável precisa ter acesso à campanha;
- dependência concluída desbloqueia, mas não conclui automaticamente;
- prazo anterior ao início é inválido;
- conteúdo submetido não é alterado in-place;
- exclusão comum vira cancelamento/arquivamento conforme entidade.

## UX

- drag-and-drop é melhoria, não requisito para o primeiro corte;
- toda mudança de data deve ser possível sem drag-and-drop;
- cores nunca são o único indicador de status;
- calendário possui navegação por teclado aplicável;
- lista é alternativa acessível e funcional;
- filtros persistem na URL;
- detalhes abrem sem perder contexto da visão.

## Permissões

Members operam itens de campanhas autorizadas. Managers podem redistribuir e corrigir itens no escopo. Admin possui diagnóstico amplo. Permissões de aprovação não são inferidas dessas ações.

## Observabilidade e métricas

- itens criados por tipo;
- atraso por campanha/canal;
- tempo por estado;
- reagendamentos;
- conflitos de versão;
- itens sem responsável;
- latência das visualizações;
- eventos de notificação produzidos.

## Critérios de aceite

- [ ] Usuário cria item em campanha autorizada.
- [ ] Tipos e metadata inválida são rejeitados.
- [ ] Visualizações mensal, semanal e lista são consistentes.
- [ ] Filtros combinam e persistem na URL.
- [ ] Datas respeitam timezone explícito.
- [ ] Reagendamento gera auditoria.
- [ ] Dependências cíclicas são bloqueadas.
- [ ] Conteúdo possui histórico de versões.
- [ ] Versão congelada não é alterada.
- [ ] Arquivos mantêm ownership e referência.
- [ ] Itens atrasados e bloqueados são identificáveis.
- [ ] Lista oferece jornada equivalente sem drag-and-drop.
- [ ] Reinício não perde agenda ou versões.

## Testes

Unitários para estados, datas, timezone, dependências e versões. Integração para CRUD, filtros, RLS, auditoria e artefatos. E2E para planejar semana, reagendar, versionar conteúdo e resolver bloqueio. Performance com volume representativo de itens.

## Gate local

Migrations/rollback, testes, três visualizações, timezone, papéis, versões, dependências, responsividade, acessibilidade e persistência.

## Gate VPS

Smoke de agenda com timezone da ENS, volumes/artefatos, CORS, eventos, reinício, logs e rollback.

## Riscos

| Risco | Mitigação |
|---|---|
| Calendário dominar o escopo | Lista funcional primeiro; views compartilham query |
| Timezone gerar disparo incorreto | UTC + fuso explícito + testes de DST aplicáveis |
| Tipos virarem tabelas isoladas | Núcleo comum com metadata versionada |
| Dependências complexas | Apenas bloqueio simples no primeiro corte |
| Versionamento confuso | Identidade do asset separada da versão |

## Gate de saída

A Fase 4 inicia quando campanhas possuem itens e versões confiáveis, e as operações manuais estão validadas localmente e na VPS.
