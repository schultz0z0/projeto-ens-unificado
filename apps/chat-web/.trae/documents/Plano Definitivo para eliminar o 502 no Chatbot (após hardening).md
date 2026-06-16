# Contexto
- RAG no Supabase do app com `chatbot_rag_documents` (768-dim, Gemini).
- Workflows atualizados e `rawBody` do Webhook está ativado.
- 502 aparece apenas em RAG.

# Hipóteses
1. **Assinatura/HMAC**: Divergência entre o corpo assinado na Edge e o `rawBody` validado no n8n.
2. **Timeout**: Fluxo RAG demorando mais que o limite da Edge (90s) em picos.
3. **Permissão/RPC**: Falta de `GRANT EXECUTE` na função `match_chatbot_rag` ou `SELECT` na tabela para `anon/authenticated`.
4. **Headers/CORS**: Algum cabeçalho essencial ausente ou transformado pelo proxy.

# Investigação (com MCPs e Agentes)
1. **MCP Playwright** (já integrado):
   - Reproduzir a pergunta RAG no app e capturar:
     - Request/Response da `proxy-chatbot`.
     - Headers enviados (`X-Signature`, `Authorization`, `Content-Length`).
     - Latência total.
2. **Agente QA**:
   - Auditar a validação HMAC no n8n (nó “Validação Edge Function”) conferindo se o `content` usado no `createHmac` é exatamente o `rawBody` recebido, sem reordenação de chaves.
3. **Agente Backend**:
   - Verificar via Supabase CLI os `GRANT` de execução na função e de leitura na tabela.
   - Validar se o RPC `match_chatbot_rag` está exposto (PostgREST) e acessível com `anon`.
4. **MCP REST Check**:
   - Fazer uma chamada de teste ao RPC `match_chatbot_rag` com um vetor de 768 via PostgREST e inspecionar o erro/dados (em ambiente controlado), para confirmar acesso e formato.

# Correções (aplicar após evidências)
1. **HMAC**:
   - Se houver divergência de corpo, ajustar a Edge para assinar o `rawBody` exato (serialização determinística) e documentar o formato padronizado (snake_case).
2. **Timeout**:
   - Se latência >90s, elevar o `AbortController` para 120s na Edge (mantendo 120s no front) e retornar `504 upstream_timeout` quando estourar, não `502`.
3. **Permissão** (manual no Supabase):
   - `GRANT EXECUTE ON FUNCTION match_chatbot_rag(vector, float, int) TO anon, authenticated;`
   - `GRANT SELECT ON TABLE chatbot_rag_documents TO anon, authenticated;`
4. **Headers/CORS**:
   - Adicionar `Access-Control-Expose-Headers: *` no Webhook do n8n (opções) e garantir `allowedOrigins: *`.

# Validação Final
- Rodar Playwright após as correções, confirmar `200` com resposta do bot e latência < 30–60s.
- Registrar um relatório com: status, tempo, headers e corpo.

Aprova este plano integrado? Posso iniciar a coleta com MCP Playwright e os agentes QA/Backend para produzir as evidências e aplicar as correções necessárias no app (Edge/Front) enquanto você aplica os GRANTs no Supabase, se indicado.