# Fase 2 — Design Técnico do Workspace Operacional MVP

- **Estado:** `approved_as_built`
- **Data:** 2026-07-13; reconciliação final em 2026-07-18
- **Dependência:** Fase 1 `production_validated`
- **PRD:** `docs/prds/phase-2-workspace-operacional-mvp.md`
- **Roadmap:** `Roadmap.md`

## Reconciliação as built

O design foi implementado e homologado. Três decisões de execução passam a
integrar o contrato:

1. “Configurações” é representada pelos controles de ciclo de vida e
   arquivamento no cabeçalho, sem uma seção vazia separada.
2. O hotfix do RAG aplicado durante QA altera somente a consulta de leitura; o
   Supabase do app segue como fonte transacional exclusiva.
3. O saneamento de performance adiciona filtro explícito de tenant e índice de
   ordenação. A migration está validada localmente e aguarda o próximo deploy.

O detalhe e a justificativa estão em [decision-log.md](decision-log.md).

## 1. Objetivo

Entregar o primeiro release de valor do Nexus AI para campanhas reais. O time de marketing deverá criar, localizar, completar, acompanhar, atualizar, concluir e arquivar campanhas sem depender de planilhas paralelas para os campos cobertos pelo MVP.

O Workspace Operacional será uma nova superfície manual do produto. Ele utilizará o mesmo domínio transacional já exposto ao Hermes, mas não antecipará o calendário da Fase 3, a operação ampla do Hermes da Fase 4, aprovações da Fase 5 nem execução de canais da Fase 6.

## 2. Alinhamento com roadmap e PRD

| Contrato aprovado | Decisão deste design |
|---|---|
| Campanha é a unidade principal | Lista e workspace são organizados por campanha |
| Supabase é a fonte operacional | Todos os campos, participantes, materiais, eventos e versões ficam no schema `marketing_ops` |
| Frontend e Hermes usam o mesmo domínio | REST e MCP continuam chamando a mesma camada de domínio |
| Chat Bridge não possui CRUD operacional | Nenhuma rota de campanha, participante ou material será adicionada à Bridge |
| Artifact Server/Storage guarda binários | Marketing Ops guarda somente metadata e referências duráveis |
| RAG contém fatos oficiais de cursos | O catálogo de cursos é consultado em leitura; nenhum dado da campanha é gravado no RAG |
| Mutação é auditável e idempotente | Todos os comandos REST usam `Idempotency-Key`, transação, auditoria e evento |
| Concorrência não sobrescreve silenciosamente | Updates exigem `If-Match` com a versão observada |
| Member, manager e admin têm limites distintos | O serviço e a RLS aplicam a matriz; o frontend apenas reflete capacidades |
| Fase só conclui após gate VPS | O status final depende de deploy, smoke, logs e aceite manual na VPS |

## 3. Escopo

### Incluído

- lista paginada de campanhas;
- busca por nome e referência de curso/produto/iniciativa;
- filtros combináveis e persistidos na URL;
- criação progressiva de rascunho;
- workspace com visão geral, briefing, pessoas, materiais, atividade e configurações funcionais;
- objetivo, referência, público, período, canais, briefing e notas;
- responsáveis e participantes;
- transições `draft`, `planned`, `active`, `completed` e `archived`;
- upload e vínculo de materiais;
- timeline segura por campanha;
- conflito de edição com revisão explícita;
- estados loading, vazio, sem resultado, erro e acesso negado;
- instrumentação de produto e operação;
- desktop e mobile;
- rollout por feature flags.

### Excluído

- calendário, tarefas, dependências e conteúdo versionado da Fase 3;
- novas mutações amplas do Hermes sobre campos do workspace;
- aprovação editorial ou operacional;
- publicação, envio ou disparo;
- dashboards de performance;
- automações proativas;
- hard delete de campanhas ou materiais;
- tags livres ou controladas nesta fase;
- restauração de campanha arquivada;
- limpeza das tabelas legadas fora do schema `marketing_ops`.

`campaign_items` permanece como prova da fundação da Fase 1 e não será exibida no Workspace da Fase 2.

## 4. Abordagens avaliadas

### A. Evoluir verticalmente o Marketing Ops existente — escolhida

O serviço recebe schema e comandos adicionais, expõe REST ao frontend, preserva MCP e usa adaptadores internos para RAG e Artifact Server. A autorização, a auditoria e a concorrência permanecem centralizadas.

**Vantagens:** respeita os ADRs, evita duplicação de regras, preserva a fundação validada e produz contratos reutilizáveis pela Fase 4.

**Custo:** exige ampliar banco, serviço, frontend e testes de forma coordenada.

### B. Frontend acessar diretamente novas tabelas Supabase — rejeitada

Reduziria código REST no curto prazo, mas duplicaria regras no navegador, fragmentaria idempotência/auditoria e permitiria divergência entre frontend e Hermes.

### C. Criar outro BFF ou colocar o workspace na Chat Bridge — rejeitada

Duplicaria o domínio ou misturaria transporte conversacional com operação. Também aumentaria o blast radius do chat e contrariaria o ADR 0001.

## 5. Arquitetura

```text
Frontend React
  ├─ /marketing-ops/campaigns
  └─ /marketing-ops/campaigns/:campaignId
             │ JWT Supabase + If-Match + Idempotency-Key
             ▼
Marketing Ops REST
  ├─ autenticação, tenant e RBAC
  ├─ comandos/queries de campanha
  ├─ participantes e diretório controlado
  ├─ timeline segura
  ├─ adaptador de referências ───────► RAG MCP (somente leitura)
  └─ adaptador de materiais ─────────► Artifact Server (binários)
             │ transação, RLS, audit, domain event
             ▼
Supabase do app / schema marketing_ops
```

### Fronteiras preservadas

- O frontend não recebe service role, chave interna do Artifact Server nem credencial do RAG.
- A Chat Bridge não recebe endpoints de campanhas.
- O Hermes mantém as tools v1 existentes. O Workspace não depende do chat.
- O Supabase do RAG não recebe migrations ou mutações da Fase 2.
- O Marketing Ops não armazena URLs assinadas; elas são emitidas sob demanda.

## 6. Modelo de domínio

### 6.1 Campanha

A tabela `marketing_ops.campaigns` será ampliada aditivamente com:

| Campo | Tipo/limite | Regra |
|---|---|---|
| `name` | texto, 1–200 | obrigatório em todo estado |
| `objective` | texto, até 2.000 | obrigatório para `planned` e estados posteriores |
| `reference_type` | `course`, `product`, `initiative` | obrigatório para `planned` e estados posteriores |
| `reference_key` | texto, até 200 | identificador oficial quando existir |
| `reference_title_snapshot` | texto, até 300 | título exibível congelado no momento da seleção |
| `reference_document_id` | UUID opcional | documento oficial do RAG quando o tipo for `course`; referência externa sem FK entre projetos Supabase |
| `reference_verified_at` | timestamp opcional | preenchido após validação de curso no RAG |
| `audience` | texto, até 2.000 | progressivo; não bloqueia `planned` |
| `starts_on` | data | obrigatório para `planned` e estados posteriores |
| `ends_on` | data | obrigatório para `planned` e não pode ser anterior a `starts_on` |
| `primary_channel` | canal controlado | opcional no rascunho |
| `secondary_channels` | array de canais, máximo 9 | sem duplicidade e sem repetir o principal |
| `briefing` | texto, até 20.000 | editável progressivamente |
| `notes` | texto, até 10.000 | observações operacionais, não conteúdo aprovado |
| `status` | enum da campanha | máquina de estados definida abaixo |
| `version` | bigint positivo | incrementa em toda mutação da campanha |

Canais controlados do MVP:

- `email`;
- `instagram`;
- `linkedin`;
- `facebook`;
- `whatsapp`;
- `website`;
- `paid_media`;
- `events`;
- `press`;
- `other`.

O campo legado `course_slug` permanece fisicamente durante a Fase 2 para compatibilidade com as tools da Fase 1, mas deixa de ser o contrato principal do frontend. Registros existentes continuam como `draft`; uma referência legada precisa ser revisada no workspace antes de avançar para `planned`.

`version` representa a versão do agregado. Alterações na campanha, participantes e vínculos de materiais incrementam a versão da campanha e atualizam `updated_at`, para que lista, detalhe e conflitos observem o mesmo estado.

### 6.2 Participantes

`marketing_ops.campaign_members` continua sendo a relação entre campanha e usuário e recebe `is_primary boolean not null default false`.

Regras:

- `owner` representa responsável;
- `editor` pode alterar conteúdo operacional permitido;
- `viewer` possui leitura;
- toda campanha nasce com o criador como `owner` principal;
- pode haver múltiplos `owner`, mas exatamente um `owner` principal em todos os estados;
- `is_primary=true` exige `member_role='owner'`;
- campanha fora de `draft` não pode ficar sem owner ou sem owner principal;
- remoção/desativação de membership do tenant não apaga a participação histórica;
- nomes são resolvidos por função privada controlada sobre `public.profiles`, sem ampliar leitura direta da tabela pelo navegador.

### 6.3 Materiais

Nova tabela `marketing_ops.campaign_materials`:

| Campo | Finalidade |
|---|---|
| `id`, `tenant_id`, `campaign_id` | identidade e escopo |
| `artifact_id` | ID durável do Artifact Server |
| `artifact_owner_id` | owner exigido para emitir link temporário |
| `filename`, `content_type`, `size_bytes`, `sha256` | metadata validada |
| `source` | `upload` ou `existing_artifact` |
| `created_by`, `created_at` | autoria |
| `unlinked_by`, `unlinked_at` | desvínculo lógico |

Política do MVP:

- máximo de 25 MiB por upload do workspace, independentemente do limite maior do Artifact Server;
- tipos permitidos: PDF, DOCX, XLSX, PPTX, TXT, CSV, PNG, JPEG e WEBP;
- nome e MIME são normalizados server-side;
- o upload passa pelo Marketing Ops e é enviado ao Artifact Server com autenticação interna;
- falha antes da persistência remove o artifact recém-criado;
- retry com a mesma chave e mesmo hash retorna o vínculo anterior;
- mesma chave com hash diferente retorna `idempotency_conflict`;
- desvincular não remove automaticamente o binário compartilhado;
- link de acesso é curto, emitido sob demanda após autorização da campanha.

### 6.4 Timeline

A timeline é uma projeção de leitura, não acesso direto a `audit_events`.

Eventos exibidos:

- campanha criada;
- campos relevantes alterados;
- status alterado;
- owner/participante adicionado, removido ou alterado;
- responsável principal alterado;
- material vinculado ou desvinculado;
- campanha arquivada.

A resposta inclui tipo, ator exibível, timestamp, campos alterados e correlation ID. Não inclui briefing, notas, objetivo, audiência, bearer, token de delegação, URL assinada, payload bruto nem estado completo de auditoria.

Auditoria e eventos de domínio passam a usar snapshots minimizados. Campos de texto livre registram nome do campo, tamanho e hash, não o conteúdo integral.

## 7. Máquina de estados

```text
draft ──► planned ──► active ──► completed
  │           │          │            │
  └───────────┴──────────┴────────────┴──► archived

planned ──► draft       somente manager/admin
active ───► planned     somente manager/admin
completed ► active      somente manager/admin
```

### Transições normais

- owner principal, manager ou admin pode avançar a campanha;
- `draft → planned` exige nome, objetivo, referência/título, período válido e owner principal;
- `planned → active` revalida os mesmos invariantes;
- `active → completed` não exige aprovação editorial e não altera materiais;
- `archived` é terminal na Fase 2.

### Arquivamento

- somente manager/admin;
- permitido a partir de qualquer estado não arquivado;
- exige confirmação explícita na UI;
- preserva campanha, participantes, materiais, auditoria e timeline;
- não equivale a aprovação, rejeição ou exclusão.

## 8. Autorização

| Ação | Member | Manager | Admin |
|---|---|---|---|
| Criar rascunho | sim | sim | sim |
| Listar campanhas | somente participante | tenant | tenant autorizado |
| Ler workspace | participante | tenant | tenant autorizado |
| Editar campos | owner/editor participante | sim | sim |
| Avançar estado | owner principal | sim | sim |
| Reabrir estado | não | sim | sim |
| Adicionar/remover viewer/editor | owner principal | sim | sim |
| Alterar owners/principal | não | sim | sim |
| Vincular material próprio/upload | owner/editor | sim | sim |
| Desvincular material | owner/editor | sim | sim |
| Ler timeline segura | participante | tenant | tenant autorizado |
| Ler auditoria detalhada | não | tenant | tenants autorizados |
| Arquivar | não | sim | sim |

O frontend pode esconder ações indisponíveis, mas somente serviço e RLS decidem.

## 9. Referências oficiais de cursos

O Marketing Ops adiciona um cliente MCP interno read-only para o RAG ENS.

Fluxo:

1. O frontend chama `GET /v1/references/courses?q=<texto>`.
2. Marketing Ops chama `ens_rag_search` com `collections=['courses']`, `intent='course_fact'`, tenant ENS e `actor_profile` correlacionado ao usuário.
3. A resposta é reduzida a `documentId`, `referenceKey`, `title`, categoria, tipo e metadata de oferta útil ao seletor. `referenceKey` é o `metadata.course_id`; resultado sem esse identificador não é selecionável.
4. Ao salvar referência de curso, Marketing Ops chama `ens_rag_get_document` e confirma tenant `ens`, coleção `courses`, documento e `course_id`.
5. A campanha persiste a chave oficial, o ID do documento, o título snapshot e o timestamp da validação.

Se o RAG estiver indisponível, o usuário pode continuar editando outros campos do rascunho. Uma campanha com `reference_type='course'` não avança para `planned` enquanto a referência não estiver validada. Produto e iniciativa aceitam título manual e chave opcional.

## 10. Contrato REST

O prefixo permanece `/v1`. A superfície da Fase 1 estava protegida por flags e ainda não possuía UI operacional; os campos são ampliados de forma aditiva e todos os clientes versionados do repositório serão atualizados no mesmo release.

### Campanhas

- `GET /v1/campaigns` — lista resumida, cursor, busca e filtros;
- `POST /v1/campaigns` — cria rascunho com nome e referência opcional;
- `GET /v1/campaigns/:id` — detalhe completo e ETag;
- `PATCH /v1/campaigns/:id` — patch estrito de campos editáveis;
- `POST /v1/campaigns/:id/transitions` — aplica transição com versão;
- `POST /v1/campaigns/:id/archive` — arquiva com versão;
- `GET /v1/campaigns/:id/timeline` — projeção segura.

Filtros de `GET /v1/campaigns`:

- `q` — nome e título de referência;
- `status`;
- `referenceType`;
- `referenceKey`;
- `channel` — principal ou secundário;
- `responsible` — usuário com papel owner;
- `periodFrom` e `periodTo` — sobreposição do período da campanha;
- `cursor` e `limit`.

### Participantes

- `GET /v1/campaigns/:id/participants`;
- `GET /v1/campaigns/:id/participant-candidates?q=<texto>`;
- `POST /v1/campaigns/:id/participants`;
- `PATCH /v1/campaigns/:id/participants/:userId`;
- `DELETE /v1/campaigns/:id/participants/:userId`.

### Materiais

- `GET /v1/campaigns/:id/materials`;
- `POST /v1/campaigns/:id/materials/upload` — corpo binário, filename em header;
- `POST /v1/campaigns/:id/materials/link` — vincula artifact existente do ator;
- `POST /v1/campaigns/:id/materials/:materialId/access-link`;
- `DELETE /v1/campaigns/:id/materials/:materialId` — desvínculo lógico.

### Referências

- `GET /v1/references/courses?q=<texto>`.

### Regras de contrato

- toda mutação exige `Idempotency-Key`;
- toda mutação de campanha, participante ou material exige `If-Match` com a versão do agregado;
- responses de campanha retornam ETag;
- payloads JSON são strict e rejeitam mass assignment;
- busca vazia ou curta não consulta o RAG;
- listas usam cursor e limite máximo 100;
- erros preservam `code`, `message`, `correlationId` e `details` seguros.

Novos códigos estáveis:

- `invalid_transition`;
- `campaign_requirements_missing`;
- `primary_owner_required`;
- `participant_role_invalid`;
- `reference_not_verified`;
- `artifact_not_owned`;
- `material_type_not_allowed`;
- `material_too_large`;
- `version_conflict`.

## 11. Compatibilidade MCP

- Tools v1 de list/get/create/update continuam registradas.
- `create_campaign_draft` continua aceitando nome e `course_slug` opcional para não quebrar o hardening da Fase 1.
- Campanhas criadas por essa tool permanecem `draft` até revisão manual dos novos campos.
- Nenhuma tool nova de participante, material ou transição será adicionada na Fase 2.
- A expansão operacional completa do Hermes permanece na Fase 4.
- Testes de plano conversacional, delegação, replay e circuit breaker continuam obrigatórios no gate de regressão.

## 12. Frontend

### Rotas

- `/marketing-ops/campaigns`;
- `/marketing-ops/campaigns/:campaignId`.

As duas rotas usam `React.lazy` para não ampliar o chunk inicial. A Sidebar recebe uma entrada “Campanhas” atrás das flags existentes.

### Lista

- busca com debounce;
- filtros refletidos em `URLSearchParams`;
- botão para limpar filtros;
- paginação por cursor;
- cards/tabela responsiva com nome, referência, status, período, canais, responsáveis, atualização e atenção;
- estados separados para primeira carga, paginação, vazio, sem resultado, erro e acesso negado.

Indicadores de atenção do MVP:

- `missing_primary_owner`;
- `planned_start_due` quando uma campanha planejada alcança a data inicial;
- `active_past_end` quando uma campanha ativa ultrapassa a data final.

### Criação

O primeiro passo exige somente nome. A campanha é criada imediatamente como draft e o usuário é enviado ao workspace. Falha de criação mantém o modal e o texto digitado.

### Workspace

Seções funcionais:

1. Visão geral;
2. Briefing;
3. Pessoas;
4. Materiais;
5. Atividade;
6. Configurações.

Não serão exibidas abas vazias de calendário, conteúdo ou aprovação.

### Salvamento e conflitos

O MVP usa salvamento explícito por seção, sem autosave. Cada formulário conserva a versão carregada. Em `409 version_conflict`:

1. valores locais permanecem na tela;
2. a versão atual é recarregada em segundo plano;
3. um painel compara campos locais e atuais;
4. o usuário escolhe descartar a edição ou reaplicar valores sobre a versão atual;
5. nenhuma repetição automática sobrescreve o servidor.

### Acessibilidade e responsividade

- labels programáticas em todos os controles;
- foco restaurado após dialogs;
- navegação por teclado nas ações essenciais;
- mensagens de erro associadas aos campos;
- status não depende somente de cor;
- alvos de toque com pelo menos 44 px;
- lista e workspace testados em 390 px, 768 px e desktop;
- contraste compatível com WCAG AA nas superfícies essenciais.

## 13. Busca e performance

- coluna de busca gerada sobre `name` e `reference_title_snapshot`;
- índice GIN para busca textual;
- índices tenant/status/update, referência, período e participantes owners;
- filtro de período usa sobreposição: `starts_on <= periodTo` e `ends_on >= periodFrom`;
- lista nunca carrega briefing, notas, timeline ou materiais;
- detalhe carrega as seções sob demanda;
- cenário de performance local usa 5.000 campanhas no tenant de teste;
- leitura de primeira página deve permanecer dentro do SLO p95 de 500 ms.

## 14. Auditoria, eventos e observabilidade

Toda mutação grava entidade, auditoria, evento e idempotência conforme aplicável.

Métricas sem IDs pessoais ou conteúdo em labels:

- `marketing_ops_campaigns_created_total`;
- `marketing_ops_campaign_status_transitions_total{from,to}`;
- `marketing_ops_campaign_version_conflicts_total`;
- `marketing_ops_material_operations_total{operation,result}`;
- `marketing_ops_reference_lookup_total{result}`;
- `marketing_ops_campaigns_without_owner`;
- `marketing_ops_workspace_active_users_24h`;
- `marketing_ops_briefing_completion_ratio`;
- contagem e soma do tempo entre criação e `planned`.

Logs incluem correlation ID, rota, operação, status, duração, tenant e ator quando permitido. Não incluem conteúdo dos campos, nome do arquivo bruto, bearer, chave interna, URL assinada ou payload do RAG.

O healthcheck do Compose passa a consultar `/ready`. `/health` continua sendo liveness para diagnóstico, mas um processo sem banco não será considerado saudável para dependências.

## 15. Testes

### Banco

- bootstrap limpo;
- upgrade a partir da Fase 1;
- enum, checks, FKs e índices;
- RLS positiva e negativa para os três papéis;
- cross-tenant;
- exatamente um owner principal;
- campanha não ativa sem requisitos;
- auditoria imutável;
- rollback/forward fix documentado.

### Serviço

- schemas e limites de campo;
- matriz de permissões;
- máquina de estados;
- busca e filtros combinados;
- idempotência e concorrência;
- participantes;
- timeline redigida;
- curso válido/inválido/RAG indisponível;
- upload, tipo, tamanho, ownership e limpeza de falha;
- access link autorizado e negado;
- regressão das tools MCP e confirmação conversacional.

### Frontend

- serialização dos filtros na URL;
- client tipado e ETag;
- formulários e validação;
- estados loading/vazio/erro/403;
- conflito sem perda dos valores locais;
- capabilities e feature flags;
- navegação e permissões visuais.

### E2E

Playwright cobre, com usuários reais de teste `member`, `manager` e `admin`:

1. criar campanha;
2. completar briefing;
3. adicionar owner e alterar principal;
4. planejar e ativar;
5. buscar, filtrar e abrir por deep link;
6. provocar conflito em duas páginas;
7. enviar, abrir e desvincular material;
8. consultar timeline;
9. arquivar;
10. negar acesso cross-tenant e ação sem papel.

`@axe-core/playwright` valida as jornadas essenciais. Os testes são executados em Chromium desktop e viewport mobile de 390 px.

## 16. Documentação da fase

O pacote seguirá o padrão das Fases 0 e 1:

- `docs/phase-2/README.md`;
- `docs/phase-2/design.md`;
- `docs/phase-2/implementation-progress.md`;
- `docs/phase-2/continuation-handoff.md`;
- `docs/phase-2/requirements-traceability.md`;
- `docs/phase-2/risk-register.md`;
- `docs/phase-2/lgpd-retention.md`;
- `docs/phase-2/slo.md`;
- `docs/phase-2/runbook.md`;
- `docs/phase-2/rollback.md`;
- `docs/phase-2/local-validation.md`;
- `docs/phase-2/supabase-deployment.md`;
- `docs/phase-2/vps-validation.md`;
- plano datado em `docs/plans/`.

O progresso por task deve ser atualizado junto com a evidência correspondente, sem antecipar estados dependentes da VPS. O handoff consolida a retomada entre sessões e computadores, mas não substitui rastreabilidade, riscos, runbooks ou evidências de gate.

O README da fase conterá um gate de entrada que reconcilia:

- riscos da Fase 0 resolvidos pela Fase 1;
- riscos residuais aceitos;
- divergência entre F1-003 e o plano de limpeza Supabase ainda `planned_not_applied`;
- readiness do ambiente local;
- commit base e estado das flags.

A limpeza de legado será registrada como dívida separada e não será misturada às migrations do Workspace.

## 17. Fluxo de validação e deploy

### Histórico da exceção operacional de 14 de julho de 2026

O computador usado na retomada original não possuía Docker Desktop, WSL ou
Podman. Por isso, pgTAP, RLS real, concorrência PostgreSQL, imagens Linux,
Compose, restart e persistência foram executados na VPS. Em 18/07/2026, outro
computador com Docker Desktop repetiu os gates locais de banco e performance.

O subestado histórico `implementation_complete_pending_vps_validation` foi
superado pelo aceite VPS. A fase encontra-se `production_validated`.

### Gate local

1. iniciar Supabase local descartável;
2. executar `db reset`, pgTAP e lint;
3. executar unitários, integração, contrato, frontend e E2E;
4. executar build, lint, typecheck e security gate;
5. validar Compose com `/health` e `/ready`;
6. validar restart e persistência;
7. validar os três papéis, cross-tenant, artifact e RAG;
8. registrar evidências em `local-validation.md`.

### Supabase do app

Depois do gate local:

1. confirmar inequivocamente o projeto do app;
2. gerar backup externo de schema e dados com hashes;
3. listar migrations remotas;
4. executar `supabase db push --linked --dry-run`;
5. revisar que somente migrations da Fase 2 serão aplicadas;
6. executar `supabase db push --linked`;
7. repetir lint, advisors, consultas de invariantes e smoke com dados de teste;
8. registrar evidências em `supabase-deployment.md`.

Nenhuma dessas etapas usa o projeto do RAG. O RAG é somente consultado por seu MCP de leitura.

### GitHub e VPS

Com testes locais, Supabase e documentação verdes:

1. criar commits pequenos e revisáveis durante a implementação local;
2. executar a regressão final sobre o conjunto completo;
3. atualizar Roadmap/PRD para o estado coerente com o gate executado;
4. fazer push da `main` para o GitHub;
5. fornecer ao responsável comandos sanitizados para `git pull --ff-only`, build e `docker compose up` na VPS;
6. o responsável executa deploy, logs e testes manuais;
7. registrar smokes, correlações, persistência, rollback e aceite em `vps-validation.md`;
8. somente então marcar a Fase 2 como `production_validated`/`completed`.

## 18. Rollout

1. migrations aditivas com frontend ainda desligado;
2. backend read habilitado para usuários de teste;
3. backend write habilitado para tenant/papéis de teste;
4. build do frontend com rota habilitada para piloto;
5. uma ou duas campanhas reais controladas;
6. correção de bloqueadores;
7. ampliação gradual;
8. remoção das flags apenas em fase posterior, após janela estável.

Rollback normal desliga frontend/write, preserva leitura e reimplanta a imagem anterior. Nenhuma auditoria, campanha, material ou migration aplicada é apagada para reverter aplicação.

## 19. Critérios de entrada para implementação

- este design revisado pelo usuário;
- PRD promovido de `draft` para `approved` com as regras deste documento;
- Supabase local respondendo e `/ready=200`;
- riscos herdados reconciliados no README da fase;
- plano de implementação detalhado aprovado;
- nenhuma migration da Fase 2 aplicada antes dos testes locais correspondentes.

## 20. Critérios de saída

- todos os critérios de aceite do PRD rastreados e aprovados;
- piloto registra campanhas reais sem planilha paralela para os campos cobertos;
- zero acesso cross-tenant nos testes;
- conflitos não sobrescrevem dados;
- materiais e timeline respeitam ownership e minimização;
- métricas, auditoria e correlação operantes;
- gate local registrado;
- Supabase do app migrado e validado;
- `main` publicada após regressão final;
- deploy e gate VPS executados;
- aceite manual registrado;
- nenhuma falha alta ou crítica conhecida.
