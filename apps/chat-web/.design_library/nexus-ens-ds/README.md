# Nexus ENS Design System

Design system extracted from the production app `projeto-ens-unificado/apps/chat-web`. Brand: **Nexus ENS** — consultora de marketing e produtos focada em seguros e certificação (ENS).

## What is it?

A reusable collection of:

- **Tokens** — colors (brand, text, surface, semantic, chat status, markdown, attachment), typography, radii, shadows, spacing, motion.
- **Components** — Button, Input, Card, Badge, Stat Tile, Sidebar Nav, Chat Message, Chat Bubble, Chat Composer, Chat Empty State, Chat History Sidebar, Chat Attachment Card, Empty State, Skeleton, Error State, Dialog, Sheet, Tabs, Tooltip, Toast.
- **Previews** — standalone HTML pages for each component (8 in v1.0 + 4 in v1.1 chat kit).
- **UI Kits** — full compositions: dashboard (v1.0) + chat (v1.1).

## How is it organized?

```
.design_library/nexus-ens-ds/
├── SKILL.md                       # system rules & extension guide
├── README.md                      # this file
├── colors_and_type.css            # tokens as CSS custom properties
├── components.css                 # component-level styles (foundations + chat kit)
├── css.json                       # machine-readable tokens
├── tsx/                           # React/TypeScript primitives (v1.2)
├── components/                    # JSON manifests (anatomy, props, states, a11y)
├── assets/icons/                  # line-style SVG icons
├── preview/                       # one HTML per component
└── ui_kits/
    ├── dashboard/                 # v1.0 — dashboard composition
    └── chat/                      # v1.1 — chat composition
```

## Visual identity

| Element | Value |
|---------|-------|
| Primary brand | `#009DB7` (cyan, HSL `189 100% 36%`) |
| Accent | `#34C5DC` (HSL `189 90% 56%`) |
| Deep | `#0F1A2B` (HSL `222 47% 11%`) |
| Type | Outfit (Google Fonts) |
| Corner radius | `1rem` base |
| Signature | Glassmorphism + brand gradient + animated conic-gradient ring |

## How to use it

### In a static HTML prototype

```html
<link rel="stylesheet" href="path/to/colors_and_type.css" />
<link rel="stylesheet" href="path/to/components.css" />

<button class="btn btn--primary">Confirmar</button>
<article class="nexus-card">…</article>
```

### In a React/Vite app

Map tokens into `tailwind.config.ts` and import `components.css`. Each class is a single source of truth — no inline styles, no hex literals.

### In Figma

Import `css.json` into a Figma Variables collection to mirror the token system.

## Previewing locally

Open any of these in a browser:

**Foundations**
- `preview/component-button.html`
- `preview/component-input.html`
- `preview/component-card.html`
- `preview/component-chat-composer.html`

**Chat Kit (v1.1)**
- `preview/component-chat-message.html`
- `preview/component-chat-empty-state.html`
- `preview/component-chat-history-sidebar.html`
- `preview/component-chat-attachment-card.html`

**Feedback + shadcn parity (v1.3)**
- `preview/component-feedback.html` (empty / skeleton / error)
- `preview/component-dialog.html`
- `preview/component-sheet.html`
- `preview/component-tabs.html` (tabs + tooltip + toast)

**Compositions**
- `ui_kits/dashboard/index.html` — dashboard
- `ui_kits/chat/index.html` — chat

## What's NOT in this library

- The original application code (`src/`, `public/`, etc.) — this is a separate, isolated deliverable.
- Any stateful JSX components — components here are CSS-driven, framework-agnostic primitives.

## Versioning

- **v2.1.0** — Themes: `themes/light.css` (canonical), `themes/dark.css` (parity with `src/index.css` `.dark`), `themes/brand-blue.css` (demo fork), `themes/auto.css` (`prefers-color-scheme` bridge). All switched via `data-theme` attribute. Preview at `preview/component-themes.html` with interactive selector. Manifest at `themes/theme.json`. Note: `apps/chat-web` is light-only today — the dark theme is provided as a DS contract for a future rollout, NOT a behavior change.
- **v2.0.0** — Accessibility: 4 reusable hooks (`useReducedMotion`, `useEscapeKey`, `useFocusTrap`, `useScrollLock`) + `Portal` component. Dialog, Sheet, Tooltip and Toaster now render through Portal with focus trap, body scroll lock, ESC dismiss and `prefers-reduced-motion: reduce` support. CSS adds `@media (prefers-reduced-motion)` block that disables infinite animations and shrinks entry/exit transitions to 80ms. All pass `tsc --noEmit`.
- **v1.3.0** — Feedback + shadcn parity: 8 new components (Empty State, Skeleton, Error State, Dialog, Sheet, Tabs, Tooltip, Toast/Toaster) with HTML previews, JSON manifests and React primitives. New tokens: overlay, skeleton surface, z-index scale (base → toast). All pass `tsc --noEmit`.
- **v1.2.0** — React primitives: 10 typed `.tsx` files (button + 9 chat components), barrel `index.ts`, isolated `tsconfig.json`, `tsx/README.md` with usage examples. All pass `tsc --noEmit`.
- **v1.1.0** — Chat Kit: 4 new components (message, empty state, history sidebar, attachment card), 1 new UI Kit (chat), 6 new tokens (status pills, markdown, code, attachment chrome, suggestion, typing pulse), 9 new icons.
- **v1.0.0** — initial extraction from `src/index.css` (HSL palette, type scale, glass + chat visuals, 8 foundation components, dashboard UI Kit).

## Contributing

See `SKILL.md` → "Extending the library" for the four-step process to add new components.
