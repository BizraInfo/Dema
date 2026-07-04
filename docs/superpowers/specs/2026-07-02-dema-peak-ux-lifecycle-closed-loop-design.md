# Dema Peak UX Lifecycle Closed Loop Design

Status: Working artifact

## Purpose

Build one preview-only lifecycle surface that lets an operator see the complete Dema journey without implying runtime execution. The surface should consolidate existing kernels for onboarding, self-loop preview, process mining, proof convergence, consent boundaries, and next safe action selection.

The goal is not a new runtime. The goal is a clearer control panel over already-bounded pieces.

## Scope

Slice id: `DEMA-PEAK-UX-LIFECYCLE-CLOSED-LOOP-1A`

In scope:

- A pure core builder for a lifecycle preview envelope.
- A CLI command that renders JSON by default and can later support human/TUI formatting.
- Tests for schema, determinism, boundary flags, stage composition, consent posture, no-mint posture, and no-network posture.
- A short architecture note under `docs/02-architecture/`.

Out of scope:

- Live runtime execution.
- Model calls, Z.ai calls, or any API key use.
- Wallets, live minting, token transfer, economic activation, or reward activation.
- Node1/Node2 connection, federation, daemon behavior, or hidden background state.
- Neural KV-cache communication, steering vectors, or latent-space sharing as implementation. Those remain research-quarantined unless promoted by a separate spec.

## Architecture

Create `packages/core/src/peak-ux-lifecycle-preview.js` as a pure composition builder. It should import existing preview builders instead of duplicating logic:

- `buildOnboardingLifecyclePreview`
- `buildPeakSelfLoopPreview`
- `buildProcessMiningSummary`
- `buildProofConvergencePreview` if a compact proof rail view is needed
- `buildPreviewBoundary`

The builder returns a frozen envelope:

```js
{
  schema: "bizra.dema.peak_ux_lifecycle_preview.v0.1",
  truth_label: "NODE0_LOCAL_SEED",
  mode: "preview_only",
  lifecycle: [...],
  current_focus: {...},
  consent: {...},
  proof_of_truth: {...},
  no_mint: {...},
  next_safe_action: {...},
  boundary: buildPreviewBoundary()
}
```

The CLI command should be `dema peak-ux-lifecycle --json`. It must not read secrets, call networks, load models, write receipts, or infer live system state.

## Lifecycle Model

The lifecycle should be compact and operator-readable:

1. Welcome and orientation.
2. Onboarding lifecycle.
3. Micro-consent constitution.
4. Mission draft.
5. Self-loop preview.
6. Process-mining mirror.
7. Proof-of-truth convergence.
8. Next safe action.

Each stage should include:

- `id`
- `label`
- `source_surface`
- `truth_label`
- `status`
- `blocked_effects`

## Consent and Compliance

The preview must restate Dema's exact-string consent rule. It may surface a proposed consent phrase for future action, but it must not treat a broad `GO` as consent for runtime, network, mint, wallet, federation, or model work.

The exposed Z.ai key from the conversation must not be stored, echoed, tested, or used. Any future provider integration must require a new secret boundary and an environment-only key path.

## Error Handling

The builder should fail closed:

- Non-object options become defaults.
- Unknown lifecycle inputs are ignored.
- Missing optional sub-surfaces produce explicit `status: "unavailable"` blocks, not thrown errors.
- Any requested live effect appears only in `blocked_effects`.

## Testing

Use TDD. Required tests:

- Emits exact schema, truth label, and `preview_only` mode.
- Returns a deeply frozen object.
- Emits canonical all-false preview boundary.
- Includes all eight lifecycle stages in order.
- Composes onboarding, self-loop, and process-mining surfaces by reference.
- States no model, no network, no wallet, no mint, no reward, no federation.
- Rejects live-effect options by preserving preview-only output.
- CLI emits parseable JSON.
- Command table includes the command with correct consent posture.

Run at minimum:

```bash
node --test tests/peak-ux-lifecycle-preview.test.js
npm test
npm run check
npm run llm:guidance
git diff --check
```

## Success Criteria

The slice is complete when the repo can prove a single closed-loop UX preview from disk with no new dependency, no external call, no secret use, no runtime claim, and all canonical checks passing.

The implementation must be described as a preview control surface, not as live autopoiesis, live agent RL, live economic value, or live federation.
