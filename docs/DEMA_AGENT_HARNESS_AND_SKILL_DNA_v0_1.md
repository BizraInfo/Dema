# Dema Agent Harness and Skill DNA v0.1

> "Prompting is not enough. A BIZRA agent becomes trustworthy only when the model is surrounded by canon, consent, deterministic checks, trace verification, and receipts."

## 1. Purpose

This document is the **acting-side** sibling to `BIZRA_AGENT_DNA_LAW_OF_ASSUMPTION_v0_1.md`. The Law of Assumption governs how a BIZRA agent **thinks** under uncertainty. This document governs how a BIZRA agent **acts** under control.

Together they form the complete agent DNA:

```text
Law of Assumption     →  think humbly
Harness & Skill DNA   →  act verifiably
```

The doc exists because LLM prompting alone — no matter how clever — cannot produce a trustworthy agent. Trustworthy agency requires a **deterministic harness** that surrounds the model with canon binding, micro-consent, tool traces, deterministic verification, hash-chained receipts, and self-critique. The model contributes reasoning and skill knowledge; the harness contributes everything else.

The doc is doctrine, not implementation. Runtime enforcement is deferred to future PAT-7 / SAT-5 slices. The canon binds now.

## 2. Truth Label

```text
DECLARED_DEMA_AGENT_HARNESS_AND_SKILL_DNA_v0_1
```

This label means the harness law, the skill law, the 10-step agent loop, the six runtime boundaries, the implementation laws, the 10-field required runtime pattern, the failure modes, the forbidden behaviors, and the example workflows are declared and consistent with the twelve-pillar canon as of 2026-05-21. No runtime is shipped by this slice. Promotion past `DECLARED` requires actual implementation under PAT-7 / SAT-5 in a future slice.

## 3. Source Canon Dependencies

Inherits **only** from the twelve pillars already merged to `main`:

| #    | Pillar                                                                                           | Why this doc cites it                                                                                |
| ---- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 1    | `THREE_REPO_PRODUCT_STACK_CANON_v0_1.md`                                                         | Repo authority; harness lives in Dema                                                                |
| 2    | `NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md`                                                      | Agent layers (PAT-7, SAT-5, FATE/EffectCap, receipt chain) — future home of the harness              |
| 3    | `DELIVERY_SPINE_v0_1.md`                                                                         | Release gates that the harness ultimately reports to                                                 |
| 4    | `CLAIM_REGISTER_v0_1.md`                                                                         | Truth taxonomy — every agent action carries its label                                                |
| 5    | `BIZRA_AGENT_DNA_LAW_OF_ASSUMPTION_v0_1.md`                                                      | Sibling doctrine — how the agent thinks                                                              |
| 6    | `BIZRA_ROOT_SOURCE_OF_TRUTH_v0_1.md`                                                             | Moral spine — `the human must consent`                                                               |
| 7-12 | Origin Video · Founder Proof · First Look · Production Brief · Evaluation Pack · Market Analysis | Inheritance surfaces — every agent action whose output touches these must obey their forbidden lists |

Plus the four architect-locked memory laws (`feedback_no_invented_evidence_source` · `feedback_incremental_evidence_binding` · `feedback_post_ramadan_2023_default_relevance` · `project_2026_05_21_home_base_consolidation_deferred_to_dema`) and the constitutional anchor `reference_bizra_constitutional_anchors` (Ihsān, ADL, ZANN_ZERO, RIBA_ZERO).

## 4. Harness Law

```text
The harness grounds the model in reality.
```

The **harness** is the **deterministic surrounding** of the model — the code-side that runs before, during, and after each LLM call to ensure the agent's behavior matches BIZRA canon. The harness is not an LLM. The harness is regular code (or future PAT-7 / SAT-5 deterministic primitives).

Mandatory harness components for every Dema agent invocation:

1. **Canon binding** — the harness loads the relevant canon docs (per `LLM_SYSTEM_FLOW.md`) and injects them as context. Skipping canon load is a defect.
2. **Intent capture** — the harness records the operator's intent verbatim as the first row of the run record.
3. **Claim-boundary check** — the harness scans intent + model output against `CLAIM_REGISTER §10` forbidden claims and `Production Brief §15-16` forbidden visuals/wording.
4. **Micro-consent gate** — the harness pauses for exact-string operator consent before any action with side effects.
5. **Tool action execution** — the harness invokes tools (file write, network call, mint, etc.) — not the model directly.
6. **Trace capture** — every tool input + tool output is captured verbatim.
7. **Deterministic verification** — the harness re-runs deterministic checks (gates, hash matches, schema validation) against the actual tool traces, not against the model's claims about them.
8. **Receipt minting** — the harness hash-chains the run into the operator's local receipt ledger.
9. **Self-critique** — the harness invokes the model again with the trace + verification result + receipt and asks the model to detect any drift.
10. **Halt-gate enforcement** — the harness refuses to proceed past any hard-stop gate without typed operator authorization.

A BIZRA agent without all ten harness components is not a BIZRA agent. It is a chat interface to an LLM.

## 5. Skill Law

```text
The skill gives the model product/canon knowledge.
```

The **skill** is the **content** the model uses when reasoning — the canon-bound facts, the truth labels, the forbidden phrases, the worked examples, the per-domain wording. Skills live in markdown files (typically under `docs/`, `~/.claude/skills/`, or `~/.dema/skills/` per the operator's environment). The model reads skills; the model does not invent them.

Mandatory properties of every BIZRA skill:

- **Sourced** — every claim in the skill traces to a canon row.
- **Truth-labeled** — every claim carries its `VERIFIED` / `DERIVED` / `OPERATOR_ATTESTED` / `SOURCE_PENDING` / `DESIGNED_NOT_LIVE` / `FORBIDDEN` / `EXTERNAL_SOURCE_REQUIRED` label.
- **Forbidden-list aware** — every skill names the forbidden claims it must refuse to produce.
- **Eval-tested** — every skill has at least one adversarial test case (a prompt designed to bait the skill into producing a forbidden claim) that the skill correctly refuses.
- **Re-readable** — when canon changes, the skill is re-read for drift.
- **Local-first** — skills live as files on the operator's machine; not as opaque cloud configuration.
- **Auditable** — a third party can read the skill markdown and see exactly what the agent is told.

A BIZRA skill is **not**: a system prompt only; a model fine-tune; a cloud-hosted configuration the operator cannot inspect.

## 6. Why Prompting Is Not Enough

LLM prompts default to **fluent confidence**. A model asked to produce a BIZRA claim, even with the Law of Assumption in its system prompt, will eventually:

- Skip the `UNKNOWN` field when the answer feels obvious.
- Confidently assert an `OPERATOR_ATTESTED` figure as `VERIFIED` because the unlabeled number reads more smoothly.
- Produce a forbidden phrase (token-buy CTA, "world's first", Sharia-certified) when the surrounding text builds toward it.
- Hallucinate a citation when no real one is available.
- Claim success without checking the tool trace.
- Skip a halt-gate when prior consent feels sufficient.

Each failure mode is **predictable** at scale. The model is not malicious; the model is statistical, and statistical drift accumulates.

The harness exists to make the failure modes **structurally impossible**:

- The harness loads canon; the model cannot forget it.
- The harness gates consent; the model cannot bypass it.
- The harness verifies against traces; the model's claim of success is not the success criterion.
- The harness mints receipts; the model cannot retroactively deny what happened.
- The harness invokes self-critique with the actual trace; the model is forced to see its own output as data, not as identity.

```text
Do not prompt harder when deterministic harness logic is required.
```

This is the central implementation law of this doctrine.

## 7. Dema Agent Loop

Every Dema agent invocation follows this exact 10-step loop:

```text
intent → claim boundary → skill selection → micro-consent → tool action → trace capture → deterministic verification → receipt → self-critique → next step
```

Sequential. Non-skippable. The harness enforces ordering; the model fills the cognitive steps; both record evidence.

**Step-by-step:**

1. **Intent** — the operator's natural-language request is captured verbatim. The harness records `intent_text` + `intent_timestamp` + `operator_context`.
2. **Claim boundary** — the harness scans intent for inferred truth-label requirements (does this intent imply a `VERIFIED` claim? a `SCENARIO` projection? a forbidden phrase?). The agent labels the intent's expected output before reasoning begins.
3. **Skill selection** — the model selects the appropriate skill(s) from the local skill catalog based on intent + claim boundary. The skill catalog is itself canon (per §8 below). Selection is logged.
4. **Micro-consent** — the harness presents the planned actions to the operator and requires exact-string consent before proceeding (per ADR-005). No consent → halt.
5. **Tool action** — the harness invokes the actual tool (file write, gate run, receipt mint, external API). The model **does not** execute tools directly; the model **declares** the tool call; the harness **runs** it.
6. **Trace capture** — every tool input + tool output is captured into the run record. Truncation is allowed for large outputs only if a hash of the full output is preserved.
7. **Deterministic verification** — the harness runs deterministic checks against the actual trace. Examples: re-compute a hash that the agent claimed; re-read a file the agent claimed to write; re-execute a test the agent claimed passed.
8. **Receipt** — the harness mints a hash-chained receipt linking intent → consent → action → trace → verification result. The receipt is appended to the operator's local receipt ledger (`~/.dema/receipts/`).
9. **Self-critique** — the model is re-invoked with the full run record (intent + plan + trace + verification + receipt) and asked: _"What went wrong? What did you not check? What would a reviewer flag?"_ The model's critique is logged; if the model surfaces a defect, the loop restarts.
10. **Next step** — the agent proposes the next action (or completion) based on the verified state, not on the model's narration of the state.

A run that skips any step is a defect. A run that completes all 10 steps with their receipts is a **trustworthy run**, regardless of how impressive (or unimpressive) the model's intermediate reasoning was.

## 8. Skill Selection Model

Skills are not invoked by intuition. The harness selects skills deterministically based on:

- **Intent surface** — the noun in the intent ("draft Canva slide", "review PR", "verify Drive metadata") maps to a skill family.
- **Claim boundary** — the expected truth label of the output narrows the skill subset (e.g., a `VERIFIED` output requires skills that include evidence-citation patterns).
- **Forbidden boundary** — the skill must include the forbidden-list for that asset family (e.g., a Canva-draft skill must include `Production Brief §15-16` forbidden visuals/wording).
- **Per-domain locality** — frontend skills activate in frontend contexts; security skills in security contexts; canon skills in canon-doc contexts.

The skill catalog is auditable: a single command (future `dema skills list` or equivalent) shows the operator every skill the agent might invoke + the canon row each skill is grounded in.

Skill conflicts (two skills both apply to the intent) are resolved by:

1. The more specific skill wins over the more general one.
2. The skill with the stricter forbidden-list wins.
3. The skill with more recent canon-citation freshness wins.
4. If still tied, the harness asks the operator to choose.

Never: pick by model confidence; pick by model preference; pick implicitly.

## 9. Must-Not-Miss Safety Rules

Safety belongs in the **primary** skill/harness path, not in an optional reference. The following must be enforced for every invocation, not consulted as backup:

| Safety rule                                                                | Where enforced                                            | Failure mode if missed                           |
| -------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| Forbidden claims (`CLAIM_REGISTER §10`)                                    | claim-boundary step (§7.2) + post-output scan             | Public surface ships forbidden phrase            |
| Forbidden visuals/wording (`Production Brief §15-16`)                      | claim-boundary + skill selection                          | Asset metadata is incomplete or claim escapes    |
| Hard-stop gates (`LLM_SYSTEM_FLOW Hard stop gates`)                        | harness refuses tool invocation                           | Unauthorized push / mint / federation activation |
| Exact-string consent (ADR-005)                                             | micro-consent step (§7.4)                                 | Operator bypassed; action without consent        |
| No hidden daemon (ADR-002)                                                 | harness scans for background processes before tool action | Unauthorized persistent state                    |
| Local-only state (`~/.dema` / `DEMA_HOME`, ADR-004)                        | tool-action step + verification step                      | State leak outside operator's machine            |
| No founder-allocation token mint                                           | claim-boundary + Production Brief §15                     | Economic activation defect                       |
| No Sharia-certified claim without expert review                            | claim-boundary                                            | Religious-authority overclaim                    |
| No invented evidence (memory canon `feedback_no_invented_evidence_source`) | self-critique step + skill discipline                     | Convenience witness ships                        |
| No mid-output uncertainty-hiding (Law of Assumption §15)                   | self-critique step                                        | False certainty surfaces in publishable output   |

Every must-not-miss rule has both a **primary enforcement point** in the harness AND a **secondary check** in self-critique. If only one of the two would catch the failure, the rule is mis-placed.

## 10. Micro-Consent Boundary

**Micro-consent** means consent at the granularity of the specific action, with the specific consequence, with the exact-string the operator types.

- Not "Are you sure?" — that is a yes/no theater.
- Not "Type CONFIRM" — that is generic and quickly habituated.
- Yes "Type the exact phrase: `GO push branch <name> to origin/<name>`" — that is action-bound and non-habituatable. (The operator-canonical `GO` consent pattern in this repo is the live example; the harness records the verbatim string.)

Micro-consent properties:

- **Action-specific** — the consent string names the exact action.
- **Consequence-explicit** — the consequence is in the string (push, mint, post, write).
- **Per-invocation** — consent granted for action X does not transfer to action Y.
- **Time-bounded** — consent expires at the end of the run record; the next session re-requests.
- **Logged verbatim** — the exact string the operator typed is captured into the receipt.
- **Refusal-handled** — anything other than the exact string is a refusal; the harness halts without retry-prompting the operator (no consent-pressure).

A consent flow that asks "Are you sure?" three times until the operator clicks Yes is not micro-consent. It is consent erosion.

## 11. Tool Action Boundary

The harness executes tools. The model **declares** the tool call. The harness **runs** it.

Why this separation matters:

- The model can hallucinate a tool call that doesn't exist; the harness rejects the unknown tool.
- The model can pass malformed arguments; the harness validates the schema before invocation.
- The model can claim a tool succeeded when the harness can see it failed; the verification step catches this.
- The model can claim a tool was idempotent when it had side effects; the trace shows the truth.
- The model is replaceable (Opus → Sonnet → Haiku → local LLM → tiny LLM); the harness is the stable interface.

Tool action requirements:

- **Allow-list** — the harness has a deterministic list of approved tools per skill. A tool not on the list cannot be invoked even if the model names it.
- **Schema validation** — every tool's arguments are JSON-schema-validated before invocation. Malformed → refusal + error capture.
- **Side-effect declaration** — every tool declares its side effects (file write, network call, irreversible mutation). The harness routes side-effect tools through micro-consent.
- **Sandboxed when possible** — read-only tools run unconditionally; write tools through consent; network tools through allow-listed destinations only.
- **Receipt-bound** — every tool invocation produces a receipt line (input hash + output hash + timestamp + tool identity).

Examples of correct routing:

- `Read` (read-only) → unconditional run.
- `Edit` (file write) → consent + verification (re-read the file; confirm the edit matches the diff).
- `Bash` (arbitrary execution) → consent + allow-list of safe command patterns; deny-list of dangerous patterns; trace + verification.
- `gh pr merge` (irreversible external mutation) → halt gate; explicit typed authorization with the PR number named.

## 12. Trace Capture Boundary

Tool traces are evidence. Specifically:

- The full input passed to a tool is captured (or, if too large, the input's sha256 is captured + a stored input artifact).
- The full output returned from a tool is captured (or its sha256 + artifact).
- The tool's exit code / status is captured.
- The duration is captured.
- Any error / stderr is captured verbatim.

Trace capture is not a debug feature. It is the substrate that deterministic verification (§13) runs against. Without trace capture, verification cannot bind to reality; the agent's claim of success becomes the only signal, which violates the harness law (§4).

Trace storage:

- **Append-only** — traces never edit; they accumulate.
- **Hash-chained** — each trace line links to the prior via sha256, so tampering is detectable.
- **Operator-local** — traces live under `~/.dema/traces/` or equivalent; not in a third-party cloud.
- **Bounded** — the harness may rotate / archive traces older than a configurable threshold, but never silently delete; archival is itself a trace event.

A run record without traces is incomplete; a run record with traces but no verification (§13) is unverified; a run record with both is a candidate for receipt minting.

## 13. Deterministic Verification Boundary

```text
Tool traces are evidence.
Claims of success must be verified against traces.
```

Deterministic verification is the harness re-running the check the agent claims succeeded, without trusting the agent's narration.

Examples:

- Agent claims "the file was written" → harness re-reads the file and computes its hash; compares to the expected.
- Agent claims "the test passed" → harness re-runs the test; checks exit code; checks expected output substring.
- Agent claims "the gate is green" → harness re-runs the gate; reads its output; matches against expected schema.
- Agent claims "the receipt was minted" → harness reads the receipt file; verifies the hash chain; confirms the new entry.
- Agent claims "the commit landed" → harness runs `git log -1`; matches the SHA; confirms the commit message.

When deterministic verification fails:

- The harness does **not** trust the agent's claim of success.
- The harness records the divergence (claim vs reality) as a verification-failure receipt.
- The harness invokes self-critique with the divergence as input.
- The agent is required to surface the failure in its final output, not to paper over it.

Verification is not skippable, even when "the agent surely got it right." If the agent surely got it right, verification confirms cheaply. If the agent silently got it wrong, verification is the only line of defense.

## 14. Receipt Boundary

Every consequential action (intent → consent → tool action → trace → verification result) is hash-chained into a receipt and appended to the operator's local receipt ledger.

Receipt structure (`bizra.dema.agent_run_receipt.v0.1` schema):

```yaml
agent_run_receipt:
  schema: bizra.dema.agent_run_receipt.v0.1
  run_id: # uuid
  parent_receipt_sha: # hash of prior receipt (chain link)
  timestamp: # UTC ISO 8601
  operator: # operator id
  intent_text: # verbatim
  claim_boundary: # expected truth labels
  selected_skills: # list
  micro_consent:
    consent_string: # verbatim what operator typed
    consent_timestamp:
  tool_actions: # list of {tool, args_hash, output_hash, status, duration_ms}
  traces_path: # pointer to detailed trace file
  deterministic_verification: # list of {check_name, expected, actual, pass}
  self_critique_summary: # short
  next_step: # the agent's proposed next step
  receipt_sha: # sha256 of this whole receipt (excluding this field)
```

Receipt properties:

- **Append-only** — receipts never edit; corrections ship as new receipts.
- **Hash-chained** — `parent_receipt_sha` makes the chain tamper-evident.
- **Operator-local** — receipts live under `~/.dema/receipts/`; never auto-uploaded.
- **Reproducible verification** — a third party with the receipt file + the local state can re-verify every claim row in the receipt.
- **Receipt-driven release** — `DELIVERY_SPINE §24` Release Receipt is the higher-level form of this same pattern; agent run receipts roll up into release receipts when actions are release-scoped.

A run without a receipt is unwitnessed. A receipt without a hash chain is forgeable. Both fail the harness law.

## 15. Self-Critique Boundary

Self-critique is the model's re-invocation after a run, given the run record + the trace + the verification result, with the explicit goal of detecting its own drift.

Self-critique prompt template (the harness uses something like this):

> "Here is the intent, the plan you produced, the tool actions taken, the traces captured, and the verification result. Answer in the Law of Assumption Required Output Pattern:
> KNOWN: what is verifiably done.
> INFERRED: what follows from the trace.
> ASSUMED-WITH-IHSAN: what you assumed but did not verify.
> UNKNOWN: what gaps remain.
> BOUNDARY: what this run does not cover.
> NEXT EVIDENCE NEEDED: what would harden this further.
> Additionally, name three ways a reviewer would attack this run, and one defect you would flag in your own work if you were the reviewer."

Self-critique requirements:

- **Mandatory** — every non-trivial run includes a self-critique step.
- **Sees the trace, not just the claim** — the model critiques against actual evidence, not its own narration.
- **Output-shaped per Law of Assumption** — the 6-field output pattern is mandatory; the model cannot revert to fluent prose.
- **Reviewer-flagged defects are first-class** — if the self-critique surfaces a defect, the run is marked `partially-successful with named drift`, never `successful`.
- **The model is not graded on producing zero defects** — the model is graded on **honest disclosure** of any defects found.

A self-critique that produces "everything went fine" without specifically naming what was verified vs assumed is a Law of Assumption violation and a harness defect.

## 16. Local / Tiny Model Role

Not every step of the agent loop needs Opus 4.7 1M (or its equivalent). Many steps are deterministic enough that **a local or tiny LLM is the correct choice**.

Disposition by step:

| Loop step                       | Default model class                             | Reason                                                      |
| ------------------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| §7.1 Intent capture             | n/a (no model — just record)                    | Deterministic capture                                       |
| §7.2 Claim boundary             | small / local                                   | Classification task; bounded label set                      |
| §7.3 Skill selection            | small / local                                   | Catalog lookup + classification                             |
| §7.4 Micro-consent              | n/a (no model — harness gates the operator)     | No reasoning required                                       |
| §7.5 Tool action                | n/a (harness runs the tool)                     | Deterministic execution                                     |
| §7.6 Trace capture              | n/a (harness captures)                          | Deterministic capture                                       |
| §7.7 Deterministic verification | n/a (deterministic code)                        | By definition not model-driven                              |
| §7.8 Receipt mint               | n/a (harness mints)                             | Deterministic hashing                                       |
| §7.9 Self-critique              | the active full-model                           | Requires the same reasoning capacity that produced the work |
| §7.10 Next step                 | small / local for routine; full-model for novel | Adaptive                                                    |

```text
Local/tiny models should handle narrow deterministic tasks where possible.
```

Architectural rationale:

- **Cost discipline** — Opus-class invocations on classification tasks waste tokens that the operator's weekly cap can't afford (per `reference_token_discipline_playbook` memory).
- **Latency discipline** — local models respond in <100ms for short prompts; full-model network round-trips are 1–5 seconds.
- **Sovereignty** — local models keep state and reasoning on the operator's machine; aligns with ADR-002 (no hidden daemon) and ADR-004 (local-first memory).
- **Resilience** — when the network is unavailable, the routine steps still work.
- **Cross-model consistency** — when the same skill produces consistent outputs across local-tiny and full-model invocations, the skill is well-formed; when outputs diverge sharply, the skill needs eval-tightening.

The harness routes per step based on a configurable model-routing table. Default: small/local for classification + routing; full-model for reasoning + self-critique; deterministic code for everything else.

## 17. Skill Evaluation Requirements

```text
Skills and docs must be eval-tested like code.
```

Every BIZRA skill ships with an eval pack. The eval pack contains:

- **Positive cases** — intents that should activate this skill, with the expected output structure.
- **Adversarial cases** — intents designed to bait the skill into producing a forbidden claim or skipping a required step. The skill must refuse / handle these correctly.
- **Drift cases** — intents that are subtly off-canon (e.g., a `VERIFIED` claim where the underlying canon row is `OPERATOR_ATTESTED`). The skill must downgrade the label, not paper over.
- **Boundary cases** — intents at the edge of the skill's scope. The skill must defer to the operator or to a sibling skill, not over-claim.

Skill eval cadence:

- **At skill creation** — initial eval pack written; ≥5 cases.
- **On canon change** — any change to a citation source triggers re-eval of dependent skills.
- **On regression** — when a skill produces a wrong output in operation, that case is added to the eval pack permanently.
- **Cross-model** — at least once per quarter (or on model change), the skill is run against multiple model classes to detect cross-model drift.

A skill without an eval pack is `DESIGNED_NOT_LIVE` for production agent use, regardless of how good its prose reads.

## 18. Harness Evaluation Requirements

The harness itself is testable, and must be tested:

- **Step ordering tests** — the harness enforces §7's 10-step order; missing or out-of-order steps fail the test.
- **Consent-bypass tests** — adversarial inputs designed to skip micro-consent; harness must refuse.
- **Trace-tamper tests** — adversarial inputs designed to forge a trace; harness must detect.
- **Verification-skip tests** — adversarial inputs that claim success without trace; harness must mark unverified.
- **Receipt-chain tests** — break the hash chain artificially; harness must detect.
- **Halt-gate tests** — adversarial inputs that approach a hard-stop gate; harness must refuse without prompting consent erosion.
- **Cross-model tests** — same intent through different model classes; harness must produce consistent receipt structure.

Harness eval pack is canon-bound: every test cites the canon rule it enforces.

## 19. Agent Failure Modes

Honest enumeration of how BIZRA agents fail. Each is closed by a specific section above.

| Failure mode                | What it looks like                                      | Closed by                                                      |
| --------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| Confidence-without-evidence | Model asserts a `SOURCE_PENDING` fact as `VERIFIED`     | Law of Assumption §15 + Harness §13 verification               |
| Consent erosion             | Model retries until operator clicks yes                 | Micro-consent §10 (no retry-prompting; exact string)           |
| Trace fabrication           | Model claims a tool succeeded that wasn't run           | Tool action §11 (harness runs, not model) + Trace §12          |
| Verification skipping       | Model claims success; harness doesn't re-check          | Deterministic verification §13 (mandatory)                     |
| Receipt drift               | Action happens; no receipt minted                       | Receipt §14 (append-only chain)                                |
| Self-critique theater       | "Everything went fine" without evidence                 | Self-critique §15 (Law of Assumption output pattern mandatory) |
| Skill drift                 | Skill carries outdated canon citation                   | Skill evaluation §17 (on-canon-change re-eval)                 |
| Harness silent failure      | Harness skips a step under load                         | Harness evaluation §18 (step-ordering tests)                   |
| Halt-gate bypass            | Hard-stop gate reached; agent proceeds                  | §9 Must-Not-Miss Safety + Harness Law §4.10                    |
| Over-routing to full model  | Every step pays Opus cost                               | Local/tiny model role §16 (route by step)                      |
| Cross-model divergence      | Same skill, different model, different output structure | Skill eval §17 cross-model + harness §18 cross-model           |
| Token-burn drift            | Long sessions accumulate context without pruning        | Token discipline canon + future harness cache-warmth checks    |

Every failure mode above has been observed in some agent system somewhere. The harness exists to make BIZRA agents resistant to _all of them, not just one or two_.

## 20. Forbidden Behaviors

The agent must **never**:

- Prompt-harder when a deterministic harness check is required (per §6).
- Skip any step of the agent loop (per §7).
- Execute a tool the harness has not allow-listed (per §11).
- Claim a tool succeeded without trace verification (per §13).
- Mint a receipt before deterministic verification completes (per §14).
- Produce a "self-critique" that lacks the Law of Assumption 6-field structure (per §15).
- Treat a small/local model's classification output as `VERIFIED` without verification — small models are routing aids, not authorities.
- Use micro-consent as a habituation surface ("CONFIRM" again and again).
- Hide consent erosion behind "the operator already agreed earlier."
- Treat any agent (PAT, SAT, future, current, the model producing this response) as infallible — per Law of Assumption §11 last item.
- Manufacture a defect to fix when the trace shows clean behavior — same operating-law clause as Law of Assumption §15.
- Skip self-critique when the operator's intent was simple — simplicity is the easiest place to drift.

Each forbidden behavior is a specific failure mode the law closes structurally.

## 21. Required Runtime Pattern

For any non-trivial agent invocation, the run record must contain (per §14's receipt schema, surfaced here as the human-readable runtime pattern):

```text
INTENT:
  <operator's verbatim request>

CLAIM BOUNDARY:
  <expected truth labels of the output>

SELECTED SKILL:
  <skill name(s) from the local catalog>

MICRO-CONSENT:
  <exact string operator typed>
  <consent timestamp>

TOOL ACTION:
  <tool name, args hash, output hash, status, duration>

TRACE:
  <pointer to detailed trace file + summary>

DETERMINISTIC VERIFICATION:
  <check name, expected, actual, pass/fail>

RECEIPT:
  <receipt SHA + parent SHA + ledger location>

SELF-CRITIQUE:
  <Law of Assumption 6-field output: KNOWN / INFERRED / ASSUMED-WITH-IHSAN / UNKNOWN / BOUNDARY / NEXT EVIDENCE NEEDED>

NEXT STEP:
  <verified next action>
```

The pattern is **sequential, binding, and mandatory**. A run record that omits any field has violated the Harness Law. A run record that completes all 10 fields with their evidence is a **trustworthy run**.

This pattern is the sibling of the Law of Assumption's 6-field Required Output Pattern (`Law of Assumption §16`). Together:

```text
Law of Assumption §16  →  the agent's THINKING template
Harness & Skill §21    →  the agent's ACTING template
```

A BIZRA agent that obeys both is operationally trustworthy.

## 22. Example Workflows

### 22.1 — Operator: "Run the test suite"

```text
INTENT:                  "Run the test suite"
CLAIM BOUNDARY:          output will be VERIFIED (pass/fail count) or DERIVED (status from exit code)
SELECTED SKILL:          test-runner skill (cites package.json, test directory canon)
MICRO-CONSENT:           none required (read-only test run); harness allows unconditional
TOOL ACTION:             Bash("npm test")
TRACE:                   stdout, stderr, exit code, duration captured
DETERMINISTIC VERIFICATION:  exit code = 0 AND last line matches "tests N pass / 0 fail"
RECEIPT:                 receipt minted with test count + duration
SELF-CRITIQUE:
  KNOWN: 4861/4861 tests passed in ~18s
  INFERRED: no production-code regression
  ASSUMED-WITH-IHSAN: none
  UNKNOWN: any flaky tests not surfaced by a single run
  BOUNDARY: this run does not verify integration or end-to-end behavior
  NEXT EVIDENCE NEEDED: multi-run for flakiness; CI parity check
NEXT STEP:               none (intent complete)
```

### 22.2 — Operator: "Commit the canon doc"

```text
INTENT:                  "Commit the canon doc"
CLAIM BOUNDARY:          output will be VERIFIED (commit SHA exists in git log)
SELECTED SKILL:          commit skill (cites Delivery Spine §10-12)
MICRO-CONSENT:           required (side-effect tool)
                         exact string: "Type 'commit and stage: docs/X.md' to authorize"
                         operator typed: "commit and stage: docs/X.md"
                         timestamp: 2026-05-21T10:00:00Z
TOOL ACTION:             Bash("git add docs/X.md && git commit -m '...'")
TRACE:                   stdout (commit SHA), stderr (empty), exit code 0
DETERMINISTIC VERIFICATION:  re-run `git log -1` → SHA matches; commit message matches
RECEIPT:                 receipt minted; chain links to prior receipt
SELF-CRITIQUE:
  KNOWN: commit aa406ff exists; message matches plan
  INFERRED: branch HEAD advanced by one commit
  ASSUMED-WITH-IHSAN: none
  UNKNOWN: whether the commit message convention will satisfy reviewer expectations
  BOUNDARY: this run does not push; push is a separate intent
  NEXT EVIDENCE NEEDED: reviewer feedback on message format
NEXT STEP:               await operator decision on push (separate intent)
```

### 22.3 — Operator: "Draft a Canva slide quoting the founder's 15k+ hours"

```text
INTENT:                  "Draft a Canva slide quoting the founder's 15k+ hours"
CLAIM BOUNDARY:          15k+ hours is OPERATOR_ATTESTED per FOUNDER_PROOF §14; cannot be cited as VERIFIED
SELECTED SKILL:          Canva-asset skill + Founder-proof claim-discipline skill
                         Forbidden phrases loaded from PRODUCTION_BRIEF §16 + CLAIM_REGISTER §10
MICRO-CONSENT:           harness halts BEFORE planning:
                         "15k+ hours is OPERATOR_ATTESTED, not VERIFIED.
                          Drafting an asset that asserts it as VERIFIED is a Production Brief §15 defect.
                          Acceptable rewordings:
                            a) '15,000+ hours (operator-attested)'
                            b) 'multi-year solo work; specific hours not yet verified'
                            c) drop the figure and use the verified 142 public repositories instead
                          Choose, or refine intent."
TOOL ACTION:              (no tool action — halted at consent boundary)
TRACE:                    (harness halt receipt only)
DETERMINISTIC VERIFICATION: harness confirms intent was halted; no asset drafted
RECEIPT:                  halt-receipt minted; reason: "claim boundary refuses unlabeled OPERATOR_ATTESTED in public asset"
SELF-CRITIQUE:
  KNOWN: intent halted at claim boundary; no defect produced
  INFERRED: operator's intent may have been one of (a), (b), or (c); awaiting choice
  ASSUMED-WITH-IHSAN: operator was acting in good faith (Ihsān per Law of Assumption §7)
  UNKNOWN: which rewording the operator prefers
  BOUNDARY: this halt does not assert the operator was wrong; it asserts the asset would be
  NEXT EVIDENCE NEEDED: operator's choice of rewording
NEXT STEP:                operator selects a rewording; re-intent
```

This third example is the most important: the harness **halted before any tool action** because the intent itself, if executed, would produce a Production Brief defect. The agent thought about the claim before drafting the asset — that is the entire purpose of the Harness & Skill DNA layer.

## 23. Non-Goals

This slice does **not**:

- ship a runtime that enforces the agent loop or the harness law,
- modify any agent's actual code (Dema CLI, current connected LLMs, future PAT/SAT),
- create a skill catalog file or a harness implementation,
- mint any receipt or run any agent invocation,
- write market or GTM material,
- create Canva or video assets (per Production Brief boundary),
- create any ADR (this is doctrine, not architectural decision),
- claim that current Dema CLI surfaces already enforce the full loop (they declare; they do not yet check all 10 steps),
- forbid agents from being concise — only forbid concision that hides verification skipping.

## 24. Future Implementation Path

The doctrine is v0.1. Future slices that operationalize it:

- **v0.2 — Skill catalog spec**: a structured catalog format (`docs/skills/SKILL_CATALOG_SPEC_v0_1.md`) defining how skills are declared, evaluated, and selected. Includes the schema for skill metadata + eval-pack format.
- **v0.3 — Harness integration test suite**: actual test cases that exercise §18 (step ordering, consent bypass attempts, trace tampering, verification skipping, receipt chain integrity, halt-gate enforcement).
- **v0.4 — Agent run receipt schema**: lift `bizra.dema.agent_run_receipt.v0.1` (§14) into a formal receipt-schema slice with versioning + migration rules.
- **v0.5 — Self-critique prompt library**: canon-bound self-critique prompts per skill family (a Canva skill's self-critique focuses on visual + on-screen text; a commit skill's focuses on commit-message convention; etc.).
- **v0.6 — Local model routing table**: explicit routing config + cross-model consistency tests per §16.
- **v0.7 — Dema harness library**: the actual deterministic harness code that surrounds Dema CLI agent invocations. This is the first runtime slice.
- **v0.8 — PAT-7 baseline harness contract**: when PAT-7 ships, every PAT obeys this harness law from day one.
- **v0.9 — SAT-5 enforcement layer**: SAT-5 (Sovereign Agents · "must govern") is the natural place for cross-PAT harness consistency.
- **v0.10 — Receipt-chain federation (URP-scale)**: when URP ships, cross-node receipt federation extends the operator-local chain to a forest-scale verifiable record.

Each step adds runtime to doctrine, not new doctrine on top of doctrine.

## 25. Next Canon Slices

This Harness & Skill DNA depends on and points forward to:

- `docs/BIZRA_AGENT_DNA_LAW_OF_ASSUMPTION_v0_1.md` — sibling doctrine (thinking layer).
- `docs/CLAIM_REGISTER_v0_1.md` — truth taxonomy that every claim boundary uses.
- `docs/DELIVERY_SPINE_v0_1.md` — release gates + Release Receipt template that agent run receipts roll up into.
- `docs/NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md` — Component DNA Layers 9 (PAT-7) and 10 (SAT-5) — the future runtime home.
- `docs/BIZRA_2026_FIRST_LOOK_PRODUCTION_BRIEF_v0_1.md` §22 Production Checklist + §23 Review Gate — the asset-production analog of the agent loop.
- `docs/BIZRA_THIRD_PARTY_EVALUATION_PACK_v0_1.md` §17 Testing & CI/CD Posture — reviewer-side framing of the harness discipline.
- Memory canon: `feedback_no_invented_evidence_source.md` · `feedback_incremental_evidence_binding.md` · `feedback_post_ramadan_2023_default_relevance.md` · `project_2026_05_21_home_base_consolidation_deferred_to_dema.md` · `reference_token_discipline_playbook.md` (cited in §16 model routing rationale).
- Future `docs/skills/SKILL_CATALOG_SPEC_v0_1.md`.
- Future `docs/agent-dna/DEMA_HARNESS_INTEGRATION_TESTS_v0_1.md`.
- Future `docs/agent-dna/DEMA_AGENT_RUN_RECEIPT_SCHEMA_v0_1.md`.

The load-bearing surfaces of this canon are §4 (Harness Law), §5 (Skill Law), §7 (Dema Agent Loop — the 10 steps), §9 (Must-Not-Miss Safety), §13 (Deterministic Verification), §14 (Receipt Boundary), §20 (Forbidden Behaviors), and §21 (Required Runtime Pattern). When any pillar in the twelve-pillar canon changes, this doctrine is re-read for drift. When this doctrine changes, every future agent-implementation slice is re-read for drift.

---

> **The harness grounds the model in reality. The skill gives the model product/canon knowledge. Micro-consent bounds action. The receipt preserves proof.**
>
> _Together with the Law of Assumption: think humbly, act verifiably._
