---
name: design-taste-frontend
description: |
  Anti-slop frontend skill for landing pages, portfolios, and redesigns. The agent reads the brief, infers the right design direction, and ships interfaces that do not look templated. Real design systems when applicable, audit-first on redesigns, strict pre-flight check.
triggers:
  - "design taste"
  - "anti slop frontend"
  - "premium landing page"
  - "portfolio redesign"
  - "visual taste"
od:
  mode: prototype
  surface: web
  platform: desktop
  scenario: marketing
  category: creative-direction
  upstream: "https://github.com/Leonxlnx/taste-skill"
  preview:
    type: html
  design_system:
    requires: true
  craft:
    requires:
      - typography
      - color
      - anti-ai-slop
      - animation-discipline
  example_prompt: |
    Create a premium landing page that follows design-taste-frontend: infer the design read, set the dials, avoid AI-slop patterns, and output a polished responsive HTML artifact.
---


# tasteskill: Anti-Slop Frontend Skill

> Landing pages, portfolios, and redesigns. Not dashboards, not data tables, not multi-step product UI.
> Every rule below is **contextual**. None of it fires automatically. First read the brief, then pull only what fits.

---

## 0. BRIEF INFERENCE (Read the Room Before Anything Else)

Before touching code or tweaking dials, **infer what the user actually wants**. Most LLM design output is bad because the model jumps to a default aesthetic instead of reading the room.

### 0.A Read these signals first
1. **Page kind** - landing (SaaS / consumer / agency / event), portfolio (dev / designer / creative studio), redesign (preserve vs overhaul), editorial / blog.
2. **Vibe words** the user used - "minimalist", "calm", "Linear-style", "Awwwards", "brutalist", "premium consumer", "Apple-y", "playful", "serious B2B", "editorial", "agency-y", "glassy", "dark tech".
3. **Reference signals** - URLs they linked, screenshots they pasted, products they named, brands they're competing with.
4. **Audience** - B2B procurement panel vs. design-conscious consumer vs. recruiter scanning a portfolio. The audience picks the aesthetic, not your taste.
5. **Brand assets that already exist** - logo, color, type, photography. For redesigns, these are starting material, not optional input (see Section 11).
6. **Quiet constraints** - accessibility-first audiences, public-sector, regulated industries, trust-first commerce, kids' products. These constraints OVERRIDE aesthetic preference.

### 0.B Output a one-line "Design Read" before generating
Before any code, state in one line: **"Reading this as: \<page kind> for \<audience>, with a \<vibe> language, leaning toward \<design system or aesthetic family>."**

Example reads:
- *"Reading this as: B2B SaaS landing for technical buyers, with a Linear-style minimalist language, leaning toward Tailwind utilities + Geist + restrained motion."*
- *"Reading this as: solo designer portfolio for hiring managers, with an editorial / kinetic-type language, leaning toward native CSS + scroll-driven animation + custom typography."*
- *"Reading this as: redesign of a public-sector service site, with a trust-first language, leaning toward GOV.UK Frontend or USWDS."*

### 0.C If the brief is ambiguous, ask one question, do not guess
Ask exactly **one** clarifying question - never a multi-question dump - and only when the design read genuinely diverges. Example: *"Should this feel closer to Linear-clean or Awwwards-experimental?"*

If you can confidently infer from context, **do not ask**. Just declare the design read and proceed.

### 0.D Anti-Default Discipline
Do not default to: AI-purple gradients, centered hero over dark mesh, three equal feature cards, generic glassmorphism on everything, infinite-loop micro-animations everywhere, Inter + slate-900. These are the LLM defaults. Reach past them deliberately based on the design read.

---

## 1. THE THREE DIALS (Core Configuration)

After the design read, set three dials. Every layout, motion, and density decision below is gated by these.

* **`DESIGN_VARIANCE: 8`** - 1 = Perfect Symmetry, 10 = Artsy Chaos
* **`MOTION_INTENSITY: 6`** - 1 = Static, 10 = Cinematic / Physics
* **`VISUAL_DENSITY: 4`** - 1 = Art Gallery / Airy, 10 = Cockpit / Packed Data

**Baseline:** `8 / 6 / 4`. Use these unless the design read overrides them. Do not ask the user to edit this file - overrides happen conversationally.

### 1.A Dial Inference (design read → dial values)
| Signal | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| "minimalist / clean / calm / editorial / Linear-style" | 5-6 | 3-4 | 2-3 |
| "premium consumer / Apple-y / luxury / brand" | 7-8 | 5-7 | 3-4 |
| "playful / wild / Dribbble / Awwwards / experimental / agency" | 9-10 | 8-10 | 3-4 |
| "landing page / portfolio / marketing site (default)" | 7-9 | 6-8 | 3-5 |
| "trust-first / public-sector / regulated / accessibility-critical" | 3-4 | 2-3 | 4-5 |
| "redesign - preserve" | match existing | +1 | match existing |
| "redesign - overhaul" | +2 | +2 | match existing |

### 1.B Use-Case Presets
| Use case | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| Landing (SaaS, mainstream) | 7 | 6 | 4 |
| Landing (Agency / creative) | 9 | 8 | 3 |
| Landing (Premium consumer) | 7 | 6 | 3 |
| Portfolio (Designer / studio) | 8 | 7 | 3 |
| Portfolio (Developer) | 6 | 5 | 4 |
| Editorial / Blog | 6 | 4 | 3 |
| Public-sector service | 3 | 2 | 5 |
| Redesign - preserve | match | match+1 | match |
| Redesign - overhaul | +2 | +2 | match |

### 1.C How the Dials Drive Output
Use these (or user-overridden values) as global variables. Cross-references throughout this document refer to these exact variable names - never invent aliases like `LAYOUT_VARIANCE` or `ANIM_LEVEL`.

---


## 2. Detailed references (lazy-loaded)

The following sections live in references/ and should be loaded only when the brief calls for them. Hermes will not inject them into the system prompt by default.

- references/02-brief-to-design-map.md — when to reach for a real design system vs custom aesthetic
- references/03-default-architecture.md — stack, state, icons, emoji policy, layout mechanics
- references/04-design-engineering-directives.md — typography, color, layout, materiality, density (LOAD WHEN doing design work)
- references/05-context-aware-proactivity.md — sticky-stack, horizontal-pan, scroll-reveal skeletons, forbidden animations
- references/06-performance-accessibility.md — hardware acceleration, reduced-motion, contrast
- references/07-output-contract.md — dial definitions (technical reference, LOOKUP not memorise)
- references/08-dark-mode-protocol.md — light/dark mode consistency rules
- references/09-ai-tells-forbidden.md — list of AI-generated tropes to avoid (CRITICAL: load before any frontend work)
- references/10-reference-vocabulary.md — pattern names the agent should know
- references/11-redesign-protocol.md — audit-first redesign workflow
- references/12-block-library.md — contract for reusable block implementations
- references/13-out-of-scope.md — explicit non-goals
- references/14-pre-flight-check.md — final checklist before delivery


## Nexus PRD overrides (LOAD references/NEXUS-OVERRIDES.md FIRST)

When this skill is used for **Soluções Nexus AI** work, the agent MUST load
`references/NEXUS-OVERRIDES.md` BEFORE applying any taste-skill default.
That file contains 7 categories of overrides derived from the Nexus PRD:

1. **Color** — replace purple-blue gradients with cyber teal + neon coral
2. **Typography** — remove Inter (forbidden 2026-06-27), use Space Grotesk + JetBrains Mono
3. **Motion** — replace Tailwind default easing with Nexus 4-tier (200/300/500/600ms)
4. **3D effects** — apply budget 🔥🔥🔥/🔥🔥/🔥/❄° per PRD §5.4
5. **Layout** — use Nexus spacing scale + section-y (96/68/48)
6. **AI-tells** — extend upstream §9 with Nexus-specific rejections
7. **Brand voice** — operator language, no hype words

If upstream taste-skill rule conflicts with NEXUS-OVERRIDES.md: **PRD wins**.

## Source

Adapted from open-design taste-skill (https://github.com/nexu-io/open-design, Apache 2.0).
Original skill: 87.9KB monolithic SKILL.md. Split here into ~6KB SKILL.md + 13 references/ files (~80KB) to keep Hermes system prompt lean.
Full backup of original: SKILL.md.full-backup in this directory.
