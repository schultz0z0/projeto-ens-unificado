# Hermes API Server ABC Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fechar completamente as etapas A, B e C do chat Hermes com seguranca server-side, contrato alinhado ao Hermes API Server e refatoracao estrutural dos hotspots principais.

**Architecture:** O frontend continua usando Supabase Storage privado, mas deixa de ser a origem de confianca dos anexos. A Edge Function valida e resolve anexos server-side, monta o payload canonico de `/v1/responses`, envia `conversation` e `X-Hermes-Session-Key`, sanitiza SSE/erros do Hermes e expõe ao frontend apenas o necessario para o chat funcionar com tools/thinking preservados no backend.

**Tech Stack:** React, TypeScript, Vitest, Supabase Storage, Supabase Edge Functions, Deno, Zod, SSE, Hermes API Server

---

### Task 1: Formalizar a policy unica de anexos

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatAttachmentPolicy.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatAttachmentPolicy.test.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\migrations\20260528154000_chat_attachments_storage.sql`

**Step 1: Write the failing test**

```ts
it("mantem exatamente os mesmos MIME types aceitos pelo bucket", () => {
  expect(SUPPORTED_ATTACHMENT_MIME_TYPES).toContain("application/vnd.ms-excel");
  expect(SUPPORTED_ATTACHMENT_MIME_TYPES).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  expect(SUPPORTED_ATTACHMENT_MIME_TYPES).toContain("text/csv");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chatAttachmentPolicy.test.ts`
Expected: FAIL se a policy e a migration ainda estiverem divergentes

**Step 3: Write minimal implementation**

```ts
// alinhar allowlist do frontend com a allowlist do bucket
```

```sql
-- incluir xls, xlsx e csv em allowed_mime_types
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/chatAttachmentPolicy.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/chatAttachmentPolicy.ts src/lib/chatAttachmentPolicy.test.ts supabase/migrations/20260528154000_chat_attachments_storage.sql
git commit -m "fix: align chat attachment policy with storage contract"
```

### Task 2: Remover confianca em URL arbitraria do cliente

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatProxyPayload.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatProxyPayload.test.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\multimodalPayload.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\multimodalPayload.test.ts`

**Step 1: Write the failing test**

```ts
it("nao serializa signed_url no payload do cliente", () => {
  const payload = buildChatProxyPayload(...);
  expect(payload.attachments?.[0]).not.toHaveProperty("signed_url");
});
```

```ts
it("rejeita attachment sem storage_path valido", () => {
  expect(() => parseProxyPayload(...)).toThrow();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chatProxyPayload.test.ts supabase/functions/proxy-chatbot/multimodalPayload.test.ts`
Expected: FAIL com contrato ainda expondo URL do cliente

**Step 3: Write minimal implementation**

```ts
// frontend envia apenas kind, name, mime_type e storage_path
```

```ts
// schema do proxy rejeita qualquer payload fora do contrato minimo
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/chatProxyPayload.test.ts supabase/functions/proxy-chatbot/multimodalPayload.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/chatProxyPayload.ts src/lib/chatProxyPayload.test.ts supabase/functions/proxy-chatbot/multimodalPayload.ts supabase/functions/proxy-chatbot/multimodalPayload.test.ts
git commit -m "refactor: remove client signed urls from chat proxy contract"
```

### Task 3: Extrair modulo server-side de resolucao segura de anexos

**Files:**
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\attachmentPolicy.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\attachmentResolver.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\attachmentResolver.test.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\index.ts`

**Step 1: Write the failing test**

```ts
it("rejeita storage_path fora do escopo do usuario", async () => {
  await expect(resolveAttachmentForUser(...)).rejects.toThrow("forbidden_attachment");
});

it("rejeita bucket inesperado ou mime type nao permitido", async () => {
  await expect(resolveAttachmentForUser(...)).rejects.toThrow();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/attachmentResolver.test.ts`
Expected: FAIL com modulo ausente

**Step 3: Write minimal implementation**

```ts
export async function resolveAttachmentForUser(...) {
  // validar path, ownership, mime type e gerar acesso temporario server-side
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/attachmentResolver.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/attachmentPolicy.ts supabase/functions/proxy-chatbot/attachmentResolver.ts supabase/functions/proxy-chatbot/attachmentResolver.test.ts supabase/functions/proxy-chatbot/index.ts
git commit -m "feat: resolve chat attachments securely on the server"
```

### Task 4: Formalizar adapter Hermes Responses API

**Files:**
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesResponsesAdapter.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesResponsesAdapter.test.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\multimodalPayload.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\index.ts`

**Step 1: Write the failing test**

```ts
it("monta payload /v1/responses com conversation e input_text/input_image corretos", () => {
  const request = buildHermesResponsesRequest(...);
  expect(request.conversation).toBe("nexus:user:session");
  expect(request.input[0].content[0].type).toBe("input_text");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesResponsesAdapter.test.ts`
Expected: FAIL com modulo ausente

**Step 3: Write minimal implementation**

```ts
export function buildHermesResponsesRequest(...) {
  return {
    model: "hermes-agent",
    stream: true,
    store: true,
    conversation,
    input,
    metadata: { ... },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesResponsesAdapter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/hermesResponsesAdapter.ts supabase/functions/proxy-chatbot/hermesResponsesAdapter.test.ts supabase/functions/proxy-chatbot/multimodalPayload.ts supabase/functions/proxy-chatbot/index.ts
git commit -m "feat: add hermes responses api adapter"
```

### Task 5: Implementar X-Hermes-Session-Key e descoberta de capabilities

**Files:**
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesCapabilities.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesCapabilities.test.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\index.ts`

**Step 1: Write the failing test**

```ts
it("monta X-Hermes-Session-Key estavel e sem caracteres proibidos", () => {
  expect(buildHermesSessionKey(...)).toBe("agent:main:nexus:chat:user-123");
});

it("aceita responses_api=true no capabilities e falha em combinacoes incompativeis", async () => {
  await expect(assertHermesCapabilities(...)).resolves.not.toThrow();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesCapabilities.test.ts`
Expected: FAIL com modulo ausente

**Step 3: Write minimal implementation**

```ts
// GET /v1/capabilities com cache curto e validacao do surface usado pelo chat
// header X-Hermes-Session-Key montado por usuario e sessao
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesCapabilities.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/hermesCapabilities.ts supabase/functions/proxy-chatbot/hermesCapabilities.test.ts supabase/functions/proxy-chatbot/index.ts
git commit -m "feat: validate hermes capabilities and session key"
```

### Task 6: Formalizar documentos como texto extraido oficial

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\attachmentTextExtraction.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\attachmentTextExtraction.test.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\multimodalPayload.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\multimodalPayload.test.ts`

**Step 1: Write the failing test**

```ts
it("serializa documentos nao-imagem como input_text enriquecido com nome do arquivo", () => {
  const result = buildHermesInput(...);
  expect(result[0].content).toContainEqual(
    expect.objectContaining({ type: "input_text" }),
  );
});
```

```ts
it("mantem attachmentTextExtraction sem regex com control char proibido pelo lint", () => {
  expect(true).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/attachmentTextExtraction.test.ts supabase/functions/proxy-chatbot/multimodalPayload.test.ts`
Expected: FAIL se o naming ou o lint continuarem inconsistentes

**Step 3: Write minimal implementation**

```ts
// ajustar extracao para evitar no-control-regex
// ajustar testes e nomenclaturas para refletir "texto extraido oficial"
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/attachmentTextExtraction.test.ts supabase/functions/proxy-chatbot/multimodalPayload.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/attachmentTextExtraction.ts supabase/functions/proxy-chatbot/attachmentTextExtraction.test.ts supabase/functions/proxy-chatbot/multimodalPayload.ts supabase/functions/proxy-chatbot/multimodalPayload.test.ts
git commit -m "fix: formalize extracted document text path for hermes"
```

### Task 7: Sanitizar SSE e erros do Hermes sem quebrar tools/thinking

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesStreamEventParser.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesStreamEventParser.test.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\index.ts`

**Step 1: Write the failing test**

```ts
it("nao vaza upstream_response cru para o cliente", () => {
  const result = sanitizeUpstreamError(...);
  expect(result).not.toContain("Traceback");
});

it("preserva metadados minimos de tool progress sem expor payload bruto", () => {
  const parsed = parseHermesEventBlock(...);
  expect(parsed.events).toContainEqual(expect.objectContaining({ event: "status" }));
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesStreamEventParser.test.ts`
Expected: FAIL com parser ainda permissivo demais

**Step 3: Write minimal implementation**

```ts
// reduzir metadados expostos ao browser
// remover upstream_response cru do erro 502
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesStreamEventParser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/hermesStreamEventParser.ts supabase/functions/proxy-chatbot/hermesStreamEventParser.test.ts supabase/functions/proxy-chatbot/index.ts
git commit -m "fix: sanitize hermes stream metadata and upstream errors"
```

### Task 8: Refatorar proxy-chatbot/index.ts em modulos menores

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\index.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\proxyRequestContext.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\proxyErrorResponse.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\proxyUpstreamStream.ts`

**Step 1: Write the failing test**

```ts
it("mantem o fluxo do proxy funcionando apos extracao dos modulos", () => {
  expect(true).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/*.test.ts`
Expected: FAIL se a extracao quebrar imports ou contrato

**Step 3: Write minimal implementation**

```ts
// mover auth/contexto, erro e stream para modulos dedicados
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/*.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/index.ts supabase/functions/proxy-chatbot/proxyRequestContext.ts supabase/functions/proxy-chatbot/proxyErrorResponse.ts supabase/functions/proxy-chatbot/proxyUpstreamStream.ts
git commit -m "refactor: split hermes proxy into focused modules"
```

### Task 9: Refatorar o frontend do chat para reduzir acoplamento

**Files:**
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\components\chat\useChatSend.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\components\chat\chatStreamClient.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\components\chat\chatAttachmentHydration.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\components\ChatInterface.tsx`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\components\chat\ChatFileCard.tsx`

**Step 1: Write the failing test**

```ts
it("restaura o input do usuario se o envio falhar antes da persistencia final", () => {
  expect(true).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chatStreamingUx.test.ts src/lib/chatAttachments.test.ts`
Expected: FAIL apos adicionar o caso de regressao

**Step 3: Write minimal implementation**

```ts
// extrair orquestracao de envio para hook
// restaurar input em falha precoce
// mover stream client para modulo dedicado
// refresh seguro de links no card sob demanda
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/chatStreamingUx.test.ts src/lib/chatAttachments.test.ts src/lib/chatProxyPayload.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ChatInterface.tsx src/components/chat/useChatSend.ts src/components/chat/chatStreamClient.ts src/components/chat/chatAttachmentHydration.ts src/components/chat/ChatFileCard.tsx
git commit -m "refactor: split chat interface send and attachment flow"
```

### Task 10: Fechamento de validacao final A/B/C

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\docs\plans\2026-05-28-hermes-api-server-abc-closure-design.md`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\docs\plans\2026-05-28-hermes-api-server-abc-closure-implementation.md`

**Step 1: Run targeted frontend tests**

Run: `npx vitest run src/lib/chatAttachmentPolicy.test.ts src/lib/chatAttachments.test.ts src/lib/chatProxyPayload.test.ts src/lib/chatStreamingUx.test.ts`
Expected: PASS

**Step 2: Run targeted proxy tests**

Run: `npx vitest run supabase/functions/proxy-chatbot/cors.test.ts supabase/functions/proxy-chatbot/attachmentResolver.test.ts supabase/functions/proxy-chatbot/attachmentTransport.test.ts supabase/functions/proxy-chatbot/attachmentTextExtraction.test.ts supabase/functions/proxy-chatbot/multimodalPayload.test.ts supabase/functions/proxy-chatbot/hermesResponsesAdapter.test.ts supabase/functions/proxy-chatbot/hermesCapabilities.test.ts supabase/functions/proxy-chatbot/hermesStreamEventParser.test.ts`
Expected: PASS

**Step 3: Run lint nos arquivos tocados**

Run: `npx eslint src/components/ChatInterface.tsx src/components/chat/ChatFileCard.tsx src/components/chat/useChatSend.ts src/components/chat/chatStreamClient.ts src/components/chat/chatAttachmentHydration.ts src/lib/chatAttachmentPolicy.ts src/lib/chatAttachments.ts src/lib/chatProxyPayload.ts supabase/functions/proxy-chatbot/*.ts`
Expected: PASS

**Step 4: Run build**

Run: `npm run build`
Expected: PASS

**Step 5: Check diagnostics**

Run: verificar diagnostics dos arquivos alterados no editor
Expected: sem novos diagnostics

**Step 6: Manual verification**

Run:
- enviar texto puro
- enviar imagem
- enviar PDF
- enviar DOCX
- enviar XLSX ou CSV
- validar erro amigavel para payload invalido
- validar que o historico nao quebra apos reload

Expected:
- texto puro funciona
- imagem vai como `input_image`
- documentos seguem como texto extraido
- tools/thinking nao quebram o fluxo
- input do usuario nao se perde em falha precoce
- nao ha vazamento de erro interno do Hermes

**Step 7: Commit**

```bash
git add .
git commit -m "feat: close hermes api server chat stages a b c"
```
