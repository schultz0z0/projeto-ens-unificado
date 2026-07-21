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
| 4. Banco | Concluída e aplicada | a registrar | 27 pgTAP verdes no remoto |
| 5. Artifact client | Em andamento | — | — |
| 6. Workspace lifecycle | Pendente | — | — |
| 7. Package builder | Pendente | — | — |
| 8. Jobs e worker | Pendente | — | — |
| 9. REST/MCP/auth | Pendente | — | — |
| 10. Container Picture | Pendente | — | — |
| 11. Hermes MCP/skill | Pendente | — | — |
| 12. Bridge Picture | Pendente | — | — |
| 13. Sessões frontend | Pendente | — | — |
| 14. Client/hook frontend | Pendente | — | — |
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
