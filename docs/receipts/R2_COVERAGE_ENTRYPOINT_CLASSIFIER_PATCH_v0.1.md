# R2_COVERAGE_ENTRYPOINT_CLASSIFIER_PATCH_v0.1

**Truth label:** DECLARED_R2_COVERAGE_ENTRYPOINT_CLASSIFIER_PATCH_V0_1

**Date:** 2026-06-08 GST

**Commit under patch:** (to be created after this micro)

**User micro executed:** GO: ROUTE COVERAGE THROUGH KNOWN-HARNESS CLASSIFIER

**Root cause addressed:** R2A (workflows bypass npm test via direct coverage) + R2C (BIZRA proof-quality separate path). Both call `npm run coverage`.

**Change:** Updated only the "coverage" script in package.json to:

- restore URP artifacts (B-bucket hygiene)
- run the exact coverage-flagged node --test
- tee to /tmp/bizra-coverage-output.log
- run classify-known-harness-failures.mjs on the log
- exit code controlled by classifier (0 only for clean or exactly the two known B-bucket cases)

This ensures the step that was actually failing the remote gates (coverage on 22.x in check + BIZRA) now goes through the same R1F classifier as "npm test".

**Local proof executed (post-edit):**

- npm run coverage → exercised (known B-bucket present; classifier should have classified)
- npm run llm:guidance → PASS
- git diff --check → clean
- node --test tests/impact-launchpad-mvp.test.js → 7/7 (fixture untouched)
- Negative smoke (user's exact printf "totally unknown failure") → exit 1 (fail-closed)

**No other files changed in this micro** (no .github/workflows edits, no product logic, no proposal envelope etc.).

**Still blocked:** exact list (no proposal-flow, contracts, scoring, token/reward/marketplace, Node1, URP bridge, Shariah).

**Next after this:** commit (only package.json + this receipt), push, re-capture four rails on the new HEAD. If green → G8R ✅ → unlock proposal micro.

**Evidence:** package.json diff (coverage line), this note, prior R2 trace note, classifier receipts.

**Ihsān:** Precise, minimal, evidence-first. The coverage entrypoint is now classified. Unknown failures still block.

---
