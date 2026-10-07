---
id: TASK-045
title: 'ARABIC-UX-PROMISE-GAP-1A: Dema offers Arabic and has none to give'
status: To Do
assignee: []
created_date: '2026-07-28 10:46'
labels:
  - ux
  - i18n
  - arabic
  - beta
dependencies: []
references:
  - packages/core/src/language-pack.js
  - packages/core/src/onboarding-lifecycle.js
  - packages/core/src/canon-glossary.js
  - docs/BIZRA_INVESTOR_ONE_PAGER_AR_EN_2026_07_28.md
priority: high
type: bug
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MEASURED 2026-07-28 on a clean DEMA_HOME. Arabic coverage across the operator surface:

    dema welcome     0 Arabic lines
    dema status      0 Arabic lines
    dema doctor      0 Arabic lines
    dema onboard     1 Arabic line  (only the word العربية inside the picker)
    canon glossary   15 of 29 entries carry Arabic
    bizra-site       2 files contain any Arabic

So `dema onboard` opens by asking "What language should I speak with you?" and offers العربية — and every surface after that answer is English. The picker advertises a language the product cannot speak. Same defect class as the doctor dead-end, the onboard alias and the sovereign bare-path error closed today: a surface promising more than it delivers, and the most costly one yet because it breaks the promise at the FIRST question a nontechnical Arabic-speaking operator is asked.

What already exists and is honest: packages/core/src/language-pack.js (LANGUAGE-PACK-1A) is a pure kernel that resolves display label + script direction, correctly marks ar/ur as rtl, and explicitly disclaims translation in what_this_does_not_prove ("Any translation or language model was invoked", "The display label was natively reviewed for cultural fluency"). The kernel is not overclaiming — nothing consumes it for output, and no string layer exists.

Business urgency, operator-stated 2026-07-28: all upcoming meetings are in Arabic and investor packages are required in both languages. A bilingual investor one-pager now exists at docs/BIZRA_INVESTOR_ONE_PAGER_AR_EN_2026_07_28.md (claim-gate clean, 0 flags) but it is a document, not the product surface.

Scope discipline — do NOT machine-translate the whole CLI. Highest-leverage first contact only, in order: (1) dema welcome banner + the allowed/blocked list, (2) the 7 onboard stage titles and prompts, (3) doctor predicate names and the BLOCKED-gate fix text. Those three are what a stranger reads before deciding whether this product is for them.

Native review is a hard gate: any Arabic that ships must be labeled DECLARED_NEEDS_NATIVE_REVIEW until the operator (native speaker) verifies it, matching the existing convention in canon-glossary.js. Machine-authored MSA presented as fluent is the same failure as an unverified capability claim.

RTL correctness must be verified in a real terminal and in the browser for bizra-site — the language-pack already returns script_direction, but nothing consumes it, and mixed AR/EN lines with backticked Latin identifiers are where RTL rendering actually breaks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 dema welcome renders fully in Arabic when the profile language is ar, including the allowed/blocked list
- [ ] #2 All 7 onboard stage titles and prompts render in Arabic under an ar profile
- [ ] #3 doctor predicate labels and the BLOCKED-gate fix text render in Arabic under an ar profile
- [ ] #4 Every shipped Arabic string is labeled DECLARED_NEEDS_NATIVE_REVIEW until the operator verifies it
- [ ] #5 script_direction from language-pack.js is actually consumed by at least one rendering surface, not just resolved
- [ ] #6 RTL rendering verified in a real terminal and in bizra-site, specifically on lines mixing Arabic with Latin/backticked identifiers
<!-- AC:END -->
