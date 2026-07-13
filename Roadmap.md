# Roadmap Nexus AI ENS — Marketing Operations

- **Status:** Fase 0 `production_validated`; Fase 1 `ready_for_production` com homologação VPS em andamento
- **Atualização:** 13 de julho de 2026
- **Produto:** Nexus AI ENS
- **Primeiro release de valor:** Workspace Operacional

## 1. Visão

O Nexus AI deve evoluir de um aplicativo com o Hermes integrado para a Central de Operações de Marketing da ENS.

O produto reunirá planejamento, criação, calendário, produção, aprovação, execução assistida, performance e aprendizado em um único ambiente. O Hermes continuará sendo o agente central de raciocínio, mas trabalhará sobre os mesmos objetos e regras usados pelas telas.

O objetivo não é criar apenas um chatbot nem apenas um dashboard. O objetivo é tornar o Nexus AI o lugar onde o marketing da ENS pensa, organiza, produz, aprova, executa e aprende.

## 2. Resultado esperado

O time deverá conseguir:

- organizar campanhas por curso, produto ou iniciativa;
- transformar briefings em planos e itens operacionais;
- acompanhar responsáveis, datas, materiais e pendências;
- criar e revisar conteúdo com o Hermes;
- aprovar versões e ações sensíveis;
- executar operações por workers determinísticos;
- medir resultados e registrar aprendizados;
- reutilizar conhecimento validado em campanhas futuras.

## 3. Modelo de interação

O produto terá dois caminhos complementares:

1. **Telas operacionais:** o usuário navega, consulta e edita campanhas, calendário, materiais, aprovações e indicadores.
2. **Conversa com o Hermes:** o usuário pede análises, criação, diagnóstico ou alterações em linguagem natural.

Os dois caminhos operarão sobre as mesmas entidades no `marketing-ops`. Uma resposta acionável do Hermes poderá virar campanha, item, conteúdo, solicitação de aprovação ou aprendizado, respeitando confirmação, permissão e auditoria.

## 4. Arquitetura atual que será preservada

### Frontend

- autenticação e sessão pelo Supabase;
- persistência de sessões e mensagens de chat;
- consumo de runs assíncronos da Chat Bridge;
- reconexão do stream por cursor e snapshot;
- exibição de arquivos e artefatos;
- modal técnico para aprovação de comandos do Hermes.

### Chat Bridge

- validação do JWT do Supabase;
- resolução de usuário, papel e tenant;
- criação e persistência de runs;
- sessões e continuidade do Hermes;
- SSE, reconexão e normalização de eventos;
- anexos, arquivos e Artifact Server;
- transporte entre frontend e Hermes.

### Hermes

- raciocínio e continuidade de conversa;
- memória nativa;
- ferramentas, skills e MCPs;
- consulta ao RAG ENS e ao Nexus Graph;
- geração de texto, análise, arquivos e imagens.

### Memória e conhecimento

- RAG: fatos oficiais, cursos, ofertas e documentos;
- Graph: relações, decisões e trabalhos validados;
- Supabase: dados transacionais e operacionais;
- Artifact Server/Storage: arquivos e entregáveis;
- memória nativa do Hermes: continuidade e preferências.

## 5. Arquitetura-alvo

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
Workers futuros
aprovações, agenda e execução
```

### Marketing Ops

Será criado um serviço/container próprio com:

- API autenticada para o frontend;
- interface MCP para o Hermes;
- regras de domínio compartilhadas;
- autorização, idempotência e auditoria;
- acesso transacional ao Supabase;
- eventos usados posteriormente por notificações e workers.

### Limite da Chat Bridge

A Chat Bridge continuará responsável por conversa, sessões, runs, streaming, anexos e artefatos. CRUD de campanhas, calendário, aprovações de negócio e execução não serão incorporados à bridge.

### Limite do Hermes

O Hermes poderá consultar, propor e solicitar alterações. Ele não será o executor direto de disparos nem a fonte oficial do estado de campanhas. Workers executarão payloads aprovados de forma determinística.

## 6. Princípios

- campanha é a unidade principal de organização;
- frontend e Hermes usam o mesmo domínio;
- negar acesso por padrão;
- toda mutação relevante é auditável;
- operações repetidas são idempotentes;
- nenhum tenant confia em identificadores enviados pelo cliente sem validação;
- aprovação técnica do Hermes é diferente de aprovação editorial e operacional;
- conteúdo aprovado é versionado e imutável;
- mudanças após aprovação exigem nova decisão;
- execução real exige worker, outbox e rastreabilidade;
- métricas são instrumentadas desde a fundação;
- memória validada complementa, mas não substitui, dados transacionais;
- clareza operacional vem antes de automação avançada;
- n8n não será o pilar da automação do produto;
- cada fase exige validação local e homologação na VPS.

## 7. Papéis iniciais

### Member

- cria e edita rascunhos permitidos;
- participa de campanhas;
- solicita revisão e aprovação;
- consulta e reutiliza memória validada;
- não administra usuários nem aprova ações reservadas.

### Manager

- possui as capacidades de member;
- revisa materiais;
- aprova ou rejeita dentro do escopo definido;
- gerencia trabalhos validados;
- acompanha operação e indicadores.

### Admin

- possui as capacidades de manager;
- administra usuários, integrações e configurações;
- gerencia políticas e operações reservadas;
- acessa diagnósticos e controles administrativos.

A matriz completa será definida e testada na Fase 1.

## 8. Modelo operacional resumido

Entidades previstas:

- campanhas e participantes;
- itens operacionais e calendário;
- conteúdos e versões;
- solicitações e decisões de aprovação;
- pacotes de ação imutáveis;
- jobs e tentativas de execução;
- auditoria e eventos de domínio;
- métricas e aprendizados.

Estados de campanha, conteúdo, aprovação e execução serão separados. Uma copy rejeitada não tornará a campanha inteira rejeitada.

## 9. Roadmap por fases

### Fase 0: Diagnóstico e Contrato de Evolução

**Estado:** `production_validated` — gates local e VPS aprovados; fase concluída em 11 de julho de 2026.

**Objetivo:** eliminar ambiguidades sobre o estado atual e estabelecer o contrato de evolução.

**Entregas:**

- inventário de telas, serviços, tabelas, buckets, funções e integrações;
- classificação de componentes: manter, adaptar, migrar, arquivar ou remover;
- glossário e nomes oficiais;
- mapa de responsabilidades;
- decisões arquiteturais;
- estratégia de migrations, backup e rollback;
- matriz inicial de permissões;
- gates local e VPS.

**Saída:** backlog classificado, riscos conhecidos e nenhuma decisão estrutural crítica em aberto.

**PRD:** [Fase 0 — Diagnóstico e Contrato de Evolução](docs/prds/phase-0-diagnostico-contrato-evolucao.md)

### Fase 1: Fundação do Marketing Ops

**Estado:** `ready_for_production` — implementação e gate local aprovados; deploy VPS iniciado em 12 de julho e homologação em andamento. Persistência de domínio foi confirmada em 13 de julho. O transporte efêmero e o scrub seletivo das delegações foram validados na VPS pelos testes 13 e 14; restam os testes manuais 15–20 para fechar a fase.

**Objetivo:** criar o domínio operacional compartilhado pelo frontend e pelo Hermes.

**Entregas:**

- container `marketing-ops`;
- API autenticada e MCP;
- modelo de dados canônico;
- tenant, RBAC e RLS;
- delegação confiável do ator;
- auditoria imutável;
- idempotência e concorrência otimista;
- eventos de domínio e instrumentação;
- health checks e contratos.

**Saída:** frontend e Hermes acessam com segurança o mesmo domínio básico.

**PRD:** [Fase 1 — Fundação do Marketing Ops](docs/prds/phase-1-fundacao-marketing-ops.md)

### Fase 2: Workspace Operacional MVP

**Objetivo:** entregar o primeiro release de valor para campanhas reais.

**Entregas:**

- cadastro, edição, lista, busca e filtros de campanhas;
- workspace detalhado;
- objetivo, público, curso/produto, período e canais;
- responsáveis e participantes;
- briefing, notas, anexos e materiais;
- estados válidos e timeline;
- histórico e permissões;
- UX responsiva, erros e estados vazios.

**Saída:** o time organiza campanhas no Nexus AI sem depender de planilhas paralelas.

**PRD:** [Fase 2 — Workspace Operacional MVP](docs/prds/phase-2-workspace-operacional-mvp.md)

### Fase 3: Calendário e Esteira de Produção

**Objetivo:** transformar campanhas em trabalho planejado e acompanhável.

**Entregas:**

- itens operacionais vinculados à campanha;
- calendário mensal, semanal e lista;
- tarefas, mensagens, posts, peças, revisões e marcos;
- responsáveis, prazos, prioridade e dependências;
- conteúdos em rascunho e versões;
- estados de produção;
- notificações internas básicas.

**Saída:** o Nexus AI vira a referência diária da produção de marketing.

**PRD:** [Fase 3 — Calendário e Esteira de Produção](docs/prds/phase-3-calendario-esteira-producao.md)

### Fase 4: Hermes Campaign Operator

**Objetivo:** permitir que o Hermes leia e opere objetos reais do produto.

**Entregas:**

- ferramentas MCP de consulta e mutação controlada;
- criação de campanha em rascunho;
- atualização com confirmação;
- geração de calendário e itens;
- criação e vínculo de conteúdo;
- revisão pelo tom de voz ENS;
- conversão de resposta do chat em objeto;
- auditoria correlacionada com chat e run.

**Saída:** resultados acionáveis deixam de ficar presos no histórico da conversa.

**PRD:** [Fase 4 — Hermes Campaign Operator](docs/prds/phase-4-hermes-campaign-operator.md)

### Fase 5: Governança e Aprovações

**Objetivo:** criar controle editorial e institucional sem bloquear a criação.

**Entregas:**

- aprovação editorial e autorização de ações sensíveis;
- versão congelada para decisão;
- comentários e solicitação de ajustes;
- aprovar, rejeitar, cancelar e expirar;
- fila para manager/admin;
- segregação de funções;
- payload imutável para execução;
- notificações e trilha de decisão.

**Saída:** nenhum material ou pacote sensível avança sem governança adequada.

**PRD:** [Fase 5 — Governança e Aprovações](docs/prds/phase-5-governanca-aprovacoes.md)

### Fase 6: Execução Assistida Piloto

**Objetivo:** executar um canal real com controle humano e rastreabilidade.

**Entregas:**

- escolha de um único canal piloto;
- outbox transacional;
- worker separado;
- idempotência e prevenção de duplicidade;
- retry, backoff, dead-letter e reprocessamento;
- consentimento, opt-out e LGPD;
- prévia e teste de envio;
- aprovação humana obrigatória;
- estados e histórico da execução.

**Saída:** uma operação real é executada com segurança e evidência.

**PRD:** [Fase 6 — Execução Assistida Piloto](docs/prds/phase-6-execucao-assistida-piloto.md)

### Fase 7: Performance, Diagnóstico e Aprendizado

**Objetivo:** fechar o ciclo entre planejamento, execução e resultado.

**Entregas:**

- ingestão e qualidade de métricas;
- painel por campanha, canal e curso;
- funil e comparativos;
- recomendações do Hermes;
- hipóteses e aprendizados;
- promoção de conhecimento validado para RAG/Graph;
- rastreabilidade da fonte e da confiança.

**Saída:** o produto explica o que aconteceu e orienta a próxima ação.

**PRD:** [Fase 7 — Performance, Diagnóstico e Aprendizado](docs/prds/phase-7-performance-diagnostico-aprendizado.md)

### Fase 8: Hermes Proativo e Escala Operacional

**Objetivo:** antecipar problemas e oportunidades usando dados confiáveis.

**Entregas:**

- alertas de campanha sem próximo passo;
- prazos, fechamentos e aprovações vencendo;
- anomalias de performance;
- resumos diários e semanais;
- sugestões de otimização;
- automações recorrentes controladas;
- preferências, limites e frequência;
- avaliação da qualidade das recomendações.

**Saída:** o Hermes atua como parceiro operacional contínuo, sem executar ações sensíveis sem autorização.

**PRD:** [Fase 8 — Hermes Proativo e Escala Operacional](docs/prds/phase-8-hermes-proativo-escala.md)

## 10. Dependências

```text
Fase 0
  → Fase 1
      → Fase 2 (primeiro release de valor)
          → Fase 3
              → Fase 4
                  → Fase 5
                      → Fase 6
                          → Fase 7
                              → Fase 8
```

Instrumentação começa na Fase 1, mesmo que dashboards sejam entregues na Fase 7. Segurança, testes, auditoria, observabilidade e documentação são requisitos transversais.

## 11. Gates obrigatórios

### Gate local

- migrations em ambiente limpo;
- testes unitários, integração, contrato e E2E aplicáveis;
- build, lint e typecheck;
- RLS, tenant e papéis;
- persistência após reinício;
- falhas e recuperação;
- backup e rollback;
- evidências registradas.

### Gate VPS Linux

Depois do deploy realizado pelo responsável:

- health checks dos containers;
- migrations e políticas;
- comunicação entre serviços;
- volumes e permissões Linux;
- DNS, TLS, CORS e envs;
- smoke tests com dados identificados como teste;
- logs e correlação;
- persistência após reinício;
- backup confirmado;
- rollback verificável;
- aceite funcional.

Enquanto o gate da VPS não for concluído, a fase ficará como **pronta para produção**, nunca como **concluída**.

## 12. Definition of Done

Uma fase estará concluída somente quando:

- requisitos obrigatórios e critérios de aceite estiverem atendidos;
- testes automatizados estiverem verdes;
- não houver falha crítica ou alta conhecida;
- segurança, RLS e papéis estiverem validados;
- auditoria e observabilidade estiverem funcionando;
- documentação, backup e rollback estiverem atualizados;
- gate local estiver registrado;
- deploy na VPS tiver sido realizado;
- gate de produção estiver aprovado;
- pendências restantes estiverem formalmente fora do escopo.

## 13. Não objetivos globais

- usar n8n como orquestrador central;
- disparar automaticamente sem aprovação adequada;
- integrar vários canais profundamente ao mesmo tempo;
- usar Graph ou memória do Hermes como banco transacional;
- colocar regras de campanhas dentro da Chat Bridge;
- criar dashboard complexo antes de dados confiáveis;
- remover legado sem inventário, evidência e rollback;
- declarar uma fase concluída apenas porque o código foi implementado.

## 14. Documentos do programa

- [Design aprovado](docs/plans/2026-07-10-nexus-marketing-ops-roadmap-design.md)
- [Plano documental e de preparação](docs/plans/2026-07-10-nexus-marketing-ops-program.md)
- [Índice de PRDs](docs/prds/README.md)

## 15. Norte do produto

Se uma campanha nasce fora do Nexus AI, ela deve poder entrar nele.

Se uma campanha nasce no Hermes, ela deve virar operação rastreável.

Se uma campanha performa bem, ela deve virar conhecimento validado.

Se uma campanha performa mal, ela deve virar aprendizado acionável.

Se uma ação é sensível, ela deve ser preparada, aprovada e executada exatamente como foi decidida.
