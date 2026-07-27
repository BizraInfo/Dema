---
id: TASK-024
title: 'bizra.ai films polish: /films redirect, CDN vendoring, landing link'
status: To Do
assignee: []
created_date: '2026-07-19 18:53'
updated_date: '2026-07-19 19:04'
labels: []
dependencies: []
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Residuals spun out of TASK-023 (films are LIVE at bizra.ai/films/index.html; shipped main@88c4852): (1) next.config redirect /films -> /films/index.html; (2) vendor React/Babel/fonts locally or record decision to keep unpkg+Google Fonts (unpkg outage = blank films); (3) link films from the landing page per PRD doc-001 Phase 1; (4) bizra.info middleware redirects to bizra.ai ROOT dropping path — fix deep links if .info marketing matters. Also standing repo flags: 54 dependabot vulns (1 critical), main push bypassed 2 required checks.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PARTIAL SHIP via branch feat/public-funnel-wiring @ cacd761 (award-winner-design): CRITICAL find — production CSP (script-src 'self') was blocking the films' unpkg React/Babel runtime; films HTML served but could not boot. Fixed by CSP allowlist (unpkg.com script-src, fonts.googleapis.com style-src, gstatic dev font-src). Also shipped: /films + /install clean-URL redirects, landing nav Films+Install links, films->install GET DEMA CTA. Commit verified type-clean in detached worktree (pre-commit hook fails only on operator's untracked WIP). STILL OPEN: vendor React/Babel locally to drop unpkg from CSP entirely. Awaiting operator push+merge.
<!-- SECTION:NOTES:END -->
