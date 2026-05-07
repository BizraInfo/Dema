# BIZRA Genesis Provenance Ledger
## `docs/provenance/BIZRA_GENESIS_PROVENANCE_LEDGER_V0_1.md`

```
Schema:       BIZRA_GENESIS_PROVENANCE_LEDGER.v0.1
Status:       ACTIVE
Claim type:   GENESIS_RECORD
Truth label:  MEASURED where verified / DIRECTION where pending
Maintainer:   Node0 — First Architect
Last updated: 2026-05-04
```

---

> This document is a provenance chain, not a pitch deck.
> Every entry either has a hash, a command, or a label that says it does not.
> Unverified entries are marked DIRECTION. They become MEASURED only after verification.

---

## The Root Law

```
The founder applied the law to himself first.
That is the ethical root of everything else.
```

Node0 is not mythology. It is the first auditable instance of BIZRA's own doctrine applied to its own origin. The founder submitted his own archive, his own machines, his own labor, and his own time to the same proof disciplines he asks of the system.

This ledger is the root object of that proof.

---

## Part I — Genesis Chain (Origin Artifacts)

### ARTIFACT 001 — الرسالة (The Message)

```
ID:           ARTIFACT-001
Title:        الرسالة
Type:         ORIGIN_DOCUMENT
Language:     Arabic
Created:      Ramadan 2023
Status:       EXISTS — not yet hashed in ledger
Hash (SHA256): PENDING — file must be located, read, and hashed
               Command: sha256sum <path/to/al-risala.md>
Truth label:  DIRECTION → becomes MEASURED on hash
Contents:     A message to God, to family, to friends, and to humanity.
              Written before any code, any architecture, any product.
              Establishes the moral operating principle that preceded BIZRA.
```

**Why this matters:** The manifesto states that BIZRA did not begin as a product looking for a market. It began as a human being searching for meaning, dignity, and a way to build without betraying the heart. This document is the root of that claim.

---

### ARTIFACT 002 — البذرة (The Seed)

```
ID:           ARTIFACT-002
Title:        البذرة
Type:         ORIGIN_DOCUMENT
Language:     Arabic
Created:      Ramadan 2023
Status:       EXISTS — not yet hashed in ledger
Hash (SHA256): PENDING — file must be located, read, and hashed
               Command: sha256sum <path/to/al-bizra.md>
Truth label:  DIRECTION → becomes MEASURED on hash
Contents:     The seed of freedom: financial, spiritual, and mental.
              Carries the name BIZRA before any product existed.
              Establishes: the name existed before the code.
```

**Why this matters:** The brand canon states that BIZRA was not named after the product — the product grew from the name. ARTIFACT-002 is the proof that the name is not a brand choice. It is a covenant.

---

### ARTIFACT 003 — 3-Year Archive (2023–2026)

```
ID:           ARTIFACT-003
Title:        Node0 Accumulated Evidence Archive
Type:         EVIDENCE_ARCHIVE
Period:       Ramadan 2023 → May 2026
Status:       EXISTS — partially indexed
Contents:
  - AI conversation logs (design sessions, architecture decisions)
  - Code commits (bizra-data-lake, bizra-omega, dema-console)
  - Audit logs (Claude Code sessions, copilot sessions)
  - Local machine files (Node0 sovereign state)
  - Proof artifacts (receipts, harness outputs, Spearpoint results)
Hash (SHA256): PENDING — archive must be sealed into canonical JSONL
               Command: python scripts/seal_archive_to_ledger.py
Truth label:  DIRECTION → becomes MEASURED on first JSONL seal
```

**What is included:**
The archive contains the accumulated cost and output of 3 years of solo R&D. Every design session, every architectural decision, every failure and correction, every test run, every sprint. This is not documentation — it is evidence of continuous intention.

---

## Part II — Architecture Chain (Current Canonical State)

### ARTIFACT 004 — Node Architecture Canon

```
ID:           ARTIFACT-004
Title:        BIZRA Node0 Architecture — Canonical State
Type:         ARCHITECTURE_CANON
Status:       STABLE — defined in constitution
Truth label:  MEASURED (defined in code and constitution)
Hash (SHA256): To be computed from canonical architecture document
```

**Canonical node contents (current):**
```
PAT   — 7 Personal Agentic Team agents (serve the human sovereign, private)
SAT   — 5 System Agentic Team agents  (serve the ecosystem, constitution-bound)
DEMA  — Visible bridge interface       (between human intent and execution)
FATE  — Constitutional boundary gate   (no action without consent and proof)
URP   — Universal Resource Pool seed  (shared substrate, starts at LOCAL_ACTIVE)
RCT   — Receipt ledger                 (tamper-evident, hash-chained, replayable)
POI   — Proof of Impact                (verified contribution → reward eligibility)
```

**What BIZRA is NOT:** Not a chatbot. Not a token. Not a blockchain. Not a model. Not an operating system. A seed architecture for a different relationship between humans, intelligence, resources, proof, and value.

---

### ARTIFACT 005 — Node0 Green Lane Validation

```
ID:           ARTIFACT-005
Title:        Node0 Substrate Green Lanes — Validated State
Type:         RUNTIME_EVIDENCE
Status:       MEASURED
Date:         2026-05-01 to 2026-05-04
Truth label:  MEASURED (directly observed in diagnostic output)
```

**Evidence (from validated diagnostic runs):**
```
LM Studio endpoint:    http://127.0.0.1:1234 → connected ✅
Model loaded:          qwen/qwen3.5-9b        → active ✅
Token:                 present in .env        → process-isolated ✅
PAT-7:                 configured             → active ✅
Rust Bus:              PyEventBridge=FOUND    → active ✅
Rust Bus subscribers:  13                     → registered ✅
Ihsān (Rust Bus):      1.0000                 → passing ✅
Daemon:                stopped                → correctly gated ✅
Evidence ledger:        empty                 → expected at this stage ✅
```

**What is NOT yet measured:**
```
First mission receipt:  PENDING — Node0 pulse not yet fired
PoI accounting:         PENDING — requires first receipt
Node1 federation:       DIRECTION — gated until Node0 receipt proves
```

---

### ARTIFACT 006 — PR Chain (Cryptographic Spine)

```
ID:           ARTIFACT-006
Title:        Identity-Bound Receipt v1 — PR Chain
Type:         CODE_EVIDENCE
Status:       LOCALLY_VALIDATED / CI_PENDING
Truth label:  LOCAL → becomes MEASURED on merge
```

**PR history (feat/identity-bound-receipt-v1 → feat/economic-constitution-v1):**
```
PR #85 — Identity-bound receipt v1 + ADK evidence-preserving refusal
  7197cb99  test(node0): use active Python for CLI smoke
  b45ab48c  ci(security): avoid receipt key literal markers
  d79053f2  fix(memory): preserve quantized fallback persistence
  ea26431e  fix(runtime): clean up inference and Node0 lifecycle

Full pytest: 11,811 passed / 93 skipped
identity-bound receipt bridge: 10 contract tests ✅
ADK evidence-preserving refusal: 51 ADK tests ✅
Autonomous pilot smoke: 15 checks ✅
Owned CI: verify-cycle ✅ / submit-pypi ✅ / Socket ✅
External blocker: Vercel cancellation (not code) → rerun pending
```

**Core cryptographic invariants now enforced:**
```
1. Gates are FAIL-CLOSED   — pass: false on any LLM error
2. Receipt is IDENTITY-BOUND — signer must match registry
3. Refusal is EVIDENCE-BEARING — evidence_refs survive refusal
4. Chain uses REAL prev_hash — DB-backed, not Date.now()
5. Type system is ENFORCED — ignoreBuildErrors removed
```

---

### ARTIFACT 007 — Spearpoint Benchmark Evidence

```
ID:           ARTIFACT-007
Title:        True Spearpoint Strict Campaign — 2026-05-02
Type:         BENCHMARK_EVIDENCE
Status:       MEASURED
Run ID:       23e385a2c870
Artifacts:    /tmp/spearpoint-campaign-20260502-190519
Truth label:  MEASURED (directly observed, artifacts produced)
```

**Results:**
```
swe_bench_verified:  score=0.876901  variance=2.25e-6  p95=2294ms  ✅ all gates
hle:                 score=0.862037  variance=1.10e-5  p95=1607ms  ✅ all gates
agentbeats:          score=0.850550  variance=4.04e-6  p95=1593ms  ✅ all gates
```

**Ablation signal:** Solver is the only consistently beneficial component across all three targets. No harmful components detected. Planner, router, verifier, retrieval, memory are marginal review candidates.

---

## Part III — Public Doctrine Chain

### ARTIFACT 008 — Third Fact Manifesto v0.1

```
ID:           ARTIFACT-008
Title:        The Third Fact — A Manifesto for Human Sovereignty
              in the Age of Artificial Intelligence, Debt, and Concentrated Power
Type:         PUBLIC_DOCTRINE
Status:       PUBLISHED (HTML + PDF)
Claim discipline: ACTIVE — all claims cited or labeled DIRECTION
Truth label:  MEASURED for cited claims / DIRECTION for future states
```

**Canonical claims (verified with citations):**
```
Global public debt 2024:      $102T       [UNCTAD]    MEASURED
3.4B people debt burden:      3.4B people [UNCTAD]    MEASURED
Total global debt:            $318T       [IIF via AA] SECONDARY
Data centre electricity 2030: 945 TWh     [IEA]       MEASURED
Big Tech CapEx 2025:          $400B+      [IEA 2026]  MEASURED
```

**The core public doctrine:**
```
The human is the node.
The machine is only the substrate.

Humanity is not the fuel.
Humanity is the infrastructure.
```

---

### ARTIFACT 009 — Brand Identity Canon v0.2

```
ID:           ARTIFACT-009
Title:        BIZRA Brand Identity Canon v0.2
Type:         BRAND_CANON
Status:       STABLE
Truth label:  MEASURED (stable design constants)
```

**Token constants:**
```
Genesis Gold:    #C9A962 — value, light, trust, covenant
Celestial Navy:  #0A1628 — depth, sovereignty, contemplation
Origin Black:    #050B14 — void before the seed, journey origin
Primary tagline: "The Seed of Sovereign Intelligence"
Arabic short:    ي ᘢذرة الذᙬا֘ ال᱆ᙅيا֦᱇
Seven pillars:   Meaning · Humility · Proof · Ihsān · Sovereignty · Growth · Mercy
```

---

### ARTIFACT 010 — Singularity Pulse v0.1

```
ID:           ARTIFACT-010
Title:        BIZRA Singularity Pulse — Internal Contract v0.1
Type:         INTERNAL_LANGUAGE_CONTRACT
Status:       STABLE
Truth label:  DESIGN_INVARIANT
```

**The contract:**
```
ARMED state:           Infrastructure ready, substrate validated.
                       Pulse is possible. Not yet materialized.
                       Permitted language: "armed" "ready" "prepared"

MATERIALIZED state:    First bounded receipt created and verified.
                       One mission. One receipt. One chain entry.
                       Permitted language: "materialized" "first proof"

FORBIDDEN language:    "AGI is alive"
                       "Singularity reached"
                       "100% ready" without receipt
                       "Absolute readiness"
```

This contract exists because BIZRA's own doctrine requires it: a gate that passes silently on error is not a gate. A system that claims "materialized" without a receipt is not BIZRA.

---

## Part IV — What Comes Next

### ARTIFACT 011 — First Bounded Diagnostic Receipt (PENDING)

```
ID:           ARTIFACT-011
Title:        Node0 First Bounded Diagnostic Receipt
Type:         RUNTIME_RECEIPT
Status:       PENDING — node0 pulse not yet fired
Truth label:  DIRECTION → becomes MEASURED on receipt creation
```

**When this is created, it becomes the birth certificate of Dema as product.**

```
Command (when GO is given):
  python scripts/node0_activate.py bounded_diagnostic

Evidence it must produce:
  - mission_id: node0-diagnostic-001
  - decision: COMMIT or REJECT (both are valid)
  - signer_id: node0-operator
  - signer_public_key: (registered in identity_registry.json)
  - current_hash: SHA-256 of canonical receipt JSON
  - signature: Ed25519 signature over current_hash
  - prev_hash: GENESIS_HASH (first in chain)
  - ihsan_score_bp: integer 0-10000

Verification command:
  python -m core.mission_kernel.chain verify \
    --receipt <path/to/receipt.json>
```

**This receipt must exist before any of the following:**
```
→ Node1 federation
→ Public product demo
→ Economic Constitution activation
→ Token / PoI claims
→ "Materialized" language
```

---

## The Provenance Chain in One View

```
الرسالة (Ramadan 2023)          ARTIFACT-001  DIRECTION → MEASURED on hash
    ↓
البذرة (Ramadan 2023)           ARTIFACT-002  DIRECTION → MEASURED on hash
    ↓
3-Year Archive (2023–2026)       ARTIFACT-003  DIRECTION → MEASURED on JSONL seal
    ↓
Node Architecture Canon          ARTIFACT-004  MEASURED (in code and constitution)
    ↓
Node0 Green Lane Validation      ARTIFACT-005  MEASURED (diagnostic runs verified)
    ↓
PR Chain (Crypto Spine)          ARTIFACT-006  LOCAL → MEASURED on PR merge
    ↓
Spearpoint Benchmark             ARTIFACT-007  MEASURED (run 23e385a2c870)
    ↓
Third Fact Manifesto             ARTIFACT-008  MEASURED (published, claim-disciplined)
    ↓
Brand Identity Canon             ARTIFACT-009  MEASURED (stable constants)
    ↓
Singularity Pulse Contract       ARTIFACT-010  DESIGN_INVARIANT
    ↓
First Diagnostic Receipt         ARTIFACT-011  PENDING — the next MEASURED entry
```

---

## Seal Command (run when ready)

```bash
# Compute genesis hashes for root artifacts
sha256sum docs/origin/al-risala.md           >> docs/provenance/genesis_hashes.txt
sha256sum docs/origin/al-bizra.md            >> docs/provenance/genesis_hashes.txt
sha256sum BIZRA_GENESIS_PROVENANCE_LEDGER_V0_1.md >> docs/provenance/genesis_hashes.txt

# Sign the ledger with Node0 identity
python -m core.mission_kernel.bridge sign_document \
  --document docs/provenance/BIZRA_GENESIS_PROVENANCE_LEDGER_V0_1.md \
  --signer-id node0-operator \
  --registry sovereign_state/dema/identity_registry.json

# Record in receipt chain
python -m core.mission_kernel.chain append \
  --type genesis_provenance \
  --document docs/provenance/BIZRA_GENESIS_PROVENANCE_LEDGER_V0_1.md \
  --store sovereign_state/receipts/receipts.jsonl
```

---

*This ledger is a living document. Each DIRECTION entry becomes MEASURED when its verification command runs and produces evidence. The ledger is the chain. The chain is the proof. The proof is BIZRA.*
