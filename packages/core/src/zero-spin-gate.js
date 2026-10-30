// ZERO-SPIN-GATE-1A — pure kernel. PREVIEW_ONLY · NOT ML · NOT runtime.
//
// Detects "spin": an agent burning steps without making verifiable progress
// toward its goal. It walks a declared sequence of step records origin(0)->n
// and classifies the FIRST falsifiable spin, or OK:VERIFIED when the run
// converges inside budget with zero spins. It activates no runtime, opens no
// network, reads no file, and consults no clock or randomness: every digest is
// derived from the caller-supplied step records via the mandated canonical
// JSON v1 hash, so the same input always yields the same verdict and the same
// linear receipt chain on every machine.
//
// SOURCING NOTE (slice 1D): the original Python reference prototype that first
// proved this gate (proof_harness.py) is GONE from disk and unreadable. This
// kernel is therefore built to the WRITTEN INVARIANT SPEC, NOT ported from a
// file we can read; it claims conformance to the enumerated invariants/
// scenarios below, and makes NO byte-parity claim against the lost Python.
//
// Fault taxonomy (detection order per step is F-I, then F-II, then F-III, so
// the strongest/earliest guard names the spin):
//   F-I   ctx_spin(origin->step)      1-step canonical context digest collision
//                                     — the step re-observed the IMMEDIATELY
//                                     previous step's (scrubbed) context (a lazy
//                                     retry that made no observable progress).
//   F-II  ctx_cycle(origin->step)     non-adjacent k-cycle — the context digests
//                                     OSCILLATE with a stable period k>=2 (e.g.
//                                     ping-pong A,B,A,B,A). Spec interpretation
//                                     (the lost proof_harness.py is unreadable,
//                                     so this is the literal reading of "k-cycle
//                                     oscillation", documented here and in the
//                                     test name): a single non-adjacent revisit
//                                     is NOT yet a cycle — a cycle is a SUSTAINED
//                                     period-k return, so A,B,A (step 2) is only
//                                     a revisit and the cycle is confirmed at the
//                                     SECOND full return A,B,A,B,A (step 4),
//                                     binding one period back as ctx_cycle(2->4).
//                                     Concretely: the digest must recur at a
//                                     stable period k at THREE positions
//                                     (i, i-k, i-2k).
//   F-III action_stall(origin->step)  the context mutated but the NORMALIZED
//                                     action digest repeats the previous step's
//                                     — real-looking motion that does the same
//                                     thing (e.g. a cosmetic/comment-only edit).
//   F-IV  budget_exhausted            no verified convergence within maxSteps.
//   OK:VERIFIED                       converged (a step reported verified) with
//                                     0 spins inside budget.
//
// Gate flags are ORTHOGONAL ablation controls:
//   enableCtxGate    guards F-I and F-II (context collisions/cycles).
//   enableActionGate guards F-III (action stalls).
// Turning one off provably changes WHICH fault a mixed trace trips first, which
// is what makes the controls falsifiable rather than decorative.

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const ZERO_SPIN_GATE_SCHEMA = "bizra.dema.zero_spin_gate.v0.1";
export const ZERO_SPIN_GATE_TRUTH_LABEL = "ZERO_SPIN_GATE_PREVIEW_ONLY";

const boundary = () =>
  Object.freeze({ runtimeActivated: false, networkCalled: false, authorityDelta: 0 });

// Telemetry noise classes. Each is deterministic noise that varies between
// otherwise-identical steps (wall clock, heap pointers, pod ids, request uuids,
// resource telemetry). Scrubbing them to a stable placeholder is what lets two
// structurally identical actions hash to the same digest so a stall is visible.
// Order matters: UUID is matched before the generic pointer/pod patterns so a
// uuid is not partially consumed by a looser rule.
const NOISE_PATTERNS = Object.freeze([
  // ISO-8601 timestamp (with optional fractional seconds / Z|offset).
  { re: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, token: "<TS>" },
  // RFC-4122 UUID.
  { re: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, token: "<UUID>" },
  // Resource telemetry blob: `telem=...` up to the next whitespace.
  { re: /telem=\S+/g, token: "<TELEM>" },
  // Hex pointer, e.g. 0x7ffabc123def.
  { re: /0x[0-9a-fA-F]+/g, token: "<PTR>" },
  // Pod id, e.g. pod-8d4f2a-worker-17.
  { re: /pod-[0-9a-zA-Z-]+/g, token: "<POD>" },
]);

// Object keys whose VALUE is pure telemetry noise regardless of its textual
// shape. A value under one of these keys is replaced wholesale by the matching
// placeholder so e.g. a numeric pod index or an already-normalized pointer is
// still scrubbed.
const NOISE_KEY_TOKENS = Object.freeze({
  ts: "<TS>",
  ptr: "<PTR>",
  pod: "<POD>",
  uuid: "<UUID>",
  telem: "<TELEM>",
});

function scrubString(s) {
  let out = s;
  for (const { re, token } of NOISE_PATTERNS) {
    out = out.replace(re, token);
  }
  return out;
}

// Deterministically replace telemetry noise in an arbitrary JSON-ish value.
// Pure: returns a NEW value, never mutates the input. Non-string leaves pass
// through unless they sit under a known noise key. Interpretation (literal
// reading of the spec): both value-pattern scrubbing AND noise-key scrubbing
// apply, so noise is removed whether it is tagged by key or merely shaped like
// a timestamp/pointer/uuid inside free text.
export function scrubTelemetryNoise(value) {
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map((v) => scrubTelemetryNoise(v));
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value)) {
      if (Object.hasOwn(NOISE_KEY_TOKENS, key)) {
        out[key] = NOISE_KEY_TOKENS[key];
      } else {
        out[key] = scrubTelemetryNoise(value[key]);
      }
    }
    return out;
  }
  return value;
}

// Cosmetic action fields that carry no structural meaning: an action that
// differs from another ONLY in these fields is the SAME action for stall
// detection (the cosmetic/comment spoof control). Stripped before hashing.
const COSMETIC_ACTION_KEYS = Object.freeze(new Set(["comment", "note", "annotation"]));

function stripCosmetic(value) {
  if (Array.isArray(value)) return value.map((v) => stripCosmetic(v));
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value)) {
      if (COSMETIC_ACTION_KEYS.has(key)) continue;
      out[key] = stripCosmetic(value[key]);
    }
    return out;
  }
  return value;
}

const contextDigest = (context) => sha256CanonicalJsonV1(scrubTelemetryNoise(context ?? null));

// Normalized action digest: telemetry-scrubbed AND cosmetic-stripped, so two
// actions that do the same thing modulo noise/comments share a digest.
const actionDigest = (action) =>
  sha256CanonicalJsonV1(stripCosmetic(scrubTelemetryNoise(action ?? null)));

// One linear receipt per step. The step_hash binds this step's observable
// content AND its predecessor's hash, so the chain is tamper-evident: editing
// any earlier step changes every subsequent step_hash. Genesis has a null
// prev_step_hash.
function buildReceipt({ index, contextHash, actionHash, verified, prevStepHash }) {
  const body = {
    schema: ZERO_SPIN_GATE_SCHEMA,
    index,
    context_hash: contextHash,
    action_hash: actionHash,
    verified: verified === true,
    prev_step_hash: prevStepHash,
  };
  const step_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, step_hash });
}

function normalizeSteps(steps) {
  return Array.isArray(steps) ? steps : [];
}

// Walk origin(0)->n and classify the first spin, or OK:VERIFIED / F-IV.
export function runZeroSpinGate({
  steps,
  maxSteps,
  enableCtxGate = true,
  enableActionGate = true,
} = {}) {
  const list = normalizeSteps(steps);
  const budget = Number.isInteger(maxSteps) && maxSteps > 0 ? maxSteps : list.length;

  const receiptChain = [];
  const contextHashes = [];
  const actionHashes = [];

  let classification = null; // set on first spin
  let verified = false;
  let spinsDetected = 0;
  let prevStepHash = null;
  let stepsConsumed = 0;

  for (let i = 0; i < list.length; i++) {
    if (i >= budget) break; // budget bounds how many steps the run may take
    const step = list[i] ?? {};
    const ctxHash = contextDigest(step.context);
    const actHash = actionDigest(step.action);

    const receipt = buildReceipt({
      index: i,
      contextHash: ctxHash,
      actionHash: actHash,
      verified: step.verified,
      prevStepHash,
    });
    receiptChain.push(receipt);
    prevStepHash = receipt.step_hash;
    stepsConsumed = i + 1;

    if (classification === null && i > 0) {
      // F-I: adjacent (1-step) context collision.
      if (enableCtxGate && ctxHash === contextHashes[i - 1]) {
        classification = `F-I:ctx_spin(${i - 1}->${i})`;
        spinsDetected += 1;
      }
      // F-II: non-adjacent k-cycle — a SUSTAINED period-k oscillation, not a
      // one-off revisit. The step's context digest must recur at a stable
      // period k at THREE positions: ctx[i] == ctx[i-k] == ctx[i-2k]. Two
      // occurrences are a single revisit; the THIRD occurrence at the same
      // period is what establishes the oscillation. For ping-pong A,B,A,B,A the
      // anchor digest A sits at indices 0,2,4, so the cycle confirms at step 4
      // (period 2) binding one period back to step 2 -> ctx_cycle(2->4). The
      // intermediate A,B,A (step 2) and A,B,A,B (step 3) are not yet cycles.
      if (classification === null && enableCtxGate) {
        for (let k = 2; k <= Math.floor(i / 2); k++) {
          if (ctxHash === contextHashes[i - k] && ctxHash === contextHashes[i - 2 * k]) {
            classification = `F-II:ctx_cycle(${i - k}->${i})`;
            spinsDetected += 1;
            break;
          }
        }
      }
      // F-III: context mutated but normalized action repeats the previous step.
      if (
        classification === null &&
        enableActionGate &&
        ctxHash !== contextHashes[i - 1] &&
        actHash === actionHashes[i - 1]
      ) {
        classification = `F-III:action_stall(${i - 1}->${i})`;
        spinsDetected += 1;
      }
    }

    contextHashes.push(ctxHash);
    actionHashes.push(actHash);

    if (classification !== null) break; // first spin wins; stop the walk

    if (step.verified === true) {
      verified = true;
      classification = "OK:VERIFIED";
      break;
    }
  }

  if (classification === null) {
    // No spin and never verified within budget.
    classification = "F-IV:budget_exhausted";
  }

  const verdictBody = {
    schema: ZERO_SPIN_GATE_SCHEMA,
    truth_label: ZERO_SPIN_GATE_TRUTH_LABEL,
    classification,
    verified,
    spinsDetected,
    stepsConsumed,
    budget,
    gates: { enableCtxGate: enableCtxGate === true, enableActionGate: enableActionGate === true },
    final_step_hash: prevStepHash,
  };
  const verdict_hash = sha256CanonicalJsonV1(verdictBody);

  return Object.freeze({
    ...verdictBody,
    gates: Object.freeze(verdictBody.gates),
    receiptChain: Object.freeze(receiptChain),
    verdict_hash,
    boundary: boundary(),
  });
}

// Re-derivation / verify path: recompute each step_hash from its body and
// confirm the linear prev_step_hash links hold. Fails closed on any break so a
// tampered receipt chain cannot pass as genuine. Pure: no disk, no clock.
export function verifyZeroSpinReceiptChain(receiptChain) {
  const chain = Array.isArray(receiptChain) ? receiptChain : [];
  const base = { boundary: boundary(), length: chain.length };

  let prevStepHash = null;
  for (let i = 0; i < chain.length; i++) {
    const r = chain[i] ?? {};
    if (r.prev_step_hash !== prevStepHash) {
      return Object.freeze({ ...base, ok: false, reason: "RECEIPT_CHAIN_BROKEN", brokenAt: i });
    }
    const recomputed = sha256CanonicalJsonV1({
      schema: ZERO_SPIN_GATE_SCHEMA,
      index: r.index,
      context_hash: r.context_hash,
      action_hash: r.action_hash,
      verified: r.verified === true,
      prev_step_hash: r.prev_step_hash,
    });
    if (recomputed !== r.step_hash) {
      return Object.freeze({ ...base, ok: false, reason: "RECEIPT_CHAIN_BROKEN", brokenAt: i });
    }
    prevStepHash = r.step_hash;
  }

  return Object.freeze({ ...base, ok: true, reason: "RECEIPT_CHAIN_VERIFIED" });
}
