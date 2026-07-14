# PRD — Fase 2: Workspace Operacional MVP

- **Status:** approved
- **Implementação:** `in_progress_through_task_12`
- **Última evidência de código:** `7fcbd21` — workspace editável, conflito, transições e arquivamento implementados
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

- [ ] Usuário autorizado cria rascunho.
- [ ] Campos obrigatórios e datas são validados.
- [ ] Campanha não ativa sem responsável e dados mínimos.
- [ ] Lista pagina, busca e combina filtros.
- [ ] URL preserva filtros relevantes.
- [ ] Workspace mostra visão geral, briefing, participantes, materiais e atividade.
- [ ] Upload/vínculo respeita ownership e limites.
- [ ] Conflito de versão não sobrescreve dados.
- [ ] Member, manager e admin respeitam a matriz.
- [ ] Arquivamento preserva histórico.
- [ ] Timeline não expõe campos proibidos.
- [ ] Estados de erro e vazio estão implementados.
- [ ] Jornadas críticas são responsivas e acessíveis.

### Progresso dos critérios de aceite

Os checkboxes permanecem abertos até a evidência completa exigida pelo gate da fase. Implementação parcial é registrada abaixo sem antecipar aceite PostgreSQL, frontend ou VPS.

| Critério | Estado em 14/07/2026 | Evidência/pendência |
|---|---|---|
| Usuário autorizado cria rascunho | `backend_client_and_ui_implemented_pending_vps_validation` | diálogo name-only, idempotência e navegação ao deep link cobertos; auth/API/banco real e E2E VPS pendentes |
| Campos obrigatórios e datas são validados | `backend_client_and_ui_implemented_pending_vps_validation` | schemas, formulário, datas e canais verdes; banco/API real pendentes |
| Campanha não ativa sem responsável e dados mínimos | `backend_implemented_pending_vps_validation` | regra de domínio implementada; PostgreSQL real pendente |
| Lista pagina, busca e combina filtros | `backend_client_and_ui_implemented_pending_vps_validation` | projeção resumida, tabela/cards, filtros e cursor cobertos por testes nativos; performance, banco e API real pendentes |
| URL preserva filtros relevantes | `frontend_implemented_pending_vps_validation` | busca/status preservados e combinados no browser; deep link real e E2E VPS pendentes |
| Workspace mostra visão geral, briefing, participantes, materiais e atividade | `overview_and_briefing_ui_implemented_panels_pending` | visão/briefing responsivos existem; participantes, materiais e atividade são Task 13 |
| Upload/vínculo respeita ownership e limites | `backend_and_client_implemented_pending_vps_validation` | client envia `File` bruto com MIME/nome/versão/idempotência; integração real e UI pendentes |
| Conflito de versão não sobrescreve dados | `backend_client_and_ui_implemented_pending_vps_validation` | diálogo preserva/compara valor local e reaplica só após decisão; 409 API/DB real pendente |
| Member, manager e admin respeitam a matriz | `partially_implemented_pending_vps_validation` | autorização nativa parcial; RLS/E2E/VPS pendentes |
| Arquivamento preserva histórico | `backend_client_and_ui_implemented_pending_vps_validation` | confirmação e read-only implementados; preservação no PostgreSQL/timeline/VPS pendente |
| Timeline não expõe campos proibidos | `implemented_pending_vps_validation` | backend seguro e client reduzido/paginado implementados; pgTAP, UI e logs VPS pendentes |
| Estados de erro e vazio estão implementados | `list_and_workspace_states_implemented_panels_pending` | lista e workspace cobrem loading, vazio, 403, 404, erro, correlação e retry; painéis da Task 13 pendentes |
| Jornadas críticas são responsivas e acessíveis | `list_and_workspace_journeys_implemented_pending_e2e` | semântica e larguras 390/768/1440 px validadas; painéis, axe e E2E integrado permanecem pendentes |

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

### Exceção operacional do computador de retomada

Por decisão do usuário em 14 de julho de 2026, o computador atual não usará Docker Desktop, WSL ou Podman. O desenvolvimento executa localmente os testes nativos, lint, typecheck, build e validações estáticas. Testes que exigem PostgreSQL/Supabase conteinerizado, imagens Linux, Compose, restart ou persistência são preparados durante as tasks e obrigatoriamente executados na VPS de produção com fixtures identificadas e cleanup. O fechamento interno recebe `implementation_complete_pending_vps_validation`, ainda dentro de `in_progress`; esta exceção não altera o gate de saída nem permite marcar a fase `completed` antes da homologação VPS.

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

A Fase 3 inicia quando o Workspace Operacional estiver adotado pelo grupo piloto, sem falhas altas, com auditoria, RLS, filtros e fluxos essenciais validados. A Fase 2 é o primeiro release de valor, mas só recebe status `completed` depois do gate VPS.
