# Themes

The Nexus ENS Design System supports multiple themes via a `data-theme` attribute on the root element. Tokens are layered so adding a new theme = adding a new CSS file.

## Available themes

| File | `data-theme` value | Status | Description |
|------|--------------------|--------|-------------|
| `light.css` | `"light"` (default on `:root`) | **Canonical** — used by `apps/chat-web` today | Full token map, official brand. |
| `dark.css` | `"dark"` | Opt-in — production app does not use it yet | Parity with the `.dark` block in `src/index.css`. |
| `brand-blue.css` | `"brand-blue"` | Demo | Shows how to fork the brand color while keeping the rest. |
| `auto.css` | `"auto"` | Bridge for system preference | Mirrors `prefers-color-scheme: dark` rules. |

## How a theme is applied

A theme is just a CSS file that overrides the canonical token set. The cascade order matters:

```html
<html data-theme="light">  <!-- or "dark", "brand-blue", "auto" -->
  <head>
    <!-- 1. base tokens (light, default) -->
    <link rel="stylesheet" href="../colors_and_type.css" />
    <!-- 2. theme overrides -->
    <link rel="stylesheet" href="themes/light.css" />
    <!-- (or themes/dark.css, themes/brand-blue.css, themes/auto.css) -->
    <!-- 3. component styles -->
    <link rel="stylesheet" href="../components.css" />
  </head>
```

The token file already declares all custom properties under `:root` with light defaults. A theme file simply **re-declares the subset it changes** inside `[data-theme="X"]` and the cascade does the rest.

## Switching themes at runtime

```html
<button onclick="document.documentElement.dataset.theme = 'dark'">Dark</button>
<button onclick="document.documentElement.dataset.theme = 'brand-blue'">Brand blue</button>
<button onclick="document.documentElement.dataset.theme = 'light'">Light</button>
```

The CSS variables update synchronously; no React re-render needed.

## Adding a new theme

1. Copy `themes/light.css` as a starting point.
2. Rename the selector to `[data-theme="my-theme"]`.
3. Override only the tokens you want to change — keep the rest.
4. Update `themes/theme.json` and add an entry to `css.json` under `themes`.
5. Add a preview that exercises key components (button, card, dialog).

## Versioning

- **v1.0.0** — Initial theme set: light (canonical), dark (opt-in parity), brand-blue (demo), auto (bridge).
