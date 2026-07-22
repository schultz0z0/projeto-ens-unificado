# Picture-Hermes — diário de execução

**Branch:** codex/picture-hermes
**Plano:** docs/plans/2026-07-21-picture-hermes-implementation.md
**Regra:** execução sequencial, sem subagentes, com RED/GREEN e evidência antes de concluir cada etapa.

**Operação autorizada:** migrations podem ser aplicadas no Supabase remoto após validação local e revisão de impacto/RLS. O .env real da raiz e o .env.example devem permanecer sincronizados; segredos não são registrados nem commitados.

## Estado

| Etapa | Estado | Commit | Evidência principal |
|---|---|---|---|
| 1. Engine Picture | Concluída | 7ecdbff | 3 testes, tsc e build verdes |
| 2. Contratos e paths | Concluída | 4caef2e | 14 testes totais e tsc verdes |
| 3. Artifact Server | Concluída | eb061a7 | 13 testes verdes |
| 4. Banco | Concluída e aplicada | 2837702 | 27 pgTAP verdes no remoto |
| 5. Artifact client | Concluída | 53bc144 | 20 testes, tsc e build verdes |
| 6. Workspace lifecycle | Concluída | 4885300 | 24 testes, tsc e build verdes |
| 7. Package builder | Concluída | eedaf15 | 28 testes, tsc e build verdes |
| 8. Jobs e worker | Concluída | a504bb6 | 34 testes, tsc e build verdes |
| 9. REST/MCP/auth | Concluída | e78200a | 43 testes, tsc e build verdes |
| 10. Container Picture | Concluída com validação estática | e338f87 | 45 testes e tsc verdes; Docker CLI indisponível |
| 11. Hermes MCP/skill | Concluída | 0c051d6 | 16 testes Hermes verdes; 1 POSIX skip |
| 12. Bridge Picture | Concluída | fe5a111 | 81 testes verdes e syntax check |
| 13. Sessões frontend | Concluída | a135527 | 7 testes focais e typecheck verdes |
| 14. Client/hook frontend | Concluída | f73af68 | 9 testes focais e typecheck verdes |
| 15. UI Picture | Concluída | b7b0e00 | 197 testes, typecheck e build verdes |
| 16. Trabalhos Validados | Concluída | a registrar | 2 testes de card, 82 da Bridge e typecheck verdes |
| 17. Cutover Designer | Pendente | — | — |
| 18. Integração/docs | Pendente | — | — |
| 19. Verificação final | Pendente | — | — |

## Registro detalhado

### Etapa 1 — Importar e estabilizar a engine Picture

- Estado inicial: checkout externo limpo em main; worktree do projeto limpo em codex/picture-hermes.
- Escopo de importação confirmado: fontes, scripts, skill e fixture graduação-test; exclusão de .git, .env, node_modules, dist e renders avulsos.
- Problemas previamente reproduzidos no código de origem: process.exit em funções de biblioteca e erros TypeScript em config.ts, fonts.ts e templates/index.ts.
- RED: bun test test/config.test.ts retornou 0 pass e 2 fail porque as funções encerravam o processo e não lançavam códigos tipados.
- RED: bunx tsc --noEmit retornou quatro erros nos arquivos config.ts, fonts.ts e templates/index.ts.
- Implementação: PictureError, erros tipados na biblioteca, correção do ArrayBuffer e remoção do tipo inexistente.
- GREEN: bun test retornou 3 pass, 0 fail; bunx tsc --noEmit saiu com código 0; bun run build gerou dist/index.js.

### Etapa 2 — Contratos e confinamento de workspace

- RED: bun test test/contracts.test.ts test/workspace-paths.test.ts retornou 0 pass e 11 fail por módulos ausentes.
- Implementação: schemas Zod estritos para briefing, plano, operações, jobs, revisões e manifest; normalização POSIX e resolução confinada ao root.
- Segurança coberta: paths absolutos, drive Windows, backslash, byte nulo e traversal são rejeitados.
- GREEN: suíte específica retornou 11 pass, 0 fail; suíte Picture completa retornou 14 pass, 0 fail; tsc saiu com código 0.

### Etapa 3 — Evoluir Artifact Server para workspaces

- Estado inicial: Artifact Server oferece upload, URL assinada e delete individual, mas não possui lifecycle/listagem por workspace.
- RED: node --test test/artifact-workspaces.test.js retornou 0 pass e 5 fail por metadados e rotas ausentes.
- Implementação: metadados de workspace, validação de paths/categorias/lifecycle, persistência atômica, listagem owner-scoped, promoção final idempotente e limpeza temporária em lote.
- Compatibilidade: uploads legados continuam aceitos com campos de workspace nulos; deduplicação e acesso assinado foram preservados.
- GREEN: npm test retornou 13 pass, 0 fail, incluindo os oito contratos preexistentes.

### Etapa 4 — Criar esquema persistente Picture-Hermes

- Estado inicial: chat_sessions não diferencia sessões; validated_works rejeita peças visuais; tabelas Picture ainda não existem.
- Infra local: Supabase local não pôde iniciar porque Docker Desktop não está ativo. Isso foi tratado como limitação de infraestrutura, não como teste funcional.
- RED remoto transacional: o teste falhou com relation public.picture_workspaces does not exist.
- Implementação: session_kind protegido por privilégios de coluna; picture_workspaces e picture_jobs com constraints, índices, leases, triggers, RLS e grants; validated_works ampliado para peca_visual.
- Validação pré-deploy: migration aplicada e revertida em transação no banco remoto; 27/27 assertions pgTAP passaram.
- Dry-run oficial: supabase db push listou somente 20260721190000_picture_hermes_workspace.sql.
- Deploy autorizado: migration aplicada no Supabase remoto. O cache pg-delta em Docker emitiu warning por Docker Desktop inativo, sem falha da migration.
- GREEN pós-deploy: 27/27 assertions pgTAP passaram novamente diretamente no schema remoto.

### Etapa 5 — Cliente de Artifact Server no Picture

- Estado inicial: Picture ainda não publica ou consulta artefatos pelo serviço.
- RED: bun test test/artifact-client.test.ts retornou 0 pass e 6 fail porque o módulo do cliente ainda não existia.
- Implementação: cliente interno com upload e metadados completos de workspace, listagem owner-scoped, promoção, limpeza, download, metadata e URL temporária; timeout/AbortSignal e erros tipados sem vazamento da chave.
- Ajuste de contrato: o tsconfig passou a carregar os tipos Fetch/DOM do runtime Bun; buffers enviados à FAL foram normalizados para Uint8Array compatível com File/Blob.
- GREEN: bun test retornou 20 pass, 0 fail; bunx tsc --noEmit saiu com código 0; bun run build gerou dist/index.js.

### Etapa 6 — Repositórios e lifecycle de workspace

- RED: bun test test/workspace-service.test.ts retornou 0 pass e 4 fail porque o serviço ainda não existia.
- Implementação: adapter Bun SQL, repositório Postgres com transações e locks, criação convergente sob índice único, guarda de sessão Picture, candidato com optimistic version, aprovação idempotente e reset em duas fases.
- Segurança/integridade: todos os acessos são tenant/user scoped; a promoção acontece antes do insert idempotente em validated_works; a limpeza só ocorre depois de status validated e mantém os IDs promovidos ao fechar.
- Ajuste durante GREEN: o fake de concorrência foi corrigido para reproduzir a atomicidade do índice único do Postgres; os quatro contratos de lifecycle passaram.
- GREEN: suíte Picture retornou 24 pass, 0 fail; bunx tsc --noEmit e bun run build saíram com código 0.

### Etapa 7 — Package builder e publisher

- RED: os quatro testes de builder/publisher falharam por módulos ausentes.
- Implementação: pacote temporário determinístico com brief, prompt, plano, steps, overlays, referências saneadas e diretórios intermediate/final; referências são aceitas apenas pelo manifest do workspace.
- Publicação: varredura sem symlinks, categorias auditáveis, MIME por extensão e reuso de artifact existente quando relative_path e SHA-256 coincidem, evitando duplicação em reruns do mesmo job.
- Higiene: falhas do builder removem o diretório temporário; o executor recebe cleanup explícito para o finally da próxima etapa.
- GREEN: bun test retornou 28 pass, 0 fail; typecheck e build saíram com código 0.

### Etapa 8 — Fila recuperável e executor

- RED: seis testes de job, lease, worker e adapter falharam porque os módulos ainda não existiam.
- Implementação: enqueue idempotente e serializado por workspace, claim com FOR UPDATE SKIP LOCKED, lease/heartbeat, recuperação após expiração, max_attempts, retry seguro e conclusão transacional de job+candidate.
- Executor: materializa package, chama a engine como biblioteca, publica artefatos e só então devolve a final; cleanup do temporário ocorre em finally. Revisões que falham preservam a candidata anterior e retornam o workspace a review.
- Worker: polling cancelável por AbortSignal, heartbeat e pool limitado por concorrência configurada. Nenhum teste invocou FAL.
- GREEN: bun test retornou 34 pass, 0 fail; bunx tsc --noEmit e build saíram com código 0.

### Etapa 9 — REST, MCP e autenticação

- RED: nove testes de delegação, HTTP e MCP falharam porque as interfaces ainda não existiam.
- Delegação: HS256 com kid ativo/anterior, issuer/audience, TTL máximo, claims completos, workspace binding e scopes picture:read/write; erros não devolvem token nem chave.
- REST: health/ready, ensure/get/manifest/references/approve/reset, autenticação interna constant-time, contexto explícito de tenant/user/session, Zod estrito, body limitado e CORS allowlist.
- MCP: transporte Web Standard nativo do Bun e somente quatro tools de alto nível (get workspace, start, revise, get job); approve/reset permanecem exclusivamente humanos via REST.
- Runtime: main.ts monta DB, Artifact client, serviços, MCP/HTTP e worker pool com shutdown coordenado.
- GREEN: bun test retornou 43 pass, 0 fail; bunx tsc --noEmit e build saíram com código 0.

### Etapa 10 — Container do Picture Service

- RED: os dois testes de contrato falharam por Dockerfile, entrypoint e dockerignore ausentes.
- Implementação: imagem multi-stage `oven/bun:1.3.14`, install frozen, fontes no build, curl+tini, usuário bun, temp root gravável, healthcheck e shutdown por sinais entregue ao main.
- Contexto: .env, node_modules, dist, fixtures, outputs e imagens avulsas são excluídos; scripts shell preservam LF pela regra raiz de gitattributes.
- GREEN local: contrato Docker 2/2 e suíte Picture 45/45; typecheck saiu com código 0.
- Limitação de infraestrutura: o comando `docker` não está instalado/disponível no PATH desta máquina, portanto build/run da imagem não puderam ser executados aqui. O smoke ficou mantido para a verificação/deploy em host com Docker.

### Etapa 11 — MCP e skill no Hermes

- Skill aplicado: `hermes-agent`; confirmou paths profile-safe e necessidade de nova sessão/reset para recarregar MCP/skills.
- RED: suíte focal retornou três falhas (MCP ausente e skill/runtime ausentes) e um skip POSIX.
- Implementação: `nexus_picture` no template e reparo de todos os perfis, sampling desabilitado, timeout 300s; skill gerenciado instalado no home principal e perfis existentes sem remover skills alheios.
- Contrato do planner: somente sessão Picture-Hermes, CreativeBrief/CompositionPlan completos, textos/logos determinísticos, consulta antes de revisão, proibição de image_generate/approve/reset e status sem invenção.
- GREEN: suíte focal 3 pass/1 skip; suíte docker Hermes completa 16 pass/1 skip. O skip é apenas a execução bash idempotente em Windows sem bash; contrato e wiring foram validados estaticamente.

### Etapa 12 — Bridge Picture

- RED: oito contratos novos começaram com módulos Picture ausentes e rotas BFF não conectadas; o fluxo normal foi congelado por teste de igualdade de payload.
- Implementação: cliente server-to-server do Picture e Artifact Server, delegação JWT curta vinculada a tenant/user/session/workspace/run, redaction recursiva e serviço de lifecycle das sessões Picture.
- Isolamento: `experience=picture` exige sessão e workspace do usuário, importa todas as referências antes de enfileirar o Hermes, nunca instrui `image_generate` e não recebe delegação de Marketing Ops.
- BFF: current/get/files/approve/new-piece autenticados; approval idempotente; nova peça só após validação e executa reset do Picture, limpeza da sessão Hermes/chat e criação convergente de um novo workspace.
- Persistência segura: bytes e token técnico não entram no histórico da mensagem; o run guarda somente resumo do manifest, IDs e a entrada já redigida.
- GREEN: `node --check` passou em server/payloads; `npm test` retornou 81 pass, 0 fail.

### Etapa 13 — Isolar sessões normais e Picture no frontend

- RED: listagem não aplicava `session_kind=normal` e o payload ignorava os campos explícitos do modo Picture; dois testes falharam como esperado.
- Banco/segurança: criação normal continua usando o default protegido da tabela (clientes autenticados não recebem privilégio para forjar `session_kind`); a resposta tipada confirma `normal`.
- Chat reutilizável: `fixedSessionId`, `experience`, `pictureWorkspaceId`, `hideHistory` e callback de refresh foram adicionados sem alterar defaults; sessão fixa carrega mensagens mas não cria/navega pela sidebar.
- Isolamento visual: sidebar filtra defensivamente apenas sessões normais e a ação `image_generate` não aparece no composer Picture; o payload normal permaneceu estruturalmente igual.
- GREEN: 7/7 testes focais passaram e `tsc --noEmit` saiu com código 0.

### Etapa 14 — Client e estado persistente do workspace

- RED: client e hook inexistentes impediram a coleta das duas suítes.
- Client: cinco operações BFF autenticadas com bearer do Supabase, `AbortSignal`, IDs codificados, nenhum segredo interno e códigos conhecidos convertidos em mensagens seguras em português.
- Estado: TanStack Query hidrata current/details/files; chaves de detalhes e arquivos incluem `workspace_id`; o servidor permanece fonte da verdade, sem localStorage.
- Polling: somente `generating` refaz details/files; `drafting`, `review` e `validated` ficam estáveis. Refresh explícito atende ao fim de um turno do chat.
- Mutações: approve atualiza caches; newPiece troca sessão/workspace, remove cache antigo de arquivos e limpa a seleção local; erro de refresh preserva os dados anteriores.
- GREEN: 9/9 testes focais passaram e `tsc --noEmit` saiu com código 0.

### Etapa 15 — Chat Picture e painel de arquivos

- RED: as duas suítes de componentes falharam porque workspace, painel, preview e ações ainda não existiam.
- Cutover visual: a aba Geração de Imagem agora monta `PictureWorkspace`; formulário, hook e service do Designer foram removidos do frontend.
- Layout: grid desktop aproximadamente 55/45 com chat fixo e manifest; no mobile os arquivos abrem em Sheet. O chat vazio possui apenas orientação, composer e anexos, sem wizard nem controles do Designer.
- Preview: categorias do pacote, destaque da candidata, JSON/text formatado, imagem, fallback para arquivo desconhecido, link assinado cacheado e renovação preventiva/por erro.
- Ações humanas: aprovação somente em review; nova peça somente em validated; confirmação reproduz integralmente o aviso do PRD; pending bloqueia clique duplicado.
- GREEN: suíte completa do frontend 197/197; `tsc --noEmit` e build Vite de produção passaram. Restaram somente warnings preexistentes de chunk e caniuse desatualizado.

### Etapa 16 — Peças visuais em Trabalhos Validados

- RED: teste do card falhou inicialmente por componente ausente.
- Modelo: `peca_visual` e os metadados imutáveis de artefato/dimensões entraram nos tipos e labels do frontend.
- Card: URL assinada solicitada à Bridge com bearer Supabase, thumbnail, dimensões, preview ampliado, download, renovação de expiração/erro e fallback indisponível; o JSON interno de `content` nunca é o bloco principal.
- Edição: peças visuais permitem somente metadados textuais (título, status, curso e tags); `artifact_id` e conteúdo técnico não são enviados pela edição.
- Revisão de acesso: previews de trabalhos compartilhados agora resolvem o owner original na Bridge por `artifact_id + tenant_id + peca_visual + validated`; outros tenants não ganham acesso.
- GREEN: card 2/2, Bridge 82/82 e `tsc --noEmit` passaram.

### Etapa 17 — Cutover de runtime e remoção do Designer API

- RED: o teste novo provou que o Bridge em produção ainda aceitava iniciar sem URL/chaves do Picture.
- Fail-closed: produção agora exige URL HTTP(S), chave interna e chave de delegação fortes, `kid` ativo e issuer/audience coerentes; o `server.js` usa somente os valores validados.
- Compose: `picture-it` substituiu `designer-api`, permanece apenas na rede interna/porta exposta 8090, depende da prontidão do Artifact Server, usa o PostgreSQL/Supabase compartilhado, FAL, tmpfs limitado, worker com lease/heartbeat e `/ready` real.
- Dependências: Hermes e Bridge aguardam o Picture saudável; o Hermes recebe o MCP `nexus_picture`; o frontend deixou de receber as três URLs legadas e não depende mais do gerador antigo.
- Remoção: `apps/designer-api`, seu script de desenvolvimento e o debug obsoleto do frontend foram apagados; validadores e launcher local agora apontam para `services/picture-it`.
- Env: `.env.example` passou ao contrato Picture; o `.env` real ignorado foi limpo dos nomes Designer, recebeu 19 variáveis Picture, FAL real e duas chaves fortes novas sem exposição. A sincronização idempotente ficou em `scripts/env/sync-picture-env.ps1`.
- GREEN: Bridge 83/83; Picture 45/45 + typecheck + build; frontend 199/199 + typecheck + build; Hermes 16 pass/1 skip POSIX; contratos estáticos de ambos os Compose passaram.
- Limitação local: Docker e Bash não estão instalados, então `docker compose config/build` e smoke de container ficam como gate obrigatório na VPS (etapas 18/19 e runbook).

### Etapa 18 — Integração, E2E e operação

- Integração real sem custo: o teste sobe Artifact Server e Picture HTTP em portas temporárias, usa engine Sharp local e cobre ensure, enqueue, worker, manifest, aprovação, reset seletivo e preservação da final; 2/2 casos passaram.
- Recuperação: o segundo caso simula um worker interrompido, vence o lease e prova retomada sem duplicar o job.
- Correção revelada pelo teste: o executor passou a normalizar o `id` retornado pelo Artifact Server em `artifact_id` e revisões agora restauram o brief e as referências persistidas mais recentes. Cinco testes focais do worker passaram.
- E2E fake: rotas Supabase/Bridge são interceptadas e nenhum provedor pago é chamado. Desktop validou chat/painel, geração, previews, reload persistente, aprovação, cancelamento/confirmação do popup, workspace novo e peça visual validada; mobile validou o drawer de arquivos. Resultado 2/2.
- Depuração sistemática: o primeiro cenário mobile expôs que o botão hambúrguer não tinha nome acessível. `aria-label="Abrir menu"` foi adicionado e o seletor passou a representar a interação real; o rerun mobile e depois a dupla desktop/mobile passaram.
- Gate de tipagem: os 49 testes Picture passaram, mas o typecheck detectou uma inferência circular apenas no harness integrado; o tipo foi tornado explícito e typecheck/build passaram no rerun.
- Frontend: 199/199 testes, typecheck e build de produção passaram; permaneceram somente os warnings preexistentes de chunk grande/import misto e caniuse desatualizado.
- Operação: mapa de env, guia Picture e deploy VPS agora cobrem internal-only, Session Pooler, migrations, health/readiness, fila/lease, rotação de delegação, smoke FAL somente opt-in, teste manual e rollback sem apagar dados.
- FAL: nenhum teste ou smoke pago foi executado nesta etapa.

### Etapa 19 — Verificação final e smoke controlado

- Disciplina: a skill `verification-before-completion` foi aplicada e todos os gates abaixo foram executados novamente com o código final, sem confiar em resultados anteriores.
- Artifact Server: 13/13 testes passaram.
- Bridge: 83/83 testes passaram, incluindo fail-closed de produção, autenticação/isolamento Picture e preservação do gerador normal.
- Picture: 49/49 testes passaram; typecheck e build passaram. A suíte inclui engine, contratos, autenticação, package, fila/lease, HTTP/MCP, lifecycle, Docker contract e dois testes integrados.
- Frontend: 199/199 testes, typecheck e build passaram; E2E fake desktop/mobile 2/2 passou após a última correção. Lint terminou com zero erros e 10 warnings preexistentes.
- Finding do lint: o novo painel tinha um warning de dependência do hook. `selectFile` passou a `useCallback`, o warning novo desapareceu e teste focal 2/2 + typecheck passaram antes do rerun completo.
- Hermes: 16 testes passaram e 1 foi pulado por exigir POSIX/bash no host Windows.
- Supabase remoto: migration `20260721190000` está alinhada local/remoto; dry-run informou banco atualizado; o mesmo pgTAP transacional retornou `ok 1` a `ok 27`. O runner oficial conectou, mas tentou Docker; o arquivo foi então executado diretamente pelo driver Bun SQL, preservando seu `begin/rollback`.
- Env/segredos: 19/19 nomes Picture estão no `.env` real e no exemplo, sem extras/faltantes; banco/FAL estão configurados, chaves técnicas satisfazem o mínimo, nenhum nome Designer existe e o `.env` continua ignorado. Busca literal encontrou zero segredo real em arquivos rastreados.
- Compose: YAML base/prod foi parseado; Picture está internal-only, sem porta/labels Traefik, com `/ready`, Artifact/Bridge/Hermes encadeados e zero serviço Designer. O Docker CLI continua ausente, portanto `docker compose config/build` e o health real de container permanecem gates explícitos do deploy VPS.
- Isolamento: zero referência Designer executável após excluir migrations/relatórios históricos; `apps/designer-api` não existe; Roadmap.md permaneceu intacto; PRD e plano separados foram atualizados.
- Smoke pago: não executado por falta de autorização específica de custo. O E2E e a integração usaram engine/rotas fake locais.

### Hotfix pós-deploy — handshake MCP do Picture

- Sintoma observado na VPS: o dashboard do Hermes mostrava `nexus_picture` configurado em `http://picture-it:8090/mcp`, mas o startup encerrava a conexão após o timeout e registrava somente 32 tools dos outros três MCPs. A sessão Picture conhecia a competência, porém não recebia nenhuma tool `picture_*`.
- Reprodução local: um cliente oficial `StreamableHTTPClientTransport` contra o handler real travou no `initialize` e excedeu o limite de 5 segundos.
- Causa: o handler stateless retornava uma resposta SSE e executava `transport.close()` no `finally` imediatamente após criar o `Response`, encerrando o stream antes de o cliente consumir a resposta JSON-RPC.
- RED: o novo teste de regressão `mcp-http-transport.test.ts` falhou em `MCP initialize timed out` após 2 segundos.
- Correção mínima: o transporte stateless passou a usar `enableJsonResponse: true`; assim `handleRequest()` só retorna quando a resposta JSON-RPC está pronta e o fechamento posterior é seguro.
- GREEN focal: o handshake real completou `initialize` e `tools/list` em aproximadamente 60 ms, expondo exatamente `picture_get_workspace`, `picture_start_job`, `picture_revise` e `picture_get_job`.
- GREEN completa: Picture 50/50, typecheck e build passaram. Não houve alteração de banco, Supabase, `.env`, frontend ou contrato de ferramentas.
