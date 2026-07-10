# Mapa de dados

## Princípio

Cada classe de dado possui uma única fonte de verdade operacional. RAG e Graph enriquecem decisões, mas não substituem o estado transacional nem a trilha de auditoria do Marketing Ops.

## Mapa atual e alvo

| Classe de dado | Fonte de verdade atual | Produtores | Consumidores | Sensibilidade | Classificação/alvo |
|---|---|---|---|---|---|
| Identidade e sessão | Supabase Auth | Supabase Auth/admin | Frontend, Bridge, RLS | Alta: identidade, e-mail, tokens | `keep`; tokens nunca persistidos em logs |
| Perfil e papel | Supabase `profiles` | trigger/RPC/admin | Frontend, Bridge, RLS | Alta: PII e autorização | `adapt`; authority server-side na Fase 1 |
| Tenant | fallback/configuração e metadata JWT | admin/configuração | Bridge, RAG, Graph | Crítica: limite de isolamento | `migrate`; catálogo e delegação confiáveis |
| Sessões e mensagens | Supabase `chat_sessions`/`chat_messages` | Frontend | Frontend, contexto do chat | Alta: conteúdo do usuário | `keep`; definir retenção/expurgo |
| Estado conversacional Hermes | `chat_session_hermes_state` + sessão Hermes | Bridge/Hermes | Bridge/Hermes | Alta: IDs e continuidade | `keep`; não usar como estado de campanha |
| Runs e eventos de streaming | JSON no volume do Chat Bridge | Bridge | Frontend | Média/alta: prompts, erros, artefatos | `keep`; retenção e limites ainda abertos |
| Anexos de chat | Supabase Storage privado | Frontend/Bridge | Bridge/Hermes/Frontend | Alta: arquivos enviados | `keep`; ownership e TTL a revisar |
| Imagens geradas | Supabase Storage `image-gen-outputs` | Designer/Hermes/Bridge | Frontend | Média/alta | `adapt`; vincular a item/versão futura |
| Artefatos Hermes | Artifact Server + volume compartilhado | Hermes/Bridge | Frontend por URL assinada | Conforme conteúdo | `keep`; metadata de vínculo no Marketing Ops |
| Conhecimento oficial ENS | RAG dedicado em Supabase | ingestion/admin | Hermes via `nexus_rag` | Interna | `keep`; facts citáveis, não estado transacional |
| Relações e fatos validados | Neo4j Graph | Graph MCP após validação | Hermes/serviços internos | Interna/alta | `keep`; referências, não autoridade operacional |
| Trabalhos validados | Supabase `validated_works` + referência Graph | usuários/Graph MCP | Frontend, Hermes | Interna | `adapt`; preservar proveniência e status |
| Catálogo de cursos/ofertas | Supabase do app e/ou RAG sincronizado | ingestão/admin | RAG, Hermes, telas ENS | Comercial | `keep`; definir master-data owner |
| Market Intelligence | tabelas `market_*`, se existirem | histórico n8n/Apify | nenhum consumidor ativo no app | Comercial/terceiros | `unknown_runtime`; auditar antes de arquivar |
| Campanhas Meta antigas | migrations históricas; runtime desconhecido | workflows históricos | consumidores externos desconhecidos | Comercial | `archive`; nunca reutilizar como novo schema |
| Campanhas e itens futuros | Supabase via Marketing Ops | API/MCP do Marketing Ops | Workspace, Hermes, workers | Alta: operação de negócio | `create`; fonte de verdade operacional |
| Aprovações editoriais | inexistente | aprovadores humanos | Marketing Ops/Hermes | Alta: decisão de negócio | `create`; imutável/auditável |
| Autorizações operacionais | inexistente | papel autorizado | workers/Marketing Ops | Crítica: permissão de envio | `create`; separada de aprovação editorial |
| Execuções e resultados | inexistente | workers/conectores | Marketing Ops/dashboard | Alta: operação e performance | `create`; idempotência e reconciliação |
| Métricas de performance | fontes externas + snapshots futuros | conectores/workers | Marketing Ops/Hermes | Comercial | `create`; guardar origem e janela temporal |
| Auditoria | fragmentada em logs/RAG audit | serviços atuais | operação/suporte | Alta | `create`; trilha append-only no domínio |

## Fronteiras de persistência

| Sistema | Pode ser fonte de verdade para | Não pode ser fonte de verdade para |
|---|---|---|
| Supabase/Marketing Ops | estado, versões, approvals, autorização, execução, auditoria | binários pesados quando Artifact Server for adequado |
| Chat Bridge | runs transitórios, cursor SSE e recuperação de transporte | campanhas, approvals editoriais, autorização operacional |
| Hermes | sessão conversacional e raciocínio corrente | estado operacional definitivo ou permissão de envio |
| Artifact Server | conteúdo binário e URLs temporárias | status de aprovação ou relacionamento de campanha |
| RAG | documentos oficiais e evidência recuperável | status atual de campanha, orçamento ou execução |
| Graph | relações, referências e memória validada | autorização, ledger operacional ou métricas brutas |
| Workers/conectores | recibos técnicos e resposta do provedor | decisão humana de aprovar/autorizar |

## Fluxos de sincronização aprovados

1. Supabase operacional emite evento/outbox depois de uma transação confirmada.
2. Worker executa somente payload autorizado, versionado e idempotente.
3. Resultado externo retorna ao Marketing Ops com correlation/idempotency key.
4. RAG recebe apenas conteúdo que deve virar conhecimento consultável.
5. Graph recebe relações leves e trabalhos explicitamente validados.
6. Artefatos permanecem no Artifact Server/Storage; tabelas guardam IDs, hashes e proveniência.

## Lacunas de governança

- política de retenção de chats, runs, anexos e artefatos;
- classificação LGPD por campo e procedimento de exclusão/exportação;
- catálogo definitivo de tenants e papéis;
- inventário remoto de buckets, policies, tabelas e grants;
- owners de master data de cursos/ofertas;
- política de backup e restore por store;
- reconciliação entre `validated_works` e referências Neo4j;
- contrato de lineage para métricas externas.

Essas lacunas devem entrar como requisitos da Fase 1 ou como risco com owner explícito antes do primeiro envio real.
