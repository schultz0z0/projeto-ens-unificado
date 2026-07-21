# Picture-Hermes — diário de execução

**Branch:** codex/picture-hermes
**Plano:** docs/plans/2026-07-21-picture-hermes-implementation.md
**Regra:** execução sequencial, sem subagentes, com RED/GREEN e evidência antes de concluir cada etapa.

## Estado

| Etapa | Estado | Commit | Evidência principal |
|---|---|---|---|
| 1. Engine Picture | Concluída | a registrar | bun test, tsc e build verdes |
| 2. Contratos e paths | Em andamento | — | — |
| 3. Artifact Server | Pendente | — | — |
| 4. Banco | Pendente | — | — |
| 5. Artifact client | Pendente | — | — |
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

- Estado inicial: ainda não implementado.
