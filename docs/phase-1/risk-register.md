# Registro de riscos da Fase 1

- **Revisão:** 2026-07-13
- **Estado:** riscos bloqueantes mitigados; riscos residuais aceitos após homologação de produção

| ID | Risco | Mitigação/evidência | Residual | Owner |
|---|---|---|---|---|
| R-01 | acesso cross-tenant | membership servidor-side, contexto RLS, force RLS e testes negativos | baixo | Backend/Security |
| R-02 | delegação MCP forjada, reutilizada, expirada ou recuperada do histórico | HS256 com `kid`, TTL, scopes, membership atual e JTI; renovação limitada à run ativa; binding do token atual no executor; redaction de `tool_calls` na persistência/replay; scrub seletivo de conteúdo e argumentos legados | baixo | Plataforma |
| R-03 | duplicidade ou perda parcial | idempotência, versão e entidade/audit/outbox na mesma transação | baixo | Backend |
| R-04 | baseline remoto divergente | dumps externos, hashes, history repair explícito, dry-run e deploy validado | baixo | Data |
| R-05 | segredo no frontend/log | build args públicos allowlisted, security gate e logger recursivamente redigido | baixo | Security |
| R-06 | indisponibilidade do serviço novo | flags default-off, probes, SLO, métricas internas e rollback de imagem | baixo | DevOps |
| R-07 | rate limit compartilhado atrás do proxy | um hop Traefik confiável e bucket por IP encaminhado | baixo | Plataforma |
| R-08 | usuário ENS sem membership | bootstrap remoto e trigger idempotente sobre `public.profiles`; matriz real validada | baixo | Backend/Data |
| R-09 | warnings legados do Supabase | 15 warnings catalogados; zero erro; não ampliados pelo Marketing Ops | médio, não bloqueante | Data/Security |
| R-10 | bundle frontend grande | registrado como dívida F1-201; sem regressão funcional da fundação | médio, não bloqueante | Frontend |
| R-11 | diferenças Windows/Ubuntu | gate Windows/Docker Desktop, imagem Linux e homologação no Ubuntu | baixo | DevOps |
| R-12 | ativação prematura | rollout read/write separado e kill switch cliente | baixo | Produto/DevOps |
| R-13 | Hermes serializa versão numérica como texto e bloqueia revisão de plano | fronteira MCP aceita número ou string decimal positiva e normaliza para inteiro; teste cobre validação do SDK antes da assinatura | baixo | Backend |
| R-14 | confirmação repetida autoriza escrita alheia ao plano recém-executado | contrato e skill encerram após o resultado do Marketing Ops e proíbem oferecer ou interpretar a repetição para Graph, RAG, artefatos ou memória validada | baixo | Plataforma/Produto |
| R-15 | confirmação natural inequívoca não recebe delegação autorizada por estar fora da allowlist exata | allowlist inclui as duas formulações observadas em produção e mantém teste negativo para confirmação condicional | baixo | Plataforma |
| R-16 | rejeições de negócio MCP abrem o circuit breaker e simulam indisponibilidade de servidor saudável | respostas estruturadas de tool comprovam conectividade e zeram o contador; somente erros de transporte/sessão/conexão incrementam o breaker; suíte dedicada 4/4 na imagem Linux | baixo | Plataforma |
| R-17 | modelo copia `plan_token` inválido ou tenta executar revisão no mesmo turno | runtime vincula o token do último preparo bem-sucedido e bloqueia `execute_plan` sem `confirmation_intent` atual; backend mantém todas as verificações criptográficas; imagem Linux 19/19 e aceite real aprovados | baixo | Plataforma |
| R-18 | modelo produz ocasionalmente um primeiro plano inválido | falha permanece fechada, sem escrita; retry conversacional preparou o plano e o fluxo seguinte foi executado exatamente uma vez | baixo, não bloqueante; evoluir a UX na Fase 4 | Produto/Plataforma |

Nenhum risco residual autoriza escrever no Supabase do RAG ou pular backup, dry-run e confirmação do projeto do app.
