# Registro de riscos — Fase 0

## Escala

- `BLOCKER`: impede iniciar ou validar a etapa indicada;
- `CRITICAL`: exposição/indisponibilidade severa e imediata;
- `HIGH`: precisa de owner e mitigação antes do gate aplicável;
- `MEDIUM`: tratar no backlog com prazo;
- `LOW`: observar ou resolver oportunisticamente.

## Riscos ativos e transferidos

| ID | Severidade | Prob. | Estado | Evidência | Impacto | Mitigação/critério de saída | Owner proposto | Fase |
|---|---|---:|---|---|---|---|---|---|
| R-001 | `BLOCKER` | Alta | `open` | `profiles`, `chat_sessions` e `chat_messages` são criadas apenas em `ignored_migrations`; `remote_sync_*` são placeholders | bootstrap limpo do Supabase do app não é reproduzível | extrair baseline real, criar projeto dev descartável e testar migrations do zero | Backend/Data | 1 |
| R-002 | `BLOCKER` | Alta | `open` | `tenant-context.js` aceita `user_metadata.tenant_id` | usuário pode influenciar contexto de tenant | aceitar somente vínculo server-side/`app_metadata`; testes cross-tenant | Plataforma/Security | 1 |
| R-003 | `BLOCKER` | Média | `open` | Bridge aceita Bearer não vazio e header de tenant quando Supabase não está configurado | falha de env pode virar bypass de autenticação | fail-closed fora de teste e validação obrigatória no startup | Plataforma/Security | 1 |
| R-004 | `BLOCKER` | Alta | `open` | `.env` central declara produção; Docker/Supabase local isolado não está disponível | desenvolvimento/migrations podem atingir produção ou ficar sem teste real | provisionar Supabase de desenvolvimento/preview separado e política explícita de ambientes | DevOps/Data | 1 |
| R-005 | `BLOCKER` | Certa | `pending_user_deploy` | ADR 0005 e `vps-validation.md` | Fase 0 não pode virar `production_validated` | usuário faz push/deploy e executa gate VPS com evidências | DevOps/Usuário | 0 |
| R-006 | `HIGH` | Certa | `resolved_local` | security gate inicialmente encontrou 14 altas e 6 moderadas | supply chain e CVEs em runtime/build | lockfile atualizado sem `--force`; 120 testes e security gate repetidos; 0 vulnerabilidades | Frontend/Security | 0 |
| R-007 | `HIGH` | Média | `open` | funções `SECURITY DEFINER` no schema `public` | bypass de RLS/superfície RPC excessiva | revisar `EXECUTE`, ator, `search_path`; advisors e testes de negação | Backend/Security | 1 |
| R-008 | `HIGH` | Média | `open` | `validated_works.tenant_id` default `ens`; isolamento real não provado | vazamento cross-tenant futuro | modelo de membership, tenant obrigatório e policies testadas | Backend/Data | 1 |
| R-009 | `HIGH` | Média | `open` | CLI/host PostgreSQL não acessível e access token de Management API retorna `401` | backup/schema diff remoto incompletos | renovar token, corrigir conectividade e executar dump/advisors antes de migration destrutiva | DevOps/Data | 0–1 |
| R-010 | `HIGH` | Baixa | `accepted_temporarily` | RAG antigo do app possui 440 registros; usuário confirmou `rag_ens` descartável e `rag_marketing` potencialmente reaproveitável | remoção prematura de marketing útil | não tocar RAG MCP; quarentenar `rag_marketing`; backup antes de remover `rag_ens` | Knowledge/Data | 1 |
| R-011 | `HIGH` | Média | `open` | volumes locais guardam runs, Hermes, artifacts e Neo4j | perda de dados em falha/redeploy | política de snapshot, restore testado e monitoramento de disco | DevOps | 1 |
| R-012 | `HIGH` | Média | `open` | contexto hoje usa headers; não existe delegação assinada/scoped | Hermes pode chegar sem prova de autoridade operacional | implementar ADR 0003 antes do MCP mutável | Plataforma/Security | 1 |
| R-013 | `HIGH` | Média | `open` | serviços possuem logs/health, mas correlação não é uniforme | incidentes e execuções não rastreáveis ponta a ponta | correlation ID e eventos estruturados em API/MCP/outbox/worker | Plataforma | 1 |
| R-014 | `HIGH` | Média | `open` | Supabase 2026 exige grants explícitos conforme configuração/rollout | tabela com RLS pode ficar inacessível ou grant excessivo | declarar grants mínimos em todas as migrations e testar Data API | Backend/Data | 1 |
| R-015 | `MEDIUM` | Média | `open` | Edge Function `proxy-chatbot` permanece no repo; runtime principal usa Bridge | superfície legada/confusão operacional | confirmar ausência de tráfego e arquivar deployment | Plataforma | 1 |
| R-016 | `MEDIUM` | Certa | `open` | Docker e Bash ausentes no Windows atual | runtime Compose e scripts Linux não validados localmente | executar em WSL/Docker ou cobrir no gate VPS | DevOps | 0 |
| R-017 | `MEDIUM` | Certa | `open` | bundle frontend > 1 MB e warning de chunk > 500 kB | carregamento e cache piores | code splitting por rota e budget de bundle | Frontend | 2 |
| R-018 | `MEDIUM` | Média | `open` | tabelas vazias `ad_sets`, `ads`, `daily_metrics` e `market_*` ainda expostas | clutter e superfície Data API | remover por migration após backup/schema snapshot | Backend/Data | 1 |
| R-019 | `MEDIUM` | Média | `open` | workflows n8n históricos ainda referenciam RAG antigo | job externo pode falhar após limpeza | confirmar que workflows estão desativados e observar logs | Operações | 1 |
| R-020 | `LOW` | Média | `open` | audit do RAG MCP reporta uma vulnerabilidade baixa em `esbuild` de desenvolvimento no Windows | leitura de arquivo se dev server hostil for exposto | não expor dev server; atualizar dependência em manutenção controlada | Knowledge | 1 |

## Decisões abertas

| Decisão aberta | Prazo | Owner proposto | Default seguro |
|---|---|---|---|
| ambiente Supabase dev/preview | antes da primeira migration da Fase 1 | DevOps/Data | não aplicar schema novo em produção |
| formato/algoritmo da delegação | antes do MCP mutável | Plataforma/Security | MCP somente leitura/desabilitado |
| retenção de chat, runs e artefatos | antes do gate VPS da Fase 2 | Produto/Compliance | preservar e limitar acesso |
| importação do `rag_marketing` antigo | antes do hard drop | Marketing/Knowledge | manter em quarentena, sem escrever no RAG MCP |
| canal piloto e autorizadores | antes da Fase 5/6 | Produto/Marketing | execução real desabilitada |

## Regra de aceite

Riscos transferidos são formalmente fora do escopo de implementação da Fase 0, mas mantêm owner e fase. `BLOCKER` da Fase 1 precisa ser resolvido antes de mutações operacionais; `R-005` é o único bloqueio externo para o status global da Fase 0.
