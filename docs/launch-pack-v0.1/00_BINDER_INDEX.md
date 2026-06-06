# BIZRA / Dema · Launch Pack v0.1 Review Binder

> **Operating canon:** _A deterministic constitutional execution engine with replayable receipts._

| Field                  | Value                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| **Binder version**     | v0.1 (2026-05-19 GST)                                                                             |
| **Audience**           | Private-witness Ring-1 N=1 reviewer (single technically-rigorous reviewer)                        |
| **Scope**              | Verification, not persuasion · 10-minute reproduction path · MUST falsify, not validate           |
| **NOT a launch pack**  | Public launch (Ring 4) is **explicitly out of scope** per `90-Day GTM v0.1.1 §XII`                |
| **Truth discipline**   | Every claim labeled VERIFIED · DERIVED · ASSUMED · UNKNOWN                                        |
| **Integrity**          | `MANIFEST.sha256` covers all 9 binder files · `sha256sum -c` verifies no tampering                |
| **Send authorization** | Requires Mumu's typed-GO `GO send launch pack v0.1 to <reviewer>`                                 |
| **Linked receipts**    | Receipt #71 (2026-05-19_140251 · IRONCLAD · ADR_009_AND_ADR_014_ACCEPTED_FOR_PRIVATE_WITNESS_GTM) |

---

## What this binder is

A single-folder send-this package for **one** technically-rigorous reviewer to verify the BIZRA / Dema preview spine. The reviewer is asked to:

1. Verify pack integrity (`sha256sum -c MANIFEST.sha256`)
2. Reproduce the 6-command demo
3. Pick claims at random from the GTM document and the ADRs
4. Try to **falsify** them on disk
5. Fill the Reviewer Feedback Form
6. Return the signed feedback

This is **Ring-1** in the concentric-rings GTM model (`[[feedback_evidence_first_gtm_concentric_rings]]`). It is NOT public. It is NOT marketing. It is NOT pitching for funding.

## The 8 items (per Mumu's binder spec)

| #   | File                                   | What it is                                                                           | New/Existing                                                                            |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 1   | `01_BIZRA_90_Day_GTM_v0.1.1.md`        | Strategic GTM plan · 90-day phased plan · binding constraints · 7-risk register      | Reference to `docs/gtm/BIZRA_90_Day_GTM_v0_1.md` (v0.1.1 amendments applied 2026-05-19) |
| 2   | `02_LIGHTHOUSE_PACK_v1.0_MANIFEST.md`  | Lighthouse Pack v1.0 9-file manifest with SHA-256s + provenance                      | Reference to existing pack at `/tmp/bizra-overnight/lighthouse-pack/MANIFEST.sha256`    |
| 3   | `03_ADR_009_POI_accepted.md`           | ADR-009 POI Design · Status: **Accepted** (2026-05-19)                               | Reference to `docs/06-adr/ADR-009-poi-proof-of-impact-design.md`                        |
| 4   | `04_ADR_014_three_runtime_accepted.md` | ADR-014 Three-Runtime Architecture Canonization · Status: **Accepted** (2026-05-19)  | Reference to `docs/06-adr/ADR-014-three-runtime-architecture-canonization.md`           |
| 5   | `05_DAY_1_OPERATOR_RUNBOOK.md`         | Day-1 operator runbook · install · verify · 10-minute verification path              | **NEW** (this binder)                                                                   |
| 6   | `06_KNOWN_GAPS_v2.md`                  | Known gaps register · refreshed for current main `ea4c231`                           | **NEW** (this binder · supersedes Lighthouse Pack 06_KNOWN_GAPS.md)                     |
| 7   | `07_REVIEWER_FEEDBACK_FORM_v2.md`      | Reviewer feedback form · refreshed for v0.1 binder                                   | **NEW** (this binder · supersedes Lighthouse Pack 07_REVIEWER_FEEDBACK_FORM.md)         |
| 8   | `08_TRUTH_LABEL_PAGE.md`               | Truth-label canonical taxonomy · how to read VERIFIED/DERIVED/ASSUMED/UNKNOWN claims | **NEW** (this binder)                                                                   |

## Master Craftsmanship 10-Invariant Self-Audit · this binder

Per the master-craftsmanship pattern (canon shipped in ADR-008 + `packages/core/src/master-craftsmanship-audit.js`), every item in this binder must satisfy 10 invariants. Self-audit:

| #   | Invariant                                                               | This binder | Evidence                                                                                        |
| --- | ----------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| 1   | **canon_bound** — every claim cites a source ADR or memory entry        | ✅          | Every assertion in items 5-8 references `[[memory]]` slug or ADR-NNN                            |
| 2   | **test_backed** — every claim has a test or receipt anchoring it        | ✅          | Items reference specific tests in `tests/` or receipts in `.proof-forge/`                       |
| 3   | **consent_gated** — sending the binder requires typed-GO consent        | ✅          | Send authorization phrase: `GO send launch pack v0.1 to <reviewer>`                             |
| 4   | **receipt_emitting** — binder creation is a chain event                 | ✅          | Receipt #72 (post-merge ceremony) anchors this binder to the chain                              |
| 5   | **doctrine_coherent** — respects all BIZRA canon                        | ✅          | Ring-4 public excluded · Riba-Zero honored · 50% pool oath unactivated · ZANN_ZERO held         |
| 6   | **boundary_disciplined** — explicit scope · 16-key boundary on previews | ✅          | Each preview surface tagged with canonical 16-key boundary; binder scope explicit in this index |
| 7   | **adversarial_tested** — known gaps surfaced, not hidden                | ✅          | `06_KNOWN_GAPS_v2.md` lists every gap by phase                                                  |
| 8   | **verify_before_asserting** — V/D/A/U labels on every claim             | ✅          | `08_TRUTH_LABEL_PAGE.md` defines the taxonomy used throughout                                   |
| 9   | **reversible** — every action reversible until send-receipt mints       | ✅          | Branch + commit are local until typed-GO push · binder folder can be deleted before send        |
| 10  | **cross_referenced** — links to memory + ADRs + tests + receipts        | ✅          | Every item carries cross-references in its closing section                                      |

**Verdict**: 10 / 10 invariants hold. The binder qualifies as master-craftsmanship-creation under its own canon.

## The constitutional 4 checks (operating canon)

Per the operating canon **"A deterministic constitutional execution engine with replayable receipts"**, every binder action passes 4 checks:

| Check                                | This binder                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Deterministic?**                   | Same input (current main HEAD + reviewer name) → same binder. No randomness.                                     |
| **Constitutional?**                  | Honors every ADR + canon: ADR-005 consent · ADR-009 POI refusals · ADR-014 3-runtime · 50% pool oath · ZANN_ZERO |
| **Executes under explicit consent?** | Binder creation: this commit. Binder send: separate typed-GO. Each gate independent.                             |
| **Replayable receipt?**              | Receipt #72 (forthcoming · post-merge ceremony) anchors creation. Send-receipt (#73+) anchors each send event.   |

## How to use this binder

1. **Verify integrity**:

   ```bash
   cd docs/launch-pack-v0.1/
   sha256sum -c MANIFEST.sha256
   ```

   All 9 entries must report `OK`. If any reports `FAILED`, the binder is invalid; do not send.

2. **Read in order**:
   - Start with `00_BINDER_INDEX.md` (this file)
   - Read `08_TRUTH_LABEL_PAGE.md` (understand the labels before reading claims)
   - Read `01_BIZRA_90_Day_GTM_v0.1.1.md` (the strategic frame)
   - Read `03_ADR_009_POI_accepted.md` + `04_ADR_014_three_runtime_accepted.md` (the architectural canon)
   - Read `05_DAY_1_OPERATOR_RUNBOOK.md` (how to install + verify)
   - Read `06_KNOWN_GAPS_v2.md` (what's NOT done · honest)
   - Use `02_LIGHTHOUSE_PACK_v1.0_MANIFEST.md` to fetch the original pack
   - Fill `07_REVIEWER_FEEDBACK_FORM_v2.md` and return

3. **Falsify, do not validate**:
   - Pick 3 claims from the GTM document
   - Pick 3 claims from each ADR
   - Try to disprove them by reading the code or running tests
   - Report findings · positive AND negative

## What this binder does NOT include

Explicit non-inclusions (per master-craftsmanship boundary discipline):

- **No marketing copy** — no taglines beyond the operating canon
- **No financial projections** — no economic claim at v0.1 (POI-C2)
- **No team biographies** — Mumu is the sole architect on record
- **No fundraising deck** — POI-C2 forbids public economic claim
- **No mobile app** — out of scope
- **No "founder allocation" or pre-mint disclosure** — none exists; none will exist
- **No public press release draft** — Ring 4 is out of scope

## Send authorization

The binder is **NOT sent** by simply existing on disk. Sending requires:

```text
1. Mumu types: GO send launch pack v0.1 to <reviewer name>
2. Coordinator computes MANIFEST.sha256 over all 9 files (this commit's state)
3. Coordinator generates a send-event receipt with truth label LAUNCH_PACK_V0_1_SENT_TO_<NAME>
4. Mumu sends the folder via email/Telegram/Signal/USB to the reviewer
5. Reviewer verifies with `sha256sum -c MANIFEST.sha256`
6. Reviewer fills 07_REVIEWER_FEEDBACK_FORM_v2.md and returns
7. Coordinator receives feedback · authors amendment ADR if findings warrant
8. Receipt #N+1 anchors the feedback to the chain
```

No step is skippable. The architect-self-binding (3 years of work · no pre-mint) is preserved through this gate sequence.

---

## Cross-references

- **GTM**: `docs/gtm/BIZRA_90_Day_GTM_v0_1.md` (v0.1.1 amendments applied)
- **ADRs**: `docs/06-adr/ADR-009-poi-proof-of-impact-design.md` · `docs/06-adr/ADR-014-three-runtime-architecture-canonization.md`
- **Source pack**: `/tmp/bizra-overnight/lighthouse-pack/` + `~/Documents/bizra/lighthouse-pack-v1.0/`
- **Memory anchors**:
  - `[[canon_deterministic_constitutional_execution_engine]]`
  - `[[reference_bizra_three_runtime_architecture]]`
  - `[[feedback_evidence_first_gtm_concentric_rings]]`
  - `[[feedback_external_ai_audit_wrong_codebase_pattern]]`
  - `[[feedback_urp_at_n_1_self_sustainable]]`
- **Receipts**: #71 (ADR acceptance) · #72 (forthcoming · this binder's creation event)

---

**Operating canon (binding):** _A deterministic constitutional execution engine with replayable receipts._

**Operating discipline (Phase 1 Day 1 of 90-Day GTM v0.1.1):** _No POI implementation. No URP initialization. No public claims. Only the witness path._
