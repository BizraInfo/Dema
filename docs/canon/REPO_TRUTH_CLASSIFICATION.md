# Repo Truth Classification

The Law of Assumption (LoA) applied to the BIZRA portfolio of ~157
repositories accumulated over 3 years of R&D.

## 1. The Anchor

> كلما ازددت علماً، ازددت يقيناً بجهلي.
> رأيي قد يكون صواباً وقد يحتمل الخطأ. ورأي غيري قد يبدو خاطئاً وقد يحتمل الصواب.
> لا نفترض ولا نقبل الظن المجرد. وإذا كان الافتراض أمراً لا مفر منه، فإننا نفترض بإحسان.

> The more I learn, the more certain I become of my ignorance.
> My view may be right — but it may contain error.
> Another view may seem wrong — but it may contain truth.
> We do not assume blindly. When assumption is unavoidable,
> we assume with Ihsān — and we declare the boundary
> between evidence and uncertainty.

Operationally for code: **A repo's existence is not evidence its
claims are true. A repo's claims at time T are not evidence they're
true at time T+N.**

## 2. Three Tiers

| Tier                 | Definition                                                                                                                                  | Treatment                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **PRIMARY_VERIFIED** | Current code, current tests passing, current CI green, claims match disk evidence                                                           | Trust per-commit. New work happens here.                                        |
| **VALUE_ADD**        | Real code that supports primary, but not verified per-commit by this repo's CI. May contain partial overclaims.                             | Useful reference. Cite claims with a "verified-against-disk" note before using. |
| **HISTORICAL**       | Point-in-time R&D snapshot. May contain claims that were true at time T but no longer hold. May contain overclaims from earlier exuberance. | Read for lineage, not for current truth. Do not patch unless promoted.          |

A repo can move tiers (HISTORICAL → VALUE_ADD → PRIMARY_VERIFIED) by
adding tests + CI. Movement is recorded with date + commit.

## 3. Per-Claim Truth Labels

These are the labels Dema already uses; they apply to any
classification across all 157 repos.

| Label               | Meaning                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `MEASURED`          | Code exists on disk, test exercises it, CI runs the test, result is green |
| `LOCAL_VERIFIED`    | Works on local machine, not yet federation/network verified               |
| `DESIGNED_NOT_LIVE` | Schema or preview exists; runtime does not yet                            |
| `ASPIRATIONAL`      | Vision/intent statement; no code yet                                      |
| `OVERCLAIM_FLAGGED` | A claim was found to exceed evidence; status corrected to its honest tier |
| `HISTORICAL`        | Was a claim at time T; current status not re-verified                     |

## 4. The Screen

Any claim about any repo (from this audit, from an external AI, from
a doc) must pass through this screen before action:

```
1. Does the cited file exist on disk today?
   → If no: REJECT claim. Do not invent patches.

2. Does the cited code/text actually say what the claim says?
   → If no: trust disk; correct the claim.

3. Is there a test that exercises the cited behavior?
   → If no: downgrade to DESIGNED_NOT_LIVE or HISTORICAL.

4. Does CI run that test against the current commit?
   → If yes: MEASURED.
   → If no: LOCAL_VERIFIED at best.

5. Is the claim older than 6 months without re-verification?
   → Downgrade to HISTORICAL until re-verified.

6. Does the claim exceed what the evidence supports?
   → Label OVERCLAIM_FLAGGED and append the honest correction.
```

This screen is the operational form of LoA. It is the answer to
"how do we assume with Ihsān."

## 5. Seeded Classification (2026-05-28)

### PRIMARY_VERIFIED

| Repo             | Evidence                                                                                                                                                      | Truth labels                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `BizraInfo/Dema` | 3161/3161 tests pass, 26/26 smoke, 24 remote-CI-green commits this session (last: `8d0aea7`). H18 authorship spine + H19 proof passport stack fully MEASURED. | `MEASURED` for authorship + passport; `LOCAL_VERIFIED` for everything else; `DESIGNED_NOT_LIVE` for federation/token/PoI. |

### VALUE_ADD

| Repo                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                   | Honest status                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bizra-node0-genesis` | Real Rust + TypeScript code in `rust/` and `src/`. Disk audit (2026-05-28) found: no `bizra_secure_2025` hardcoded, no offending `docker-compose.node0.yml`, no `backend/src/main.rs`. Real security finding: `src/security/secrets.manager.ts:73` logs `SECRETS_ENCRYPTION_KEY` to stdout on first run. Real claim drift in `docs/*.md` and root `PEAK_MASTERPIECE_*.md` files. No root README.md exists. | Code: `LOCAL_VERIFIED` / partial. Marketing docs: `OVERCLAIM_FLAGGED` (claims "READY FOR DEPLOYMENT" / "PRODUCTION READY" without per-commit CI of those claims). |
| `bizra-data-lake`     | Large corpus repo (`/data/bizra/data-lake/`). Real artifacts present (gold corpus, models, archives). Per-commit verification status of individual artifacts not established.                                                                                                                                                                                                                              | `HISTORICAL` for most artifacts pending per-artifact MEASURED upgrade. `LOCAL_VERIFIED` for the index structure itself.                                           |
| `BIZRA-OS`            | Private non-archived repo (last push 2026-01-26). Genesis UI components (`GenesisProofCard.tsx`) and README genesis claims discovered via gh search 2026-06-05. Not Dema runtime authority.                                                                                                                                                                                                                | `IMPLEMENTATION_CANDIDATE` / `DESIGNED_NOT_LIVE`. UI + claims require operator review before any migration.                                                       |
| `bizra-genesis-node`  | Private **archived** repo (distinct from `bizra-node0-genesis`). Multi-agent consensus prototype metadata verified 2026-06-05. Not cited in Dema three-repo canon as archive authority.                                                                                                                                                                                                                    | `ARCHIVED_REFERENCE` — lineage only; do not treat as live Node0 authority.                                                                                        |
| `bizra_scaffold`      | Public archived bootstrap repo (last push 2026-03-12). Metadata verified 2026-06-05 cross-repo provenance audit.                                                                                                                                                                                                                                                                                           | `ARCHIVED_REFERENCE` — bootstrap history only.                                                                                                                    |

### HISTORICAL (pending classification)

The remaining ~154 repos are tagged `HISTORICAL` until classified one
at a time. They contain real R&D lineage but cannot be cited as
current evidence without disk-truth re-verification.

Classification of additional repos is a per-repo micro task:

1. Read root README + recent commits
2. Run tests if any exist
3. Apply the §4 screen to top 3 claims
4. Add a row to the appropriate tier above
5. Record date + reviewer

## 6. External Audit Protocol

When any external AI (ChatGPT, Gemini, Claude in a different session,
etc.) produces an audit of any BIZRA repo, the audit must be screened
**before any patch is written**:

1. **Verify cited file paths.** `find` / `ls` the exact path. If it
   doesn't exist, the audit is operating on phantom files. Reject
   the patch.
2. **Verify cited code matches the claim.** `grep` the exact string.
   If the file exists but the code differs, trust the disk and update
   the audit.
3. **Verify the repo identity.** Audits frequently confuse
   `bizra-node0-genesis` with `Dema` or `data-lake`. Confirm `pwd`
   and `git remote -v` before acting.
4. **Extract the real signal.** Even when specific patch targets
   are wrong, the underlying concern (e.g., "claim discipline gap")
   may be real in a different file. Find the real file. Patch that.
5. **Record the screen.** If you reject an audit's patch, record
   what was rejected and why. This builds the OVERCLAIM_FLAGGED
   evidence trail.

This protocol is canon-bound: see memory entry
`feedback_external_ai_audit_wrong_codebase_pattern.md`.

## 7. Boundary

This document does NOT:

- Delete any historical repo
- Erase any past claim
- Assert which claims were ever wrong
- Make economic, legal, federation, or production claims about any tier

It only declares **the boundary between evidence and uncertainty** —
which is the exact operational form of the LoA canon.

## 8. Cross-Repo Provenance Status Classes

The cross-repo genesis provenance scanner (`scripts/review/cross-repo-genesis-provenance.mjs`) classifies discovered artifacts with these status classes. They map to the tiers above as follows:

| Status class                   | Tier mapping           | Migration decision               | Description                                                                                                                                                      |
| ------------------------------ | ---------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CURRENT_CANON`                | PRIMARY_VERIFIED       | `INHERIT_ACTIVE`                 | Active product code in the canonical Dema repo with CI coverage.                                                                                                 |
| `HISTORICAL_CANON`             | VALUE_ADD / HISTORICAL | `REFERENCE_ONLY`                 | Past-accurate artifacts retained as read-only lineage; do not patch unless promoted.                                                                             |
| `IMPLEMENTATION_CANDIDATE`     | VALUE_ADD              | `OPERATOR_REVIEW_BEFORE_MIGRATE` | Real code in non-archived repos (e.g., BIZRA-OS) that is not yet Dema canon. Requires operator review before any migration. Not a live runtime authority.        |
| `ARCHIVED_REFERENCE`           | HISTORICAL             | `IGNORE_UNLESS_OPERATOR_REVIEW`  | Code in archived repos retained as historical lineage only (e.g., `bizra-genesis-node`, `bizra-node0-genesis`, `bizra_scaffold`). Do not treat as current truth. |
| `SPEC_ONLY`                    | HISTORICAL             | `REFERENCE_ONLY`                 | Documentation or specification with no current backing implementation.                                                                                           |
| `TEST_FIXTURE`                 | PRIMARY_VERIFIED       | `IGNORE`                         | Test helpers; not part of the production artifact set.                                                                                                           |
| `LIVE_PROOF_CANDIDATE`         | VALUE_ADD              | `OPERATOR_VERIFY_ON_DISK`        | Artifact that may contain real live proof material; blocks key ceremony until operator verifies on disk.                                                         |
| `SECRET_REFERENCE_DO_NOT_READ` | N/A (security)         | `OPERATOR_REVIEW`                | Path matches secret/key patterns. Content is never read. **Blocks key ceremony** until operator confirms no duplicate live keys.                                 |
| `MIGRATION_CANDIDATE`          | VALUE_ADD / HISTORICAL | `OPERATOR_REVIEW_BEFORE_MIGRATE` | Archived code that may contain promotable implementation; review required before import.                                                                         |
| `REJECTED_OR_SUPERSEDED`       | HISTORICAL             | `IGNORE`                         | Artifacts containing known overclaims (e.g., `PEAK_MASTERPIECE`, "PRODUCTION READY" without CI). Permanently superseded.                                         |

## 9. Living Status

This document is the source of truth for portfolio classification.
When a repo moves tiers, append a new row with date + commit + reason.
When an external audit is screened, append a note in §6.

Last updated: 2026-06-05 at commit on `feat/block0-live-readiness` — added §8 cross-repo provenance status class definitions; provenance next_gate updated to `BLOCKED_BY_UNRESOLVED_PROVENANCE` pending secret-reference operator review.
