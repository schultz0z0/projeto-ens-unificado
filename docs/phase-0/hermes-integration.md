# Integração Hermes, Chat Bridge e frontend

## Resumo da fronteira

O frontend não conversa diretamente com o runtime Hermes. O `app-bridge` autentica o usuário, mantém runs recuperáveis, adapta o protocolo Hermes para SSE, prepara anexos e importa artefatos. Hermes permanece responsável por raciocínio e uso de ferramentas. O futuro `marketing-ops` será responsável pelo domínio de campanhas.

```text
Frontend -> Chat Bridge -> Hermes API -> RAG MCP / Graph MCP
    |             |             |
Supabase      RunStore       sessão/memória
    |             |
Storage      Artifact Server
```

## Sequência atual de uma mensagem

1. O usuário autentica no Supabase pelo frontend.
2. `ChatInterface` cria ou reutiliza `chat_sessions` e persiste a mensagem humana em `chat_messages`.
3. Anexos são preparados no Supabase Storage; o frontend envia ao Bridge referências estruturadas, não credenciais administrativas.
4. `chatStreamClient` faz `POST /api/chat/runs` com Bearer token, `session_id`, texto, anexos e intenção opcional.
5. O Bridge valida payload e token em `/auth/v1/user`, busca `profiles` com credencial server-side e deriva papel normalizado.
6. O Bridge cria um run, persiste snapshot/eventos em JSON no volume `BRIDGE_DATA_DIR` e responde com o identificador.
7. O frontend abre `GET /api/chat/runs/:runId/events?cursor=N` e recebe SSE incremental; snapshot `GET /api/chat/runs/:runId` permite reconciliação.
8. O Bridge cria/vincula uma sessão Hermes e registra continuidade em `chat_session_hermes_state`.
9. No modo atual, envia o pedido a `/api/sessions/:hermesSessionId/chat/stream`, com contexto de usuário/tenant/sessão e contratos de memória/humanização.
10. Hermes decide quando consultar `nexus_rag` e `nexus_graph`; esses MCPs ficam na rede interna do Compose.
11. O Bridge converte eventos Hermes em eventos SSE estáveis, importa arquivos elegíveis no Artifact Server e troca paths internos por URLs assinadas.
12. O frontend monta a resposta, persiste a mensagem do assistente no Supabase e renova links de artefatos expirados via Bridge.

## Contratos de transporte

### Frontend -> Bridge

| Operação | Endpoint | Responsabilidade |
|---|---|---|
| Criar run | `POST /api/chat/runs` | validar request, autenticar, preparar execução |
| Ler snapshot | `GET /api/chat/runs/:id` | reconciliar estado após perda de conexão |
| Stream | `GET /api/chat/runs/:id/events?cursor=` | replay + eventos novos por SSE |
| Renovar artefato | `POST /api/artifacts/:id/access-link` | obter URL assinada autenticada |
| Approval técnico | `GET /api/approvals/stream` | adaptar WebSocket Hermes para SSE |
| Responder approval técnico | `POST /api/approvals/respond` | encaminhar decisão técnica ao Hermes |

O cursor é a posição na lista persistida de eventos do run. Em restart, runs não terminais carregados do disco são marcados como `interrupted`, permitindo diagnóstico em vez de aparentar sucesso.

### Bridge -> Hermes

Headers observados incluem:

- `X-Hermes-Session-Id` e `X-Hermes-Session-Key`;
- `X-Tenant-Id`;
- `X-User-Id` e `X-Nexus-User-Id`;
- `X-Nexus-User-Role`;
- `X-Nexus-Session-Id`;
- Bearer interno do Hermes quando configurado.

Esses headers carregam contexto, mas não são uma autorização operacional suficiente para mutar o Marketing Ops. A Fase 1 deve emitir delegação de curta duração, assinada, com tenant, ator, papel, scopes, audiência, expiração e correlation ID.

## Identidade, papel e tenant

### Com Supabase configurado

- o Bearer token é validado no endpoint de Auth;
- o header de tenant enviado pelo cliente não é aceito como autoridade;
- o papel vem de `profiles` e é reduzido a `member`, `manager` ou `admin`;
- o tenant usa metadata do usuário e, na ausência, o fallback configurado.

### Riscos encontrados

1. `resolveTrustedTenantId` aceita `app_metadata.tenant_id` **ou** `user_metadata.tenant_id`. `user_metadata` é editável pelo usuário e não pode participar de autorização. Deve ser removido da resolução confiável antes do multi-tenant operacional.
2. Se URL/anon key do Supabase estiverem ausentes, o Bridge entra em fallback que aceita qualquer Bearer não vazio e confia no header de tenant. Produção deve falhar fechada, e o Compose deve validar variáveis obrigatórias.
3. Se a busca de `profiles` falha, o papel cai para `member`, comportamento seguro para privilégio, mas precisa de telemetria/alerta.
4. O tenant default `ens` é adequado ao produto atual single-tenant, porém não substitui um vínculo de identidade explícito.

## Sessão, memória e fontes

| Camada | Conteúdo | Persistência | Uso correto |
|---|---|---|---|
| Supabase chat | mensagens e sessão do app | durável | histórico visível ao usuário |
| `chat_session_hermes_state` | IDs de sessão/conversa/resposta e saúde | durável | reconectar o chat ao Hermes |
| RunStore do Bridge | status, eventos, cursor, erros | volume local | recuperação de transporte |
| Memória nativa Hermes | contexto conversacional do agente | runtime Hermes | continuidade de raciocínio |
| RAG | documentos oficiais e chunks | Supabase do RAG | recuperação factual/citável |
| Graph | relações e memória validada | Neo4j + refs Supabase | raciocínio relacional e reuso |
| Marketing Ops futuro | campanha, item, versão, approval e execução | Supabase operacional | fonte de verdade de negócio |

Apagar uma sessão pelo fluxo atual tenta remover, de forma coordenada, sessão Hermes, estado de vínculo, mensagens e imagens geradas. Falhas parciais precisam permanecer visíveis e retryable; não devem resultar em exclusão silenciosa de estado operacional futuro.

## Anexos e artefatos

### Entrada

- frontend valida tamanho/tipo e envia ao bucket privado;
- Bridge resolve o objeto com credencial server-side;
- imagens podem ser disponibilizadas ao Hermes pelo volume compartilhado de inputs;
- documentos suportados podem receber extração textual;
- hosts e paths aceitos são normalizados para reduzir SSRF/path traversal.

### Saída

- Hermes produz arquivo/path no diretório compartilhado de artefatos;
- Bridge lê o arquivo permitido e envia ao Artifact Server com headers internos de owner, sessão, nome e content type;
- Artifact Server devolve metadata e link de acesso temporário;
- Bridge substitui URLs internas na resposta e emite arquivo/artefato estruturado;
- frontend renova o link expirado pelo endpoint autenticado do Bridge.

O Marketing Ops deve armazenar `artifact_id`, hash, MIME, tamanho e vínculo com a versão, nunca tratar uma URL assinada temporária como identificador durável.

## Aprovação técnica atual

`useApprovalStream` consome SSE do Bridge, que por sua vez conecta ao WebSocket `/api/approvals/ws` do Hermes. `ApprovalModal` responde por `/api/approvals/respond` dentro de uma janela curta.

Esse mecanismo aprova um comando/ferramenta do runtime. Ele não registra versão editorial, aprovador de negócio, justificativa, escopo de canal ou autorização para publicação. Portanto:

- approval técnico continua no Bridge/Hermes;
- aprovação editorial pertence ao Marketing Ops;
- autorização operacional para enviar/publicar é uma decisão separada no Marketing Ops;
- nenhuma das três pode inferir automaticamente as outras.

## RAG e Graph

- `ensure-ens-rag-mcp.py` registra `nexus_rag` em `http://rag-mcp:8000/mcp` e `nexus_graph` em `http://graph-mcp:8010/mcp`.
- RAG atende busca de conhecimento oficial e filtros de cursos/ofertas.
- Graph atende fatos, relações, vizinhança e trabalhos validados.
- salvar/deprecar memória validada exige regras de papel e validação explícita.
- o futuro MCP do Marketing Ops será separado desses dois e oferecerá ferramentas de domínio com scopes e idempotência.

## Falhas e recuperação

| Falha | Comportamento atual/esperado | Melhoria necessária |
|---|---|---|
| Bearer inválido | `401` | manter fail-closed |
| Supabase não configurado | fallback permissivo | bloquear startup/requests em produção |
| Profile indisponível | role `member` + warning | métrica e alerta |
| SSE desconecta | reconectar com cursor/snapshot | testar limites e backoff |
| Bridge reinicia | run ativo vira `interrupted` | expor retry consciente ao usuário |
| Hermes session API indisponível | adapters/fallback existentes | documentar matriz de versão suportada |
| Hermes falha/timeout | evento terminal `failed` | correlation ID ponta a ponta |
| Artifact import falha | preservar referência original quando possível | fila de retry e status de artefato |
| RAG/Graph indisponível | resposta pode degradar/falhar | health e diagnóstico por ferramenta |
| Deleção parcial | best effort | job de reconciliação e audit event |
| Mutação futura duplicada | ainda não aplicável | idempotency key obrigatória no Marketing Ops |

## Contrato para evolução

### Chat Bridge mantém

- autenticação de entrada do chat;
- runs, snapshots, eventos SSE e replay;
- adaptação dos protocolos Hermes;
- preparação de anexos e importação de artefatos;
- approval técnico do runtime.

### Marketing Ops assume

- CRUD e estados de campanhas/itens/versões;
- approvals editoriais;
- autorização operacional;
- RBAC/RLS de negócio;
- auditoria, idempotência, outbox e reconciliação;
- API para frontend e MCP scoped para Hermes;
- coordenação de workers/conectores.

### Hermes mantém

- interpretação de intenção;
- planejamento, geração e recomendação;
- escolha de ferramentas dentro dos scopes recebidos;
- explicação do estado ao usuário;
- nunca executar diretamente um envio externo nem declarar sucesso sem recibo do domínio.
