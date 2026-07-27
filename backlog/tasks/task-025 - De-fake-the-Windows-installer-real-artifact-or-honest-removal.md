---
id: TASK-025
title: 'De-fake the Windows installer: real artifact or honest removal'
status: To Do
assignee: []
created_date: '2026-07-19 18:55'
labels: []
dependencies: []
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BIZRA-Unified-Windows-Installer/ in award-winner-design is a SIMULATION: installer-builder.js fakes build progress and resolves a fictional BIZRA-Sovereign-OS-Setup.exe (never produced); index.html line 975 claims 'BIZRA will begin earning SEED tokens through Proof-of-Impact' — Claim Register violation (no-mint oath, PoI PREVIEW_ONLY). NOT shipped to the public site for this reason (2026-07-19). Options: (a) build a real installer that packages the actual Dema CLI (clone+run today needs only git+node>=20 — see /install page); (b) rewrite the tool as an honest 'system readiness checker' with no fake artifact; (c) delete it. Interim truthful surface shipped instead: public/install/index.html (branch chore/dema-install-page).
<!-- SECTION:DESCRIPTION:END -->
