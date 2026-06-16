# Hermes Stage D Context Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fechar a Etapa D com continuidade robusta de contexto, mapeamento entre chat do app e sessao Hermes, e auto-recuperacao de cadeia quando o Hermes falhar em follow-ups.

**Architecture:** O chat continua usando `/v1/responses` como motor principal, mas passa a persistir estado operacional do Hermes por sessao do app. A Edge Function incorpora a `Sessions API` do Hermes como camada de apoio estrutural, registra `last_good_response_id`, detecta cadeia degradada e aplica auto-recovery sem quebrar a UX nem substituir a memoria interna do Hermes.

**Tech Stack:** React, TypeScript, Vitest, Supabase, Supabase Edge Functions, Deno, Hermes API Server, Sessions API, SSE

---

### Task 1: Persistir estado operacional do Hermes por chat do app

**Files:**
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\migrations\20260529_chat_session_hermes_state.sql`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesConversationState.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesConversationState.test.ts`

**Step 1: Write the failing test**

```ts
it("cria estado Hermes vazio para uma nova sessao de chat", async () => {
  const state = await upsertHermesConversationState(...);
  expect(state.chain_health).toBe("healthy");
  expect(state.last_good_response_id).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesConversationState.test.ts`
Expected: FAIL com modulo ausente

**Step 3: Write minimal implementation**

```ts
export async function upsertHermesConversationState(...) {
  // cria ou atualiza o vinculo entre chat_session do app e estado Hermes
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesConversationState.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260529_chat_session_hermes_state.sql supabase/functions/proxy-chatbot/hermesConversationState.ts supabase/functions/proxy-chatbot/hermesConversationState.test.ts
git commit -m "feat: persist hermes conversation state per chat session"
```

### Task 2: Criar cliente Sessions API do Hermes

**Files:**
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesSessionsClient.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesSessionsClient.test.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesCapabilities.ts`

**Step 1: Write the failing test**

```ts
it("cria uma sessao Hermes quando nao existe session_id mapeado", async () => {
  const session = await createHermesSession(...);
  expect(session.id).toBe("sess_123");
});

it("valida supporte de session_* em capabilities antes de usar a Sessions API", async () => {
  await expect(assertHermesSessionCapabilities(...)).resolves.not.toThrow();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesSessionsClient.test.ts`
Expected: FAIL com cliente ausente

**Step 3: Write minimal implementation**

```ts
export async function createHermesSession(...) {
  // POST /api/sessions
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesSessionsClient.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/hermesSessionsClient.ts supabase/functions/proxy-chatbot/hermesSessionsClient.test.ts supabase/functions/proxy-chatbot/hermesCapabilities.ts
git commit -m "feat: add hermes sessions api support"
```

### Task 3: Rastrear response_id e last_good_response_id

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesStreamEventParser.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesStreamEventParser.test.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesConversationState.ts`

**Step 1: Write the failing test**

```ts
it("captura response_id final e permite promover last_good_response_id em resposta valida", () => {
  const parsed = parseHermesEventBlock(...);
  expect(parsed.events).toContainEqual(
    expect.objectContaining({ event: "meta" }),
  );
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesStreamEventParser.test.ts supabase/functions/proxy-chatbot/hermesConversationState.test.ts`
Expected: FAIL sem persistencia do response_id bom

**Step 3: Write minimal implementation**

```ts
// promover last_good_response_id quando a cadeia fecha de forma saudavel
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesStreamEventParser.test.ts supabase/functions/proxy-chatbot/hermesConversationState.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/hermesStreamEventParser.ts supabase/functions/proxy-chatbot/hermesStreamEventParser.test.ts supabase/functions/proxy-chatbot/hermesConversationState.ts
git commit -m "feat: track last good hermes response ids"
```

### Task 4: Formalizar recovery strategy para cadeia degradada

**Files:**
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesRecoveryStrategy.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesRecoveryStrategy.test.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\index.ts`

**Step 1: Write the failing test**

```ts
it("quando recebe erro NoneType tenta reancorar no last_good_response_id", async () => {
  const plan = buildHermesRecoveryPlan(...);
  expect(plan.strategy).toBe("retry_with_last_good_response");
});

it("quando nao houver ancora boa gira a conversation mantendo a sessao Hermes", async () => {
  const plan = buildHermesRecoveryPlan(...);
  expect(plan.strategy).toBe("rotate_conversation");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesRecoveryStrategy.test.ts`
Expected: FAIL com estrategia ausente

**Step 3: Write minimal implementation**

```ts
export function buildHermesRecoveryPlan(...) {
  // decide entre retry com last_good_response_id, rotacao de conversation ou nova sessao Hermes
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesRecoveryStrategy.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/hermesRecoveryStrategy.ts supabase/functions/proxy-chatbot/hermesRecoveryStrategy.test.ts supabase/functions/proxy-chatbot/index.ts
git commit -m "feat: add hermes context auto-recovery strategy"
```

### Task 5: Integrar Sessions API ao fluxo principal do proxy

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\index.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\proxyHermesSessionBinding.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\proxyHermesSessionBinding.test.ts`

**Step 1: Write the failing test**

```ts
it("garante uma sessao Hermes vinculada antes de enviar o turno ao /v1/responses", async () => {
  const binding = await ensureHermesSessionBinding(...);
  expect(binding.hermes_session_id).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/proxyHermesSessionBinding.test.ts`
Expected: FAIL sem binding

**Step 3: Write minimal implementation**

```ts
// garantir binding app chat -> Hermes session antes do turno
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/proxyHermesSessionBinding.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/index.ts supabase/functions/proxy-chatbot/proxyHermesSessionBinding.ts supabase/functions/proxy-chatbot/proxyHermesSessionBinding.test.ts
git commit -m "feat: bind app chat sessions to hermes sessions"
```

### Task 6: Expor status minimo de recuperacao para a UI

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesStreamEventParser.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\components\chat\chatStreamClient.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\components\ChatInterface.tsx`

**Step 1: Write the failing test**

```ts
it("emite status amigavel quando o backend entra em recovery", () => {
  const parsed = parseHermesEventBlock(...);
  expect(parsed.events).toContainEqual(
    expect.objectContaining({ event: "status" }),
  );
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesStreamEventParser.test.ts`
Expected: FAIL sem status de recovery

**Step 3: Write minimal implementation**

```ts
// emitir status de recuperacao sem expor detalhes internos
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesStreamEventParser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/hermesStreamEventParser.ts src/components/chat/chatStreamClient.ts src/components/ChatInterface.tsx
git commit -m "feat: expose minimal recovery status to chat ui"
```

### Task 7: Encerrar sessao Hermes quando o chat do app for excluido

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\components\ChatInterface.tsx`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatService.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesSessionsClient.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesConversationState.ts`

**Step 1: Write the failing test**

```ts
it("marca a sessao Hermes como encerrada quando o chat do app e removido", async () => {
  await deleteChatSession(...);
  expect(await getHermesConversationState(...)).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesConversationState.test.ts`
Expected: FAIL sem cleanup

**Step 3: Write minimal implementation**

```ts
// cleanup local e tentativa de encerramento remoto da sessao Hermes
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesConversationState.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ChatInterface.tsx src/lib/chatService.ts supabase/functions/proxy-chatbot/hermesSessionsClient.ts supabase/functions/proxy-chatbot/hermesConversationState.ts
git commit -m "feat: cleanup hermes session state on chat deletion"
```

### Task 8: Provar o caminho feliz e o caminho degradado

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesRecoveryStrategy.test.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\functions\proxy-chatbot\hermesResponsesAdapter.test.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\components\chat\chatStreamClient.ts`

**Step 1: Write the failing test**

```ts
it("mantem follow-up indireto usando last_good_response_id e conversation saudavel", async () => {
  expect(await runScenario(...)).toMatchObject({ recovered: false, success: true });
});

it("recupera quando a cadeia anterior devolve NoneType", async () => {
  expect(await runScenario(...)).toMatchObject({ recovered: true, success: true });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesRecoveryStrategy.test.ts supabase/functions/proxy-chatbot/hermesResponsesAdapter.test.ts`
Expected: FAIL antes da integracao completa

**Step 3: Write minimal implementation**

```ts
// consolidar o fluxo final de request/retry/reancoragem
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesRecoveryStrategy.test.ts supabase/functions/proxy-chatbot/hermesResponsesAdapter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/proxy-chatbot/hermesRecoveryStrategy.test.ts supabase/functions/proxy-chatbot/hermesResponsesAdapter.test.ts src/components/chat/chatStreamClient.ts
git commit -m "test: cover healthy and degraded context chains"
```

### Task 9: Validacao final da Etapa D

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\docs\plans\2026-05-29-hermes-stage-d-context-recovery-design.md`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\docs\plans\2026-05-29-hermes-stage-d-context-recovery-implementation.md`

**Step 1: Run targeted proxy tests**

Run: `npx vitest run supabase/functions/proxy-chatbot/hermesConversationState.test.ts supabase/functions/proxy-chatbot/hermesSessionsClient.test.ts supabase/functions/proxy-chatbot/hermesRecoveryStrategy.test.ts supabase/functions/proxy-chatbot/proxyHermesSessionBinding.test.ts supabase/functions/proxy-chatbot/hermesResponsesAdapter.test.ts supabase/functions/proxy-chatbot/hermesStreamEventParser.test.ts`
Expected: PASS

**Step 2: Run full critical chat tests**

Run: `npx vitest run src/lib/chatProxyPayload.test.ts src/lib/chatAttachments.test.ts src/lib/chatStreamingUx.test.ts src/components/chat/chatStreamFileSafety.test.ts`
Expected: PASS

**Step 3: Run lint**

Run: `npx eslint src/components/ChatInterface.tsx src/components/chat/chatStreamClient.ts src/lib/chatService.ts supabase/functions/proxy-chatbot/*.ts`
Expected: PASS

**Step 4: Run build**

Run: `npm run build`
Expected: PASS

**Step 5: Manual verification**

Run:
- abrir novo chat e enviar texto base
- fazer follow-up simples
- fazer follow-up indireto que force lembranca
- validar comportamento apos erro estruturado do Hermes
- excluir chat e validar cleanup de sessao

Expected:
- caminho feliz continua bom
- follow-up indireto nao quebra
- recovery automatico entra quando necessario
- frontend nao fica mudo
- tools e anexos nao regressam

**Step 6: Commit**

```bash
git add .
git commit -m "feat: close hermes stage d context recovery"
```
