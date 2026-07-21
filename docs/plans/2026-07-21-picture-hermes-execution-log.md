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
| 14. Client/hook frontend | Concluída | a registrar | 9 testes focais e typecheck verdes |
| 15. UI Picture | Pendente | — | — |
| 16. Trabalhos Validados | Pendente | — | — |
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
