# Lane registry

Append-only. One entry per claim. Never rewrite prior entries — append state transitions as new rows. Isolation prevents state collisions; **claims prevent work collisions.**

```json
{
  "schema": "bizra.lane_registry.v1",
  "updated_at_utc": "2026-10-06T06:54:45Z",
  "rule": "claim before work; duplicate → L-02 reconcile by evidence; never delete superseded",
  "projection_law": {
    "owner": "/home/bizra-operating-system/Downloads/Dema/docs/LANE-REGISTRY.md",
    "mirror": "/home/bizra-operating-system/bizra-home/docs/LANE-REGISTRY.md",
    "rule": "Dema copy owns; bizra-home copy projects; every mirror sync records owner_sha256"
  },
  "entries": [
    {
      "item_id": "P0-HERMETICITY",
      "title": "CHECK-DEMA-HOME-HERMETICITY-1A",
      "claimed_by": "product-lane",
      "claimed_at": "2026-10-05TUNKNOWN_PRODUCT_START",
      "worktree": "/data/bizra/worktrees/dema-check-dema-home-hermeticity-1a",
      "branch": null,
      "base_commit": "e10d5842726d8c1b228f4bb6c23a9771d3510569",
      "canonical_correspondence": "IDENTICAL_BASE",
      "state": "RECONCILED_WINNER",
      "check_mjs_sha256": "11f3a1eca61b9d1dd6042b332ed38b8887781b4aa83c929e7c2863fa3f0f1cb8",
      "design_notes_measured": [
        "fifth-field gatePolicy operator_observation exception for env-hygiene",
        "force:true cleanup",
        "extends check-script.test.js",
        "P1 assets-scan files dirty in same worktree (assets.js, consent matrix, tests)"
      ],
      "note": "campaign-lane also implemented at /data/bizra/worktrees/check-dema-home-hermeticity-1a — see L-02; product lane is intended merge-candidate owner per campaign instruction Part 5",
      "disposition": "ON_PR_480_AWAIT_G3"
    },
    {
      "item_id": "P0-HERMETICITY-CAMPAIGN-DUP",
      "title": "CHECK-DEMA-HOME-HERMETICITY-1A (campaign-lane parallel)",
      "claimed_by": "campaign-lane",
      "claimed_at": "2026-10-05T14:49:00Z",
      "worktree": "/data/bizra/worktrees/check-dema-home-hermeticity-1a",
      "branch": "feat/check-dema-home-hermeticity-1a",
      "base_commit": "e10d5842726d8c1b228f4bb6c23a9771d3510569",
      "canonical_correspondence": "IDENTICAL_BASE",
      "state": "SUPERSEDED",
      "check_mjs_sha256": "94a8843d1fc6098fa5a7aa89e72a5cce96893440e436150c7b629431e96c5869",
      "design_notes_measured": [
        "all-children last-write DEMA_HOME (no operator_observation exception)",
        "force:false cleanup",
        "dedicated tests/check-dema-home-hermeticity.test.js 7/7",
        "related gates 45/45; full npm test/check NOT run"
      ],
      "note": "Competing correct green implementation; preserve until L-02 SUPERSEDED or LAND",
      "disposition": "ARCHIVE_REFERENCE_DO_NOT_LAND",
      "receipt_ref": "bizra-home/outputs/check-dema-home-hermeticity-1a-20261005T1450Z/HERMETICITY-RECEIPT.json"
    },
    {
      "item_id": "P1-ASSETS-SCAN-CONSENT",
      "title": "ASSETS-SCAN-CONSENT-PARITY-1A",
      "claimed_by": "product-lane",
      "claimed_at": "2026-10-05TUNKNOWN_IN_FLIGHT",
      "worktree": "/data/bizra/worktrees/dema-check-dema-home-hermeticity-1a",
      "state": "COMMITTED_PR_OPEN",
      "pr": 480,
      "head": "c1485e8ea3a3dc8f407064b11fc964728c702431",
      "branch": "fix/qualification-hermeticity-consent-parity-1a",
      "note": "G2 landed; awaits CI green + G3 merge GO",
      "disposition": "AWAIT_G3_MERGE"
    },
    {
      "item_id": "COMPOSE-P2F-WIRE",
      "title": "COMPOSE-DEMA-CLI-TO-STAGED-EFFECT-1A",
      "claimed_by": "campaign-lane",
      "claimed_at": "2026-10-05T10:18:00Z",
      "worktree": "/home/bizra-operating-system/Downloads/Dema",
      "branch": "feat/compose-dema-cli-fate-staged-effect-1a",
      "commit": "7c0edbad5a7624dd73b5edee71f8ed6349e9b975",
      "base_commit": "282b2b2903df341a0f5f5bdc626c787e6f764d70",
      "canonical_remote_main": "e10d5842726d8c1b228f4bb6c23a9771d3510569",
      "canonical_correspondence": "DRIFTED_BASE",
      "state": "COMMITTED_LOCAL_UNPUSHED",
      "correspondence_debt": true,
      "note": "Valid local work; cannot merge until L-04 onto merged canonical main with correspondence receipt",
      "disposition": "LAND_VIA_L04_AFTER_T05",
      "receipt_ref": "bizra-home/outputs/compose-commit-local-1a-20261005T1401Z/COMMIT-RECEIPT.json"
    },
    {
      "item_id": "SANDBOX-PULSE",
      "title": "NODE0-SINGULAR-CONDUCTION-1A sandbox pulse",
      "claimed_by": "campaign-lane",
      "claimed_at": "2026-10-05T00:02:00Z",
      "state": "SEALED",
      "label": "SANDBOX_PULSE_VERIFIED",
      "receipt_sha256": "0833b7a7d3cffc70955056f391a5147eefa91ccb1825e1821409fd269a9bbfbb",
      "founder_usefulness": "USEFUL",
      "verdict_recorded_at_utc": "2026-10-05T17:19:04Z",
      "verdict_artifact_sha256": "89b29f216e4d6effbe3c7c9690d8cc1002950abe3957064578ccf88dee8138d7",
      "product_lane_receipt": "docs/receipts/crossings/T-01-20261005T171904Z-founder-verdict.json",
      "campaign_lane_reference": "bizra-home/outputs/campaign-lane-L03-v-reference-20261005T1721Z/L03-V-REFERENCE-RECEIPT.json",
      "founder_note": "bizra-home/outputs/node0-pulse-lane-reconciliation-1a-20261005T1500Z/usefulness-verdict.FOUNDER-NOTE-20261005T172144Z.json",
      "founder_note_sha256": "006363d96128e5bdee0f6962423b78e1a34c5f060663ff8d3230e867109f49c0",
      "disposition": "V_RECORDED_SANDBOX_PULSE_ONLY"
    },
    {
      "item_id": "CROSSING-LEDGER",
      "title": "docs/CROSSING_LEDGER.md",
      "claimed_by": "campaign-lane",
      "claimed_at": "2026-10-05T14:59:00Z",
      "path": "/home/bizra-operating-system/Downloads/Dema/docs/CROSSING_LEDGER.md",
      "tracked_in_git": false,
      "state": "UNTRACKED_DIRTY_OWNED",
      "note": "Most important campaign projection file; still untracked — must ride with or immediately follow hermeticity landing commit",
      "disposition": "COMMIT_WITH_CAMPAIGN_RECORDS"
    },
    {
      "item_id": "LANE-REGISTRY",
      "title": "docs/LANE-REGISTRY.md",
      "claimed_by": "campaign-lane",
      "claimed_at": "2026-10-05T16:26:23Z",
      "path": "/home/bizra-operating-system/Downloads/Dema/docs/LANE-REGISTRY.md",
      "mirror": "/home/bizra-operating-system/bizra-home/docs/LANE-REGISTRY.md",
      "state": "CREATED_L01",
      "mirror_owner_sha256": "3992022c6591976f0981aed18739d3bf51e9bbcc9982874dab7071f94d29f7f5",
      "disposition": "COMMIT_WITH_CAMPAIGN_RECORDS"
    },
    {
      "item_id": "CAMPAIGN-INSTRUCTION",
      "title": "BIZRA_HOME_CAMPAIGN_LANE_AGENT_INSTRUCTION_v1_0.md",
      "claimed_by": "campaign-lane",
      "claimed_at": "2026-10-05T16:26:23Z",
      "path": "/home/bizra-operating-system/bizra-home/docs/BIZRA_HOME_CAMPAIGN_LANE_AGENT_INSTRUCTION_v1_0.md",
      "state": "CREATED_L01",
      "disposition": "GOVERNING"
    },
    {
      "item_id": "COMPOSE-BOUNDARY-L04",
      "title": "COMPOSE-SANDBOX-BOUNDARY-PROBE-1A",
      "claimed_by": "campaign-lane",
      "claimed_at": "2026-10-05T21:50:54Z",
      "worktree": "/data/bizra/worktrees/compose-sandbox-boundary-1a-20261006",
      "branch": null,
      "base_commit": "7c0edbad5a7624dd73b5edee71f8ed6349e9b975",
      "patch_sha256": "1de12ae9c59bbdfbbe94f8c3fd16d09e619f80f04228193a56b745d2dc753f2e",
      "state": "CLAIMED/DEFERRED",
      "lane": "L-04",
      "predecessor_item_id": "COMPOSE-P2F-WIRE",
      "deferred_until": "After the prover/product-lane merge to canonical main; then land together with commit 7c0edbad under one correspondence receipt.",
      "correspondence_receipt_scope": "One receipt binds original commit 7c0edbad plus this sandbox-boundary patch against the merged canonical base.",
      "evidence_ref": "/data/bizra/worktrees/compose-sandbox-boundary-1a-20261006-proof-receipt.json",
      "evidence_sha256": "c173a49fae4f04e2d0f406aa88eae50ec8ca588ea7d745bf082267f0dcdbc72c",
      "note": "Bounded local safety continuation of COMPOSE-P2F-WIRE. Preserve as a candidate; do not land separately or use ceremonially before L-04.",
      "disposition": "INCLUDE_IN_L04_AFTER_PROVER_MERGE_ONE_CORRESPONDENCE_RECEIPT"
    },
    {
      "item_id": "LESSON-EFFECT-PATH-BOUNDARY-PROBE",
      "title": "BOUNDARY-PROBE-BEFORE-CEREMONIAL-USE-1A",
      "claimed_by": "campaign-lane",
      "claimed_at": "2026-10-05T21:50:54Z",
      "state": "LESSON_CANDIDATE",
      "lesson": "Before first ceremonial use of a new effect path, probe traversal, symlink containment/read behavior, consent ordering, and write-before-gate behavior.",
      "evidence_refs": [
        "/data/bizra/worktrees/compose-sandbox-boundary-1a-20261006-proof-receipt.json",
        "/data/bizra/worktrees/compose-sandbox-boundary-1a-20261006/tests/node0-fate-staged-effect-cli.test.js"
      ],
      "evidence_sha256": "c173a49fae4f04e2d0f406aa88eae50ec8ca588ea7d745bf082267f0dcdbc72c",
      "evidence_summary": "Three red-first reproductions on the base: invalid consent/traversal seeded outside the sandbox; symlink alias entered DEMA_HOME; post-effect observation hashed an external target symlink.",
      "disposition": "CANDIDATE_FOR_REVIEW; NOT_YET_ADOPTED_AS_POLICY"
    },
    {
      "item_id": "P0-HERMETICITY",
      "title": "CHECK-DEMA-HOME-HERMETICITY-1A",
      "claimed_by": "product-lane",
      "transition_at": "2026-10-05T23:48:23Z",
      "prior_disposition": "ON_PR_480_AWAIT_G3",
      "state": "MERGED",
      "pr": 480,
      "source_head": "95bbabe3afa67f7ab9913dfb5d8a92c33ab92318",
      "merge_commit": "4edcd02d98e2c4087391991353891ef5c5223296",
      "note": "Append-only post-merge transition after G3 exact-head merge; prior AWAIT_G3 row retained above.",
      "disposition": "LANDED_ON_MAIN",
      "receipt_ref": "docs/receipts/crossings/G3-MERGE-RECEIPT.json"
    },
    {
      "item_id": "P1-ASSETS-SCAN-CONSENT",
      "title": "ASSETS-SCAN-CONSENT-PARITY-1A",
      "claimed_by": "product-lane",
      "transition_at": "2026-10-05T23:48:23Z",
      "prior_state": "COMMITTED_PR_OPEN",
      "prior_disposition": "AWAIT_G3_MERGE",
      "state": "MERGED",
      "pr": 480,
      "source_head": "95bbabe3afa67f7ab9913dfb5d8a92c33ab92318",
      "merge_commit": "4edcd02d98e2c4087391991353891ef5c5223296",
      "note": "Append-only post-merge transition after G3 exact-head merge; prior AWAIT_G3_MERGE row retained above.",
      "disposition": "LANDED_ON_MAIN",
      "receipt_ref": "docs/receipts/crossings/G3-MERGE-RECEIPT.json"
    }
  ],
  "worktrees_owned": [
    {
      "path": "/data/bizra/worktrees/check-dema-home-hermeticity-1a",
      "owner": "campaign-lane",
      "branch": "feat/check-dema-home-hermeticity-1a",
      "head": "e10d5842726d8c1b228f4bb6c23a9771d3510569",
      "item_id": "P0-HERMETICITY-CAMPAIGN-DUP"
    },
    {
      "path": "/data/bizra/worktrees/dema-check-dema-home-hermeticity-1a",
      "owner": "product-lane",
      "branch": null,
      "detached_head": "e10d5842726d8c1b228f4bb6c23a9771d3510569",
      "item_id": "P0-HERMETICITY"
    },
    {
      "path": "/home/bizra-operating-system/Downloads/Dema",
      "owner": "campaign-lane",
      "branch": "feat/compose-dema-cli-fate-staged-effect-1a",
      "head": "7c0edbad5a7624dd73b5edee71f8ed6349e9b975",
      "item_id": "COMPOSE-P2F-WIRE",
      "note": "Also hosts untracked ledger + registry; dirty unrelated files remain unowned by these claims"
    },
    {
      "path": "/data/bizra/worktrees/compose-sandbox-boundary-1a-20261006",
      "owner": "campaign-lane",
      "branch": null,
      "detached_head": "7c0edbad5a7624dd73b5edee71f8ed6349e9b975",
      "item_id": "COMPOSE-BOUNDARY-L04",
      "state": "CLAIMED/DEFERRED"
    }
  ]
}
```

## Change log

- **2026-10-05T16:26:23Z L-01:** Registry created. Duplicate P0 hermeticity recorded (`DUPLICATE_DETECTED`) for product-lane worktree `dema-check-dema-home-hermeticity-1a` and campaign-lane worktree `check-dema-home-hermeticity-1a` (distinct `check.mjs` hashes). Compose branch owned with `DRIFTED_BASE` correspondence debt. P1 claimed by product lane (campaign must not race). V still `PENDING_OPERATOR_VERDICT`. Next gated act: LG2.

- **2026-10-05T16:48:18Z L-02:** reconciled; see L02-RECONCILE-RECEIPT.json.

- **2026-10-05T16:53:21Z L-02 recovery:** Prior close-out NOT_ESTABLISHED (SIGSEGV post-registry-update; law 12). Re-verified sealed receipts (envelopes OK; no PENDING anomaly on disk); owner/mirror byte-identical before projection-law append. Record RE-CLOSED. Receipt: `bizra-home/outputs/campaign-lane-L02-recovery-20261005T1653Z/L02-RECOVERY-CLOSEOUT-RECEIPT.json`. Flake: `FLAKE-LEDGER-ENTRY-L02-CRASH.json`. Post-append owner/mirror sync: `sha256:fb566e09bdb4eedabbefadf327a5f19e5b434da507bd11112b52c34b948a58f1`.

- **2026-10-05T17:20:53Z L-03:** Founder V for pulse `0833b7a7…` is `USEFUL` (sandbox pulse only). Product lane sealed the durable verdict at 17:19:04Z (`usefulness-verdict.json` `89b29f21…`, receipt `T-01-20261005T171904Z-founder-verdict.json`). Campaign lane **references** that record (law 14) — does not re-write the verdict. Registry `founder_usefulness` updated; owner→mirror re-synced. Campaign receipt: `bizra-home/outputs/campaign-lane-L03-v-reference-20261005T1721Z/L03-V-REFERENCE-RECEIPT.json`. C-009/C-010 unchanged; `NODE0_CLOSED=false`.

- **2026-10-05T17:21:44Z L-03 founder note (additive):** Founder named the help actually needed — estate activation: Dema active locally organizing 3.5 years of unstructured work under universal rules — as the **ceremony mission target**. Pulse `USEFUL` unchanged (`89b29f21…` not edited). Note: `usefulness-verdict.FOUNDER-NOTE-20261005T172144Z.json`. Pointer: `docs/receipts/crossings/L03-20261005T172144Z-founder-note.json`. Does not authorize G5, ingest, or DEMA_HOME mutation.

- **2026-10-05T19:01:04Z G2:** Qualification repairs committed+pushed; PR #480 @ `c1485e8ea3a3`. Awaits CI + G3. Receipt: `bizra-home/outputs/campaign-lane-G2-qualification-20261005T1805Z/G2-LAND-RECEIPT.json`.

- **2026-10-05T21:50:54Z L-04 claim/defer:** Added COMPOSE-BOUNDARY-L04 as CLAIMED/DEFERRED for inclusion with 7c0edbad after the prover/product-lane merge, with one correspondence receipt binding both. Added the effect-path boundary-probe lesson as LESSON_CANDIDATE, supported by three red-first reproductions; not adopted as policy. Projection receipt: `bizra-home/outputs/campaign-lane-L04-deferred-20261005T215054Z/LANE-REGISTRY-PROJECTION-RECEIPT.json`.

- **2026-10-06T06:54:45Z G3 post-merge lane transition:** Appended MERGED/`LANDED_ON_MAIN` rows for `P0-HERMETICITY` and `P1-ASSETS-SCAN-CONSENT` binding PR #480 merge commit `4edcd02d98e2c4087391991353891ef5c5223296` at source head `95bbabe3afa67f7ab9913dfb5d8a92c33ab92318`. Prior AWAIT_G3 rows retained (append-only). Next active frontier after campaign-record land: T-06 / C-005 closeout under separate GO.
