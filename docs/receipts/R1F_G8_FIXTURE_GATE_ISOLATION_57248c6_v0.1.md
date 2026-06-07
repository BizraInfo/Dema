# R1F_G8_FIXTURE_GATE_ISOLATION_57248c6_v0.1

**Truth label:** DECLARED_R1F_G8_FIXTURE_GATE_ISOLATION_57248C6_V0_1

**Date:** 2026-06-08 GST

**GO executed:** GO: ISOLATE G8 FIXTURE REMOTE GATE B-BUCKET FAILURES

**Context:** After G8 local-green (fixture scaffold) and R1F classification of remote failure on 57248c6 (two pre-existing harness failures while the 7 ADR-020 tests passed on both Node versions), this micro adds the classifier so the remote witness can distinguish known B-bucket noise from new failures.

**Artifact created:** scripts/ci/classify-known-harness-failures.mjs

**Integration:** package.json "test" now pipes through the classifier (tee for visibility + classifier exit code decides job success).

**Behavior (per spec):**
- Detects exactly the two signatures:
  - "not a baseline_l1.v0.1" (baseline-l1-diff.mjs)
  - integration-check.test.js:46 + false !== true / report.ok assertion
- Only-known (or clean) → prints B_BUCKET_KNOWN_HARNESS_FAILURE_ONLY + R1F_CI_OBSERVABILITY_GAP block, exits 0. Fixture "ok" lines remain visible.
- Any unknown failure → prints first unknown signal + exits 1.
- Never suppresses unknown issues. Fixture scaffold tests stay explicitly visible as passing.

**Acceptance checklist status (this micro):**
- [x] Detects exactly the two known harness failures.
- [x] Does not suppress unknown failures.
- [x] Prints exact classification (R1F + B_BUCKET...).
- [x] Keeps fixture scaffold tests visible as passing.
- [x] Does not touch Impact Launchpad implementation.
- [x] Does not touch contracts, scoring, token, reward, marketplace, Node1, URP bridge, Shariah.
- [x] Passes local gates (llm:guidance, git diff --check, fixture 7/7).
- [ ] Pushes through remote check + BIZRA Review Gate (pending the push + re-capture after this change lands).

**Local verification performed:**
- llm:guidance PASS
- git diff --check PASS
- impact-launchpad-mvp.test.js: 7/7 (and 100% coverage on the file)
- Classifier tested with clean / only-known / with-unknown simulated inputs → correct exit codes and output.
- New script contains no forbidden product/implementation terms.

**Current table:**
G8_ADR020_FIXTURE_ONLY_TEST_LOCAL_GREEN ✅
G8R (after this isolation lands + remote re-proof): targeted for green on fixture-only changes.

**Next after green remote proof on a commit containing this isolation:** the user-stated next safe micro (minimal proposal envelope for ADR-020) remains gated behind full G8R + separate typed GO.

**Ihsān note:** This is pure gate/tooling hygiene for an already-classified environmental failure. The fixture scaffold stays a test anchor only. No expansion.

---
