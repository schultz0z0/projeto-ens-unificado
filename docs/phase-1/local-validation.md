# Validação local da Fase 1

- **Estado:** `validated_locally`
- **Ambiente:** Windows, PowerShell, Git Bash e Docker Desktop
- **Data:** 2026-07-11

## Evidência já concluída

| Gate | Resultado |
|---|---|
| Supabase reset | PostgreSQL 17 recriado; baseline e quatro migrations incrementais aplicados |
| pgTAP | 2 arquivos, 97 testes, todos aprovados |
| DB lint | zero erro |
| Security advisor | zero erro; 15 warnings legados do baseline público |
| Marketing Ops unit/integration | 32 testes + 2 E2E de container aprovados |
| Bridge | 60 testes aprovados |
| Hermes config | 3 testes Python aprovados |
| Frontend SDK | 125 testes totais, typecheck, lint sem erros e build aprovados |
| Compose | base e produção válidos; structural check aprovado |
| Imagem Linux | `projeto-ens-marketing-ops:latest` construída com Node 22 Alpine e audit limpo |
| Container | `/health` e `/ready` aprovados |
| REST E2E | GoTrue real, create, replay idempotente, update v2 e stale 409 |
| MCP E2E | cliente oficial leu via tool o registro criado por REST |
| Restart | registro v2 persistiu após restart do container |

O comando canônico é `bash scripts/test/phase-1-local.sh`. No Windows/WSL, o fechamento usa `git.exe` para não interpretar o checkout CRLF como milhares de alterações; no Ubuntu usa o Git nativo. Credenciais locais geradas pelo Supabase CLI são carregadas apenas no processo e não aparecem neste documento. A validação não usa o Supabase RAG e não escreve em produção.

Cinco execuções completas foram realizadas. A execução final levou 79,8 segundos e retornou `Phase 1 local gate: PASS`, incluindo uma etapa Windows explícita com os 2 E2E de container aprovados. Os avisos restantes são ACLs redundantes do dump `vector`, 15 advisors legados, 10 warnings ESLint preexistentes e chunk frontend acima de 500 kB.
