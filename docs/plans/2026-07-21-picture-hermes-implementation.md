# Picture-Hermes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir integralmente o Designer API por um chat Picture-Hermes persistente, com pasta de arquivos visível, aprovação explícita, limpeza controlada e peça final preservada em Trabalhos Validados.

**Architecture:** O Hermes continua sendo o planejador e chama um MCP de alto nível oferecido por um novo serviço Bun em services/picture-it. A Bridge autentica o usuário, separa as sessões normal e picture e atua como BFF; o Artifact Server passa a armazenar e listar os artefatos do workspace, promovendo somente a final; Postgres persiste workspaces e jobs recuperáveis.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Bun, bun:test, Sharp, Satori, FAL, MCP Streamable HTTP, Node 20 na Bridge/Artifact Server, Supabase/Postgres, pgTAP, Docker Compose e Playwright.

---

## Regras de execução

- Esta é uma implementação independente do Roadmap.md. Não editar o roadmap.
- Executar nesta mesma tarefa do Codex, sequencialmente e sem subagentes.
- Aplicar @superpowers:test-driven-development em cada mudança funcional.
- Aplicar @verification-before-completion antes de declarar conclusão.
- Não rodar chamadas reais da FAL na suíte padrão.
- Um smoke test pago só pode rodar com autorização explícita do usuário.
- Não copiar ou registrar o conteúdo da chave FAL.
- Não apagar data/designer nem buckets legados durante o cutover.
- Preservar alterações não relacionadas encontradas no worktree.

## Estado inicial verificado

- Branch de trabalho: codex/picture-hermes.
- PRD aprovado: PRD-picture-hermes-semi-nativo.md.
- Design aprovado: docs/plans/2026-07-21-picture-hermes-design.md.
- Engine de origem: C:/Users/raphaeloliveira/Desktop/Projetos Saas/picture-it-main.
- Referência complexa: picture-it-main/graduação-test.
- Página atual: apps/chat-web/src/components/ImageGenerator.tsx.
- Serviço a substituir: apps/designer-api.
- Artifact Server já suporta upload, URL assinada e delete individual.
- validated_works ainda não suporta imagem.

### Task 1: Importar e estabilizar a engine Picture

**Files:**

- Create: services/picture-it/AGENTS.md
- Create: services/picture-it/package.json
- Create: services/picture-it/bun.lock
- Create: services/picture-it/tsconfig.json
- Create: services/picture-it/index.ts
- Create: services/picture-it/src/*.ts
- Create: services/picture-it/src/templates/index.ts
- Create: services/picture-it/scripts/*.ts
- Create: services/picture-it/skill/picture-it/**
- Create: services/picture-it/fixtures/graduacao-test/**
- Create: services/picture-it/test/config.test.ts
- Create: services/picture-it/test/pipeline-contract.test.ts
- Modify: services/picture-it/src/config.ts
- Modify: services/picture-it/src/fonts.ts
- Modify: services/picture-it/src/templates/index.ts
- Modify: services/picture-it/src/operations.ts
- Modify: .gitignore

**Step 1: Importar apenas fontes e referências necessárias**

Copiar do checkout externo package.json, bun.lock, tsconfig.json, index.ts,
AGENTS.md, src, scripts, skill e graduação-test. Renomear graduação-test para
fixtures/graduacao-test.

Não importar .git, .env, node_modules, dist, .cursor ou renders avulsos da raiz.
Manter o checkout externo intacto até a verificação do commit importado.

**Step 2: Instalar dependências da engine**

Run:

~~~powershell
Set-Location services/picture-it
bun install
~~~

Expected: lockfile resolvido sem expor credenciais.

**Step 3: Escrever testes que proíbam encerramento do processo na biblioteca**

Em test/config.test.ts, importar ensureKeys e readInput com configuração
controlada. Verificar que erros são lançados como PictureError, sem chamar
process.exit.

~~~ts
test("missing FAL key throws a typed error", () => {
  expect(() => ensureKeys(["fal"], {})).toThrow("picture_config_missing_fal_key");
});
~~~

**Step 4: Confirmar falha inicial**

Run:

~~~powershell
bun test test/config.test.ts
bunx tsc --noEmit
~~~

Expected: testes ou typecheck falham por process.exit e pelos erros já
identificados em config.ts, fonts.ts e templates/index.ts.

**Step 5: Corrigir o limite biblioteca/CLI**

- criar PictureError;
- fazer config e operations lançarem erros;
- manter process.exit somente no entrypoint CLI;
- adicionar anthropic_api_key ao tipo apenas se ainda for realmente usado; caso
  contrário, remover essa leitura morta;
- normalizar ArrayBuffer em fonts.ts;
- substituir o import inexistente CompositionPlan pelo tipo correto da engine.

**Step 6: Fixar a união completa de PipelineStep**

O teste pipeline-contract deve instanciar todas as operações suportadas:
generate, edit, remove-bg, replace-bg, crop, grade, grain, vignette, text,
compose e upscale.

**Step 7: Verificar a engine sem rede**

Run:

~~~powershell
bun test
bunx tsc --noEmit
bun run build
~~~

Expected: PASS, sem chamada à FAL.

**Step 8: Commit**

~~~powershell
git add services/picture-it .gitignore
git commit -m "feat(picture): import and stabilize picture engine"
~~~

### Task 2: Definir contratos e confinamento de workspace

**Files:**

- Create: services/picture-it/src/service/contracts.ts
- Create: services/picture-it/src/service/workspace-paths.ts
- Create: services/picture-it/test/contracts.test.ts
- Create: services/picture-it/test/workspace-paths.test.ts
- Modify: services/picture-it/package.json

**Step 1: Adicionar dependências de contrato**

Adicionar zod e jose às dependencies. Adicionar scripts test, typecheck e
start:service.

**Step 2: Escrever testes do CreativeBrief e CompositionPlan**

Cobrir:

- brief mínimo válido;
- dimensão inválida;
- operação desconhecida;
- overlays estruturados;
- asset relativo;
- path absoluto;
- traversal com ponto-ponto;
- final_path fora da pasta final.

~~~ts
test("composition plan rejects traversal", () => {
  expect(() => CompositionPlanSchema.parse({
    version: 1,
    pipeline: [{ op: "compose", overlays_file: "../secret.json" }],
    final_path: "final/piece.png",
  })).toThrow();
});
~~~

**Step 3: Rodar e confirmar falha**

Run:

~~~powershell
bun test test/contracts.test.ts test/workspace-paths.test.ts
~~~

Expected: FAIL porque os módulos ainda não existem.

**Step 4: Implementar contratos estritos**

Exportar:

- CreativeBriefSchema;
- CompositionPlanSchema;
- PictureJobRequestSchema;
- PictureRevisionRequestSchema;
- ManifestEntrySchema;
- tipos inferidos.

Não usar passthrough; campos desconhecidos devem falhar para manter o contrato
auditável.

**Step 5: Implementar resolução confinada**

resolveWorkspacePath(root, relativePath) deve:

- aceitar somente path relativo POSIX;
- rejeitar vazio, absoluto, drive Windows, traversal e byte nulo;
- resolver contra root;
- confirmar que o resultado permanece dentro de root;
- não seguir link simbólico criado fora do root.

**Step 6: Verificar**

Run:

~~~powershell
bun test test/contracts.test.ts test/workspace-paths.test.ts
bunx tsc --noEmit
~~~

Expected: PASS.

**Step 7: Commit**

~~~powershell
git add services/picture-it
git commit -m "feat(picture): define safe workspace contracts"
~~~

### Task 3: Evoluir Artifact Server para workspaces

**Files:**

- Create: services/artifact-server/src/workspaces.js
- Create: services/artifact-server/test/artifact-workspaces.test.js
- Modify: services/artifact-server/src/server.js
- Modify: services/artifact-server/test/artifact-server.test.js

**Step 1: Escrever testes de metadados de workspace**

Upload com os headers:

- X-Nexus-Workspace-Id;
- X-Nexus-Relative-Path;
- X-Nexus-Artifact-Category;
- X-Nexus-Artifact-Lifecycle.

Verificar que o payload devolve esses campos e que upload legado continua
funcionando sem eles.

**Step 2: Escrever testes de isolamento**

Testar:

- relative_path com traversal retorna 400;
- categoria desconhecida retorna 400;
- lifecycle desconhecido retorna 400;
- owner diferente não lista, promove ou limpa;
- workspace UUID inválido retorna 400.

**Step 3: Escrever testes de listagem**

GET /v1/workspaces/:workspaceId/artifacts?owner_id=:owner deve retornar apenas
metadados daquele owner e workspace, ordenados por category, relative_path e
created_at. Não deve ler ou retornar bytes.

**Step 4: Escrever testes de promoção**

POST /v1/artifacts/:id/promote com owner_id e workspace_id:

- só aceita category final;
- troca lifecycle workspace por validated;
- é idempotente;
- não muda owner, SHA ou bytes.

**Step 5: Escrever testes de limpeza**

DELETE /v1/workspaces/:workspaceId/artifacts com owner_id:

- remove todos os metadados lifecycle workspace;
- mantém o promovido;
- remove objetos sem nenhuma referência restante;
- mantém objetos deduplicados ainda referenciados;
- repetir retorna sucesso com deleted_count zero.

**Step 6: Confirmar falhas**

Run:

~~~powershell
Set-Location services/artifact-server
npm test
~~~

Expected: novos testes FAIL com rotas e campos ausentes.

**Step 7: Implementar índice e mutações atômicas**

workspaces.js deve encapsular:

- validação dos metadados;
- gravação atômica por arquivo temporário mais rename;
- leitura do índice por workspace;
- remoção de referências;
- promoção;
- limpeza em lote.

O server.js apenas autentica, roteia e converte erros.

**Step 8: Verificar compatibilidade**

Run:

~~~powershell
npm test
~~~

Expected: todos os testes antigos e novos PASS.

**Step 9: Commit**

~~~powershell
git add services/artifact-server
git commit -m "feat(artifacts): add workspace lifecycle storage"
~~~

### Task 4: Criar esquema persistente Picture-Hermes

**Files:**

- Create: apps/chat-web/supabase/migrations/20260721190000_picture_hermes_workspace.sql
- Create: apps/chat-web/supabase/tests/picture_hermes_workspace.test.sql

**Step 1: Escrever pgTAP de contrato**

Testar a existência e constraints de:

- chat_sessions.session_kind com default normal;
- picture_workspaces;
- picture_jobs;
- único workspace ativo por tenant e usuário;
- idempotency_key única por workspace;
- FK da sessão;
- estados permitidos;
- tipo peca_visual em validated_works;
- artifact_id obrigatório para peca_visual;
- RLS que impede acesso entre usuários.

**Step 2: Rodar e confirmar falha**

Run em apps/chat-web:

~~~powershell
npm exec supabase db reset
npm exec supabase test db -- --file supabase/tests/picture_hermes_workspace.test.sql
~~~

Expected: FAIL porque a migration não foi implementada.

**Step 3: Implementar migration**

Trecho central esperado:

~~~sql
alter table public.chat_sessions
  add column session_kind text not null default 'normal'
  check (session_kind in ('normal', 'picture'));

create unique index picture_workspaces_one_active_per_user
  on public.picture_workspaces (tenant_id, user_id)
  where active;

alter table public.validated_works
  add column artifact_id uuid,
  add column artifact_filename text,
  add column artifact_mime_type text,
  add column artifact_width integer,
  add column artifact_height integer;
~~~

Substituir o check de artifact_type para incluir peca_visual e adicionar check
condicional de artifact_id.

**Step 4: Implementar RLS e grants mínimos**

- usuários autenticados podem ler seu próprio workspace e jobs;
- nenhuma escrita direta de workspace/job pelo frontend;
- service_role opera tudo;
- validated_works preserva as políticas existentes.

**Step 5: Rodar a suíte de banco**

Run:

~~~powershell
npm exec supabase db reset
npm exec supabase test db
~~~

Expected: PASS.

**Step 6: Commit**

~~~powershell
git add apps/chat-web/supabase
git commit -m "feat(db): add persistent picture workspaces and visual works"
~~~

### Task 5: Implementar cliente de Artifact Server no Picture

**Files:**

- Create: services/picture-it/src/service/artifact-client.ts
- Create: services/picture-it/test/artifact-client.test.ts

**Step 1: Escrever fake HTTP e testes**

Cobrir upload, list, promote, deleteWorkspace, access metadata e download
interno. Verificar headers de owner, workspace, relative path, category,
lifecycle e source picture-hermes.

**Step 2: Confirmar falha**

Run:

~~~powershell
Set-Location services/picture-it
bun test test/artifact-client.test.ts
~~~

Expected: FAIL por módulo ausente.

**Step 3: Implementar PictureArtifactClient**

Todas as chamadas recebem AbortSignal e timeout. Erros remotos devem virar
PictureError com código seguro, status e correlation id, sem incluir a chave
interna.

**Step 4: Verificar**

Run:

~~~powershell
bun test test/artifact-client.test.ts
bunx tsc --noEmit
~~~

Expected: PASS.

**Step 5: Commit**

~~~powershell
git add services/picture-it
git commit -m "feat(picture): connect workspace artifact storage"
~~~

### Task 6: Implementar repositórios e lifecycle de workspace

**Files:**

- Create: services/picture-it/src/service/database.ts
- Create: services/picture-it/src/service/repositories.ts
- Create: services/picture-it/src/service/workspace-service.ts
- Create: services/picture-it/test/workspace-service.test.ts

**Step 1: Escrever testes com repositório fake**

Testar:

- ensureActive devolve o existente;
- corrida de dois ensureActive resulta em um workspace;
- sessão deve ser kind picture;
- aprovação sem candidata falha;
- aprovação repetida devolve o mesmo validated_work_id;
- reset antes de aprovação falha;
- reset preserva validated_artifact_id;
- reset repetido é seguro.

**Step 2: Confirmar falha**

Run:

~~~powershell
bun test test/workspace-service.test.ts
~~~

Expected: FAIL.

**Step 3: Implementar repositórios com Bun.sql**

Isolar SQL em repositories.ts. Usar transações para mudanças de estado e
comparação de versão ou estado esperado para evitar corrida.

**Step 4: Implementar WorkspaceService**

Separar:

- ensureActive;
- getOwnedWorkspace;
- setCandidate;
- approveCandidate;
- beginReset;
- closeAfterArtifactCleanup.

approveCandidate promove primeiro o artefato e faz insert idempotente em
validated_works por artifact_id.

**Step 5: Verificar**

Run:

~~~powershell
bun test test/workspace-service.test.ts
bunx tsc --noEmit
~~~

Expected: PASS.

**Step 6: Commit**

~~~powershell
git add services/picture-it
git commit -m "feat(picture): persist workspace lifecycle"
~~~

### Task 7: Implementar package builder e publicação dos arquivos

**Files:**

- Create: services/picture-it/src/service/package-builder.ts
- Create: services/picture-it/src/service/package-publisher.ts
- Create: services/picture-it/test/package-builder.test.ts
- Create: services/picture-it/test/package-publisher.test.ts

**Step 1: Escrever teste baseado em graduação-test**

Criar um CreativeBrief e CompositionPlan equivalentes ao fixture. Verificar a
estrutura materializada:

~~~text
brief/brief.json
planning/prompt.txt
planning/composition-plan.json
planning/steps.json
planning/overlays.json
references/ens-logo-white.png
intermediate/
final/peca-final.png
~~~

**Step 2: Testar referências e paths**

Verificar que somente artifact_ids pertencentes ao manifest podem ser
materializados e que os nomes são saneados sem perder extensão.

**Step 3: Confirmar falha**

Run:

~~~powershell
bun test test/package-builder.test.ts test/package-publisher.test.ts
~~~

Expected: FAIL.

**Step 4: Implementar builder determinístico**

O builder escreve somente dentro de um diretório temporário criado pelo Bun.
Não deve interpolar conteúdo em nomes de arquivo.

**Step 5: Implementar publisher**

Publicar cada arquivo com category e relative_path corretos. Uploads repetidos
com a mesma execução devem ser reconhecidos pela chave do job e não criar uma
árvore duplicada.

**Step 6: Verificar**

Run:

~~~powershell
bun test test/package-builder.test.ts test/package-publisher.test.ts
bunx tsc --noEmit
~~~

Expected: PASS.

**Step 7: Commit**

~~~powershell
git add services/picture-it
git commit -m "feat(picture): build and publish reproducible work packages"
~~~

### Task 8: Implementar fila recuperável e executor

**Files:**

- Create: services/picture-it/src/service/engine-adapter.ts
- Create: services/picture-it/src/service/job-service.ts
- Create: services/picture-it/src/service/worker.ts
- Create: services/picture-it/test/job-service.test.ts
- Create: services/picture-it/test/worker.test.ts
- Modify: services/picture-it/src/pipeline.ts

**Step 1: Escrever testes de enqueue idempotente**

Mesma workspace mais idempotency_key retorna o mesmo job. Um workspace não
aceita dois jobs ativos.

**Step 2: Escrever testes de lease**

- claim concorrente entrega job a um worker;
- lease expirado volta à fila;
- max_attempts termina em failed;
- heartbeat estende lease;
- sucesso publica candidata;
- falha de revisão preserva candidata antiga.

**Step 3: Escrever teste do adapter da engine**

Usar fake FAL e uma operação determinística de composição. Garantir que o
adapter chama funções exportadas, nunca o CLI.

**Step 4: Confirmar falha**

Run:

~~~powershell
bun test test/job-service.test.ts test/worker.test.ts
~~~

Expected: FAIL.

**Step 5: Implementar JobService e Worker**

O loop usa polling configurável, AbortSignal para shutdown e concorrência
global PICTURE_WORKER_CONCURRENCY. Serializar por workspace no banco.

**Step 6: Implementar publicação transacional por estado**

Somente depois de todos os artefatos obrigatórios estarem no Artifact Server:

- definir result_artifact_id;
- marcar job succeeded;
- atualizar workspace para review;
- definir candidate_artifact_id.

**Step 7: Verificar sem créditos**

Run:

~~~powershell
bun test
bunx tsc --noEmit
~~~

Expected: PASS e nenhuma requisição FAL.

**Step 8: Commit**

~~~powershell
git add services/picture-it
git commit -m "feat(picture): add recoverable rendering jobs"
~~~

### Task 9: Implementar autenticação interna, delegação, REST e MCP

**Files:**

- Create: services/picture-it/src/service/delegation.ts
- Create: services/picture-it/src/service/http-server.ts
- Create: services/picture-it/src/service/mcp-server.ts
- Create: services/picture-it/src/service/main.ts
- Create: services/picture-it/test/delegation.test.ts
- Create: services/picture-it/test/http-server.test.ts
- Create: services/picture-it/test/mcp-server.test.ts

**Step 1: Testar delegação**

Claims obrigatórios: sub, tenant_id, actor_role, chat_session_id, workspace_id,
run_id, scopes, jti, iat, nbf, exp e contract_version.

Testar kid ativo/anterior, expiração, audience, issuer, workspace trocado e
scope insuficiente.

**Step 2: Testar API interna**

Rotas mínimas:

- GET /health;
- GET /ready;
- POST /internal/workspaces/ensure;
- GET /internal/workspaces/:id;
- GET /internal/workspaces/:id/manifest;
- POST /internal/workspaces/:id/references;
- POST /internal/workspaces/:id/approve;
- POST /internal/workspaces/:id/reset;
- POST /mcp.

Mutações internas exigem Bearer PICTURE_INTERNAL_KEY e contexto explícito do
ator; MCP exige delegação da Bridge em cada tool.

**Step 3: Testar tools MCP**

- picture_get_workspace;
- picture_start_job;
- picture_revise;
- picture_get_job.

Confirmar que approve e reset não existem como tools.

**Step 4: Confirmar falha**

Run:

~~~powershell
bun test test/delegation.test.ts test/http-server.test.ts test/mcp-server.test.ts
~~~

Expected: FAIL.

**Step 5: Implementar servidor com Bun.serve**

Usar @modelcontextprotocol/sdk no endpoint MCP. Não usar Express. Validar todo
input com Zod e devolver erros JSON/MCP estáveis.

**Step 6: Verificar**

Run:

~~~powershell
bun test
bunx tsc --noEmit
~~~

Expected: PASS.

**Step 7: Commit**

~~~powershell
git add services/picture-it
git commit -m "feat(picture): expose secure REST and MCP interfaces"
~~~

### Task 10: Containerizar o Picture Service

**Files:**

- Create: services/picture-it/Dockerfile
- Create: services/picture-it/docker-entrypoint.sh
- Create: services/picture-it/.dockerignore
- Create: services/picture-it/test/docker-contract.test.ts

**Step 1: Escrever teste de contrato do Dockerfile**

Verificar imagem Bun fixada, usuário não root, health tooling, fonts
disponíveis, diretório temporário gravável e ausência de .env no contexto.

**Step 2: Confirmar falha**

Run:

~~~powershell
bun test test/docker-contract.test.ts
~~~

Expected: FAIL.

**Step 3: Implementar imagem multi-stage**

- instalar com bun install --frozen-lockfile;
- baixar ou empacotar fontes durante build;
- copiar somente arquivos necessários;
- executar main.ts ou build compilado;
- usar usuário sem privilégio;
- preparar shutdown do worker.

**Step 4: Build e smoke sem FAL**

Run na raiz:

~~~powershell
docker build -t nexus-picture-it:test services/picture-it
docker run --rm nexus-picture-it:test bun test
~~~

Expected: build e testes PASS.

**Step 5: Commit**

~~~powershell
git add services/picture-it
git commit -m "build(picture): containerize service and worker"
~~~

### Task 11: Registrar MCP e skill no Hermes

**Files:**

- Create: services/hermes-runtime/skills/picture-hermes/SKILL.md
- Create: services/hermes-runtime/docker/ensure-nexus-skills.sh
- Create: services/hermes-runtime/docker/tests/test_picture_skill_runtime.py
- Modify: services/hermes-runtime/docker/ensure-ens-rag-mcp.py
- Modify: services/hermes-runtime/docker/tests/test_ensure_ens_rag_mcp.py
- Modify: services/hermes-runtime/templates/hermes/config.yaml
- Modify: services/hermes-runtime/docker/hermes.Dockerfile
- Modify: services/hermes-runtime/docker/hermes-api-server.sh
- Modify: services/hermes-runtime/docker/hermes-kanban-dashboard.sh
- Modify: services/hermes-runtime/.env.example

**Step 1: Estender teste do registro MCP**

Esperar nexus_picture com URL http://picture-it:8090/mcp, sampling desabilitado
e timeouts compatíveis com enqueue/consulta.

**Step 2: Escrever teste de instalação idempotente do skill**

O script copia a versão gerenciada para HERMES_HOME/skills/picture-hermes sem
apagar skills do usuário. Repetir deve produzir o mesmo resultado.

**Step 3: Confirmar falhas**

Run:

~~~powershell
python -m pytest services/hermes-runtime/docker/tests/test_ensure_ens_rag_mcp.py services/hermes-runtime/docker/tests/test_picture_skill_runtime.py -q
~~~

Expected: FAIL.

**Step 4: Escrever o skill Picture-Hermes**

O skill deve:

- afirmar que o Hermes é planner;
- usar apenas em sessão marcada Picture-Hermes;
- nunca chamar image_generate nesse modo;
- criar CreativeBrief e CompositionPlan completos;
- preservar textos e logos por composição determinística;
- consultar workspace antes de revisão;
- não aprovar nem resetar;
- explicar status de job sem inventar conclusão.

**Step 5: Implementar registro e cópia**

Atualizar config default e todos os perfis existentes via ensure. Copiar skill
na inicialização porque /opt/data é volume.

**Step 6: Verificar**

Run:

~~~powershell
python -m pytest services/hermes-runtime/docker/tests -q
~~~

Expected: PASS.

**Step 7: Commit**

~~~powershell
git add services/hermes-runtime
git commit -m "feat(hermes): register picture MCP and planning skill"
~~~

### Task 12: Integrar modo Picture e BFF na Chat Bridge

**Files:**

- Create: services/chat-bridge/src/picture-client.js
- Create: services/chat-bridge/src/picture-delegation.js
- Create: services/chat-bridge/src/picture-mode.js
- Create: services/chat-bridge/test/picture-client.test.js
- Create: services/chat-bridge/test/picture-delegation.test.js
- Create: services/chat-bridge/test/picture-mode.test.js
- Modify: services/chat-bridge/src/runtime-config.js
- Modify: services/chat-bridge/src/hermes-payloads.js
- Modify: services/chat-bridge/src/server.js
- Modify: services/chat-bridge/src/attachments.js
- Modify: services/chat-bridge/test/hermes-payloads.test.js
- Modify: services/chat-bridge/test/server-runtime-scope.test.js

**Step 1: Testar emissão e redaction da delegação**

Basear-se no padrão marketing-ops-delegation, mas audience nexus-picture e
claim workspace_id. Verificar que token não aparece no texto persistível nem
em objetos logados.

**Step 2: Testar isolamento do payload**

Para experience normal mais intent image_generate, manter exatamente o contrato
atual. Para experience picture:

- exigir picture_workspace_id;
- injetar Modo Picture-Hermes;
- proibir image_generate;
- incluir delegação técnica e resumo do workspace;
- remover delegação antes de persistir.

**Step 3: Testar endpoints BFF**

Rotas públicas autenticadas:

- POST /api/picture/workspace/current;
- GET /api/picture/workspaces/:id;
- GET /api/picture/workspaces/:id/files;
- POST /api/picture/workspaces/:id/approve;
- POST /api/picture/workspaces/:id/new-piece.

Testar usuário sem sessão, owner diferente, sessão normal usada como Picture,
aprovação idempotente e new-piece antes de validado.

**Step 4: Testar importação de anexos**

Antes do turno chegar ao Hermes, referências Picture devem ser registradas no
workspace e aparecer no manifest. Falha de importação deve impedir o job e
devolver erro acionável.

**Step 5: Confirmar falhas**

Run:

~~~powershell
Set-Location services/chat-bridge
npm test
~~~

Expected: novos testes FAIL.

**Step 6: Implementar cliente e BFF**

O frontend nunca recebe PICTURE_INTERNAL_KEY. A Bridge usa o usuário já
autenticado e confirma workspace/sessão no banco ou no Picture antes de
encaminhar.

**Step 7: Implementar new-piece orquestrado**

Sequência:

1. solicitar reset idempotente ao Picture;
2. apagar estado e sessão Hermes antiga;
3. apagar chat_messages e chat_session picture;
4. criar nova chat_session kind picture;
5. garantir novo workspace;
6. devolver novo workspace completo.

Se a etapa 4 ou 5 falhar, uma nova chamada a current deve reparar o estado.

**Step 8: Verificar regressão da Bridge**

Run:

~~~powershell
npm test
~~~

Expected: todos os testes PASS, inclusive image_generate normal.

**Step 9: Commit**

~~~powershell
git add services/chat-bridge
git commit -m "feat(bridge): add isolated Picture-Hermes experience"
~~~

### Task 13: Separar sessões normais e Picture no frontend

**Files:**

- Create: apps/chat-web/src/lib/chatService.test.ts
- Modify: apps/chat-web/src/lib/chatService.ts
- Modify: apps/chat-web/src/components/ChatInterface.tsx
- Modify: apps/chat-web/src/components/ChatHistorySidebar.tsx
- Modify: apps/chat-web/src/lib/chatProxyPayload.ts
- Modify: apps/chat-web/src/lib/chatProxyPayload.test.ts

**Step 1: Testar filtros do chatService**

- createSession normal grava session_kind normal;
- listSessions usa filtro normal;
- sessão picture não aparece;
- fixed picture session pode carregar mensagens, mas não entra na sidebar.

**Step 2: Testar payload do modo Picture**

Adicionar experience e picture_workspace_id somente quando props Picture forem
fornecidas. O default permanece byte-a-byte equivalente ao fluxo normal.

**Step 3: Confirmar falhas**

Run:

~~~powershell
Set-Location apps/chat-web
npm test -- src/lib/chatService.test.ts src/lib/chatProxyPayload.test.ts
~~~

Expected: FAIL.

**Step 4: Tornar ChatInterface reutilizável**

Adicionar props opcionais:

~~~ts
type ChatExperience = "normal" | "picture";

interface ChatInterfaceProps {
  experience?: ChatExperience;
  fixedSessionId?: string;
  pictureWorkspaceId?: string;
  hideHistory?: boolean;
  onActivitySettled?: () => void;
}
~~~

Quando fixedSessionId existe, não criar ou selecionar sessões pela sidebar.

**Step 5: Verificar**

Run:

~~~powershell
npm test -- src/lib/chatService.test.ts src/lib/chatProxyPayload.test.ts
npm run typecheck
~~~

Expected: PASS.

**Step 6: Commit**

~~~powershell
git add apps/chat-web/src/lib apps/chat-web/src/components/ChatInterface.tsx apps/chat-web/src/components/ChatHistorySidebar.tsx
git commit -m "refactor(chat): isolate normal and picture sessions"
~~~

### Task 14: Construir client e estado do workspace no frontend

**Files:**

- Create: apps/chat-web/src/lib/pictureWorkspace/types.ts
- Create: apps/chat-web/src/lib/pictureWorkspace/client.ts
- Create: apps/chat-web/src/lib/pictureWorkspace/client.test.ts
- Create: apps/chat-web/src/hooks/usePictureWorkspace.ts
- Create: apps/chat-web/src/hooks/usePictureWorkspace.test.tsx

**Step 1: Escrever testes do client**

Cobrir current, details, files, approve e newPiece. Exigir token Supabase,
propagar AbortSignal e mapear códigos conhecidos para mensagens em português.

**Step 2: Escrever testes do hook**

- hidrata workspace ao montar;
- polling ativo em generating;
- sem polling em drafting, review ou validated;
- refresh após turno de chat;
- aprovação atualiza estado;
- newPiece troca IDs e limpa seleção local;
- erro mantém dados anteriores.

**Step 3: Confirmar falhas**

Run:

~~~powershell
npm test -- src/lib/pictureWorkspace/client.test.ts src/hooks/usePictureWorkspace.test.tsx
~~~

Expected: FAIL.

**Step 4: Implementar client e hook**

Usar TanStack Query com query keys contendo workspace_id. Não guardar
workspace em localStorage como fonte da verdade.

**Step 5: Verificar**

Run:

~~~powershell
npm test -- src/lib/pictureWorkspace/client.test.ts src/hooks/usePictureWorkspace.test.tsx
npm run typecheck
~~~

Expected: PASS.

**Step 6: Commit**

~~~powershell
git add apps/chat-web/src/lib/pictureWorkspace apps/chat-web/src/hooks/usePictureWorkspace*
git commit -m "feat(web): add persistent picture workspace state"
~~~

### Task 15: Substituir o formulário pela interface chat mais arquivos

**Files:**

- Create: apps/chat-web/src/components/picture/PictureWorkspace.tsx
- Create: apps/chat-web/src/components/picture/PictureFilesPanel.tsx
- Create: apps/chat-web/src/components/picture/PictureFilePreview.tsx
- Create: apps/chat-web/src/components/picture/PictureWorkspaceActions.tsx
- Create: apps/chat-web/src/components/picture/PictureWorkspace.test.tsx
- Create: apps/chat-web/src/components/picture/PictureFilesPanel.test.tsx
- Modify: apps/chat-web/src/pages/Index.tsx
- Delete: apps/chat-web/src/components/ImageGenerator.tsx
- Delete: apps/chat-web/src/hooks/useImageGenerator.ts
- Delete: apps/chat-web/src/services/imageGeneratorService.ts

**Step 1: Escrever teste do layout**

Em viewport desktop, verificar chat e painel de arquivos. Em estado vazio,
mostrar orientação curta, sem formulário.

**Step 2: Escrever testes do painel**

Cobrir categorias, JSON/text preview, imagem, arquivo desconhecido, URL
expirada, loading, erro e seleção da candidata final.

**Step 3: Escrever testes de ações**

- Aprovar só habilita em review;
- Criar nova peça só habilita em validated;
- popup contém a mensagem aprovada;
- cancelar não chama API;
- confirmar chama newPiece uma vez;
- pending bloqueia clique duplo.

**Step 4: Confirmar falhas**

Run:

~~~powershell
npm test -- src/components/picture
~~~

Expected: FAIL.

**Step 5: Implementar layout simples**

Desktop: painel redimensionável ou grid aproximado 55/45. Mobile: chat principal
e arquivos em Sheet. Não adicionar wizard, campos do Designer ou controles de
baixo nível.

**Step 6: Ligar ChatInterface em modo fixo**

~~~tsx
<ChatInterface
  experience="picture"
  fixedSessionId={workspace.chat_session_id}
  pictureWorkspaceId={workspace.id}
  hideHistory
  onActivitySettled={refreshWorkspace}
/>
~~~

**Step 7: Trocar a aba image**

Index.tsx deve importar PictureWorkspace. Remover os três módulos legados e
todas as referências de frontend ao Designer.

**Step 8: Verificar frontend**

Run:

~~~powershell
npm test
npm run typecheck
npm run build
~~~

Expected: PASS.

**Step 9: Commit**

~~~powershell
git add apps/chat-web/src
git commit -m "feat(web): replace image form with Picture-Hermes chat"
~~~

### Task 16: Renderizar peças visuais em Trabalhos Validados

**Files:**

- Create: apps/chat-web/src/components/validated-works/ValidatedVisualWorkCard.tsx
- Create: apps/chat-web/src/components/validated-works/ValidatedVisualWorkCard.test.tsx
- Modify: apps/chat-web/src/lib/validatedWorks.ts
- Modify: apps/chat-web/src/pages/manager/ValidatedWorks.tsx

**Step 1: Estender tipos e labels**

Adicionar peca_visual e label Peça visual.

**Step 2: Escrever testes do card**

- solicita URL assinada pelo endpoint existente da Bridge;
- mostra thumbnail e dimensões;
- abre preview;
- permite download;
- renova URL expirada;
- não renderiza content como bloco principal de texto;
- fallback quando artefato está indisponível.

**Step 3: Confirmar falha**

Run:

~~~powershell
npm test -- src/components/validated-works/ValidatedVisualWorkCard.test.tsx
~~~

Expected: FAIL.

**Step 4: Implementar integração na página**

Manter cards e edição dos tipos textuais. Para peca_visual, edição deve limitar
metadados textuais e nunca permitir alterar artifact_id manualmente.

**Step 5: Verificar**

Run:

~~~powershell
npm test -- src/components/validated-works/ValidatedVisualWorkCard.test.tsx
npm run typecheck
~~~

Expected: PASS.

**Step 6: Commit**

~~~powershell
git add apps/chat-web/src/lib/validatedWorks.ts apps/chat-web/src/pages/manager/ValidatedWorks.tsx apps/chat-web/src/components/validated-works
git commit -m "feat(validated-works): display approved visual pieces"
~~~

### Task 17: Fazer o cutover do runtime e remover Designer API

**Files:**

- Modify: docker-compose.yml
- Modify: docker-compose.prod.yml
- Modify: .env.example
- Modify: services/chat-bridge/src/runtime-config.js
- Modify: services/chat-bridge/test/server-runtime-scope.test.js
- Modify: apps/chat-web/Dockerfile
- Delete: apps/designer-api/**

**Step 1: Escrever testes de configuração antes da troca**

Bridge em produção deve exigir:

- PICTURE_INTERNAL_URL;
- PICTURE_INTERNAL_KEY forte;
- PICTURE_DELEGATION_ACTIVE_KID;
- PICTURE_DELEGATION_ACTIVE_KEY forte;
- issuer/audience coerentes.

**Step 2: Atualizar Compose**

Adicionar picture-it:

- internal port 8090;
- DATABASE_URL;
- FAL_KEY vindo de NEXUS_PICTURE_FAL_KEY;
- Artifact Server URL/key;
- delegation keyring;
- worker concurrency e lease;
- temp dir;
- health/readiness;
- depends_on Artifact Server e banco externo configurado.

Adicionar picture-it ao depends_on do Hermes e Bridge. Remover designer-api e o
depends_on do frontend.

**Step 3: Atualizar env example**

Remover NEXUS_DESIGNER, NEXUS_PUBLIC_DESIGNER e VITE_IMAGE_GENERATOR. Adicionar
NEXUS_PICTURE sem valores secretos reais.

**Step 4: Remover build args do frontend**

Remover VITE_IMAGE_GENERATOR_API_URL, VITE_API_BASE_URL e
NEXT_PUBLIC_API_BASE_URL quando usados apenas pelo Designer.

**Step 5: Excluir apps/designer-api**

Antes, verificar que nenhum código novo o importa. Excluir somente o diretório
versionado apps/designer-api. Não tocar em data/designer.

**Step 6: Buscar referências restantes**

Run:

~~~powershell
rg -n "designer-api|ImageGenerator|useImageGenerator|imageGeneratorService|VITE_IMAGE_GENERATOR|NEXUS_DESIGNER|PUBLIC_DESIGNER" . -g "!data/**" -g "!docs/**" -g "!PRD-picture-hermes-semi-nativo.md"
~~~

Expected: nenhuma referência executável. Referências históricas fora do runtime
devem ser avaliadas, não apagadas mecanicamente.

**Step 7: Validar Compose**

Run:

~~~powershell
docker compose config --quiet
docker compose -f docker-compose.prod.yml config --quiet
~~~

Expected: exit 0.

**Step 8: Rodar testes afetados**

Run:

~~~powershell
Set-Location services/chat-bridge
npm test
Set-Location ../../apps/chat-web
npm test
npm run typecheck
npm run build
~~~

Expected: PASS.

**Step 9: Commit**

~~~powershell
git add docker-compose.yml docker-compose.prod.yml .env.example services/chat-bridge apps/chat-web/Dockerfile apps/designer-api
git commit -m "refactor(runtime): replace Designer API with Picture service"
~~~

### Task 18: Adicionar integração e E2E sem chamadas pagas

**Files:**

- Create: services/picture-it/test/integration/picture-workspace-flow.test.ts
- Create: apps/chat-web/e2e/picture-hermes.spec.ts
- Modify: apps/chat-web/playwright.config.ts
- Create: docs/picture-hermes-operations.md
- Modify: docs/env-map.md
- Modify: docs/vps-deploy.md

**Step 1: Testar fluxo de serviço com fakes reais de transporte**

Subir Artifact Server temporário, banco/repositório de teste e Picture HTTP com
fake engine. Executar:

1. ensure workspace;
2. enqueue;
3. worker;
4. manifest;
5. approve;
6. reset;
7. confirmar final preservada e temporários removidos.

**Step 2: Testar restart do worker**

Interromper após claim, expirar lease e iniciar novo worker. Esperar succeeded
sem job duplicado.

**Step 3: Escrever E2E da página**

Com APIs interceptadas ou stack fake:

- abrir aba Geração de imagem;
- encontrar chat à esquerda e arquivos à direita;
- simular geração;
- visualizar JSON e final;
- recarregar e manter workspace;
- aprovar;
- abrir popup;
- cancelar;
- confirmar;
- receber workspace vazio;
- visitar Trabalhos Validados e abrir a final.

Adicionar caso mobile para drawer de arquivos.

**Step 4: Rodar integração**

Run:

~~~powershell
Set-Location services/picture-it
bun test test/integration/picture-workspace-flow.test.ts
~~~

Expected: PASS sem FAL.

**Step 5: Rodar E2E**

Run:

~~~powershell
Set-Location ../../apps/chat-web
npm run e2e -- picture-hermes.spec.ts
~~~

Expected: PASS desktop e mobile.

**Step 6: Documentar operação**

Cobrir:

- variáveis;
- health/readiness;
- fila e lease;
- como investigar job;
- como preservar data/designer;
- como rotacionar delegação;
- como rodar smoke FAL opt-in;
- como reverter somente o deploy, sem apagar dados.

**Step 7: Commit**

~~~powershell
git add services/picture-it/test/integration apps/chat-web/e2e apps/chat-web/playwright.config.ts docs
git commit -m "test(picture): cover persistent workspace lifecycle"
~~~

### Task 19: Verificação final e smoke controlado

**Files:**

- Modify only if verification finds a defect.

**Step 1: Confirmar worktree e diff**

Run:

~~~powershell
git status --short
git diff --check
git diff --stat main...HEAD
~~~

Expected: somente mudanças Picture-Hermes planejadas; diff --check sem erros.

**Step 2: Rodar suíte do Artifact Server**

~~~powershell
Set-Location services/artifact-server
npm test
~~~

Expected: PASS.

**Step 3: Rodar suíte da Bridge**

~~~powershell
Set-Location ../chat-bridge
npm test
~~~

Expected: PASS.

**Step 4: Rodar suíte completa do Picture**

~~~powershell
Set-Location ../picture-it
bun test
bunx tsc --noEmit
bun run build
~~~

Expected: PASS sem rede paga.

**Step 5: Rodar frontend**

~~~powershell
Set-Location ../../apps/chat-web
npm test
npm run typecheck
npm run lint
npm run build
~~~

Expected: PASS. Se lint revelar dívida preexistente, registrar separadamente e
garantir zero novos erros nos arquivos alterados.

**Step 6: Rodar banco**

~~~powershell
npm exec supabase db reset
npm exec supabase test db
~~~

Expected: PASS.

**Step 7: Rodar contratos Hermes**

~~~powershell
Set-Location ../../
python -m pytest services/hermes-runtime/docker/tests -q
~~~

Expected: PASS.

**Step 8: Validar runtime**

~~~powershell
docker compose config --quiet
docker compose -f docker-compose.prod.yml config --quiet
docker compose build artifact-server picture-it app-bridge hermes-api app-frontend
~~~

Expected: PASS.

**Step 9: Provar isolamento por busca**

~~~powershell
rg -n "designer-api|ImageGenerator|useImageGenerator|imageGeneratorService|VITE_IMAGE_GENERATOR|NEXUS_DESIGNER" apps services docker-compose.yml docker-compose.prod.yml .env.example
~~~

Expected: zero resultados executáveis.

**Step 10: Smoke FAL somente após autorização**

Não executar automaticamente. Quando autorizado, usar um prompt barato e uma
única peça, confirmar que brief, planning, intermediate e final aparecem, e
registrar o custo/modelo sem expor a chave.

**Step 11: Commit de correções de verificação, se houver**

~~~powershell
git add -A
git commit -m "fix(picture): address end-to-end verification findings"
~~~

Criar esse commit somente se houve correção.

## Resultado de execução esperado

Ao concluir todas as tasks:

- services/picture-it contém a capacidade importada e o serviço novo;
- Artifact Server é a pasta persistente do trabalho;
- a aba de imagem é um chat simples com painel direito;
- reset de página e de Hermes preservam estado;
- aprovação é humana e idempotente;
- criar nova peça apaga somente o workspace temporário;
- a final aparece em Trabalhos Validados;
- chat normal ainda usa image_generate;
- apps/designer-api não participa mais do código ou runtime;
- Roadmap.md permanece inalterado;
- todo o trabalho foi realizado nesta mesma tarefa, sem subagentes.
