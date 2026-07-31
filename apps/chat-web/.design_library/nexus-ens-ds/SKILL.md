# Nexus ENS Design System — SKILL

> Single source of truth for tokens, components and patterns used by Nexus ENS.

## Overview

This Design System formalizes the visual language already shipped in `apps/chat-web`. It is intended for **consumption and reuse** — it does not modify the application. Use it when you build new pages, internal tools, marketing surfaces or any other UI that should feel like Nexus ENS.

| Attribute | Value |
|-----------|-------|
| Name | Nexus ENS Design System |
| Source app | `projeto-ens-unificado/apps/chat-web` |
| Brand color | `#009DB7` (cyan / teal, HSL `189 100% 36%`) |
| Typography | `Outfit` (Google Fonts) + system fallback |
| Visual signature | Glassmorphism, brand-gradient, conic-gradient ring |
| Modes | Light + Dark |
| Output dir | `.design_library/nexus-ens-ds/` |
| Version | `2.0.0` (A11y + Portal + Focus lock) |

## When to use

- Building new screens in the same visual language.
- Documenting the brand for partners and contractors.
- Generating prototypes / Storybook-like previews.
- Aligning downstream design tools (Figma tokens, Style Dictionary exports).

## When NOT to use

- Modifying the production system — this library is read-only and isolated under `.design_library/`.
- Replacing tokens directly in `src/index.css` — change them here first, then port.

## File layout

```
.design_library/nexus-ens-ds/
├── SKILL.md                      ← this file
├── README.md                     ← human-facing docs
├── colors_and_type.css            ← canonical tokens (CSS custom props)
├── components.css                 ← component-level styles (chat bubbles, cards, badges, etc.)
├── css.json                       ← machine-readable token manifest
├── tsx/                           ← React/TypeScript primitives (v1.2)
│   ├── index.ts                   ← barrel
│   ├── tsconfig.json              ← isolated typecheck config
│   ├── README.md
│   ├── lib.ts                     ← cn()
│   ├── button.tsx                 ← shadcn-style Button (self-contained)
│   ├── chat-prose.tsx
│   ├── chat-typing.tsx
│   ├── chat-status.tsx
│   ├── chat-confidence.tsx
│   ├── chat-artifact.tsx
│   ├── chat-attachment-card.tsx
│   ├── chat-message.tsx
│   ├── chat-history-sidebar.tsx
│   └── chat-empty-state.tsx
├── components/
│   ├── index.json
│   ├── button.json
│   ├── input.json
│   ├── card.json
│   ├── badge.json
│   ├── stat-tile.json
│   ├── chat-bubble.json
│   ├── chat-composer.json
│   └── sidebar-nav.json
├── assets/icons/                 ← line-style SVG icons (lucide-shaped)
├── preview/
│   ├── component-button.html
│   ├── component-input.html
│   ├── component-card.html
│   └── component-chat-composer.html
└── ui_kits/
    ├── dashboard/index.html      ← full dashboard composition
    └── chat/index.html           ← full chat composition (sidebar + thread + composer)
```

## Token model

Tokens follow a single naming convention: `--color-*`, `--radius-*`, `--shadow-*`, `--type-*`, `--space-*`, `--ease-*`, `--duration-*`. HSL triples (no `hsl()` wrapper) keep Tailwind/shadcn compatibility.

| Group | Variable | Default | Role |
|-------|----------|---------|------|
| Brand | `--color-nexus-primary` | `189 100% 36%` | Primary actions, focus, key surfaces |
| Brand | `--color-nexus-accent` | `189 90% 56%` | Decorative highlight |
| Surface | `--color-background` | `0 0% 100%` | App background |
| Surface | `--color-card` | `0 0% 100%` | Solid cards |
| Text | `--color-text-primary` | `222 47% 11%` | Primary copy |
| Semantic | `--color-destructive` | `0 84% 60%` | Errors / destructive |
| Semantic | `--color-success` | `142 71% 45%` | Success states |
| Radius | `--radius-lg` | `1rem` | Cards, modals |
| Shadow | `--shadow-md` | `0 8px 24px -4px rgba(11,18,32,0.20)` | Default elevation |
| Shadow | `--shadow-glass` | layered (see file) | Glass surfaces |
| Type | `--type-h1` | `600 32px/1.20 Outfit` | Page title |
| Motion | `--ease-out-soft` | `cubic-bezier(0.22,1,0.36,1)` | Default easing |

## Components

Twenty core components cover the chat + dashboard + feedback surfaces:

**Foundations**
1. **Button** — primary / secondary / tertiary / destructive / ghost; sizes sm/md/lg.
2. **Input** — leading + trailing icons, validation, helper text.
3. **Card** — default / glass / elevated variants.
4. **Badge** — tonal indicators (primary, success, warning, danger, info, neutral).
5. **Stat Tile** — KPI / dashboard tile with delta.
6. **Sidebar Nav** — solid or glass variant with active-item highlight.

**Chat Kit (v1.1)**
7. **Chat Message** — full bubble with header (avatar+author), markdown prose, status pill, artifact card, attachment, typing & streaming states.
8. **Chat Composer** — input with animated conic-gradient ring + brand send button.
9. **Chat Bubble** — base gradient/glass bubbles (foundational; consumed by Chat Message).
10. **Chat Empty State** — hero with mascot, headline, suggestion grid + composer.
11. **Chat History Sidebar** — sessions list with active state, rename/delete on hover, "Novo chat" gradient button.
12. **Chat Attachment Card** — image / video / file variations; adapts chrome for user (translucent over brand gradient) and assistant (solid light).

**Feedback + shadcn parity (v1.3)**
13. **Empty State** — generic zero-data placeholder (icon + title + description + actions).
14. **Skeleton** — shimmer loader, configurable width/height/radius.
15. **Error State** — destructive feedback (retry/support).
16. **Dialog** — controlled modal with overlay, header, body, footer; ESC + click-outside to close.
17. **Sheet** — drawer with 4 sides (right/left/top/bottom).
18. **Tabs** — list + trigger + content with controlled/uncontrolled state.
19. **Tooltip** — pure CSS hover/focus popover, 4 sides.
20. **Toast (Sonner-style)** — single notification unit + Toaster container, 4 tones (default/success/warning/danger), auto-dismiss.

Each component has a corresponding `components/<slug>.json` describing props, tokens used, states and accessibility.

## Themes (v2.1)

The Design System ships with 4 themes under `themes/`:

| File | Selector | Status | Notes |
|------|----------|--------|-------|
| `light.css` | `:root, [data-theme="light"]` | **Canonical** — used by chat-web today | Full token map. |
| `dark.css` | `[data-theme="dark"]` | Opt-in (parity with `src/index.css` `.dark`) | Not consumed by chat-web yet. |
| `brand-blue.css` | `[data-theme="brand-blue"]` | Demo | Royal blue fork. |
| `auto.css` | `[data-theme="auto"]` + `@media (prefers-color-scheme: dark)` | Bridge | Mirrors OS preference. |

A theme is a thin override file — it re-declares only the tokens it changes, and the cascade does the rest. Adding a new theme = adding a new CSS file + one entry in `themes/theme.json`. See `themes/README.md` for the full guide.

## Accessibility (v2.0)

All overlay primitives (`Dialog`, `Sheet`, `Tooltip`, `Toast`/`Toaster`) ship with:

- **Portal** — rendered into `document.body` to escape `overflow: hidden` and `transform` ancestors.
- **Focus trap** — Tab and Shift+Tab cycle inside the overlay. Previous focus is restored on close.
- **Body scroll lock** — `body.overflow: hidden` while open; preserves scrollbar width to avoid layout shift.
- **ESC** — closes (when `dismissible`).
- **Click outside** — overlay click closes (when `dismissible`).
- **`prefers-reduced-motion: reduce`** — disables infinite animations (skeleton shimmer, chat-typing dots, status pulse, conic-gradient ring) and shrinks entry/exit transitions to 80ms. Components expose an `is-reduced` class for consumers.
- **Focus-visible ring** — 2px solid `hsl(var(--color-ring))` on keyboard nav only.

Reusable helpers in `tsx/hooks.ts`:

| Hook | Purpose |
|------|---------|
| `useReducedMotion()` | Reads `prefers-reduced-motion` and tracks changes via `matchMedia`. |
| `useEscapeKey(handler, enabled?)` | Global ESC listener; SSR-safe. |
| `useFocusTrap(active)` | Returns a ref. While `active`, traps Tab inside and restores focus on disable. |
| `useScrollLock(active)` | Locks body scroll while active; preserves scrollbar width. |
| `<Portal>` | SSR-safe wrapper around `createPortal`. |

## Usage pattern

```html
<link rel="stylesheet" href=".design_library/nexus-ens-ds/colors_and_type.css" />
<link rel="stylesheet" href=".design_library/nexus-ens-ds/components.css" />

<button class="btn btn--primary">Confirmar</button>
<article class="nexus-card">…</article>
<aside class="nexus-sidebar">…</aside>
```

In a React/Vite app, import the CSS once in your entry file (or copy tokens into `tailwind.config.ts`).

## Extending the library

1. Add a new component class in `components.css` (use the existing token names).
2. Add a `components/<slug>.json` describing anatomy / props / states / a11y.
3. Add a `preview/component-<slug>.html` demonstrating all states.
4. (v1.2+) Add a `tsx/<slug>.tsx` primitive with CVA variants + forwardRef, re-export from `tsx/index.ts`.
5. Reference it from a UI Kit page if it composes well at screen scale.

## React primitives (v1.2)

The `tsx/` folder ships a typed, shadcn-style mirror of every chat component. The primitives are framework-agnostic (clsx + tailwind-merge + CVA + lucide-react) and are validated by `tsc --project tsx/tsconfig.json`.

Two ways to consume:

```bash
# Option A — copy into the project
cp -r .design_library/nexus-ens-ds/tsx/* src/components/design-system/

# Option B — alias the folder
# tsconfig.json → "paths": { "@ds/*": [".design_library/nexus-ens-ds/tsx/*"] }
```

```tsx
import {
  ChatMessage,
  ChatEmptyState,
  ChatHistorySidebar,
  DEFAULT_SUGGESTIONS,
} from "@ds";
```

## Quality gates

- All colors expressed as HSL triples.
- No hard-coded hex outside the brand `#009DB7` reference (use `hsl(var(--token))`).
- Focus ring uses `--color-ring` (2px solid, 2px offset).
- Components degrade gracefully in dark mode.
- Preview HTML must be self-contained (no JS required).
