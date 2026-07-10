# Matriz de responsabilidades

## Ownership por componente

| Componente | Owner proposto | Responsável por | Fonte de verdade que opera | Não é responsável por |
|---|---|---|---|---|
| Frontend | Produto/Frontend | UX, navegação, edição, optimistic UI, consumo de SSE/API | nenhum estado autoritativo próprio | autorizar ações, confiar em papel visual, executar canais |
| Chat Bridge | Plataforma/Integração | autenticar chat, runs, SSE/replay, adapters Hermes, anexos, artifacts, aprovação técnica | RunStore de transporte | campanha, aprovação editorial, autorização operacional |
| Hermes | AI/Agents | intenção, planejamento, geração, recomendação e tool use scoped | sessão/memória conversacional | fonte de verdade, RBAC, envio direto, afirmar execução sem recibo |
| Marketing Ops | Backend/Produto | domínio de campanhas, versões, approvals, autorização, execução, auditoria, API e MCP | Supabase operacional | armazenar conhecimento documental bruto ou binários pesados |
| Supabase Auth | Plataforma | identidade, sessão, emissão/validação de token | usuários e sessões | papel de produto editável pelo cliente |
| Supabase operacional | Backend/Data | entidades transacionais, RLS, audit/outbox | estado operacional | raciocínio do agente ou arquivos grandes |
| Artifact Server | Plataforma | armazenamento de artefatos, hashes e links temporários | binários/metadata técnica | estado de aprovação ou autorização |
| RAG MCP | Knowledge | ingestão/busca de documentos oficiais | conhecimento recuperável | estado atual de campanha, papel ou permissão |
| Graph MCP/Neo4j | Knowledge | fatos/relações e refs de trabalhos validados | memória relacional validada | autorização, auditoria transacional ou execução |
| Workers/conectores | Integrações | executar payload autorizado, retry, recibo e reconciliação | estado técnico da tentativa | aprovar conteúdo ou escolher escopo por conta própria |
| Operação/DevOps | Plataforma | Compose, secrets, backups, deploy, health, logs, rollback | configuração de runtime | decisões editoriais |
| Usuário `member` | Negócio | criar/editar/propor e consultar dentro do scope | suas decisões registradas | gestão global ou autorização privilegiada |
| Usuário `manager` | Negócio | revisar/aprovar e gerenciar memória conforme política | decisões assinadas | alterar infraestrutura/secrets |
| Usuário `admin` | Negócio/Plataforma | usuários, papéis, políticas administrativas e operações de alto privilégio | decisões administrativas auditadas | burlar trilha de auditoria |

## Matriz RACI para fluxos críticos

Legenda: `R` executa, `A` responde pela decisão, `C` consultado, `I` informado.

| Atividade | Frontend | Bridge | Hermes | Marketing Ops | Humano autorizado | Worker | RAG/Graph |
|---|---|---|---|---|---|---|---|
| Criar/editar campanha | R | I | R opcional via MCP | A/R | A quando política exigir | I | C |
| Gerar versão | R | R transporte | R | A pelo registro/versionamento | C | I | C |
| Aprovação técnica de ferramenta | R UI | A/R proxy | R solicitante | I | A decisão | I | I |
| Aprovação editorial | R UI | I | C | R registro/política | A | I | I |
| Autorização operacional | R UI | I | C | R validação/registro | A | I | I |
| Executar publicação/envio | I | I | I | A/orquestra | I | R | I |
| Registrar recibo/resultado | I | I | I | A/R | I | R produtor | I |
| Consultar conhecimento | I | R transporte | A/R decisão de consulta | C | I | I | R |
| Promover aprendizado validado | R UI | I | C | A/R provenance | A | I | R destino |
| Alterar papel/permissão | R UI admin | I | I | C | A admin | I | I |
| Deploy/rollback | I | I | I | I | I | I | I; Operação é A/R |

## Regras obrigatórias de autoridade

1. O frontend pode esconder ações, mas a autorização sempre é recalculada no servidor.
2. O Chat Bridge transporta contexto; não concede scope de domínio.
3. Hermes recebe uma delegação curta e não pode ampliar tenant, papel ou scopes.
4. Marketing Ops valida estado, versão, approval editorial e autorização operacional antes de publicar.
5. Worker rejeita payload ausente, expirado, alterado ou já processado fora do contrato idempotente.
6. RAG e Graph podem aconselhar; nunca autorizam.
7. Toda ação sensível gera audit event com ator, tenant, correlation ID e resultado.

## Separação das aprovações

| Decisão | Owner | Registro | Prazo/escopo | Efeito permitido |
|---|---|---|---|---|
| Aprovação técnica | Hermes/Bridge | evento runtime | comando/tool call específico e curto | ferramenta pode prosseguir no runtime |
| Aprovação editorial | Marketing Ops/Negócio | decisão sobre `version_id` | versão exata | conteúdo fica editorialmente aprovado |
| Autorização operacional | Marketing Ops/Negócio | autorização sobre pacote/canal | payload, canal, janela e limites | worker pode receber pedido idempotente |

Uma execução só é válida quando o Marketing Ops comprova a versão e a autorização operacional exigida. O prompt do Hermes e a aprovação técnica não substituem essa prova.

## Decisões abertas de ownership

- owner de negócio definitivo para catálogo de cursos/ofertas;
- owner e política de retenção de chats/artefatos;
- quem pode autorizar cada canal e limite financeiro;
- responsabilidade pelo baseline/migrations do Supabase;
- plantão e SLO de workers/conectores;
- processo de promoção/expiração de aprendizado no RAG/Graph.

Essas decisões devem receber nomes/papéis concretos antes do gate de produção das fases que delas dependem.
