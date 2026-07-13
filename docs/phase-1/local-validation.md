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

Em 13 de julho de 2026, a correção de renovação da delegação passou novamente pelo gate canônico integral em 171,2 segundos: 97 pgTAP, Marketing Ops 38 testes + 2 E2E, Bridge 65 testes, Hermes 3 testes, frontend 125 testes, typechecks/builds/audits e Compose base/produção aprovados. O token renovado preserva TTL máximo de 120 segundos e o mesmo `jti`; a autoridade termina quando a run pai encerra ou completa 900 segundos. Como o Hyper-V reservava as portas Supabase padrão no Windows, a execução usou portas locais alternativas apenas no processo de teste e restaurou o checkout antes do fechamento.

Ainda em 13 de julho, o diagnóstico do teste 14 comprovou que versões anteriores da Bridge colocavam o bloco de delegação dentro da mensagem persistida pelo SessionDB do Hermes. A correção foi conduzida por TDD: os testes falharam antes da implementação e passaram depois, cobrindo o transporte em `system_message` efêmero e o scrub idempotente de uma ou várias delegações legadas sem alterar o restante da conversa. O reset, lint, advisors e os 97 pgTAP passaram no WSL; como o executável `docker` dessa sessão apontava para um socket Podman inativo, o restante do gate foi executado no Docker Desktop nativo e aprovou Marketing Ops 38 testes + 2 E2E, Bridge 66, Hermes 5, RAG 26, Graph 18, Artifact 8 e frontend 125, além de typechecks, builds, audits, Compose base/produção e `git diff --check`. As imagens Linux de `app-bridge` e `hermes-api` foram reconstruídas e inspecionadas. As portas Supabase temporárias foram restauradas e não houve alteração de `.env`, migration ou Supabase remoto.
