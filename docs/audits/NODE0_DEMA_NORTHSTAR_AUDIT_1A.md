# NODE0 / DEMA — Northstar Technical Audit (1A)

- **Truth label:** `AUDIT_ASSESSMENT_NOT_MEASURED_FACT` — grades are evidence-weighted judgments, not metrics.
- **Method:** 10-dimension multi-lens audit, each top finding adversarially refuted-by-default (41 agents).
- **Overall grade:** B+
- **Date:** 2026-06-23 · run wf_404ca24a-276

## Rationale

Node0/Dema is an unusually honest, invariant-disciplined preview codebase: zero runtime npm deps (verified package.json deps={} / devDeps={}, gate-enforced and CI-wired), kernel purity mechanically scanned across all packages with 0 violations, exact-string + cryptographic consent gates that fail closed, and a pervasive boundary-block discipline (federation/mint/network all forced false). Security (A), zero-dep (A+), and scalability/federation honesty (A) are genuine strengths grounded in code I re-verified on disk. The grade is held at B+ rather than higher because adversarial verification refuted a large share of the lower-graded findings: the audit's architecture (C+), documentation (C+), testing (B-), and best-practices (C+) dimensions were materially inflated by fabricated or stale evidence — ADR-012 exists (claimed missing), all 418 test files are documented in TESTING.md (claimed 347/418), the nonce registry shipped and is wired into verdict-attest (claimed not implemented), baseline artifacts are written to docs/baselines/ (claimed never written), and verifyBaseline is wired into the Block0 readiness path (claimed no caller). After correction, the real defects are modest and mostly cosmetic/process: one genuine fail-open bug (covenant CLI uses CommonJS require() inside an ESM package at index.js:907/934, masking a ReferenceError as a generic error — but in a [PROTOTYPE] command with no live runtime), several stale doc headers, a missing docs/public/third-fact-v0.1.md markdown that ~15 references dangle to, and crypto-policy + SAT-review verification existing as unwired/stubbed previews. None of these breach the no-runtime / zero-dep / consent invariants. The system is a credible honest northstar; its weakest real axis is documentation freshness enforcement, not correctness or security.

# BIZRA Node0 / Dema — Synthesized Technical Assessment

**Overall: B+** · Preview-only, zero-runtime, consent-gated pure-kernel CLI. Strengths are real and verified; the lower dimension grades were inflated by refuted findings and are corrected below.

## 1. Dimension grades (audit vs corrected)

| Dimension | Audit grade | Corrected posture | Note |
|---|---|---|---|
| Security & fail-closed | A | A (holds) | Consent gates + key-isolation verified; one finding (nonce registry "not implemented") REFUTED — registry shipped + wired |
| Dependency mgmt / zero-dep | A+ | A+ (holds) | deps={} / devDeps={}, gate + CI enforced, 0 kernel-purity violations |
| Scalability / federation honesty | A | A (holds) | All federation/URP/Node1-2 surfaces honestly DECLARED/DESIGNED_NOT_LIVE; boundaries forced false |
| Giants & components (MCP/A2A/amana/RSI/SNR) | B+ | B+ (holds) | 6/7 components are tested preview kernels; severities trimmed (no autonomous loop = intentional, low) |
| Performance & CI headroom | B+ | B (raised on facts) | 2 "critical" findings REFUTED (baselines ARE written; verifyBaseline IS wired). Real gap: SAT-review verify stubbed |
| Error handling / fail-closed | B+ | B+ (holds) | Mostly clean; **1 genuine new fail-open**: covenant CLI require() bug |
| Architecture / module boundaries | C+ | B- (raised) | "god-file hub" REFUTED (~272 LOC/file avg, 2 files >1k); real issue is large dispatcher + doc-stack drift, both low |
| Testing coverage | B- | B (raised) | Registry-gap REFUTED (418/418 documented); kernel-purity "thin" REFUTED. Real: mock-only runtime is mandated, not a gap |
| Documentation freshness | C+ | C+ (holds) | Real: dangling third-fact md, stale "Last verified/refreshed" headers, no date-staleness gate |
| Best-practices (ADR/CLI-naming/truth-label) | C+ | B- (raised) | ADR-012 + CLI-naming enforcement REFUTED as "missing" — both exist + test-enforced. Real: ADR-008 self-corrected drift (low) |

## 2. Findings by corrected severity

Adversarial verification overturned the most severe claims. Corrected counts:

- **Critical:** 0 (both perf "critical" findings refuted on disk; ADR-008 "critical" downgraded to low — it is a self-applied correction, not a live overclaim)
- **High:** 1 — covenant CLI `require()`-in-ESM fail-open masquerade (latent; [PROTOTYPE] command, no test exercises the CLI path), index.js:907 & :934
- **Medium:** ~4 — SAT-review verification stubbed (perf-improvement.js, no step-7); QSAFE crypto-policy unwired (only self-imports); RSI preview metric (bounded, non-load-bearing); dangling docs/public/third-fact-v0.1.md
- **Low / info:** remainder — stale doc headers, large CLI dispatcher (1193 LOC, already modularized), 154-file core package (well-decomposed)

### Refuted / corrected findings (folded in)
- **"Test registry gap 347/418"** — FALSE. `find tests -name '*.test.js'` = 418; TESTING.md documents all 418 unique refs (verified). Mechanically gated (integration-check, spine-contract, doc-freshness all green).
- **"ADR-012 does not exist / CLI naming unenforced"** — FALSE. `docs/06-adr/ADR-012-cli-naming-convention.md` exists (ACCEPTED); `tests/cli-naming-convention.test.js` enforces it.
- **"Nonce registry not implemented"** — FALSE. `packages/receipts/src/consent-nonce-registry.js` exists and is wired into `verdict-attest.js:29,145`.
- **"No baseline ever written / verifyBaseline has no caller"** — FALSE. 4 artifacts in `docs/baselines/` (written by `scripts/baseline-l1.mjs`); `verifyBaseline` imported+called at `block0-prerequisite-status-collector.js:22,96`.
- **"Core is a god-file hub"** — FALSE. ~272 avg LOC/file, only 2 files >1000 LOC; concerns live in separate dedicated modules.

## 3. Qualitative evaluation

**Security (strong).** Consent is dual-layer: exact-string phrase gates plus the KEYCONSENT cryptographic proof kernel that verifies signatures with an *externally-supplied* pubkey only (ignores embedded fingerprint), binds scope (target_hash), enforces a 5-minute freshness window, and now closes replay via the single-use nonce registry. Private key material is stripped from all envelopes and asserted-absent by tests. Object.freeze is pervasive; every kernel emits a 16-key boundary block with effects false. This is the genuine center of gravity and earns the A.

**Reliability / error handling (good).** Depth-capped stableStringify (RangeError >100), byte-counted intent bound (10 KiB), bounded codebase walker (files/depth/bytes/time), inode symlink-loop detection, top-level dispatch .catch → exit 1. The single real defect is the covenant CLI: `require("node:fs")` inside a `"type":"module"` package throws ReferenceError for *all* inputs and the catch reports it as a generic "covenant screen error" — a fail-open masquerade in a gate that should fail closed. Latent because no test spawns the CLI path; the pure kernel (`screenProposal`) is fine. Worth fixing before that command is anything beyond [PROTOTYPE].

**Maintainability (adequate).** Real informal monorepo (no per-package package.json, relative-path imports), which is the *correct* shape given the zero-dep invariant — repo-charter.md's declared pnpm/Turborepo/TS/Vitest stack is DESIGNED_NOT_LIVE and would itself violate zero-dep if implemented; the fix is to update the charter, not build the stack. The CLI dispatcher (1193 LOC, 80 eager imports) and the large `core` package are organizational debt, not correctness risk in a no-runtime repo.

**Documentation (weakest real axis).** Strong truth-label discipline (CLAIM_REGISTER, CURRENT_LIMITS Layer-1 scanner, doc-freshness gate). But: `docs/public/third-fact-v0.1.md` is referenced ~15× (00_START_HERE, canon-glossary.js, ADRs) and does not exist; "Last verified"/"Last refreshed" headers are 15–30 days stale with no date-staleness gate to enforce them. These are navigation/integrity defects, not runtime defects.

**Honesty about scale/federation (exemplary).** Zero deceptive live-federation claims. URP shared runtime is DISCOVERY_ONLY with a refusal-only write evaluator; Node1/Node2 are placeholder fixtures (live_nodes=0, sockets_opened=0); think-probe forbids network imports as a proof-of-non-execution gate. This is the model other nodes should copy.

## 4. Top recommendations (priority order)

1. **Fix the covenant CLI fail-open** — replace `require("node:fs")` with the ESM import at index.js:907/934, and add a CLI-path test so the gate fails closed. (High, S)
2. **Resolve the dangling third-fact markdown** — either convert the PDF to `docs/public/third-fact-v0.1.md` or repoint the ~15 references; add a broken-internal-link check to doc-freshness-gate. (Medium, M)
3. **Add a date-staleness gate** — fail when "Last verified/refreshed" > N days; this closes the documented-but-unenforced refresh protocol that drifted on 00_START_HERE and ADR INDEX. (Low, S)
4. **Mark crypto-policy + SAT-review as preview-only in code** and add an integration test (or explicit skip marker) so their unwired status is self-evident rather than discoverable only by grep. (Medium, S)
5. **Update repo-charter.md** to describe the actual stdlib-only ESM monorepo + `node --test`, removing the pnpm/Turborepo/TS aspiration that contradicts the zero-dep invariant. (Low, S)
6. **Trim the CLI dispatcher** — defer command handler imports to dispatch time; move the 378-line HELP literal out of index.js. Pure ergonomics, no behavior change. (Low, M)

## Verified capability truth-ledger (grounds NODE0-ROSETTA-CONSTITUTION-1A)

| Capability | Status | Anchor |
|---|---|---|
| Zero-dependency invariant (0 runtime + 0 dev deps) | `IMPLEMENTED` | package.json (deps={}, devDeps={}); scripts/review/zero-dep-gate.mjs:15-23; scripts/check.mjs:6; .github/workflows/check.yml:30 |
| Kernel purity (no fs/net/http/child_process/fetch in pure tier) | `IMPLEMENTED` | scripts/review/kernel-purity-check.mjs; kernel-purity-allowlist.js:45-107 |
| Exact-string consent gates (key init, signing, attest) | `IMPLEMENTED` | packages/receipts/src/authorship-key-store.js:149; authorship-sign-command.js:35 |
| Cryptographic consent proof — scope + freshness binding (KEYCONSENT-1A/1B) | `IMPLEMENTED` | packages/receipts/src/consent-proof.js (buildConsentProof/verifyConsentProof:144-227) |
| Single-use consent nonce registry (replay close, KEYCONSENT-2) | `IMPLEMENTED` | packages/receipts/src/consent-nonce-registry.js:145-207; wired in verdict-attest.js:29,145 |
| Private key never exposed in output/errors | `IMPLEMENTED` | authorship-sign-command.js:108; consent-proof.js:123-127 |
| Fail-closed boundary blocks (federation/mint/network forced false) | `IMPLEMENTED` | packages/genesis/src/block0-manifest-verifier.js:52-60; node0-identity-proof.js:31-38 |
| DoS guards: depth-capped stringify + byte-bounded intent | `IMPLEMENTED` | packages/consent/src/consent-common.js:62-83 (MAX_DEPTH=100), :9-18 (MAX_INTENT_BYTES=10KiB) |
| Gitleaks secret scanning with grandfathered Firebase key | `IMPLEMENTED` | .gitleaks.toml:9-39; .github/workflows/gitleaks.yml:48 |
| Bounded resource walker (files/depth/bytes/time + symlink-loop) | `IMPLEMENTED` | packages/core/src/codebase-architecture-map.js:51-54,547-625 |
| Top-level CLI fail-closed (catch → exit 1) | `IMPLEMENTED` | apps/cli/src/index.js:1176-1187 |
| Covenant screen CLI (fail-open bug: require() in ESM) | `DECLARED` | apps/cli/src/index.js:907,934 |
| Performance baseline write + verify (PERF-1A / L1) | `IMPLEMENTED` | scripts/baseline-l1.mjs:193-200; docs/baselines/ (4 artifacts); verifyBaseline wired block0-prerequisite-status-collector.js:22,96 |
| Environment-aware perf budgets + A+ gate | `IMPLEMENTED` | scripts/review/performance-budget-gate.mjs:23-31; scripts/perf-bench.mjs |
| SAT-reviewed performance improvement verification (step 7) | `DECLARED` | packages/receipts? perf-improvement.js verifyImprovement (steps 1-6 only) |
| Post-quantum crypto policy gate (QSAFE) | `DECLARED` | packages/receipts/src/crypto-policy.js (evaluateSignaturePolicy) |
| MCP capability descriptor | `DECLARED` | packages/consent/src/mcp-capability-descriptor-preview.js |
| A2A message envelope | `DECLARED` | packages/consent/src/a2a-message-envelope-preview.js |
| Amana smart-contract registry | `DECLARED` | packages/core/src/amana-contracts-preview.js |
| SNR (signal-to-noise) scoring engine | `DECLARED` | packages/core/src/process-value-preview.js (computeSNRValue) |
| RSI (recursive self-improvement) metric | `DECLARED` | packages/core/src/process-value-preview.js:144-198 (computeProcessRsi) |
| Autopoietic / autonomous self-modification loop | `DESIGNED_NOT_LIVE` | packages/core/src/peak-self-loop-preview.js:344 (not_autonomous_runtime:true) |
| Shoulder-of-giants protocol mapping | `DECLARED` | packages/core/src/peak-self-loop-preview.js:92-118; external-pattern-registry-preview.js |
| URP local-only (discovery/manifest) | `DECLARED` | packages/core/src/urp-shared-runtime-discovery.js:70-201 |
| URP shared runtime (cross-node sync/pool) | `DESIGNED_NOT_LIVE` | packages/core/src/shared-urp-world-preview.js:31-40; docs/CURRENT_LIMITS.md |
| SAT (verifier) agents — dual-loop verdict | `DESIGNED_NOT_LIVE` | tests/closed-dual-loop-dry-run.test.js:61-66; node bin/dema agent-loop dual-preview |
| PAT (proposer) agents — proposal loop | `DESIGNED_NOT_LIVE` | tests/closed-dual-loop-dry-run.test.js; agent-loop dual-preview (PAT-7) |
| Agent DNA root coherence / Law of Assumption gate | `IMPLEMENTED` | packages/agents/src/agent-dna-root-coherence.js:39-109 |
| Proof passport / canonical receipt verification | `IMPLEMENTED` | packages/receipts/src/proof-passport-verify.js:160-171; canonical-receipt.js:124-128 |
| Receipt read/list (paging) | `IMPLEMENTED` | packages/receipts/src (listReceiptsPage; dema receipts paging, PR #222) |
| Dual-token ledger (ECON-1A) | `DECLARED` | packages/econ/src/dual-token-ledger.js:57-58 |
| Node1/Node2 federation handoff | `DESIGNED_NOT_LIVE` | packages/core/src/network-fixture-preview.js:26-39 |
| PoI / token economy / Step-7 mint | `DESIGNED_NOT_LIVE` | packages/genesis/src/block0-manifest-verifier.js:52-60; amana-contracts-preview.js:181 |
| ADR-012 CLI naming convention + enforcement | `IMPLEMENTED` | docs/06-adr/ADR-012-cli-naming-convention.md; tests/cli-naming-convention.test.js |
| Test registry completeness (TESTING.md ↔ disk) | `IMPLEMENTED` | docs/TESTING.md; find tests -name '*.test.js' |
| Canonical Third Fact markdown (docs/public/third-fact-v0.1.md) | `DESIGNED_NOT_LIVE` | referenced ~15× (00_START_HERE.md, canon-glossary.js, ADR-009); file ABSENT on disk |

## Invariant-safe additions (northstar roadmap)

| Effort | Component | Value | Invariant safety |
|---|---|---|---|
| M | Rosetta Constitution document (Node0 truth ledger as canon) — single machine-readable + human doc that pins each capability to IMPLEMENTED/DECLARED/DESIGNED_NOT_LIVE with file:line anchors | Becomes the honest northstar future nodes inherit: one authoritative source mapping every claimed capability to verified status, replacing scattered, drift-prone doc headers. Directly addresses the documentation-freshness weakness. | Pure markdown + optional frozen JSON constant; no runtime, no deps, no consent surface. Cannot mint/sign/network. Status strings are derived-from-evidence, not asserted. |
| S | Broken-internal-link + date-staleness gate (scripts/review/doc-staleness-gate.mjs) | Closes the only genuinely unenforced documentation discipline: catches the dangling third-fact-v0.1.md class of defect and stale 'Last verified/refreshed' headers before merge. | Read-only scanner over docs/*; node:fs read-tier (already allowlisted pattern), no network, no exec, no consent. Pure pass/fail. |
| M | RSI/self-improvement-PROPOSAL preview kernel (emits a frozen improvement proposal envelope, never applies it) | Lets Node0 model recursive self-improvement as a reviewable artifact (proposal + evidence + SAT-verdict-required flag) without any autonomous change — the honest precursor future nodes need before any live loop. | Pure function returning Object.freeze proposal with boundary all-false (not_autonomous_runtime:true, mutation_performed:false); no exec/network/persist; gated behind consent at any future apply step. |
| S | MCP capability-descriptor preview hardening: add a negative conformance test fixture set (malformed descriptors must reject) | Strengthens the already-shipped MCP preview so the eventual server-invocation surface inherits a proven-tight schema; raises the descriptor from DECLARED-with-thin-tests toward a fully fixture-bounded contract. | Test-only + pure validator; invocable_now stays false; no server, no network, no consent escalation. |
| M | SAT-review verification step-7 (wire verifyImprovement to actually verify a SAT signature, preview-only with mock SAT) | Removes a real DECLARED gap: performance-improvement proofs currently shape-check the SAT hash but never verify it. A pure verifier (external-pubkey, like consent-proof) closes the stub honestly. | Pure crypto verify (node:crypto, already used), no key generation, no network; verifies an externally-supplied SAT pubkey exactly as consent-proof does. Fail-closed. |
| S | Amana smart-contract preview: add explicit unblock-criteria manifest (what external audit snapshots would flip BLOCKED_PRE_AMANA→ready) | Makes the economic-activation gate auditable and removes ambiguity about Step-7 promotion — future nodes see exactly what proof is required before any settlement is even designable. | Static frozen data only; external_code_imported=false preserved; no mint/settlement/network; pure registry extension. |
