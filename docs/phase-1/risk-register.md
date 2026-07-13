# Registro de riscos da Fase 1

- **Revisão:** 2026-07-13
- **Estado:** riscos bloqueantes mitigados; riscos residuais aceitos para rollout controlado

| ID | Risco | Mitigação/evidência | Residual | Owner |
|---|---|---|---|---|
| R-01 | acesso cross-tenant | membership servidor-side, contexto RLS, force RLS e testes negativos | baixo | Backend/Security |
| R-02 | delegação MCP forjada, reutilizada, expirada ou recuperada do histórico | HS256 com `kid`, TTL, scopes, membership atual e JTI; renovação limitada à run ativa; transporte por prompt efêmero e scrub seletivo de blocos legados no SessionDB | baixo | Plataforma |
| R-03 | duplicidade ou perda parcial | idempotência, versão e entidade/audit/outbox na mesma transação | baixo | Backend |
| R-04 | baseline remoto divergente | dumps externos, hashes, history repair explícito e dry-run antes do push | médio até o deploy | Data |
| R-05 | segredo no frontend/log | build args públicos allowlisted, security gate e logger recursivamente redigido | baixo | Security |
| R-06 | indisponibilidade do serviço novo | flags default-off, probes, SLO, métricas internas e rollback de imagem | baixo | DevOps |
| R-07 | rate limit compartilhado atrás do proxy | um hop Traefik confiável e bucket por IP encaminhado | baixo | Plataforma |
| R-08 | usuário ENS sem membership | bootstrap remoto e trigger idempotente sobre `public.profiles` | baixo após migration | Backend/Data |
| R-09 | warnings legados do Supabase | 15 warnings catalogados; zero erro; não ampliados pelo Marketing Ops | médio, não bloqueante | Data/Security |
| R-10 | bundle frontend grande | registrado como dívida F1-201; sem regressão funcional da fundação | médio, não bloqueante | Frontend |
| R-11 | diferenças Windows/Ubuntu | gate Windows/Docker Desktop e checklist de build/smoke Ubuntu | médio até homologação | DevOps |
| R-12 | ativação prematura | rollout read/write separado e kill switch cliente | baixo | Produto/DevOps |

Nenhum risco residual autoriza escrever no Supabase do RAG ou pular backup, dry-run e confirmação do projeto do app.
