---
nexus_overrides: true
last_updated: 2026-06-27
source: Soluções Nexus AI PRD §2.1, §2.2, §5.3, §5.4
---

# Nexus PRD Overrides — taste-skill adaptation

When this skill is used for Soluções Nexus AI work, the following overrides
apply to the upstream taste-skill defaults. The agent MUST check this file
before generating any frontend artifact.

## 1. Color overrides (PRD §2.1)

| Upstream default (anti-slop) | Nexus canonical | Action |
|------------------------------|-----------------|--------|
| Purple-blue gradient (e.g. `#6366F1 → #8B5CF6`) | Primary: `#4F46E5` → `#00D2FF` (indigo → cyber teal) | REPLACE |
| `#8B5CF6` accent (Tailwind purple-500) | `#00D2FF` (cyber teal) | REPLACE |
| `#3B82F6` accent (Tailwind blue-500) | `#00D2FF` (cyber teal) | REPLACE |
| `#FFFFFF` pure white (clinical feel) | `#F8F7FF` (spectral white) | REPLACE |
| `#000000` pure black (clinical feel) | `#0A0A1A` (Obsidian) | REPLACE |
| Soft pastels in dashboard | `#39FF88` success, `#FFF34D` warning, `#FF4D8D` danger | REPLACE |
| Generic gradient `linear-gradient(135deg, #6366F1, #8B5CF6)` | `linear-gradient(135deg, #4F46E5, #00D2FF)` | REPLACE |

## 2. Typography overrides (PRD §2.2)

| Upstream default | Nexus canonical | Action |
|------------------|-----------------|--------|
| Inter (display) | Space Grotesk 400-700 | REPLACE |
| Inter (body) | Space Grotesk 400-700 | REPLACE |
| system-ui (display fallback) | "Inter" forbidden — use "Space Grotesk" only | REMOVE |
| Source Code Pro / Fira Code (mono) | JetBrains Mono 400-500 | REPLACE |
| Roboto / SF Pro (body fallback) | Space Grotesk | REPLACE |
| Default 1.5 line-height (body) | 1.52 (--leading-body) | ALMOST MATCH — use 1.52 |
| Default 1.2 line-height (display) | 1.06 (--leading-tight) | TIGHTER |
| Default 0 letter-spacing | -0.025em display (--tracking-display) | TIGHTER |
| Positive tracking on uppercase | Mixed case per Nexus | DO NOT replicate |

**Critical:** `Inter` was REMOVED from Nexus design system by user decision
on 2026-06-27. Any upstream suggestion to use Inter MUST be ignored.

## 3. Motion overrides (PRD §5.3)

| Upstream default | Nexus canonical | Action |
|------------------|-----------------|--------|
| Tailwind default `cubic-bezier(0.4, 0, 0.2, 1)` | 4 explicit easings: 200/300/500/600ms | REPLACE |
| GSAP defaults `power1/2/3/4` | Map to Nexus 4-tier system | MAP |
| Spring physics | Use 500ms medium for entrance | RESTRICT |
| Bounce/elastic overshoots | Forbidden on production UI | FORBIDDEN |
| Animation duration unlimited | Budget by context: micro 200, small 300, medium 500, large 600 | ENFORCE |

## 4. 3D effects budget (PRD §5.4)

Each 3D effect carries a budget indicator:
- 🔥🔥🔥 (full): hero, above-fold, single use per page
- 🔥🔥 (medium): section breaks, max 2-3 per page
- 🔥 (warm): secondary, max 4-5 per page
- ❄ (cold): disabled by default, opt-in only

Upstream taste-skill applies effects freely. Nexus restricts per budget.

## 5. Layout overrides (PRD §2.2, inferred)

| Upstream | Nexus | Action |
|----------|-------|--------|
| Generous whitespace (Linear-style) | Section-y: desktop 96, tablet 68, phone 48 | SPECIFIC |
| 8px spacing scale (default) | Scale: 4, 8, 12, 16, 20, 24, 32, 48, 64, 96, 128 | EXTENDED |
| Border radius 8-16px default | Use sparingly — prefer sharp edges on dark | RESTRICT |
| Card-heavy layouts | Text-on-image or text-on-surface, minimal containers | MIRROR SPACEX |

## 6. AI-tells to actively flag (upstream §9 + Nexus-specific)

- ❌ Purple-blue gradient as primary accent
- ❌ Inter font
- ❌ `cubic-bezier(0.4, 0, 0.2, 1)` default easing
- ❌ Generic 3-card feature row with identical icons
- ❌ "Tailwind purple" hover states
- ❌ system-ui fallback as final stack
- ❌ Empty marketing adjectives ("revolutionary", "cutting-edge")
- ❌ Decorative blobs that serve no product purpose
- ❌ Stock photo placeholders (label as "sample" or use generated)

## 7. Brand voice (Nexus-specific)

Soluções Nexus AI serves multi-client RAG/MCP workflows. Copy should:
- Use **operator** language, not consumer-marketing language
- Emphasize **isolation, control, sovereignty** (multi-tenant)
- Reference **Claude/Codex/Hermes** when appropriate (audience knows)
- Avoid hype words ("AGI", "revolutionary", "magical")
- Be specific: "RAG index isolated per client" > "intelligent document retrieval"

## How to apply these overrides

When taste-skill is invoked for Nexus work:
1. Read this file FIRST (before upstream §0-14)
2. Apply upstream rules that DO NOT conflict with this file
3. REJECT upstream suggestions that violate any override above
4. If conflict: PRD wins (this file is PRD-derived)
5. Report any upstream rule that conflicts to the user (transparency)
