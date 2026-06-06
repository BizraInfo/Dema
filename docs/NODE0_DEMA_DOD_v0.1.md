# Definition of Done — BIZRA Node0 + Dema v0.1

**Anchored:** 2026-06-06 (Dubai GST) · Science of Achievement /C gate
**Release gate artifact:** ARTIFACT-011 — First Bounded Diagnostic Receipt
**Companion:** [ARTIFACT_011_PREP.md](ARTIFACT_011_PREP.md) · [NODE0_ACTIVATION_ROADMAP.md](NODE0_ACTIVATION_ROADMAP.md) Step A5

---

## Final statement

**BIZRA Node0 + Dema v0.1 is done when it proves one complete sovereign achievement loop:** local setup, status awareness, explicit consent, bounded diagnostic execution, proof receipt, verification, learning entry, and green test/check gates — with no hidden autonomy and no unverified claims.

In one line:

```text
DONE = Local-first setup + explicit consent + bounded action + receipt + verification + learning + green checks
```

Dema is “done” for v0.1 only when one local user can run one bounded diagnostic mission through the **governed Node0 path** with explicit consent, no hidden autonomy, proof-safe execution, a verifiable receipt (read back via Dema), and a learning entry — with all tests/checks passing.

This matches the product promise: local-first, consent-bound, receipt-backed, memory-aware, and no action without consent. v0.1 must not claim AGI, token launch, public network activation, or hidden background autonomy.

---

## 1. North Star flow

Node0 + Dema completes the first real milestone when this works:

```text
Mumu opens Dema
→ Dema reads Node0 status
→ Dema proposes one bounded diagnostic mission (preview only; executes=false)
→ Mumu gives exact consent
→ Governed Node0 executes only the permitted diagnostic (NOT Dema runtime)
→ Runtime issues ARTIFACT-011 receipt into DEMA_HOME
→ Dema lists and reads the receipt (dema receipts ARTIFACT-011)
→ Dema records one learning entry
→ all tests and checks pass
```

**Canon correction:** Dema does **not** mint runtime receipts. It reads and lists them. Minting is the governed Node0 / gateway responsibility (ADR-006, LLM_SYSTEM_FLOW).

Required consent phrase:

```text
GO: Node0 bounded diagnostic activation only
```

Forbidden categories (mission layer): Node1 activation, public demo, external provider routing, economic/token claims, unbounded daemon autonomy.

---

## 2. Hard acceptance criteria

### A. Local sovereignty

- [ ] Dema runs locally first
- [ ] `DEMA_HOME` or `~/.dema` is the default state root
- [ ] Setup creates local profile/config folders
- [ ] No cloud dependency required for the first diagnostic
- [ ] No background daemon starts silently

### B. Consent gate

- [ ] No mission executes without exact consent
- [ ] Fuzzy, whitespace-modified, translated, or partial consent fails
- [ ] Consent result is logged as a proof event

Exact-string rule: accepted only when `phrase === requiredPhrase`; otherwise verdict `BLOCK`.

### C. Bounded diagnostic mission

- [ ] `dema mission propose` remains preview-only (`executes: false`)
- [ ] Mission blocks if Node0 is not ready
- [ ] Mission blocks if console is not ready
- [ ] Mission blocks if daemon is already running
- [ ] Mission blocks if runtime pulse already fired
- [ ] Mission blocks if activation gate is not `EXPLICIT_GO_REQUIRED`

Product-shell command:

```bash
dema mission propose --consent "GO: Node0 bounded diagnostic activation only"
```

### D. Receipt / proof layer

- [ ] ARTIFACT-011 receipt exists on disk (issued by governed runtime)
- [ ] Receipt includes action, actor, timestamp, truth label, input/output hash, verification status
- [ ] Receipt stored under `DEMA_HOME/receipts/`
- [ ] `dema receipts` lists it
- [ ] `dema receipts ARTIFACT-011` reads it
- [ ] Malformed receipt does not crash the CLI
- [ ] Tampering is detected or marked invalid

Peak evolution (post-v0.1 seed): schema-valid receipt → deterministic event hash → hash-linked chain → signature-ready proof event.

### E. CLI functional surface

These commands must work for v0.1 close:

```bash
dema setup
dema status
dema status:json
dema today
dema doctor
dema mission propose
dema mission propose --consent "GO: Node0 bounded diagnostic activation only"
dema receipts
dema receipts ARTIFACT-011
dema monetize
```

### F. Safety / claim boundary

Public messaging and runtime behavior must block:

- AGI claim
- token launch claim
- passive income claim
- public federation claim
- hidden background autonomy
- Node1 activation
- external provider routing without explicit consent
- economic reward claim without proof receipt

---

## 3. Engineering DOD

### Code quality

- [ ] Node >=20 supported
- [ ] ESM modules remain consistent
- [ ] No unnecessary dependency expansion
- [ ] No shell execution for untrusted inputs
- [ ] External command hooks timeout-bound and documented
- [ ] All file writes local, explicit, and test-covered
- [ ] Error messages structured enough for user recovery

### Test gate

- [ ] `npm test` passes
- [ ] `npm run check` passes
- [ ] Consent tests pass
- [ ] Mission preview tests pass
- [ ] Receipt tests pass
- [ ] Setup safety tests pass
- [ ] Doctor/readiness tests pass
- [ ] ARTIFACT-011 close gate test passes (fixture + operator ceremony; see appendix)
- [ ] `npm run artifact-011:preflight` passes (Dema-side preview ceremony; release-gated in `npm run check`)

---

## 4. Proof-of-truth DOD

| Rail          | DOD requirement                                        |
| ------------- | ------------------------------------------------------ |
| Formal        | Mission, consent, receipt, status schemas validate     |
| Cryptographic | Receipt has deterministic hash; tampering fails verify |
| Empirical     | Tests and local smoke prove the flow                   |
| Economic      | Monetization/token claims blocked unless proof exists  |

---

## 5. Ihsān DOD

Every meaningful Node0 action must satisfy:

- Correct — does what it claims
- Safe — cannot exceed consent boundary
- Useful — benefits the user directly
- Efficient — avoids unnecessary complexity
- Auditable — leaves a receipt
- Fair — avoids deceptive or extractive behavior
- Robust — fails closed
- Truthful — does not overclaim

If any item fails, the feature is **not done**.

---

## 6. Release DOD for v0.1

Dema v0.1 can be called done only when:

- [ ] Fresh clone works
- [ ] `npm install` works
- [ ] `npm test` passes
- [ ] `npm run check` passes
- [ ] setup / status / doctor / mission / receipts commands work
- [ ] ARTIFACT-011 generated from a bounded diagnostic (governed runtime)
- [ ] ARTIFACT-011 readable from CLI
- [ ] No hidden daemon starts
- [ ] No token/AGI/federation claim in public output
- [ ] README matches actual behavior
- [ ] `docs/LLM_SYSTEM_FLOW.md` matches actual behavior
- [ ] Release evidence report generated

Final release evidence artifact:

```text
docs/evidence/ARTIFACT-011_FIRST_BOUNDED_DIAGNOSTIC_RECEIPT.md
```

---

## 7. Not done until

```text
Node0 + Dema is NOT done if it only talks.
Node0 + Dema is NOT done if it only has docs.
Node0 + Dema is NOT done if it only has tests.
Node0 + Dema is NOT done if it cannot emit a receipt.
Node0 + Dema is NOT done if consent can be bypassed.
Node0 + Dema is NOT done if the claim is bigger than the proof.
```

Correct sequence:

```text
Proof before scale.
Consent before action.
Local before global.
Ihsān before optimization.
Impact before reward.
```

Do **not** optimize for:

```text
launch token first
claim AGI first
build massive public network first
run autonomous agents without consent
make unverifiable impact claims
copy centralized AI platforms
```

---

## Appendix A — Repo validation snapshot (2026-06-06)

Truth labels for this workspace. Re-verify before release sign-off.

| Criterion block             | Status       | Notes                                                                                     |
| --------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| A Local sovereignty         | **TESTED**   | Setup/harness: `hidden_autonomy: false`, explicit consent                                 |
| B Consent gate              | **TESTED**   | FATE exact-string; extensive consent tests                                                |
| C Mission preview           | **TESTED**   | `executes: false`; bounded diagnostic gating in `mission.js`                              |
| D Receipt read path         | **TESTED**   | Receipt store list/read; fixture ARTIFACT-011 in tests                                    |
| D Receipt mint              | **UPSTREAM** | Governed Node0 / gateway; Dema read-only                                                  |
| E CLI surface               | **SHIPPED**  | Commands wired in `apps/cli/src/index.js`                                                 |
| F Claim boundary            | **SHIPPED**  | README + monetize guard + forbidden list                                                  |
| Engineering tests           | **TESTED**   | 4152+ tests pass; `npm run check` green                                                   |
| ARTIFACT-011 Dema preflight | **SHIPPED**  | `npm run artifact-011:preflight`; release-gated in check                                  |
| ARTIFACT-011 operator close | **OPEN**     | Layer A5 in activation roadmap not MEASURED on fresh path                                 |
| Learning entry witness      | **OPEN**     | HOW-1A kernel exists; post-receipt CLI loop not closed                                    |
| Release evidence template   | **SHIPPED**  | `docs/evidence/ARTIFACT-011_FIRST_BOUNDED_DIAGNOSTIC_RECEIPT.md` (PREPARED; not MEASURED) |

**Hard release gate:** ARTIFACT-011 with `truth_label: MEASURED` on disk (upstream governed Node0) + learning entry + completed evidence markdown.

---

## Appendix B — One-sentence definition

**BIZRA Node0 + Dema aims to become a sovereign, local-first, consent-bound achievement engine that helps one human convert intention into verified impact through proof receipts, ethical reasoning, and continuous self-improving execution.**
