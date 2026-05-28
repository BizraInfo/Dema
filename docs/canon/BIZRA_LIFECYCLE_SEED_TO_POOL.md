# BIZRA Lifecycle — Seed to Pool

The bridge between what is MEASURED today and what is DESIGNED_NOT_LIVE
in the BIZRA proof economy. Read this before any work that touches
URP indexing, Proof of Impact minting, or federation.

## 1. The Seed Principle

In the operator's own words (2026-05-28):

> Whatever I have built or collected over the last 3 years is truly
> just the first step in BIZRA's journey. I just seeded the first seed.
> It's the first step. I always see BIZRA as continuously growing work,
> not a one-time hit. It grows like a seed, step by step. And not only
> me alone — with other nodes, users' support.

The anchor is Quranic in posture: small consistent action, sown with
intent, grown by what is greater than the sower. The system does not
decide what is valuable. The operator does. The system only verifies,
indexes within consent, and respects the keep/share boundary.

## 2. The Five-Stage Lifecycle

```
┌────────────────────────────────────────────────────────────────┐
│  1. COLLECT                                                    │
│     Operator's own 3-year corpus (~157 repos, data lake, etc.) │
│                          │                                     │
│  2. VERIFY                ▼                                    │
│     Sign artifacts (H18) → Generate passport (H19) →           │
│     Verify envelope + receipts (H19.2 + H19.3)                 │
│                          │                                     │
│  3. INDEX                 ▼                                    │
│     URP (Universal Resource Pool) local registry of            │
│     verified, classified, operator-tagged resources            │
│                          │                                     │
│  4. CHOOSE                ▼                                    │
│     Per-resource operator decision: SHARE / KEEP / WITHHOLD    │
│     Exact-string consent for each share boundary               │
│                          │                                     │
│  5. MINT                  ▼                                    │
│     PoI token mint candidate emitted only for verified,        │
│     shared resources. No mint without deep-verify pass.        │
└────────────────────────────────────────────────────────────────┘
```

## 3. What Is MEASURED Today (Stage 1–2 substrate)

| Capability                        | Code                                               | Verification                                                    |
| --------------------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| Sign a local artifact             | `packages/receipts/src/authorship-sign-command.js` | 12 tests, CI green at `4a592bf`                                 |
| Persist content-addressed receipt | `DEMA_HOME/receipts/authorship-<hash>.json`        | atomic write, mode 0o600 keys                                   |
| Generate Proof Passport           | `packages/receipts/src/proof-passport.js`          | stable-hash + portable, 15 tests                                |
| Verify envelope                   | `dema proof passport verify <path>`                | 17 tests, scope `PASSPORT_ENVELOPE_ONLY`                        |
| Verify receipts (deep)            | `dema proof passport verify <path> --deep`         | 12 kernel + 7 CLI tests, scope `PASSPORT_ENVELOPE_AND_RECEIPTS` |
| Classify any repo claim           | `docs/canon/REPO_TRUTH_CLASSIFICATION.md`          | committed canon at `396caeb`                                    |

These six together give Stages 1 and 2 of the lifecycle a real,
testable, CI-sealed substrate. Anything built on top of these can
declare `MEASURED` for its evidence base.

## 4. What Is DESIGNED_NOT_LIVE (Stage 3–5 intent)

| Capability             | Intent                                                                                              | Current status                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **URP Local Index**    | Resource registry composing verified passports, classification tier, operator tags, share/keep flag | Schema-only previews in `packages/core/src/urp-local.js`; no live indexer; no Stage-3 runtime |
| **Choose surface**     | CLI flow: per-resource SHARE / KEEP / WITHHOLD decision, exact-consent gated                        | Consent primitives exist (`consent-planner`, `consent-card-preview`); no Stage-4 wiring       |
| **PoI mint candidate** | Token mint proposal bound to (verified passport + deep verify pass + operator share decision)       | No mint runtime. No token ledger. No reward issuance                                          |
| **Multi-node pool**    | Voluntary union of shared verified passports across operator-nodes                                  | Federation schema-only; no live handshake; no inter-node verification path                    |

Each row is honestly DESIGNED_NOT_LIVE. Promotion to MEASURED requires:

1. Code on disk
2. Tests that exercise it
3. CI runs the tests
4. Boundary still bounded (no overclaim)

## 5. The Bridge Discipline

These rules govern any future code that crosses from §3 into §4:

```
Rule 1.  No PoI mint candidate without a passing deep-verify.
Rule 2.  No URP index entry without a verified passport reference.
Rule 3.  No share without exact-string operator consent.
Rule 4.  Mint candidate ≠ mint. The token economy is still
         DESIGNED_NOT_LIVE; mint candidates are read-only proposals.
Rule 5.  The keep/share/withhold decision is the operator's, recorded
         per-resource, never inferred.
Rule 6.  Federation across nodes requires per-node consent + receipt
         exchange. Until that exists, pool = local-only.
Rule 7.  Promotion of any DESIGNED_NOT_LIVE row to MEASURED requires
         a corresponding entry in §3 with test count and CI commit.
```

These rules are the LoA canon applied to the proof economy.

## 6. Multi-Node Future

```
Each operator-node runs the same loop locally:
  collect → verify → index → choose → mint candidate

A node never sends private resources. It only sends:
  - verified passports the operator marked SHARE
  - the passport_hash, not the receipt content
  - the operator's public key fingerprint, not the private key

The pool is the union of voluntarily-shared verified passports.
No node is forced. No claim is global without verification.
No central authority decides value — the operator's labeled tier
and the receipt chain do.
```

This is the "with other nodes, users' support" the operator named.
It is not a network. It is a discipline.

## 7. What This Document Does NOT Do

- Does not mint tokens
- Does not federate
- Does not assert legal or economic claims
- Does not promote any DESIGNED_NOT_LIVE row to MEASURED
- Does not declare PoI live
- Does not authorize cross-node sharing
- Does not classify any of the ~157 historical repos (that work is
  per-repo per-claim in `REPO_TRUTH_CLASSIFICATION.md`)

It only declares the bridge so future code can fill it honestly,
stage by stage, with every promotion paired with evidence.

## 8. The Seed Posture

```
This is the first step.
Not the last.
Not the only.
Not the largest possible.

It is sown with Ihsān.
It is verified with receipts.
It grows step by step.
```

## 9. Living Status

| Stage          | Status                         | Last MEASURED commit                       |
| -------------- | ------------------------------ | ------------------------------------------ |
| 1. Collect     | — (operator's existing corpus) | —                                          |
| 2. Verify      | MEASURED                       | `4a592bf` (H19.3.1 deep-verify CLI sealed) |
| 3. Index (URP) | DESIGNED_NOT_LIVE              | —                                          |
| 4. Choose      | DESIGNED_NOT_LIVE              | —                                          |
| 5. Mint        | DESIGNED_NOT_LIVE              | —                                          |

When a stage promotes to MEASURED, update this table with the
verifying commit. When a stage adds a CLI surface, link it from §3.

Last updated: 2026-05-28 at commit `396caeb` (Repo Truth Classification sealed).
