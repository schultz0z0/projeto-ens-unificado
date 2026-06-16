# Chat Signed URL Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persistir a expiracao de signed URLs dos anexos do chat e renovar apenas quando necessario para reduzir `ERR_ABORTED` no console.

**Architecture:** O upload do anexo passa a salvar `signedUrlExpiresAt` junto do `storagePath`. O carregamento do historico usa esse metadado para decidir se a URL ainda pode ser reutilizada ou se precisa ser renovada, evitando trocar `src` de imagem sem necessidade.

**Tech Stack:** React, TypeScript, Supabase Storage, Vitest

---

### Task 1: Cobrir a regra de expiracao com teste

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatAttachments.test.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatAttachments.ts`

**Step 1: Write the failing test**

```ts
it("renova signed url apenas quando a expiracao estiver proxima", () => {
  expect(shouldRefreshSignedUrl("2026-05-28T12:20:00.000Z", { now: 0 })).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chatAttachments.test.ts`
Expected: FAIL with missing function

**Step 3: Write minimal implementation**

```ts
export const shouldRefreshSignedUrl = (...) => { ... };
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/chatAttachments.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/chatAttachments.ts src/lib/chatAttachments.test.ts
git commit -m "test: cover signed url refresh window"
```

### Task 2: Persistir expiracao no payload do anexo

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatMessageParts.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatAttachments.ts`

**Step 1: Write the failing test**

```ts
it("salva signedUrlExpiresAt ao criar anexo enviado", () => {
  expect(true).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chatAttachments.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
type ChatMessageFilePart = {
  ...
  signedUrlExpiresAt?: string;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/chatAttachments.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/chatMessageParts.ts src/lib/chatAttachments.ts
git commit -m "feat: persist chat attachment signed url expiration"
```

### Task 3: Renovar apenas quando necessario

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatAttachments.ts`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\components\ChatInterface.tsx`

**Step 1: Write the failing test**

```ts
it("nao altera a url quando a signed url ainda esta valida", () => {
  expect(true).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chatAttachments.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
if (!shouldRefreshSignedUrl(part.signedUrlExpiresAt)) return part;
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/chatAttachments.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/chatAttachments.ts src/components/ChatInterface.tsx
git commit -m "fix: avoid unnecessary signed url refresh in chat"
```

### Task 4: Verificacao final

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatAttachments.ts`

**Step 1: Run targeted test**

Run: `npx vitest run src/lib/chatAttachments.test.ts`
Expected: PASS

**Step 2: Run build**

Run: `npm run build`
Expected: PASS

**Step 3: Check diagnostics**

Run: verificar diagnostics dos arquivos alterados
Expected: sem erros novos

**Step 4: Manual verification**

Run: abrir um chat com imagem historica e observar se o console deixa de registrar refresh/abort desnecessario
Expected: menos ou nenhum `ERR_ABORTED` durante carregamento normal

**Step 5: Commit**

```bash
git add .
git commit -m "fix: reduce aborted attachment image requests"
```
