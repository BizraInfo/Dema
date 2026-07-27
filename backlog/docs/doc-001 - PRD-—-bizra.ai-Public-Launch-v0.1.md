---
id: doc-001
title: PRD — bizra.ai Public Launch v0.1
type: specification
created_date: '2026-07-19 18:15'
tags:
  - gtm
  - bizra.ai
  - launch
  - task-023
---
# PRD — bizra.ai Public Launch v0.1

**Status:** DRAFT · **Owner:** Operator (Mumu) · **Executing task:** TASK-023 · **Date:** 2026-07-19
**Truth label:** `DECLARED` — this spec binds public wording to `docs/CLAIM_REGISTER_v0_1.md` and `docs/CURRENT_LIMITS.md`. No claim below may ship unlabeled.

## 1. Problem

bizra.ai is live but empty: title + one "Clear local data" control (verified by live fetch 2026-07-19). bizra.info 302-redirects to it. Anyone hearing about BIZRA — investor, lighthouse candidate, peer builder — lands on a page that proves nothing and explains nothing. Meanwhile three finished onboarding films and a body of MEASURED proof kernels sit unpublished. The wedge ("trustable action") is eroding competitively; an empty landing page erodes it faster.

## 2. Goals

1. A visitor understands *what BIZRA is* (sovereign mission OS) and *what is actually proven today* within 60 seconds.
2. The three onboarding films (The Third Fact, Mission Thesis, Federation Atlas) are publicly watchable at a stable URL.
3. Every sentence on the site passes the Claim Register: vision is labeled vision, MEASURED is labeled measured, nothing reads as live that is not.
4. One deploy covers both domains (bizra.info already redirects).

## 3. Non-goals

- No signup, waitlist backend, auth, or analytics beyond a privacy-respecting counter (defer).
- No token, URP, federation, or PoI *live* claims — these are `PREVIEW_ONLY`/`DESIGNED_NOT_LIVE` per CURRENT_LIMITS and may appear only as labeled roadmap.
- No dema.ai (domain not owned). No redesign of the Dema CLI docs.
- No CMS. Static only.

## 4. Users

| Persona | Job on the site |
|---|---|
| Lighthouse candidate (Ring 1–2, evidence-first GTM) | Judge whether the founder's claims are honest before engaging |
| Investor / partner | Grasp category ("mission-centric computing") + see proof density |
| Peer builder | Find the public repos and the receipt/proof vocabulary |

## 5. Solution (phased)

**Phase 0 — Films live (this week).** Copy `artifacts/design-imports/bizra-node0-onboarding/` (10 files, verified serving 9/9 + gallery index) into the production site repo (`award-winner-design`) under `/films`. Landing page links it. Ship.

**Phase 1 — Honest landing (next).** Landing sections, each bound to a claim label:
- Hero: category one-liner + film CTA (`DECLARED` vision wording from the films).
- "What is proven today": receipts, reversible execute gate, Ed25519-signed receipt chains, exact-string consent — the `[MEASURED]` rows of CURRENT_LIMITS, in plain language, each linking to its receipt doc in the public repo.
- "What is not live yet": federation, token economy, PoI rewards — labeled `PREVIEW_ONLY`, framed as the roadmap, not the product.
- Footer: bizra.ai · bizra.info · GitHub.

**Phase 2 — Proof surface (later).** Auto-published proof index (receipt hashes, gate outcomes) generated from the repo — the site becomes the public face of the receipt spine. Out of scope for this PRD beyond naming it.

## 6. Success metrics

- T+7 days: films URL live on both domains, HTTP 200, all film assets load (automatable curl check).
- Zero Claim Register violations: `npm run eval:layer1`-style forbidden-phrase scan over site copy passes before each deploy (manual until the linter slice exists — Register §2 notes enforcement is a future slice).
- Landing bounce path exists: every page reachable within 2 clicks from hero.
- Qualitative gate (Daughter Test): the founder would show this page to family without caveats.

## 7. Acceptance criteria (supersets TASK-023's four)

1. Films render in a real browser from the production URL (pixel check — sandbox could not prove this locally).
2. CDN decision recorded: vendor React/Babel/fonts locally OR accept unpkg+Google Fonts with a note in the site README (unpkg outage = blank films; recommendation: vendor, it is 3 files).
3. Site copy reviewed against CLAIM_REGISTER_v0_1 §labels by the operator; review noted in TASK-023.
4. bizra.info redirect re-verified post-deploy.
5. Landing page replaces the bare "Clear local data" state; that control remains reachable (it is a real privacy affordance — keep it, style it).

## 8. Risks

| Risk | Mitigation |
|---|---|
| Overclaim drift on a public surface | This PRD's label binding + operator review gate (AC-3); the Register exists precisely for this |
| unpkg/fonts outage blanks the films | Vendor the 3 runtime files (AC-2) |
| Two-account Vercel confusion deploys to wrong project | Deploy only from `award-winner-design` main; the session-visible team BIZRA (5 v0-* projects) is NOT the production target |
| Films' in-browser Babel compile is slow on mobile | Accept for v0.1; Phase 1 may pre-compile. `ponytail:` known ceiling — precompile when mobile matters |

## 9. Dependencies & the gate

- **Hard gate:** production deploy = operator GO + credentials on the production Vercel account. Dema holds no credentials by design. Nothing in this PRD authorizes autonomous deploy.
- Bundle source of truth: Claude Design project `c109afff-2411-46e9-80bc-30b7ca495560`; local copy in `artifacts/design-imports/bizra-node0-onboarding/`.

## 10. What this PRD does not prove

Writing this spec proves intent, not shipment. No metric above is met until the deploy happens and the checks in §6 run against the live domain.
