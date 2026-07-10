# PRD — Fase 0: Diagnóstico e Contrato de Evolução

- **Status:** approved
- **Responsável funcional:** a definir
- **Dependências:** nenhuma
- **Resultado:** base inventariada, classificada e pronta para decisões de implementação

## Resumo

A Fase 0 transforma conhecimento disperso do monorepo e dos ambientes em um inventário verificável. Ela não executa uma grande refatoração; estabelece o que existe, o que continua, quais dados são reais e quais decisões devem orientar as fases seguintes.

## Problema

O repositório reúne experimentos, módulos antigos, migrations que criaram e removeram campanhas, documentação histórica e serviços com responsabilidades diferentes. Implementar o novo produto sem uma linha de base pode reutilizar estruturas erradas, remover dados úteis ou criar dois conceitos com o mesmo nome.

## Objetivos

- mapear o produto e a infraestrutura atuais;
- identificar dependências e dados em uso;
- classificar legado sem removê-lo prematuramente;
- definir glossário e ownership;
- registrar decisões arquiteturais;
- criar critérios objetivos para migrations, deploy e rollback;
- produzir backlog priorizado para a Fase 1.

## Não objetivos

- remover em massa código ou banco legado;
- redesenhar a interface;
- criar o Marketing Ops;
- migrar campanhas de origem ainda não confirmada;
- integrar canais de disparo;
- resolver dívidas sem impacto no roadmap.

## Usuários e participantes

- responsável pelo produto;
- marketing ENS;
- engenharia;
- administração do Supabase;
- operação da VPS;
- segurança/compliance quando necessário.

## Escopo funcional

### F0-RF-01 — Inventário de telas e jornadas

Registrar rotas, menus, telas, estados de acesso, dependências e situação: `keep`, `adapt`, `migrate`, `archive` ou `remove_candidate`.

### F0-RF-02 — Inventário de serviços

Registrar finalidade, porta, dependências, volumes, secrets, health check, owner, consumidores e criticidade de cada serviço do Compose.

### F0-RF-03 — Inventário Supabase

Listar tabelas, views, funções, triggers, policies, buckets e Edge Functions. Para cada item, registrar evidência de uso, owner, dados, retenção e ação proposta.

### F0-RF-04 — Inventário Hermes

Documentar frontend → bridge → Hermes, sessões, runs, eventos, anexos, artefatos, aprovações técnicas, RAG, Graph, skills e memória.

### F0-RF-05 — Glossário

Definir nomes oficiais para campanha, item, conteúdo, versão, aprovação editorial, autorização operacional, execução, aprendizado, tenant e papéis.

### F0-RF-06 — Matriz de responsabilidade

Definir o que pertence ao frontend, Chat Bridge, Hermes, Marketing Ops, Supabase, Artifact Server, RAG, Graph e futuros workers.

### F0-RF-07 — Mapa de dados

Identificar origem, classificação, sensibilidade, retenção, volume e qualidade dos dados necessários às campanhas.

### F0-RF-08 — Decisões arquiteturais

Criar ADRs para decisões que afetam a Fase 1, incluindo serviço de domínio, contratos, autorização, eventos, migrations e observabilidade.

### F0-RF-09 — Estratégia de transição

Definir compatibilidade temporária, feature flags, sequência de migrations, coexistência, rollback e critérios para remover legado.

### F0-RF-10 — Backlog classificado

Produzir itens com impacto, risco, dependência, evidência e fase-alvo. Nenhum item pode ser apenas “limpar depois”.

## Entregáveis

- inventário de frontend;
- catálogo de serviços;
- catálogo Supabase;
- mapa da integração Hermes;
- glossário;
- matriz RACI/ownership;
- mapa de dados;
- ADRs obrigatórias;
- registro de riscos;
- plano de transição;
- backlog da Fase 1;
- checklist local e VPS aplicável ao diagnóstico.

## Requisitos não funcionais

- inventários versionados no Git;
- toda classificação possui evidência;
- nenhuma credencial é copiada para documentos;
- exportações de esquema não incluem dados pessoais;
- comandos de inspeção são reproduzíveis;
- decisões possuem data, autor e consequência.

## Segurança e privacidade

- mascarar secrets e PII;
- registrar onde existe `service_role` e quem a consome;
- revisar CORS, exposição de portas e redes;
- mapear permissões reais, não apenas declaradas;
- identificar dados sujeitos à LGPD;
- registrar políticas ausentes ou permissivas como risco.

## Observabilidade

O diagnóstico deve identificar logs, health checks, métricas, correlation IDs e lacunas por serviço. Não é necessário implementar toda a observabilidade nesta fase.

## Critérios de aceite

- [ ] Todas as rotas ativas foram classificadas.
- [ ] Todos os serviços do Compose têm owner e responsabilidade.
- [ ] Tabelas, views, funções, policies e buckets foram inventariados.
- [ ] A integração frontend–bridge–Hermes está documentada ponta a ponta.
- [ ] Aprovação técnica foi diferenciada de aprovação de negócio.
- [ ] O glossário foi aprovado pelo responsável do produto.
- [ ] Não há decisão estrutural crítica da Fase 1 sem owner.
- [ ] Riscos possuem severidade e mitigação.
- [ ] Legado candidato a remoção possui evidência e rollback.
- [ ] Backlog da Fase 1 está priorizado.

## Estratégia de testes e validação

### Repositório

- comparar inventário com `rg --files`, rotas e Compose;
- validar links e caminhos;
- comparar migrations com o schema do ambiente autorizado;
- conferir que não há secrets no diff.

### Ambiente local

- executar scripts existentes de validação;
- subir o Compose quando as credenciais locais permitirem;
- registrar health checks e dependências;
- validar persistência após reinício onde aplicável.

### VPS

- conferir o Compose efetivo sem imprimir secrets;
- validar containers, volumes, redes e health checks;
- comparar versões/migrations com o inventário;
- registrar divergências entre repositório e produção.

## Riscos

| Risco | Mitigação |
|---|---|
| Schema local diferente da produção | Comparação controlada e snapshot versionado |
| Remoção prematura | Apenas classificar; remover em plano específico |
| Secrets em evidências | Redação e revisão antes do commit |
| Documentação ficar obsoleta | Owner e data de revisão |
| Escopo infinito | Priorizar apenas o que afeta fases 1–8 |

## Gate de saída

A Fase 1 pode iniciar quando inventários, glossário, ADRs bloqueantes, matriz de responsabilidade, riscos e backlog estiverem aprovados. A Fase 0 fica `completed` somente depois que as verificações aplicáveis também forem confirmadas na VPS.
