---
id: TASK-041
title: 'DEMO-STORY-1A: the killer demo is a counter dump, not a story'
status: To Do
assignee: []
created_date: '2026-07-28 07:32'
labels:
  - demo
  - ux
  - gtm
dependencies: []
references:
  - apps/cli/src/commands/demo.js
  - packages/dema-ui
priority: high
type: enhancement
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Measured 2026-07-28. `dema demo node0-value-loop` is the surface named "Node0 killer demo value loop". Its entire output is 10 lines:

    schema: bizra.dema.node0_killer_demo_value_loop_cli.v0.1
    truth: NODE0_KILLER_DEMO_VALUE_LOOP_CLI_PREVIEW_ONLY
    demo_stage: PRE_TOKEN_LOCAL_PROOF
    scan_modes: 5
    unstructured_assets: 13
    devices: 4
    ontology_nodes: 13
    mobile_high_value: true

Those are counters with no narrative. A stranger cannot tell what happened, what it means, or why it matters. There is no before/after, no problem being solved, no visible result — nothing that makes someone lean in. As the artifact shown to invited beta testers and to freelance developers being recruited to build on BIZRA, this is the weakest link in the whole beta package: the CLI is honest and the numbers are real, but nobody is persuaded by `ontology_nodes: 13`.

The operator named this directly as the lever: master data visualisation and storytelling and the work becomes visible to many more people. The vehicle already exists and is verified working — `packages/dema-ui` builds and serves (HTTP 200, title "Dema — BIZRA Node0", confirmed 2026-07-28). The counters are the DATA; what is missing is the narration.

Scope note: this is presentation of already-measured local values. It must add NO new claim. Every number stays bound to what the kernel actually computed, keeps its truth label, and the PRE_TOKEN_LOCAL_PROOF / preview-only framing stays visible. A demo that overstates would be worse than a demo that bores.

Design questions for whoever picks this up: what is the single before/after the demo should land; which one number is the hero; and does the story run in dema-ui, in the CLI, or both.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The demo presents a narrative a non-technical stranger can follow: what was the situation, what did Node0 do, what changed
- [ ] #2 Every displayed number remains bound to a value the kernel actually computed, with its truth label intact — no new or inflated claim
- [ ] #3 PRE_TOKEN_LOCAL_PROOF and preview-only framing stay visible in the presented story
- [ ] #4 The story is reachable from the running dema-ui, not only as CLI stdout
<!-- AC:END -->
