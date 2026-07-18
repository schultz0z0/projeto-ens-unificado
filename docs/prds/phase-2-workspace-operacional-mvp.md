# PRD — Fase 2: Workspace Operacional MVP

- **Status:** `completed`
- **Implementação:** `production_validated`
- **Última reconciliação:** 2026-07-18 — homologação VPS preservada e gates locais saneados
- **Dependência:** Fase 1 concluída
- **Resultado:** primeiro release utilizável por campanhas reais

## Resumo

O Workspace Operacional permite que o time registre, encontre, acompanhe e atualize campanhas dentro do Nexus AI. Esta fase entrega valor independente do chat e evita planilhas paralelas, mantendo preparação para o Hermes operar os mesmos objetos na Fase 4.

## Problema

Campanhas e materiais podem ficar espalhados em conversas, documentos e ferramentas sem uma unidade oficial de trabalho. O time precisa de visão comum sobre objetivo, público, responsáveis, período, canais, briefing e estado.

## Objetivos

- tornar campanha uma entidade útil ao trabalho diário;
- centralizar briefing, responsáveis e materiais;
- permitir criação e manutenção manual confiável;
- oferecer busca, filtros e histórico;
- validar o domínio da Fase 1 com uso real;
- entregar uma experiência responsiva e acessível.

## Não objetivos

- calendário completo;
- geração automática pelo Hermes;
- aprovação editorial;
- disparos;
- dashboards de performance;
- automações proativas.

## Personas

### Member de marketing

Cria e mantém campanhas em que participa, adiciona contexto e acompanha próximos passos.

### Manager

Visualiza o portfólio do escopo, define responsáveis, corrige organização e arquiva campanhas.

### Admin

Possui visão administrativa e diagnóstico, sem substituir a operação cotidiana do manager.

## Jornadas prioritárias

1. Criar campanha em rascunho.
2. Completar briefing e participantes.
3. Planejar e ativar campanha.
4. Encontrar campanhas por curso, responsável, canal, status ou período.
5. Abrir workspace e entender situação atual.
6. Anexar ou vincular materiais.
7. Consultar timeline e alterações.
8. Concluir ou arquivar campanha.

## Requisitos funcionais

### F2-RF-01 — Lista

Exibir nome, referência de curso/produto, status, período, canais, responsáveis, atualização e indicador de atenção quando aplicável.

### F2-RF-02 — Busca e filtros

Buscar por nome e campos autorizados. Filtrar por status, curso/produto, canal, responsável e período. Filtros devem ser combináveis, compartilháveis por URL e resetáveis.

### F2-RF-03 — Criação

Criar rascunho com nome obrigatório. O fluxo pode salvar progresso sem exigir briefing completo.

### F2-RF-04 — Dados da campanha

Campos previstos:

- nome;
- objetivo;
- curso, produto ou iniciativa;
- referência oficial e snapshot mínimo do título;
- público;
- período;
- canal principal e canais secundários;
- responsáveis e participantes;
- briefing;
- notas;
- status;
- tags controladas quando justificadas.

### F2-RF-05 — Workspace

Organizar visão geral, briefing, participantes, materiais, atividade e configuração. Abas futuras podem aparecer somente quando funcionais.

### F2-RF-06 — Transições

Permitir `draft → planned → active → completed → archived`, com regras para retorno quando aprovado no design técnico. Arquivamento exige confirmação e permissão.

### F2-RF-07 — Participantes

Adicionar/remover usuários autorizados e definir responsável principal. Impedir remover o último responsável quando a campanha não está em rascunho.

### F2-RF-08 — Materiais

Vincular artefatos existentes ou realizar upload conforme política. O workspace guarda metadata e ID; o arquivo permanece no serviço adequado.

### F2-RF-09 — Timeline

Mostrar eventos úteis: criação, campos relevantes alterados, participante adicionado/removido, status e material vinculado.

### F2-RF-10 — Edição concorrente

Em conflito de versão, avisar que a campanha mudou e oferecer recarregar/revisar. Nunca sobrescrever silenciosamente.

### F2-RF-11 — Exclusão

Não oferecer hard delete comum. Usar arquivamento. Exclusão administrativa futura requer política separada.

### F2-RF-12 — Deep links

Cada campanha possui URL estável que poderá ser usada pelo Hermes e por notificações.

## Regras de negócio

- nome é obrigatório e limitado;
- datas devem formar período válido;
- campanha ativa exige objetivo, período e responsável;
- referências oficiais devem ser validadas quando disponíveis;
- somente participante autorizado lê campanha restrita;
- status não representa aprovação de cada peça;
- materiais não são automaticamente considerados aprovados;
- arquivamento preserva auditoria e vínculos.

## UX

- desktop e mobile;
- estados loading, vazio, sem resultado, erro e acesso negado;
- autosave somente se não esconder erros/conflitos;
- feedback claro de sucesso;
- navegação por teclado nos fluxos essenciais;
- labels e contraste acessíveis;
- formulários divididos por contexto, sem formulário gigante;
- ação principal consistente.

## Permissões

| Ação | Member | Manager | Admin |
|---|---:|---:|---:|
| Criar rascunho | Sim | Sim | Sim |
| Ler campanha participante | Sim | Sim | Sim |
| Editar campanha participante | Conforme regra | Sim | Sim |
| Gerenciar participantes | Limitado | Sim | Sim |
| Arquivar | Não por padrão | Sim | Sim |
| Ver auditoria detalhada | Própria/permitida | Escopo | Sim |

## Dados e API

Operações mínimas:

- listar e paginar;
- buscar/filtrar;
- obter detalhe;
- criar rascunho;
- atualizar com versão;
- alterar status;
- gerenciar participantes;
- vincular/desvincular material;
- obter timeline.

Todos os comandos mutáveis usam idempotência e auditoria.

## Observabilidade e métricas de produto

- campanhas criadas e planejadas;
- taxa de conclusão do briefing;
- tempo até `planned`;
- conflitos de edição;
- erros por operação;
- latência da lista e detalhe;
- campanhas sem responsável;
- usuários ativos no workspace.

Métricas não devem incluir conteúdo sensível nos labels.

## Critérios de sucesso

- equipe piloto consegue registrar campanhas reais sem planilha paralela para os campos cobertos;
- campanhas relevantes são encontradas em poucos passos;
- alterações têm ator e histórico;
- nenhum usuário acessa campanha fora do escopo;
- reinício não perde dados ou vínculos;
- fluxo principal funciona em desktop e mobile.

## Critérios de aceite

- [x] Usuário autorizado cria rascunho.
- [x] Campos obrigatórios e datas são validados.
- [x] Campanha não ativa sem responsável e dados mínimos.
- [x] Lista pagina, busca e combina filtros.
- [x] URL preserva filtros relevantes.
- [x] Workspace mostra visão geral, briefing, participantes, materiais e atividade.
- [x] Upload/vínculo respeita ownership e limites.
- [x] Conflito de versão não sobrescreve dados.
- [x] Member, manager e admin respeitam a matriz.
- [x] Arquivamento preserva histórico.
- [x] Timeline não expõe campos proibidos.
- [x] Estados de erro e vazio estão implementados.
- [x] Jornadas críticas são responsivas e acessíveis.

### Progresso dos critérios de aceite

Os critérios foram aprovados no gate VPS de 16/07/2026 e reconciliados com os
gates locais de 18/07/2026.

| Critério | Estado final | Evidência |
|---|---|---|
| Criação, campos e transições | `production_validated` | domínio, API, PostgreSQL e jornadas VPS |
| Lista, busca, filtros e URL | `production_validated` | jornadas VPS; p95 local 21,38–23,36 ms com 5.000 campanhas |
| Workspace e painéis | `production_validated` | desktop/mobile/axe e integração real |
| Materiais | `production_validated` | ownership, upload/access/unlink e persistência |
| Concorrência | `production_validated` | 409/reaplicação e harness sem deadlock |
| Papéis e isolamento | `production_validated` | member/manager/admin/viewer e cross-tenant |
| Arquivamento e timeline | `production_validated` | histórico preservado, allowlists, pgTAP e logs |
| Erro, vazio, responsividade e acessibilidade | `production_validated` | smokes, desktop/mobile/axe |

## Testes

### Unitários

Schemas, datas, transições, filtros, permissões e conflitos.

### Integração

CRUD, participantes, materiais, timeline, RLS e auditoria.

### E2E

- criar campanha;
- completar briefing;
- adicionar responsável;
- planejar/ativar;
- filtrar e abrir;
- provocar conflito;
- arquivar;
- validar acesso negado.

### Performance

Lista paginada com volume representativo e detalhe com materiais/timeline.

## Gate local

- migrations e rollback;
- testes verdes;
- build/lint/typecheck;
- fluxo completo com os três papéis;
- responsividade e acessibilidade básica;
- persistência após reinício;
- evidências do aceite funcional.

### Histórico da exceção operacional do computador de retomada

Em 14/07/2026, o computador usado na retomada não possuía Docker. Os gates de
PostgreSQL/Linux foram então executados na VPS. Em 18/07/2026, este computador
com Docker Desktop repetiu reset, pgTAP, lint/diff, concorrência e performance
local. A exceção não está mais ativa.

## Gate VPS

- deploy do backend e frontend;
- migrations confirmadas;
- CORS, TLS e auth;
- smoke com campanhas de teste;
- upload e acesso de artefatos;
- papéis e isolamento;
- logs/correlation ID;
- reinício e rollback.

## Riscos

| Risco | Mitigação |
|---|---|
| Formulário complexo | Rascunho progressivo e seções |
| Estados demais | Máquina simples de campanha |
| Curso desatualizado | Referência RAG + snapshot mínimo |
| Lista lenta | Paginação, índices e payload resumido |
| Material órfão | Ownership e limpeza explícita |
| Time continuar em planilhas | Piloto real e feedback antes de ampliar |

## Rollout

1. feature flag para equipe piloto;
2. dados de teste;
3. uma ou duas campanhas reais controladas;
4. correções de bloqueadores;
5. ampliação gradual;
6. homologação VPS e aceite.

## Gate de saída

A Fase 2 recebeu `completed`/`production_validated` após o gate VPS e o
saneamento local. O piloto funcional foi aceito e não existe falha alta
conhecida. A adoção longitudinal sem planilhas permanece métrica de produto e
não bloqueia a entrada técnica da Fase 3.
