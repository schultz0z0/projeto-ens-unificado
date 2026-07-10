# PRD — Fase 4: Hermes Campaign Operator

- **Status:** draft
- **Dependências:** Fases 1–3 concluídas
- **Resultado:** Hermes consulta e opera campanhas reais com confirmação e auditoria

## Resumo

Esta fase conecta o Hermes ao Marketing Ops por MCP. O agente passa a transformar conversa em objetos reais, sem acessar o banco diretamente e sem executar ações sensíveis.

## Problema

Hoje uma resposta útil pode permanecer apenas no chat. Para o Hermes ser copiloto operacional, ele precisa consultar o estado atual e criar rascunhos, itens e conteúdos que aparecem imediatamente nas telas.

## Objetivos

- permitir consultas naturais sobre campanhas e agenda;
- criar campanhas e itens em rascunho;
- converter conteúdo do chat em asset versionado;
- sugerir calendário e checklist;
- exigir confirmação para mutações;
- propagar ator confiável;
- correlacionar conversa, run, ferramenta e auditoria.

## Não objetivos

- aprovar em nome de humano;
- disparar mensagens;
- alterar pacote aprovado;
- conceder permissões;
- executar SQL ou chamar Supabase diretamente;
- substituir telas por conversa.

## Casos de uso

- “Liste minhas campanhas ativas.”
- “Abra o resumo da campanha X.”
- “Crie um rascunho para o curso Y.”
- “Transforme este briefing em itens de calendário.”
- “Salve esta copy na campanha como rascunho.”
- “Reagende o item, depois de eu confirmar.”
- “Quais campanhas estão sem responsável ou próximo passo?”

## Ferramentas MCP iniciais

### Leituras

- `marketing_ops_capabilities`;
- `campaign_list`;
- `campaign_get`;
- `campaign_item_list`;
- `campaign_timeline_get`;
- `content_get`;
- `user_permissions_get` quando seguro.

### Escritas controladas

- `campaign_create_draft`;
- `campaign_update`;
- `campaign_item_create`;
- `campaign_item_reschedule`;
- `content_create_draft`;
- `content_version_create`;
- `artifact_link`;
- `campaign_note_add`.

Nomes finais serão versionados no design técnico. Ferramentas devem ser pequenas, tipadas e orientadas ao domínio.

## Requisitos funcionais

### F4-RF-01 — Consulta fundamentada

O Hermes deve consultar o Marketing Ops antes de afirmar estado atual de campanha, item, responsável, versão ou agenda.

### F4-RF-02 — Uso do RAG

Fatos de curso e institucionais são consultados no RAG. O resultado operacional é persistido no Marketing Ops com referência mínima.

### F4-RF-03 — Uso do Graph

Graph é usado para relações e trabalhos validados; não substitui a consulta transacional.

### F4-RF-04 — Preview

Antes de mutação relevante, o Hermes apresenta resumo dos campos e impacto.

### F4-RF-05 — Confirmação

Mutação exige confirmação explícita capturada na conversa e autorização limitada à operação.

### F4-RF-06 — Delegação

Marketing Ops valida contexto assinado, expiração, escopo, ator, tenant, run e anti-replay.

### F4-RF-07 — Deep link

Após sucesso, o Hermes devolve identificação e link para abrir o objeto.

### F4-RF-08 — Idempotência

Retry da mesma ferramenta não duplica campanha, item, nota ou versão.

### F4-RF-09 — Conflito

Quando versão está obsoleta, o Hermes informa que o objeto mudou, consulta o estado atual e pede nova decisão.

### F4-RF-10 — Operação parcial

Criações em lote retornam sucesso/falha por item e não ocultam resultado parcial. Transações atômicas são usadas quando a consistência exigir.

### F4-RF-11 — Auditoria

Registrar ator humano, origem `hermes`, chat session, bridge run, tool call, correlação e mudanças.

### F4-RF-12 — Limites

O Hermes não chama ferramentas de aprovação técnica para simular autorização editorial e não contorna papéis.

## Experiência

O frontend deve apresentar feedback quando um objeto for criado/alterado e permitir abrir o deep link. A resposta do Hermes deve diferenciar proposta, confirmação pendente, sucesso, conflito e falha.

## Segurança

- ferramentas não aceitam papel autodeclarado;
- delegação curta e escopada;
- parâmetros com allowlist;
- conteúdo e URLs tratados como dados não confiáveis;
- rate limit por ator e ferramenta;
- logs sem texto integral quando desnecessário;
- mutações administrativas fora do escopo;
- prompt injection não concede autoridade adicional.

## Observabilidade

- chamadas por ferramenta;
- sucesso, falha e negação;
- tempo até confirmação;
- idempotency hit;
- conflito de versão;
- objetos criados via Hermes;
- correlação chat → run → tool → audit;
- erros por contrato/capacidade.

## Critérios de aceite

- [ ] Hermes lista somente campanhas autorizadas.
- [ ] Estado operacional sempre vem do Marketing Ops.
- [ ] Hermes cria rascunho após confirmação.
- [ ] Objeto criado aparece no frontend sem reconciliação manual.
- [ ] Retry não duplica objeto.
- [ ] Tenant/papel forjados são rejeitados.
- [ ] Delegação expirada ou reutilizada falha.
- [ ] Conflito exige nova consulta/decisão.
- [ ] Conteúdo do chat vira versão vinculada.
- [ ] Deep link abre o objeto correto.
- [ ] Auditoria conecta ator, chat, run e ferramenta.
- [ ] Hermes não aprova nem executa ação sensível.
- [ ] Indisponibilidade do Marketing Ops é comunicada sem falso sucesso.

## Testes

Contratos de schema MCP; autorização e delegação; golden flows de leitura e escrita; idempotência; conflito; prompt injection; indisponibilidade; E2E frontend → bridge → Hermes → MCP → Supabase → frontend.

## Gate local

Runtime Hermes com MCP configurado, ferramentas descobertas, jornadas E2E, correlação, falhas, segurança e reinício.

## Gate VPS

Config MCP persistente, rede interna, secrets, delegação, health, smoke com usuários de teste, logs correlacionados e rollback da configuração.

## Riscos

| Risco | Mitigação |
|---|---|
| Modelo chama ferramenta errada | Descrições claras, schemas pequenos, testes de cenário |
| Ator forjável | Delegação assinada e verificação server-side |
| Duplicidade em retry | Idempotência obrigatória |
| Estado alucinado | Consulta transacional antes de afirmar |
| Core Hermes inchado | MCP na borda, sem nova core tool |
| Confirmação ambígua | Resumo estruturado e autorização escopada |

## Gate de saída

A Fase 5 inicia quando o Hermes opera rascunhos e itens com segurança, sem acesso direto ao banco, e a trilha ponta a ponta está validada localmente e na VPS.
