# NODE0-FIRST-LIGHT-0A — Truth Card

**Surface class:** technical evidence brief (claim-register bound)
**Truth label:** `MEASURED_LOCAL` for the local loop · `KNOWN_OPEN` for repo coverage gate
**Not:** public LIVE network · federation · mint · SaaS agent control plane · release-ready CI green

> Ihsān here means: say only what the receipt can re-verify.
> Market trend here means: governed local agents with portable proof — demonstrated, not advertised.

---

## One sentence (safe)

Dema/Node0 First Light is a **local, consent-bound loop** that answers one question from a chosen folder using a localhost model, seals an exact-answer receipt, derives a Proof Card from that receipt alone, and **re-verifies after process restart** — while refusing to call that loop a public network or a green release.

---

## Why this matters in the 2026 agent market (without overclaim)

The market is full of agents that *act*. Buyers and builders increasingly ask for agents that:

1. stay under **human sovereignty** (local / on-prem),
2. leave **evidence someone else can check**,
3. fail closed when evidence drifts.

First Light is not “the category winner.” It is a **reproducible specimen** of that discipline on one machine.

| Market hunger | What First Light shows | What it does **not** show |
|---------------|------------------------|---------------------------|
| Auditability | SHA-bound receipt + receipt-derived Proof Card | Independent semantic truth of the model’s prose |
| Local control | `ollama` / localhost only | Cloud multi-tenant fleet |
| Consent before effect | Exact phrase + context hash before content read / model / write | Continuous silent monitoring |
| Restart trust | Fresh-process `--resume` re-checks sources | Cross-node consensus |
| Honesty under pressure | Coverage gate recorded as inherited red | `npm run check` PASS |

---

## Reproducible evidence (disk-bound)

| Field | Value |
|-------|--------|
| Branch | `feat/node0-first-light-0a` |
| Commit | `40258a6d87b0a2da665a0acb6dce98579d01fb5a` |
| Parent | `72ef164f7c90351c781b01be085bc7e62bffe914` |
| Entrypoint | `bin/bizra` → `bizra start` |
| Mission ID | `first-light-c8c6f0c5c27b6bc06a2d` |
| Receipt ID | `sha256:d3ce2c703dff28605d84607b6b58a90480968324cefcd6ef3040afc011e9d318` |
| Proof Card | `sha256:98600a0839cef511fe420b4264327dcfd6124162139ce1abf400ae27097b3f63` |
| Verification | `VERIFIED_LOCAL` (execute) · `RESUMED_VERIFIED` (fresh process) |
| Corpus root (example run) | `docs/02-architecture` (124 supported files) |
| Model | `ollama` · `qwen3:4b` · `http://localhost:11434` |
| Focused tests | 55/55 pass |
| Full unit suite | 8248/8248 pass (`npm test`) |

**Grounded answer excerpt (example run):**

> PAT builds candidate actions (expands possibility); SAT decides if candidate becomes state (constrains authority) [S3]

Cited source family includes `SAT_ROLE_BOUNDARY.md` with matching SHA-256 recomputed from disk.

**Operator replay (local):**

```bash
# from the First Light worktree / commit
bizra start --resume first-light-c8c6f0c5c27b6bc06a2d --dema-home <your-DEMA_HOME> --json
```

Expect `status: RESUMED_VERIFIED` and `verification_state: VERIFIED_LOCAL` when sources are unchanged.

---

## Discipline demonstrated (ihsān checklist)

- [x] Consent disclosed **before** content read
- [x] Wrong phrase / expired context / forged endpoint → **no** model, **no** latest pointer
- [x] Answer text must derive from model response + retrieval (tamper fails closed)
- [x] Proof Card built only from verified receipt (`RECEIPT_DERIVED`)
- [x] Source identity + hash drift fails resume
- [x] Boundary keys: local acts true; federation / mint / public network / tool_exec **false**
- [x] Inherited CI coverage failure **named**, not hidden

---

## Coverage known-open (do not smooth)

`npm run check` remains red because repository-wide native coverage thresholds are already unmet on clean main. First Light improves aggregate line coverage from **91.49% → 93.00%** but does not close the inherited **95% line / 84% branch** thresholds.

| Tree | Lines | Branches |
|------|------:|---------:|
| Clean main `72ef164` | 91.49% | 78.33% |
| First Light candidate | 93.00% | 77.80% |
| Threshold | 95% | 84% |

**Separate mission:** `REPOSITORY-COVERAGE-TRUTH-AND-RESCUE-1A` (TASK-050) — ownership map before repair.
First Light must **not** absorb false blame for that inherited gate — and must **not** pretend the gate is green.

Forbidden labels for this card:

```text
full check: PASS
coverage: CLOSED
release ready: true
Node0 is live on the public internet
federation / mint / PoI rewards are live
```

---

## Claim-register alignment

| Public-adjacent statement | Label |
|---------------------------|--------|
| Dema is the local-first product face | `VERIFIED` (BIZRA-PUBLIC-001) |
| First Light local loop as described above | `MEASURED_LOCAL` |
| Federation / token / PoI | `DESIGNED_NOT_LIVE` (BIZRA-PUBLIC-002) |
| Islamic finance as design constraint, not certification | design language only |
| Apex-style multi-agent pantheon / quantum stack | **out of scope** — not BIZRA claims |

---

## How to judge quality (for a skeptical reader)

1. Re-run `--resume` on unchanged sources → must verify.
2. Edit one cited file → resume must fail closed.
3. Search this card for “LIVE network”, “mint”, “guaranteed reward” → must find none as assertions.
4. Compare coverage table to a fresh `npm run coverage` on `72ef164` vs this commit.

If those four hold, the card holds. If not, the card is wrong — fix the card, do not inflate the claim.

---

## Closing

The market does not need another mythology of intelligence.
It needs **systems that stay under consent and leave proof**.

First Light is one such loop, on one machine, with receipts you can hash again.
That is how BIZRA shines: **not louder — cleaner.**
