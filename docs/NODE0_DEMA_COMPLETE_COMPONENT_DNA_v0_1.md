# Node0 + Dema Complete Component DNA v0.1

> "The first seed does not contain the whole forest. It contains the DNA that makes the forest possible."

## 1. Purpose

The purpose of this document is to define the complete Node0 + Dema component DNA without claiming that every future capability is already implemented.

This file is the canonical registry for what belongs in the first seed, what is required to reach MVP, what must wait until a pilot exists, what belongs to the future forest, and what must remain quarantined inside research notes until it has earned exit.

When a contributor or connected LLM is uncertain whether a feature belongs in Node0, Dema, URP, UKE, pilot, or future forest, they consult this document **before** proposing implementation.

## 2. Operating Law

```text
PAT may discover.
SAT must govern.
UKE may remember.
URP may share.
Dema may show.
The human must consent.
Receipts must prove.
```

```text
Minimum resources make a node alive.
Shared resources make the forest stronger.
Proof-of-Impact decides what value deserves reward.
Consent decides what may leave the node.
Receipts decide what can be trusted.
```

```text
Game feeling belongs at the interface layer.
Formal proof belongs at the mutation layer.
Receipts belong at the truth layer.
```

These three blocks bind every layer below. A component may not be promoted past its labeled status until the operating law for its layer is satisfied by receipts, not by narrative.

## 3. Status Labels

Every component is labeled with exactly one of:

| Label                 | Meaning                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| `ACTIVE`              | Shipped, exercised on disk today, covered by tests and receipts.               |
| `MVP_REQUIRED`        | Must exist (even as a static or read-only artifact) before first public look.  |
| `PILOT_REQUIRED`      | Must exist before a private pilot operator can run a real session.             |
| `FUTURE_FOREST`       | Belongs to a later node generation; out of scope for first seed.               |
| `RESEARCH_QUARANTINE` | Documented in research, must not leak into public surface or runtime.          |
| `DESIGNED_NOT_LIVE`   | Spec or ADR exists, no runtime; safe to reference, forbidden to claim as live. |

`ACTIVE` is the only label that authorizes user-facing language like "this works today." Every other label requires explicit qualification.

## 4. Component DNA Table

| Layer                    | Component                                                 | Purpose                                                | Current status        | Proof boundary                                                          | Forbidden overclaim                                    |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------ | --------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| Root Canon               | Three founding files (themassage.pdf, البذرة, Third Fact) | Doctrinal source bound to Bitcoin merkle anchor        | `ACTIVE`              | Proof-of-priority pin + Bitcoin block 948027/8/9                        | Treating later docs as superseding root canon          |
| Human Sovereignty        | Exact-string consent, operator-grounding gate             | Human is the only legal mutator                        | `ACTIVE`              | ADR-005, consent receipts                                               | Implying consent can be inferred from behavior         |
| Node0 Homebase           | Homebase TUI, local state under `~/.dema`                 | Hardware-aware operator surface                        | `ACTIVE`              | TUI surfaces + Node0 awakening receipt                                  | Claiming federation or multi-node from a single node   |
| Dema Product Face        | dema CLI, public README, status/mission/receipt views     | One face for the human                                 | `ACTIVE`              | dema commands + first-run wizard evidence                               | Pretending Dema is the whole BIZRA system              |
| PAT-7                    | Seven Personal Agents (local intelligence)                | Discover, draft, propose                               | `DESIGNED_NOT_LIVE`   | Topology canon + PAT/SAT bridge spec                                    | Claiming PAT actions without SAT/receipt cover         |
| SAT-5                    | Five Sovereign Agents (governance)                        | Verify, gate, refuse                                   | `DESIGNED_NOT_LIVE`   | SAT verifier sibling spec                                               | Naming SAT as authority before verifier runtime ships  |
| FATE / EffectCap         | Capability-based effect boundary                          | Bound side effects to typed capability                 | `DESIGNED_NOT_LIVE`   | EffectCap invariant working artifact                                    | Asserting boundary enforcement without runtime         |
| EvidenceChain / Receipts | Hash-chained receipts, proof-forge                        | The truth substrate of the node                        | `ACTIVE`              | Local receipt chain + proof-forge IRONCLAD seals                        | Treating absence of receipt as absence of risk         |
| UKE House of Wisdom      | Cross-node knowledge fabric                               | Long-memory of the forest                              | `DESIGNED_NOT_LIVE`   | Spec only; no runtime fabric                                            | Naming UKE as a live store                             |
| URP Soil                 | Shared resource / agent-as-a-service substrate            | One shared substrate across nodes                      | `DESIGNED_NOT_LIVE`   | Topology canon; no public URP                                           | Claiming a live public URP                             |
| Proof-of-Impact          | Outcome-bound reward signal                               | Decides what value deserves reward                     | `DESIGNED_NOT_LIVE`   | Spec dependency on UKE/URP                                              | Implying any reward is guaranteed                      |
| Dual Token Economy       | Stable utility token + earned reputation token            | Economic accounting layer                              | `RESEARCH_QUARANTINE` | Research notes only                                                     | Any public token claim, value claim, or yield language |
| MMORPG Experience        | Game-feel interface for collaborative work                | Engagement surface for the forest                      | `FUTURE_FOREST`       | None until interface canon exists                                       | Building hype assets before proof exists               |
| Visual Emulator          | Static or simulated visual of node + forest behavior      | Lets a viewer see system intent without a live network | `PILOT_REQUIRED`      | Static prototype or sandboxed sim                                       | Showing emulator output as measured live data          |
| DevOps / Quality         | Test gates, receipt gates, llm-guidance gate              | The gates that keep doctrine load-bearing              | `ACTIVE`              | `npm test`, `npm run check`, `npm run llm:guidance`, `git diff --check` | Skipping gates with `--no-verify`                      |
| Public Face / GTM        | README, Lighthouse Invitation, Claim Register             | The first contact surface with humans                  | `PILOT_REQUIRED`      | Lighthouse doc + claim register                                         | Marketing claims that outrun proof labels              |

Read this table top-to-bottom whenever a proposal touches any of these components. If your proposal contradicts a row, fix the proposal, not the row.

## 5. Root Canon Layer

- **Status**: `ACTIVE`
- **Purpose**: Anchor every later artifact to the three founding files (`themassage.pdf`, `البذرة`, `BIZRA_Third_Fact_v0_1_FINAL.pdf`) via the proof-of-priority pin and Bitcoin block merkle anchor.
- **Proof boundary**: A change is only canonical if it is consistent with the founding files. Drift is fixed by editing the proposal, not the canon.
- **Forbidden overclaim**: Promoting a derivative doc above the founding files; treating later edits as authoritative when they conflict with the anchored root.

## 6. Human Sovereignty Layer

- **Status**: `ACTIVE`
- **Purpose**: The human is the only legal mutator. Every consequential action requires exact-string consent, recorded in a receipt.
- **Proof boundary**: ADR-005 (explicit consent). Operator-grounding gate. Receipts show who consented and when.
- **Forbidden overclaim**: Inferring consent from prior context, voice tone, or general "auto" mode; treating informal phrases as typed authorization.

## 7. Node0 Hardware / Homebase Layer

- **Status**: `ACTIVE`
- **Purpose**: Node0 is a single operator's machine plus the Dema software face. Homebase is the visible map of that machine's state.
- **Proof boundary**: TUI surfaces are read from disk, not invented. Local state stays under `DEMA_HOME` or `~/.dema`.
- **Forbidden overclaim**: Implying federation, multi-node coordination, or cross-machine sync from a single Node0.

## 8. Dema Product Face Layer

- **Status**: `ACTIVE`
- **Purpose**: Dema is the one product face a human sees. It shows local state, previews safe next steps, drafts consent, drafts missions, and reads receipts.
- **Proof boundary**: ADR-001 (Dema is one face). Dema does not own the runtime, the economy, or the network.
- **Forbidden overclaim**: Presenting Dema as the whole ecosystem; allowing Dema to claim it minted a runtime receipt that the governed runtime issued.

## 9. PAT-7 Local Intelligence Layer

- **Status**: `DESIGNED_NOT_LIVE`
- **Purpose**: Seven Personal Agents that discover, draft, propose — never finalize. PAT is the "may discover" half of the operating law.
- **Proof boundary**: Topology canon names PAT-7; PAT/SAT bridge spec covers the safe handoff. No PAT runtime ships in this seed.
- **Forbidden overclaim**: Letting PAT actions out without SAT verification and receipt cover; merging PAT-private memory into UKE/URP by default.

## 10. SAT-5 Governance Layer

- **Status**: `DESIGNED_NOT_LIVE`
- **Purpose**: Five Sovereign Agents that verify, gate, refuse. SAT is the "must govern" half of the operating law.
- **Proof boundary**: SAT verifier sibling spec. SAT presence is required at runtime before any PAT proposal becomes binding.
- **Forbidden overclaim**: Naming SAT as authority before its verifier runtime ships; treating "auto-mode" as SAT.

## 11. FATE / EffectCap Boundary Layer

- **Status**: `DESIGNED_NOT_LIVE`
- **Purpose**: Capability-based bounding of side effects. Code that wants to touch a resource must hold a typed capability for it.
- **Proof boundary**: EffectCap invariant working artifact. Pre-runtime invariant only.
- **Forbidden overclaim**: Asserting boundary enforcement without the runtime that checks it; calling something "safe" because its plan says so.

## 12. EvidenceChain / Receipt Layer

- **Status**: `ACTIVE`
- **Purpose**: The truth substrate. Every consequential event leaves a hash-chained receipt that future readers can verify without trusting the writer.
- **Proof boundary**: Local receipt chain (`~/.dema/receipts/`), proof-forge IRONCLAD seals, multi-session chain policy (ADR-007).
- **Forbidden overclaim**: Treating absence of receipt as absence of risk; minting on behalf of the governed runtime from Dema.

## 13. UKE House of Wisdom Layer

- **Status**: `DESIGNED_NOT_LIVE`
- **Purpose**: Long-memory of the forest. A shared, governed knowledge fabric that holds what survives across nodes and generations.
- **Proof boundary**: Spec only. No runtime fabric. Membership and write rules to be defined before any code.
- **Forbidden overclaim**: Naming UKE as a live store; routing PAT-private memory into UKE by default.

## 14. URP Soil Layer

- **Status**: `DESIGNED_NOT_LIVE`
- **Purpose**: One shared substrate where nodes contribute resources and consume agent-as-a-service capabilities under consent.
- **Proof boundary**: Topology canon names one shared URP. Public URP is gated behind pilot proof.
- **Forbidden overclaim**: Claiming a public URP exists; claiming AaaS marketplace activity before pilot evidence; implying URP membership confers economic right.

## 15. Proof-of-Impact Layer

- **Status**: `DESIGNED_NOT_LIVE`
- **Purpose**: Outcome-bound signal that decides what contributed value deserves reward.
- **Proof boundary**: Depends on UKE + URP being live. No reward emission until proof-of-impact can be verified by a receipt chain.
- **Forbidden overclaim**: Promising reward, guaranteed return, or any "yield" before live PoI.

## 16. Dual Token / Economy Layer

- **Status**: `RESEARCH_QUARANTINE`
- **Purpose**: Eventual accounting layer — a stable utility token paired with an earned reputation token. Both bound to PoI receipts.
- **Proof boundary**: Research notes only. No deployment, no market, no public discussion of value.
- **Forbidden overclaim**: Any token claim of any kind on public surfaces; any phrase implying investment return, passive income, or guaranteed reward (see GTM forbidden list).

## 17. MMORPG Experience Layer

- **Status**: `FUTURE_FOREST`
- **Purpose**: Game-feel collaborative work surface. Belongs at the interface layer per the operating law.
- **Proof boundary**: None until interface canon exists. Receipts and SAT rule the mutation layer regardless of UI feel.
- **Forbidden overclaim**: Building hype assets before underlying proof exists; letting game feel imply economic right or guaranteed outcome.

## 18. Visual Emulator Layer

- **Status**: `PILOT_REQUIRED`
- **Purpose**: A static or sandboxed simulation that lets a viewer see node + forest behavior without a live network — for explanation, not for claim.
- **Proof boundary**: Output must be labeled as scenario, not measurement. No live data flow into the emulator.
- **Forbidden overclaim**: Showing emulator output as measured live network behavior; using emulator screenshots as "proof".

## 19. DevOps / Quality Layer

- **Status**: `ACTIVE`
- **Purpose**: The gates that keep doctrine load-bearing. If a gate is bypassed, the doctrine is no longer protected by mechanism.
- **Proof boundary**: `npm test`, `npm run check`, `npm run llm:guidance`, `git diff --check`, and release-readiness checks. Receipts are minted only when gates green.
- **Forbidden overclaim**: Skipping gates with `--no-verify`; declaring complete when a guidance check still fails.

## 20. Public Face / GTM Layer

- **Status**: `PILOT_REQUIRED`
- **Purpose**: First contact surface with humans. README, Lighthouse Invitation, Claim Register, and the first-run wizard.
- **Proof boundary**: Lighthouse doc + claim register + GTM forbidden-claims list. Every claim has a matching proof label below it.
- **Forbidden overclaim**: Marketing language that outruns the proof label of the underlying component; using `FUTURE_FOREST` features as `ACTIVE` selling points.

## 21. MVP Cut Line

Required before first public look (everything below is `MVP_REQUIRED` unless already `ACTIVE`):

- Root-source docs reachable from `docs/INDEX.md`.
- Three-Repo Canon discoverability — visible in INDEX and LLM_SYSTEM_FLOW read order.
- Node0 Founder Proof — the operator's own node telling its own story with receipts.
- Dema README / public product face.
- Dema status / mission / receipt story working end-to-end on a fresh install.
- Consent boundary explanation in the README and the first-run wizard.
- PAT / SAT / UKE / URP loop diagram — static, labeled with status per layer.
- Visual Emulator spec or static prototype (no live network).
- Lighthouse Invitation document.
- Claim Register pairing every public claim with its proof label.

## 22. Pilot Cut Line

Not required before first public look. Required before a private pilot operator can run a real session:

- Visual Emulator at static-prototype quality.
- Public Face / GTM at `PILOT_REQUIRED` quality, including Lighthouse Invitation and Claim Register.
- Documented PAT-7 / SAT-5 handoff narrative that a pilot operator can follow even though the runtime is `DESIGNED_NOT_LIVE`.
- Receipt chain that survives the pilot's first session unbroken.

## 23. Future Forest Cut Line

Out of scope for the first seed and the first pilot. Must not appear in public claims before its layer reaches at least `PILOT_REQUIRED`:

- Live token.
- Live public URP.
- Real AaaS marketplace.
- Full UKE runtime.
- 1M-node proof.
- Autonomous outreach.
- Full MMORPG economy.

A `FUTURE_FOREST` row in the table may be referenced in vision language only when paired with its label and with no implication of imminence.

## 24. Forbidden Shortcuts

- Do not claim public URP is live before pilot proof.
- Do not claim token value, guaranteed rewards, or investment return.
- Do not claim Sharia certification before expert review.
- Do not let private PAT memory enter UKE/URP by default.
- Do not treat scenario outputs as measured facts.
- Do not collapse Dema, Data Lake/Omega, and Node0 Genesis into one authority surface.
- Do not build visual/GTM hype before proof labels exist.

A shortcut at any layer breaks the layer above it. The cost of a shortcut is paid by the next contributor who has to redo the proof.

## 25. Next Canon Dependencies

This doc points forward to, and depends on, the following canon work:

- `docs/THREE_REPO_PRODUCT_STACK_CANON_v0_1.md` — repo-boundary doctrine that frames where Dema sits inside the three-repo stack.
- `docs/canon/BIZRA_TOPOLOGY_CANON.md` — topology authority for PAT-7, SAT-5, one shared URP, and membrane language.
- `docs/06-adr/ADR-001-dema-is-one-face.md` — Dema is one face.
- `docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md` — exact-string consent law.
- `docs/02-architecture/pat-builder-sat-validator.md` — PAT/SAT bridge.
- `docs/02-architecture/sat-verifier-sibling-spec.md` — SAT verifier sibling spec.
- `docs/02-architecture/node0-urp-ecosystem-transition.md` — internal Node0 → shared URP transition; docs-only.
- `docs/LIGHTHOUSE.md` — private lighthouse operator lane.

When any of these change, this doc is reviewed for drift. When this doc changes, the linked canon is reviewed for drift. The Component DNA Table in Section 4 is the load-bearing surface; the per-layer sections explain it; the cut lines bind release behavior to the labels.
