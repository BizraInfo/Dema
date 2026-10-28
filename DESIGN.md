---
version: alpha
name: BIZRA Public Site
description: Source-bound public-site tokens; generation defaults and evidence limits are identified in the prose.
colors:
  primary: "#C89B3C"
  on-primary: "#14100A"
  background: "#0A0F14"
  surface: "#0D1320"
  on-surface: "#E8E3D9"
  muted: "#7C8797"
typography:
  display:
    fontFamily: KufiLocal, Noto Kufi Arabic, serif
    fontSize: 88px
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: 0.02em
  headline:
    fontFamily: ui-sans-serif, system-ui, sans-serif
    fontSize: 35.2px
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: -0.04em
  body:
    fontFamily: ui-sans-serif, system-ui, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.7
  body-ar:
    fontFamily: AmiriLocal, Noto Naskh Arabic, serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 2.1
  caption:
    fontFamily: ui-sans-serif, system-ui, sans-serif
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.65
  chip-label:
    fontFamily: ui-monospace, SFMono-Regular, Menlo, monospace
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 0.18em
rounded:
  none: 0px
  sm: 2px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.none}"
    padding: "{spacing.lg}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
  caption:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.caption}"
---

# Design System: BIZRA Public Site

Scope: the BIZRA public website, as selected by the human. This specification
extracts the available `packages/bizra-site` source; it does not describe the Dema
operator interface. It is a local design reference, not proof of deployment or
Canvas synchronization. Component source establishes declared styles, not rendered
appearance or live capability.

## Overview

### Purpose and real content

The README is the product-copy owner. BIZRA is the ecosystem; Dema is its local
product face. Reuse these README strings verbatim when describing Dema on the
BIZRA public site:

- Tagline: “A deterministic constitutional execution engine with replayable receipts.”
- Lead: “Your sovereign AI node companion.”
- Description: “Dema helps you run a private AI workspace on your own machine -- with memory, safe actions, receipts, and a clear next step.”
- Principles: “Local-first.” “Consent-bound.” “Receipt-backed.” “No coding required.”
- Relationship: “BIZRA is the ecosystem.” “Dema is the door.”
- Audience: “Dema is for people who want local AI without invisible autonomy.”

These are source-bound product statements, not a fresh runtime attestation.
The design's job follows the README: show what is ready, what is blocked, what
Dema can safely preview, what requires exact consent, and what receipt will prove
the result. Every visible product name, action label, state, example, and error
must have an inspected source. Omit unsupported content; do not fill space with
invented metrics, customers, sample missions, prices, or receipts.

### Critical files and their authority

| Source owner | What the design inherits |
| --- | --- |
| [README.md](README.md) | Product copy, the leading atlas, first-run commands, installation limits, and the separation of live and future capabilities. |
| [BIZRA.md](BIZRA.md) and [LLM_SYSTEM_FLOW.md](docs/LLM_SYSTEM_FLOW.md) | Dema presents state and previews; exact human consent gates upstream effects; governed runtime issues receipts. |
| [Public homepage](packages/bizra-site/src/app/page.tsx) and [HeroIqra](packages/bizra-site/src/components/bizra/hero-iqra.tsx) | Active composition, Arabic mark, actual bilingual copy, local font declarations, and existing action labels. |
| [Habitat components](packages/bizra-site/src/components/bizra/habitat-brand.tsx), [sealed doors](packages/bizra-site/src/components/bizra/sealed-doors.tsx), and [open problems](packages/bizra-site/src/lib/open-problems.json) | `TruthLabel`, `SealedDoor`, inspect/close interaction, evidence fields, and unseal conditions. The JSON is a fixture derived from `CURRENT_LIMITS`, not a runtime feed. |
| [Journey](packages/mission/src/journey.js) and [mission draft](packages/mission/src/mission-draft.js) | Ordered chapters, mission fields, permissions, commitment hashes, and `DRAFT_INTENT` → `CONSENT_NEGOTIATION`; both outputs are `PREVIEW_ONLY`. |
| [Consent planner](packages/consent/src/consent-planner.js) and [consent card](packages/core/src/consent-card-preview.js) | Scope review, allowed/blocked effects, exact-string matching, and `not_minted` receipt preview; the preview card sets its phrase to `null`. |
| [Bounded diagnostic](packages/core/src/mission.js) | Readiness refusal reasons, `EXPLICIT_GO_REQUIRED`, next safe actions, and `executes: false` even when the preview accepts a phrase. |
| [CLI help](packages/core/src/help-topics.js), [receipt commands](apps/cli/src/commands/receipts.js), and [receipt store](packages/receipts/src/receipt-store.js) | Real command vocabulary, bounded local read/list behavior, missing/read/parse failures, and content-integrity-only verification. |
| [Brand tokens](docs/brand/BIZRA_VISUAL_TOKENS.json) and [Claim Register](docs/CLAIM_REGISTER_v0_1.md) | Identity and public-claim constraints. Available component styles supply the observed website variants below. |

Read the owning implementation before showing a value; documentation and fixtures
do not establish current machine state. `dema receipt verify` explicitly proves
content integrity only, with no signature, producer authentication, or runtime
attestation. Do not turn a valid digest into a claim that an action happened.

### Native structure and page goals

The README leads with **The atlas**, whose central distinction is authority:
you type exact consent; Dema shows truth-labeled snapshots and previews; Node0
performs governed effects and issues receipts. SAT-5 / URP is explicitly
`DESIGNED_NOT_LIVE`. Give this boundary the strongest explanatory weight before
telemetry, test totals, architecture breadth, or future economics.

The code's native shape is an ordered, gated journey. Its chapter titles are
“First launch” → “Mission and consent” → “Node0 handoff” → “Receipts and impact”.
The README supplies the human path: Install Dema → create your profile → connect
a local model → see your node health → approve one bounded action → receive your
first proof receipt. Use that progression to organize the Dema story within the
BIZRA page, with consent as its pivot. The journey implementation sets approval,
handoff, execution, receipt minting, and impact claims to false; an illustrated
path must not imply that those steps have occurred.

The page succeeds when a reader can identify the next safe step, its boundary,
and the evidence needed to call it done. Keep the mandatory origin, founder-proof,
inspectability, designed-not-live, and choice material from the
[website production brief](docs/BIZRA_2026_FIRST_LOOK_PRODUCTION_BRIEF_v0_1.md)
within that hierarchy. Do not copy its historical counts without fresh evidence.

### Visual inheritance

The compact frontmatter maps source colors into machine-readable roles. Display
and headline tokens record the minimum of their fluid source scales; the full
clamps remain below. The headline's system-sans fallback, the 12px caption and chip
floor, and the spacing rhythm are proposed generation defaults. They do not claim
that missing global font mappings or the current small labels have been repaired.

The material metaphor is a quiet manuscript in a dark reading room: ink surfaces,
bone-colored text, aged brass accents, and restrained botanical green. Arabic is
the first visual voice. The large **اقرأ** mark means “Read”; supporting content
invites inspection and conscious choice. Keep the experience contemplative,
human-scaled, and precise.

The active homepage imports `HeroIqra`. `HeroSeed` is an available alternative,
not an additional hero to stack beneath it. Prefer full-width editorial sections,
fine structural rules, and generous space over floating cards. Preserve the
seed/chain motif and the named Iqra signature where appropriate. Avoid unrelated
sacred geometry, neon effects, decorative status dots, floating pill badges,
stock AI imagery, and invented live-network or financial dashboards.

## Colors

These are literal values from the public-site components. Retain their roles;
do not collapse the entire page into a single gold or import Dema's bright teal.

| Material token | Exact color | Public-site role |
| --- | --- | --- |
| Reading-room ink | `#0A0F14` | Hero foundation |
| Hero light well | `#111A23` | Radial light at the top of the Iqra hero |
| Site ink | `#0A0E1A` | Page and navigation ground |
| Quiet section | `#090D17` | Signature bar and sealed-doors section |
| Door surface | `#0D1320` | Inspectable capability panel |
| Open record | `#090E18` | Expanded evidence record |
| Footer ink | `#080B14` | Footer foundation |
| Structural rule | `#1C2438` | Page, navigation, and section dividers |
| Door rule | `#242D40` | Capability panel borders |
| Bone | `#E8E3D9` | Hero display and primary prose |
| Page text | `#E8E6DF` | Main page foreground |
| Slate | `#7C8797` | Hero secondary copy |
| Narrative gray | `#9AA4B5` | Supporting section prose |
| Aged gold | `#C89B3C` | Hero CTA, gloss, signature detail |
| Navigation gold | `#C9A84C` | Navigation and planned-state accent |
| Warm hover | `#DCAE49` | Primary hero CTA hover |
| Button ink | `#14100A` | Text on the gold CTA |
| Living green | `#4E7C59` | Botanical accent, ghost hover, focus outline |

The Iqra hero uses a radial gradient `125% 85% at 50% 8%`, from `#111A23`
to `#0A0F14` at 64%. Its text glow is gold at 13% opacity, blurred 60px;
this is atmosphere, not a success signal. Navigation uses the site ink at 88%
opacity with a medium backdrop blur. Keep opacity explicit.

Existing `TruthLabel` variants use square bordered labels with a 10% tint fill:

| Component state | Border/tint color | Text color | Border opacity |
| --- | --- | --- | --- |
| `MEASURED` | `#4E7C59` | `#9FC0A6` | 55% |
| `DESIGNED_NOT_LIVE` | `#5B9BD5` | `#9BC3EA` | 50% |
| `PREVIEW_ONLY` | `#8C78B8` | `#BFAEE4` | 50% |
| `PLANNED` | `#C9A84C` | `#E1C984` | 50% |
| `BLOCKED` | `#A75656` | `#D69A9A` | 55% |

The core brand record separately declares Genesis Gold `#C9A962`, Celestial
Navy `#0A1628`, Origin Black `#050B14`, Pure White `#FFFFFF`, Ivory `#F6F2E9`,
and optional Living Teal `#2CB7A7`. Those remain identity tokens; the table above
records the website's observed material variants. This extraction does not
ratify the differences or change the brand record. The Dema-specific Isnād
document reserves gold for verified proof, while this public site uses gold
for identity and controls; that separate product doctrine is not silently
substituted for the public site's existing roles.

## Typography

The Iqra hero explicitly declares **Noto Kufi Arabic**, weight 700, under the
`KufiLocal` family for the primary Arabic mark, and **Amiri**, weight 400, under
`AmiriLocal` for running Arabic. Their referenced files are
`/fonts/NotoKufiArabic-Bold.ttf` and `/fonts/Amiri-400.woff2`. Latin hero copy uses
`ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`; annotations
use `ui-monospace, SFMono-Regular, Menlo, monospace`.

The brand record names Inter for interface text, Playfair Display for ceremonial
English display, Amiri for Arabic, and JetBrains Mono for proof annotations.
Treat those as brand direction, not evidence that this public-site checkout
loads them. `font-display` and `font-mono` outside the hero cannot be resolved
fully because the site's imported global stylesheet is missing. Keep local font
delivery and readable system fallbacks; never introduce a font-host request.

Observed scales below assume the browser's default 16px root size:

| Role | Family | Size / line height | Weight and tracking |
| --- | --- | --- | --- |
| Iqra h1 | Noto Kufi Arabic | `clamp(5.5rem, 22vw, 15rem)` / 0.95 | 700; `0.02em` |
| Section h2 | Inherited site family, unresolved | `clamp(2.2rem, 6vw, 4.5rem)` / 0.98 | 600; `-0.04em` |
| Door h3 | Inherited site family, unresolved | 16px / 1.45 | 500 |
| Latin hero body | System sans | `clamp(1rem, 2.3vw, 1.22rem)` / 1.7 | Normal |
| Arabic body | Amiri | 16–20.8px / 2–2.1 | 400; natural Arabic spacing |
| Section body | Inherited site family, unresolved | 15px / 1.8 | Normal |
| Hero actions | System mono | 12.8px / normal | Primary 600; `0.04em` |
| Hero gloss | System mono | 11.2px / normal | Uppercase; `0.34em` |
| Truth label | Site mono alias, unresolved | 9px / inherited | 600; `0.18em` |

For new screens, use the compact semantic roles in frontmatter, with no more than
five distinct sizes in one view. Use system sans until the site family is resolved;
Inter remains a declared brand choice rather than a newly selected replacement.
Keep body lines under 80ch, with slightly more leading for serif text. Raise
essential labels to at least 12px and body copy to at least 16px. These are
generation/accessibility rules, not claims about the current 9–11px labels.
Use tabular numerals for comparable quantities. Preserve
real Arabic text, `lang="ar"`, RTL direction, and accessible labels for named
marks; decorative duplicates stay hidden from assistive technology. Existing
Arabic copy remains `DECLARED_NEEDS_NATIVE_REVIEW` in the source.

## Layout

- Open with the existing `HeroIqra` identity and sourced product promise, then
  explain the atlas and gated journey. Inspection, scope review, the consent
  boundary, and the resulting evidence determine the reading order. Future
  capabilities stay beside their limitations; measurements support the story
  beside their sources instead of becoming the opening dashboard.
- Use the source's real vocabulary: `dema welcome`, `dema setup`, `dema status`,
  `dema doctor`, `dema journey`, `dema consent plan`, `dema mission draft`, and
  `dema receipts`. Preserve `ready` / `blocked`, `PREVIEW_ONLY`, and
  `EXPLICIT_GO_REQUIRED` where their owning data supplies them. Never fabricate
  a command result or display a consent phrase as a reusable authorization.
- Use 1280px as the proposed Stitch desktop reference viewport. The extracted site
  content width is 1080px, shared by navigation, signature bar, sections, and footer.
- The main page gutter is 16px, increasing to 24px at `sm`. Hero padding is
  72px top, 20px horizontally, and 64px bottom; its minimum height is `100svh`.
  Hero content has a 32px gap, with Latin prose capped at 42ch and Arabic at 40–46ch.
- Use a proposed 4px base / 8px major spacing rhythm for new screens. Preserve
  source exceptions: scholar grid gap `0.9rem`, CTA gap `0.7rem`, and 20px gutters.
  Do not claim these source values are already a uniform token scale.
- Scholar lineage is one column below 720px and four columns from 720px. Sealed
  doors become two columns at `md`; their heading/description split is
  `1fr 1.25fr` at `lg`. Preserve the explicit 720px hero breakpoint. Other `sm`,
  `md`, and `lg` numeric values are unresolved without the missing site config;
  do not present guessed breakpoints as extracted tokens.
- Sealed-door section spacing is 80px vertically, rising to 112px at `sm`.
  Door grids have a 16px gap and a 48px lead-in. The hero lineage is capped at
  62rem. Keep long hashes and evidence paths wrapping inside their column.
- Preserve bilingual reading order and use logical alignment for RTL. At narrow
  widths, stack content and actions without hiding truth labels or evidence.

## Components

- **Navigation:** sticky at the top, a 2px reading-progress strip, a thin bottom
  divider, and a 1080px centered content budget. Section links scroll horizontally
  when needed. Active links use `#1A2238` with `#E8C878` text; inactive text is
  `#7C8597`, moving to `#CDD3DF` on hover. Keep named navigation and button labels.
- **Primary and secondary actions:** 2px corner radius, mono labels, padding
  `0.72rem 1.35rem`. Primary fill is aged gold with button-ink text; secondary
  actions have a `1px #26313D` border. Hover transitions take 180ms. Hero focus
  uses a 2px living-green outline with 3px offset. Proposed for new touch layouts:
  provide at least a 44px interaction target without enlarging every visual label.
- **Truth labels:** reuse `TruthLabel` with its explicit text and semantic colors.
  Existing padding is 8px horizontally and 4px vertically. Never infer truth from
  color alone or upgrade a state for visual balance.
- **Sealed doors:** reuse `SealedDoor`, with square corners, a 1px door-rule border,
  20px padding rising to 24px, and at least 220px visual height. The inner inset
  line and center seam describe a seal; do not add more nested decorative cards.
  Activation expands the evidence and unseal condition and updates `aria-expanded`.
  It inspects a record; it does not activate a capability. Preserve keyboard access.
- **Action provenance:** the hero labels are “Install your node · ثبّت عقدتك”
  (`#installer`) and “See what it cannot do” (`#measured`). Their target sections
  are imported from missing files in this checkout, and the README calls the
  public installer endpoint planned. Keep them as source references; show a
  working action only after its destination is inspected and verified. No public
  input primitive is supplied; omit invented forms. Inspection and navigation
  never constitute consequential consent.

## Do's and Don'ts

Atmosphere keywords: dark manuscript, ink and bone, aged brass, quiet botanical
green, Arabic-first editorial hierarchy, inspectable evidence, restrained ceremony.

Keep all-caps styling inside evidence chips on new screens. Use sentence case for
other labels; avoid extra eyebrow labels, isolated accent-colored headline words,
nested cards, purple gradients, and hover or state changes that shift layout.
These are generation guardrails, not claims of current component conformance.

### Generation prompts

Attach or bind this design system first. New-screen prompts describe content,
layout, interactions, and structure only; do not repeat colors, fonts, radii, or
other theme instructions. Make one or two changes per edit; precise color values
are appropriate in targeted edits. The primary rule is documented in
[Google's Stitch generation skill](https://github.com/google-labs-code/stitch-skills/blob/0337446dadde6f8c94210444e2aa9d546126480f/plugins/stitch-design/skills/generate-design/SKILL.md).

Use these prompts as structural instructions, not as current capability claims:

- “Create a BIZRA public page using the existing اقرأ mark and README product
  copy. Explain the atlas, then organize the Dema story as First launch, Mission
  and consent, Node0 handoff, and Receipts and impact. Make the consent boundary
  the pivot. Keep previews explicit, bind evidence to claims, include the required
  public-story material, and omit actions whose destinations are unverified.”
- “Create a sealed-capability section with two inspectable panels per desktop row.
  Each panel names its truth state and expands to show its evidence and the exact
  condition for opening the door. Expansion inspects a record and activates nothing.”
- “Create a narrow-screen variation that stacks panels, retains truth labels,
  exposes keyboard focus, and keeps every action's meaning explicit.”

After token edits, run `npm exec --yes --ignore-scripts --package=@google/design.md@0.4.0 -- designmd lint DESIGN.md`
and inspect errors, warnings, and the number of tokens checked; exit 0 alone does
not establish contrast coverage. Before claiming visual completion, render and
inspect at 390px and 1280px for clipping, overflow, focus, missing content, and
layout shifts. If sources or rendering are unavailable, retain `NOT_RUN` and name
the missing prerequisite.

Public claims follow `docs/CLAIM_REGISTER_v0_1.md`, including its public claim
taxonomy; the five existing component variants above do not replace that taxonomy.
Label simulations `SCENARIO` with their assumptions and planned architecture
`DESIGNED_NOT_LIVE`. Do not copy source assertions of live status, performance,
economic value, or certification as freshly verified facts. Include the source and
limits for quantitative claims. Never invent metrics, receipts, testimonials, or
active networks to fill a layout.

Require WCAG AA contrast (4.5:1 body, 3:1 large text), keyboard operation, and
visible focus. Existing colors and small labels have not been certified by this
extraction. The hero entrance is finite and disables animation for reduced motion;
extend reduced-motion support to navigation and new transitions. Do not introduce
idle looping animation or required external assets.

Source binding: `packages/bizra-site/src/app/page.tsx`, `src/app/layout.tsx`, and
`src/components/bizra/{hero-iqra,hero-seed,habitat-brand,top-nav,sealed-doors}.tsx`
under that package; `docs/brand/BIZRA_VISUAL_TOKENS.json`;
`docs/BIZRA_ROOT_SOURCE_OF_TRUTH_v0_1.md`; and
`docs/BIZRA_2026_FIRST_LOOK_PRODUCTION_BRIEF_v0_1.md`.

Extraction limit: this checkout does not contain the public site's package
manifest, imported `src/app/globals.css`, referenced public font files, or several
imported homepage sections. Their rendered fonts, breakpoints, behavior, and
deployed appearance remain unverified. This document establishes a source-backed
visual reference with named generation assumptions; it does not repair or rebuild
those missing sources.
