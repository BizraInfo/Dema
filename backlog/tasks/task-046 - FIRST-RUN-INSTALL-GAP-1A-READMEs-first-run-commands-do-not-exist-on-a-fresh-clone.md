---
id: TASK-046
title: >-
  FIRST-RUN-INSTALL-GAP-1A: README's first-run commands do not exist on a fresh
  clone
status: To Do
assignee: []
created_date: '2026-07-28 10:56'
labels:
  - ux
  - onboarding
  - docs
  - beta
dependencies: []
references:
  - README.md
  - bin/dema
priority: high
type: bug
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MEASURED 2026-07-28 by an end-to-end new-user walkthrough (landing -> onboarding -> installation) on a genuinely fresh clone.

README.md line 44 opens "## First run — Five commands. Each one is safe and reversible." and lists:

    dema welcome
    dema setup
    dema status
    dema doctor
    dema journey "Fix auth.py and run pytest"

On a fresh clone none of these exist. Verified with PATH reduced to /usr/bin:/bin:

    $ dema welcome
    bash: line 1: dema: command not found

Nothing between the top of README.md and line 44 tells the reader how to obtain the `dema` command. The only `npm install` appears at line 331 under "### Developer install", nearly 300 lines below the section a first-time reader follows, and it is framed for contributors rather than users.

FALSE-PASS WARNING for whoever verifies this: on a machine where dema is already globally linked (as the founder machine is — /home/.../nvm/versions/node/v22.22.2/bin/dema), `dema welcome` succeeds from inside the clone and the gap is invisible. The first attempt at this walkthrough was contaminated exactly this way. Re-test with `env PATH="/usr/bin:/bin" dema welcome` or in a container.

The product itself is fine — this is purely a documentation/packaging gap, and the fix is small. Measured on the same fresh clone with only node on PATH:

    node bin/dema welcome  -> WORKS
    node bin/dema setup    -> WORKS
    node bin/dema onboard  -> WORKS (renders the 7-stage guided path)

So Dema genuinely runs with zero install and zero dependencies, exactly as the zero-dep gate promises. The README simply never says so at the point of first contact. A new user hits `command not found` on step one of five and has no route forward.

This is the highest-severity finding of the walkthrough because it is the FIRST instruction an invited beta tester follows, and it fails before they see anything the product does.

Related landing-surface findings from the same walkthrough, filed here for context but scoped to their own tasks if pursued: the bizra-site hero opens with "BIZRA vΩ.2.0 — APEX KERNEL · OMNI-SYNTHESIS" and a navigation reading Seal / A·Loop / Dual-Agent / B·Forest / BlockTree, none of which tells a stranger what the product does; and the installer section offers a generated node0-bootstrap.sh whose relationship to the README first-run path is undocumented.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 README states how to obtain the dema command BEFORE the first-run command list
- [ ] #2 The zero-install path (node bin/dema ...) is documented at first contact, since it works with no dependencies
- [ ] #3 The five first-run commands succeed verbatim on a fresh clone with dema NOT globally installed, verified with a reduced PATH
- [ ] #4 Developer install stays clearly separated from user first-run
<!-- AC:END -->
