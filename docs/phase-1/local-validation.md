# Validação local da Fase 1

- **Estado:** `validated_locally`
- **Ambiente:** Windows, PowerShell, Git Bash e Docker Desktop
- **Data:** 2026-07-13

## Evidência já concluída

| Gate | Resultado |
|---|---|
| Supabase reset | PostgreSQL 17 recriado; baseline e quatro migrations incrementais aplicados |
| pgTAP | 2 arquivos, 97 testes, todos aprovados |
| DB lint | zero erro |
| Security advisor | zero erro; 15 warnings legados do baseline público |
| Marketing Ops unit/integration | 53 testes, incluindo 2 E2E de container, aprovados |
| Bridge | 69 testes aprovados |
| Hermes runtime/config | 13 testes Python aprovados |
| Frontend SDK | 125 testes totais, typecheck, lint sem erros e build aprovados |
| Compose | base e produção válidos; structural check aprovado |
| Imagens Linux | `marketing-ops`, `app-bridge` e `hermes-api` construídas sem cache e inspecionadas |
| Container | `/health` e `/ready` aprovados |
| REST E2E | GoTrue real, create, replay idempotente, update v2 e stale 409 |
| MCP E2E | cliente oficial leu via tool o registro criado por REST |
| Restart | registro v2 persistiu após restart do container |

O comando canônico é `bash scripts/test/phase-1-local.sh`. No Windows/WSL, o fechamento usa `git.exe` para não interpretar o checkout CRLF como milhares de alterações; no Ubuntu usa o Git nativo. Credenciais locais geradas pelo Supabase CLI são carregadas apenas no processo e não aparecem neste documento. A validação não usa o Supabase RAG e não escreve em produção.

Cinco execuções completas foram realizadas. A execução final levou 79,8 segundos e retornou `Phase 1 local gate: PASS`, incluindo uma etapa Windows explícita com os 2 E2E de container aprovados. Os avisos restantes são ACLs redundantes do dump `vector`, 15 advisors legados, 10 warnings ESLint preexistentes e chunk frontend acima de 500 kB.

Em 13 de julho de 2026, a correção de renovação da delegação passou novamente pelo gate canônico integral em 171,2 segundos: 97 pgTAP, Marketing Ops 38 testes + 2 E2E, Bridge 65 testes, Hermes 3 testes, frontend 125 testes, typechecks/builds/audits e Compose base/produção aprovados. O token renovado preserva TTL máximo de 120 segundos e o mesmo `jti`; a autoridade termina quando a run pai encerra ou completa 900 segundos. Como o Hyper-V reservava as portas Supabase padrão no Windows, a execução usou portas locais alternativas apenas no processo de teste e restaurou o checkout antes do fechamento.

Ainda em 13 de julho, o diagnóstico do teste 14 comprovou que versões anteriores da Bridge colocavam o bloco de delegação dentro da mensagem persistida pelo SessionDB do Hermes. A correção foi conduzida por TDD: os testes falharam antes da implementação e passaram depois, cobrindo o transporte em `system_message` efêmero e o scrub idempotente de uma ou várias delegações legadas sem alterar o restante da conversa. O reset, lint, advisors e os 97 pgTAP passaram no WSL; como o executável `docker` dessa sessão apontava para um socket Podman inativo, o restante do gate foi executado no Docker Desktop nativo e aprovou Marketing Ops 38 testes + 2 E2E, Bridge 66, Hermes 5, RAG 26, Graph 18, Artifact 8 e frontend 125, além de typechecks, builds, audits, Compose base/produção e `git diff --check`. As imagens Linux de `app-bridge` e `hermes-api` foram reconstruídas e inspecionadas. As portas Supabase temporárias foram restauradas e não houve alteração de `.env`, migration ou Supabase remoto.

O teste manual 15 revelou um segundo canal legado: argumentos de tools eram persistidos em `messages.tool_calls`, embora `messages.content` já estivesse limpo. O novo teste TDD reproduz um token obsoleto selecionado do histórico e comprova que o executor o substitui pelo token efêmero do turno. A persistência e todos os caminhos de replay do SessionDB, além do snapshot JSON opcional, redigem valores `delegation_token`; o scrub de startup cobre `content` e `tool_calls`. A validação fresca aprovou Marketing Ops 42 testes + 2 E2E, Bridge 66, Hermes 10, RAG 26, Graph 18, Artifact 8, frontend 125, 97 pgTAP, typechecks, builds, audits e Compose base/produção. Uma suíte MCP com Supabase local real aprovou os equivalentes aos testes manuais 15–20. As imagens Linux de Bridge e Hermes foram reconstruídas sem cache e executaram os gates de binding, persistência/replay e scrub. As portas temporárias foram restauradas; `.env`, migrations e Supabase remoto não foram alterados.

## Hardening de confirmação conversacional

Em 13 de julho de 2026, a inconsistência observada com um usuário `member` foi transformada em requisito de produto: o Hermes não pode exigir campos técnicos e não pode persistir nenhuma mutação antes de uma confirmação humana única para o plano completo. A implementação foi conduzida por TDD e validou plano assinado stateless, vínculo a ator/tenant/sessão, expiração e rotação de chave, recusa no mesmo turno, recusa sem confirmação, adulteração, execução de campanha mais item, idempotência de retry, resultado parcial e bloqueio das tools mutáveis diretas no runtime.

A rodada final aprovou:

| Gate | Resultado final |
|---|---|
| Supabase do app local | migrations/seed aplicados em portas alternativas temporárias; RAG não acessado |
| pgTAP | 97/97 |
| DB lint | zero erro |
| Security advisor | zero erro; 15 warnings legados |
| Marketing Ops | 53/53, incluindo 2 E2E contra o container Linux; typecheck e build aprovados |
| Chat Bridge | 69/69; audit de produção com zero vulnerabilidades |
| Hermes runtime | 13/13 |
| RAG MCP | 26/26; typecheck e build aprovados |
| Graph MCP | 18/18; typecheck e build aprovados |
| Artifact Server | 8/8 |
| Frontend | 125/125; typecheck, lint sem erros e build aprovados |
| Imagens Linux | `marketing-ops`, `app-bridge` e `hermes-api` reconstruídas sem cache e inspecionadas |
| Compose | configurações base e produção aprovadas |

Os 10 avisos de lint e o alerta de chunk do frontend são preexistentes. Durante a inspeção da imagem, um pipe legado mascarava a falha do `npm ci` do `pptx-studio`; o Dockerfile passou a usar o Chromium do sistema e a falhar fechado, e a imagem final confirmou `dom-to-pptx` instalado. O Supabase descartável foi encerrado, as portas oficiais foram restauradas e não houve alteração em `.env`, migrations ou Supabase remoto. O hardening está `validated_locally`; o fechamento da Fase 1 continua condicionado ao redeploy e ao aceite conversacional na VPS.

## Correção posterior ao aceite automatizado

O aceite no app real reproduziu uma revisão de plano em que o Hermes enviou `expected_version` como string numérica. O schema do MCP recusou a chamada antes da normalização interna. Por TDD, o contrato passou a aceitar número ou string decimal positiva na fronteira e a normalizar para inteiro antes de assinar o plano. O teste comprova também que a chamada atravessa a validação do SDK MCP, em vez de falhar com `-32602`.

O contrato da Bridge e a skill do operador foram reforçados para não pedir confirmação de um plano revisado antes de `prepare_plan` concluir, resumir recusas sem códigos, scopes, IDs ou detalhes de transporte e encerrar após o resultado do Marketing Ops sem propor gravações em outros sistemas. A rodada canônica final levou 147,5 segundos e aprovou 97 pgTAP, Marketing Ops 53/53, Hermes 13/13, Bridge 69/69 e todas as suítes, typechecks, builds, audits e Compose restantes. As imagens Linux de `app-bridge` e `hermes-api` foram reconstruídas sem cache. O Supabase local foi encerrado, as portas oficiais foram restauradas e não houve mudança em `.env`, migration ou Supabase remoto.
