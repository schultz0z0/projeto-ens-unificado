# Chat Attachments Signed URL Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir o envio de imagens no chatbot criando o bucket privado `chat-attachments`, aplicando RLS e trocando o fluxo de `getPublicUrl()` por signed URLs temporarias.

**Architecture:** O upload continua no cliente autenticado via Supabase JS v2, mas a logica sai de `ChatInterface.tsx` para um servico dedicado. O storage usa bucket privado com policies por pasta de usuario, e cada anexo recebe uma signed URL curta antes de ser enviado ao Hermes.

**Tech Stack:** React, TypeScript, Zod, Supabase JS v2, Supabase Storage, Vitest, SQL migrations

---

### Task 1: Criar a migration de storage do chat

**Files:**
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\supabase\migrations\20260528143000_chat_attachments_storage.sql`

**Step 1: Escrever a migration**

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

**Step 2: Adicionar policies**

```sql
create policy "Users can upload own chat attachments" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

**Step 3: Revisar nomes de policy e idempotencia**

Run: revisao manual do SQL
Expected: migration segura para reaplicacao

**Step 4: Aplicar a migration no ambiente alvo**

Run: `supabase db push`
Expected: bucket e policies criados no projeto remoto

**Step 5: Commit**

```bash
git add supabase/migrations/20260528143000_chat_attachments_storage.sql
git commit -m "feat: add chat attachments storage bucket"
```

### Task 2: Cobrir o servico com teste focado

**Files:**
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatAttachments.test.ts`
- Create: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatAttachments.ts`

**Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";

describe("buildAttachmentPath", () => {
  it("sanitiza o nome do arquivo e preserva o prefixo do usuario", () => {
    expect(true).toBe(false);
  });
});
```

**Step 2: Rodar o teste para confirmar a falha**

Run: `npx vitest run src/lib/chatAttachments.test.ts`
Expected: FAIL

**Step 3: Implementar o servico minimo**

```ts
export function buildAttachmentPath(userId: string, sessionId: string, filename: string) {
  return `${userId}/${sessionId}/${Date.now()}-${filename}`;
}
```

**Step 4: Rodar o teste novamente**

Run: `npx vitest run src/lib/chatAttachments.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/chatAttachments.ts src/lib/chatAttachments.test.ts
git commit -m "test: add chat attachments service coverage"
```

### Task 3: Implementar validacao e signed URL no servico

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\lib\chatAttachments.ts`

**Step 1: Adicionar schema Zod para metadados do anexo**

```ts
const attachmentSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  size: z.number().int().positive().max(10 * 1024 * 1024),
});
```

**Step 2: Implementar upload e signed URL**

```ts
const { error } = await supabase.storage.from(bucket).upload(path, file, {
  cacheControl: "3600",
  upsert: false,
});
```

**Step 3: Mapear erros operacionais**

```ts
if (error?.message.includes("Bucket not found")) {
  throw new Error("Bucket de anexos do chat nao configurado.");
}
```

**Step 4: Rodar o teste e ajustar**

Run: `npx vitest run src/lib/chatAttachments.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/chatAttachments.ts src/lib/chatAttachments.test.ts
git commit -m "feat: use signed urls for chat attachments"
```

### Task 4: Integrar o servico ao chat

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\components\ChatInterface.tsx`

**Step 1: Substituir o upload inline pelo servico**

```ts
const { storedParts, modelMarkdown } = await uploadChatAttachments({
  attachments,
  sessionId: activeSessionId,
  userId: user.id,
});
```

**Step 2: Manter limpeza de previews e estados**

Run: revisao manual do fluxo de `attachments`
Expected: nenhum vazamento de blob URL

**Step 3: Garantir mensagem de erro amigavel**

```ts
toast.error("Nao foi possivel enviar o anexo. Tente novamente.");
```

**Step 4: Rodar lint e teste focado**

Run: `npm run lint`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ChatInterface.tsx
git commit -m "refactor: move chat attachment upload to service"
```

### Task 5: Verificar a integracao

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\Frontend UI\src\components\ChatInterface.tsx`

**Step 1: Build local**

Run: `npm run build`
Expected: PASS

**Step 2: Validar o tipo dos arquivos editados**

Run: verificar diagnosticos do editor
Expected: sem erros novos

**Step 3: Teste manual**

Run: anexar uma imagem e enviar no chat autenticado
Expected: upload concluido, URL assinada gerada e resposta do Hermes sem erro de bucket

**Step 4: Registrar qualquer acao manual pendente**

Run: documentacao no handoff
Expected: lista clara do que executar no Supabase

**Step 5: Commit**

```bash
git add .
git commit -m "fix: restore chatbot image attachments"
```
