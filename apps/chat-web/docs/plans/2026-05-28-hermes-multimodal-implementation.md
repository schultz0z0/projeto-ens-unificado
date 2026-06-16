# Hermes Multimodal Chat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir o envio textual de URLs/markdown por payload multimodal estruturado para o Hermes, com suporte inicial a imagem e PDF e fallback textual efemero para PDF.

**Architecture:** O frontend continua armazenando anexos no Supabase Storage, mas para de concatenar markdown no texto do modelo. O `proxy-chatbot` passa a receber `message_text` e `attachments[]`, converte para o formato multimodal nativo do Hermes/OpenAI-compatible e executa fallback efemero para PDF quando o provider nao aceitar o caminho nativo.

**Tech Stack:** React, TypeScript, Zod, Supabase Storage, Supabase Edge Functions, SSE, Vitest

---

### Task 1: Definir os tipos e o builder de payload de anexos no frontend

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatAttachments.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatProxyPayload.ts`
- Test: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatProxyPayload.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildChatProxyPayload } from "./chatProxyPayload";

describe("buildChatProxyPayload", () => {
  it("serializa imagem e pdf em attachments estruturados sem markdown", () => {
    const result = buildChatProxyPayload({
      sessionId: "session-1",
      messageText: "analise",
      attachments: [
        {
          kind: "image",
          name: "img.png",
          mimeType: "image/png",
          storagePath: "user/session/img.png",
          url: "https://signed-url/image",
        },
      ],
    });

    expect(result).toEqual({
      session_id: "session-1",
      message_text: "analise",
      attachments: [
        {
          kind: "image",
          name: "img.png",
          mime_type: "image/png",
          storage_path: "user/session/img.png",
          signed_url: "https://signed-url/image",
        },
      ],
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chatProxyPayload.test.ts`
Expected: FAIL with module/function missing

**Step 3: Write minimal implementation**

```ts
export function buildChatProxyPayload(...) {
  return { ... };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/chatProxyPayload.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/chatAttachments.ts src/lib/chatProxyPayload.ts src/lib/chatProxyPayload.test.ts
git commit -m "feat: add structured chat proxy payload builder"
```

### Task 2: Refatorar o ChatInterface para usar o payload estruturado

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\components\ChatInterface.tsx`

**Step 1: Write the failing test**

```ts
// adicionar ou adaptar um teste focado no builder/comportamento auxiliar,
// cobrindo que anexos nao viram markdown para o modelo
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chatProxyPayload.test.ts`
Expected: FAIL if markdown ainda estiver no caminho do modelo

**Step 3: Write minimal implementation**

```ts
const proxyPayload = buildChatProxyPayload({
  sessionId: activeSessionId,
  messageText: currentInput.trim(),
  attachments: storedParts,
});

await sendMessageToChatbotStream(proxyPayload, activeSessionId, ...);
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/chatProxyPayload.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ChatInterface.tsx
git commit -m "refactor: send structured multimodal payload to proxy"
```

### Task 3: Criar o schema Zod e o builder multimodal na Edge Function

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\index.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\multimodalPayload.ts`
- Test: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\multimodalPayload.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildHermesInput } from "./multimodalPayload";

describe("buildHermesInput", () => {
  it("monta input_text + input_image para anexos de imagem", () => {
    const result = buildHermesInput({
      messageText: "analise",
      attachments: [
        {
          kind: "image",
          name: "img.png",
          mime_type: "image/png",
          storage_path: "u/s/img.png",
          signed_url: "https://signed-url/image",
        },
      ],
    });

    expect(result).toMatchObject({
      type: "message",
      role: "user",
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/multimodalPayload.test.ts`
Expected: FAIL with missing module/function

**Step 3: Write minimal implementation**

```ts
export function buildHermesInput(...) {
  return [{ type: "message", role: "user", content: [...] }];
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/multimodalPayload.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/index.ts supabase/functions/proxy-chatbot/multimodalPayload.ts supabase/functions/proxy-chatbot/multimodalPayload.test.ts
git commit -m "feat: add multimodal payload builder for hermes"
```

### Task 4: Implementar fallback efemero para PDF no proxy

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\index.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\multimodalPayload.ts`
- Test: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\multimodalPayload.test.ts`

**Step 1: Write the failing test**

```ts
it("cai para texto efemero quando pdf nao puder ser enviado de forma nativa", async () => {
  expect(true).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/multimodalPayload.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// baixar PDF com signed_url, extrair texto em memoria, anexar bloco textual ao input
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/multimodalPayload.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/index.ts supabase/functions/proxy-chatbot/multimodalPayload.ts supabase/functions/proxy-chatbot/multimodalPayload.test.ts
git commit -m "feat: add ephemeral pdf fallback for hermes"
```

### Task 5: Regressao do parser e contrato do proxy

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesStreamEventParser.test.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\index.ts`

**Step 1: Write the failing test**

```ts
it("nao envia markdown textual de anexo para o provider", () => {
  expect(true).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesStreamEventParser.test.ts supabase/functions/proxy-chatbot/multimodalPayload.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// ajustar contrato do proxy para aceitar payload estruturado e proteger o caminho textual antigo
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesStreamEventParser.test.ts supabase/functions/proxy-chatbot/multimodalPayload.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/index.ts supabase/functions/proxy-chatbot/hermesStreamEventParser.test.ts
git commit -m "fix: remove markdown attachment path from hermes input"
```

### Task 6: Verificacao final

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\components\ChatInterface.tsx`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\index.ts`

**Step 1: Run targeted tests**

Run: `npx vitest run src/lib/chatProxyPayload.test.ts supabase/functions/proxy-chatbot/multimodalPayload.test.ts supabase/functions/proxy-chatbot/hermesStreamEventParser.test.ts`
Expected: PASS

**Step 2: Run build to verify frontend integrity**

Run: `npm run build`
Expected: PASS

**Step 3: Run diagnostics on touched files**

Run: verificar diagnostics do editor para arquivos alterados
Expected: sem erros novos

**Step 4: Manual verification**

Run: testar texto puro, imagem e PDF no chat autenticado
Expected: texto continua funcionando; imagem e PDF nao vao mais como URL textual; PDF usa fallback amigavel se preciso

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add hermes multimodal chat attachments"
```
