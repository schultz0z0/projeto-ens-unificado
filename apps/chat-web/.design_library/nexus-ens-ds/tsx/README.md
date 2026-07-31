# Nexus ENS Design System — Chat Kit (v1.2, React primitives)

React/TypeScript primitives that mirror the visual chat kit defined in
`components/chat-*.html` and the source app (`src/components/Chat*.tsx`).

## Install (inside `apps/chat-web`)

The primitives are framework-agnostic — they rely on:

- `clsx`, `tailwind-merge` → already in `package.json`.
- `class-variance-authority` → already in `package.json`.
- `lucide-react` → already in `package.json`.
- The DS stylesheet (`../colors_and_type.css` + `../components.css`).

Two ways to consume them:

### Option A — Copy the files

```bash
cp -r .design_library/nexus-ens-ds/tsx/* src/components/design-system/
```

Then import from `@/components/design-system`:

```tsx
import { ChatMessage, ChatHistorySidebar, ChatEmptyState, DEFAULT_SUGGESTIONS } from "@/components/design-system";
```

### Option B — Reference from outside

`tsconfig.json` already accepts `@/` aliases. Add a second alias:

```json
"paths": { "@ds/*": [".design_library/nexus-ens-ds/tsx/*"] }
```

```tsx
import { ChatMessage } from "@ds/chat-message";
```

## Components

| Component | Slug | Mirrors source |
|-----------|------|----------------|
| `ChatMessage` | `chat-message` | `ChatInterface.tsx` (bubble shell) + `ChatMessageContent.tsx` (body) |
| `ChatProse` | `chat-message` (sub) | `chat-prose` markdown surface |
| `ChatTyping` | `chat-message` (sub) | 3-dot bounce |
| `ChatStatus` | `chat-message` (sub) | `chat-status` pill |
| `ChatConfidence` | `chat-message` (sub) | `chat-confidence` badge |
| `ChatArtifact` | `chat-message` (sub) | artifact card (markdown/html/code/text) |
| `ChatAttachmentCard` | `chat-attachment-card` | `ChatFileCard.tsx` |
| `ChatHistorySidebar` | `chat-history-sidebar` | `ChatHistorySidebar.tsx` |
| `ChatEmptyState` | `chat-empty-state` | `ChatEmptyState.tsx` |

## Quick start

```tsx
import { ChatMessage, ChatEmptyState, DEFAULT_SUGGESTIONS, ChatHistorySidebar, ChatStatus } from "@/components/design-system";

// 1. Empty state
<ChatEmptyState
  suggestions={DEFAULT_SUGGESTIONS}
  onSelectSuggestion={(s) => console.log(s.prompt)}
  composer={<MyChatComposer />}
/>

// 2. Message
<ChatMessage role="user" timestamp="14:03">
  Quero lançar o curso <strong>Riscos Emergentes 2026</strong>…
</ChatMessage>

<ChatMessage role="assistant" timestamp="14:04" status="Hermes está processando…">
  Vamos montar uma jornada <strong>H2H</strong> com 3 e-mails…
</ChatMessage>

<ChatMessage role="assistant" isTyping />

<ChatMessage
  role="assistant"
  artifact={{
    title: "briefing-riscos-emergentes.md",
    artifactType: "markdown",
    content: "# LP Riscos Emergentes 2026",
  }}
>
  Aqui está o briefing.
</ChatMessage>

// 3. History sidebar
<ChatHistorySidebar
  sessions={sessions}
  currentSessionId={current}
  onSelectSession={setCurrent}
  onNewChat={createSession}
  onRename={openRenameDialog}
  onDelete={openDeleteDialog}
/>
```

## Required global CSS

Make sure both stylesheets are loaded in the app entry (`main.tsx` or `App.tsx`):

```ts
import "@/../.design_library/nexus-ens-ds/colors_and_type.css";
import "@/../.design_library/nexus-ens-ds/components.css";
```

(Adjust the relative path to wherever the DS lives in your project.)

## Extending

1. Add a new class in `components.css` using existing token names.
2. Create `tsx/<name>.tsx` following the same forwardRef + CVA pattern.
3. Re-export it from `tsx/index.ts`.

## Versioning

- **v1.2.0** — first React primitives release. Mirrors v1.1 chat components.
