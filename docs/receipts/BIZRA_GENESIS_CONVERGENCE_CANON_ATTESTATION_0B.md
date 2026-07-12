# Receipt: BIZRA-GENESIS-CONVERGENCE-CANON-ATTESTATION-0B

- **Promotion state:** `REVIEWED_LOCAL_CANON_CANDIDATE` — corrected and gated on an unpushed local branch; pending remote draft review and explicit merge authorization.
- **Authority scope:** documentation only. This attestation authorizes nothing further; it does not claim its own containing commit SHA (that is unknowable at authoring time).

## Commit lineage

| Role | SHA |
|---|---|
| Base (`origin/main`) | `5c9d3111e6abf3c8315ee7e0d3ab21a7be94b4b4` |
| Content commit | `3741711` (posture + ignition pack + 0A receipt) |
| Amendment commit | `d4d3904` (exit materiality · reward law · enforcement labels) |
| Correction commit (0C) | `e1a1ea63090487a53d2c870ae51272c864d4471e` (promotion/enforcement-label precision) |

## Resulting artifact hashes (SHA-256, at correction commit `e1a1ea6`)

| File | SHA-256 |
|---|---|
| `docs/canon/BIZRA_CONSTITUTIONAL_POSTURE_ON_TRUTH_SERVICE_AND_CHOICE.md` | `425089ebeef4ad0830bfbb864a2aa419180401ef6314fa756477adbe8ea87916` |
| `docs/00-product-thesis/NODE0_IGNITION_1A_IGNITION_PACK.md` | `5454d593226af632562326f53a34f58d5778736ad21bad2a2423e520a345b28c` (unchanged since 3741711) |
| `docs/receipts/BIZRA_GENESIS_CONVERGENCE_CANON_0A.md` | `179312c1386f505ae4c2f91877779a9d16275dbf04a9bc0d49594ed046b15996` |

## Gate results (correction commit)

`canon-check` ✓ · `no-overclaim` ✓ · `npm run llm:guidance` ✓ · `npm run check` ✓ (G8 clean, 0 failures) · `git diff --check` ✓.

## Authority history (honest)

- `3741711` — content committed under an explicit operator request to make the artifacts durable and tracked.
- `d4d3904` — amendments committed under an **inferred** GO (review read as approval). Weaker than exact consent; preservation ratified forward; **no retroactive exact-authorization claim.**
- `e1a1ea6` — corrections committed under the **exact** scoped GO `BIZRA-CANON-CORRECTION-0C`.

## Current state

- **Repository promotion state:** `LOCAL_COMMITTED_CANON_CANDIDATE` → after this attestation commit, `REVIEWED_LOCAL_CANON_CANDIDATE`.
- **`DEMA_RUNTIME_AWARE = NO`** — no runtime module loads `docs/canon`; no kernel (PAT/SAT/FATE/URP) consumes the posture; no precedence/supersession machinery; Dema cannot cite the posture's commit or hash at runtime.
- **Master roadmap companion:** `docs/00-product-thesis/BIZRA_MASTER_ROADMAP_v0_1.md` — `PLANNED_COMPANION_NOT_YET_PRESENT`.
- **`authority_delta: 0`** throughout; changes additive only (no existing canon modified beyond these tracked artifacts).

## Clauses still `DESIGNED_NOT_LIVE` (unresolved proof gaps)

- Model-family independence (no live runner enforces SAT-family ≠ PAT-family).
- Live SAT agent separation (SAT judges declared facts today; does not gather-and-test real results autonomously).
- Material exit (no export-and-verify fixture proving keys/data/history/receipts are externally verifiable).
- Reward distribution / conflict-of-interest separation (economy dormant; nothing distributes).
- Living Dema runtime memory (built by the gated Genesis Convergence campaign).
- Remaining test gap: no dedicated `tests/fate.test.js` (FATE exercised via consumers only).

## What this proves / does not prove

Proves: the canon candidate's authority, evidence, enforcement boundaries, and promotion history are now visible and honestly labeled. Does not prove: any runtime, economy, federation, autonomy, or Dema runtime-awareness — none built, run, pushed, merged, or published. Each remains behind a separate exact GO.
