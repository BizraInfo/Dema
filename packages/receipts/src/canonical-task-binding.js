// RECEIPT-CHAIN-1C · bind a flywheel task's artifacts into the canonical chain.
//
// Phase A of the Node0 master plan. The flywheel produces heterogeneous,
// separately-stored proofs (action receipt, IMPACT ledger entry, SAT validation
// receipt). This binder appends them, in order, as canonical receipts into the
// single `receipts/canonical-ledger.ndjson` prev_hash chain — so one task is one
// replayable canonical chain a stranger can verify with the public key alone.
//
// Thin orchestration over the existing canonical primitives (no new crypto, no
// new schema): each artifact becomes the `canonical_body` of a content-addressed,
// signed canonical receipt chained to the previous one. Fail-closed: a rejected
// append stops the bind and reports how far it got; the partial chain remains
// individually valid (every written entry is signed and linked).

import {
  CANONICAL_RECEIPT_CONSENT_PHRASE,
  VALID_TRUTH_LABELS,
} from "./canonical-receipt.js";
import {
  appendCanonicalReceipt,
  verifyCanonicalLedger,
} from "./canonical-ledger.js";
import { loadPublicKey } from "./authorship-key-store.js";

export const CANONICAL_TASK_BINDING_SCHEMA =
  "bizra.dema.canonical_task_binding.v0.1";

function fail(error, extra = {}) {
  return Object.freeze({
    schema: CANONICAL_TASK_BINDING_SCHEMA,
    bound: false,
    error,
    ...extra,
  });
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Mirrors canonical-receipt's JSON-safety gate so the batch pre-validation
// covers every reason appendCanonicalReceipt can refuse — a body carrying a
// function / undefined / bigint / symbol would otherwise pass validateDescriptor
// and fail mid-batch, leaving a half-bound chain.
function isJsonSafe(value, seen = new WeakSet()) {
  if (value === null) return true;
  const t = typeof value;
  if (t === "string" || t === "boolean") return true;
  if (t === "number") return Number.isFinite(value);
  if (
    t === "function" ||
    t === "undefined" ||
    t === "bigint" ||
    t === "symbol"
  ) {
    return false;
  }
  if (t === "object") {
    if (seen.has(value)) return false;
    seen.add(value);
    if (Array.isArray(value)) return value.every((v) => isJsonSafe(v, seen));
    return Object.values(value).every((v) => isJsonSafe(v, seen));
  }
  return false;
}

// Validate one task-receipt descriptor before any durable write.
function validateDescriptor(d) {
  if (!isPlainObject(d)) return "task_receipt_malformed";
  if (!isPlainObject(d.body)) return "task_receipt_body_invalid";
  if (!isJsonSafe(d.body)) return "task_receipt_body_invalid";
  if (!VALID_TRUTH_LABELS.includes(d.truthLabel)) {
    return "task_receipt_truth_label_invalid";
  }
  if (!isNonEmptyString(d.whatProves))
    return "task_receipt_what_proves_required";
  if (!isNonEmptyString(d.whatDoesNotProve)) {
    return "task_receipt_what_does_not_prove_required";
  }
  return null;
}

/**
 * Append an ordered list of a task's artifacts to the canonical chain, then
 * replay-verify the whole ledger. Returns a frozen success/failure envelope.
 *
 * @param {object} args
 *   - taskReceipts: Array<{ body, truthLabel, whatProves, whatDoesNotProve }>
 *   - consent: must equal CANONICAL_RECEIPT_CONSENT_PHRASE
 *   - demaHome, now (ISO-8601)
 */
export async function bindTaskReceiptsToCanonicalChain({
  taskReceipts,
  consent,
  demaHome,
  now,
} = {}) {
  if (consent !== CANONICAL_RECEIPT_CONSENT_PHRASE) {
    return fail("consent_required");
  }
  if (!isNonEmptyString(now) || Number.isNaN(Date.parse(now))) {
    return fail("created_at_iso_required");
  }
  if (!Array.isArray(taskReceipts) || taskReceipts.length === 0) {
    return fail("task_receipts_required");
  }
  // Pre-validate the whole batch before writing anything — a malformed
  // descriptor must not leave a half-bound chain.
  for (const d of taskReceipts) {
    const err = validateDescriptor(d);
    if (err) return fail(err);
  }

  const receipt_ids = [];
  for (const d of taskReceipts) {
    const res = await appendCanonicalReceipt({
      canonicalBody: d.body,
      truthLabel: d.truthLabel,
      whatProves: d.whatProves,
      whatDoesNotProve: d.whatDoesNotProve,
      consent,
      demaHome,
      now,
    });
    if (!res.appended) {
      return fail(res.error, {
        bound_count: receipt_ids.length,
        receipt_ids: Object.freeze([...receipt_ids]),
        reason: res.reason,
      });
    }
    receipt_ids.push(res.receipt.receipt_id);
  }

  // Final replay must verify before we claim the chain is bound. Never throw —
  // a read error fails closed; a non-verified replay is not a successful bind.
  const pubkeyPem = await loadPublicKey(demaHome);
  let replay;
  try {
    replay = await verifyCanonicalLedger({ demaHome, pubkeyPem });
  } catch {
    return fail("replay_unreadable", {
      bound_count: receipt_ids.length,
      receipt_ids: Object.freeze([...receipt_ids]),
    });
  }
  if (!replay.verified) {
    return fail("replay_failed", {
      bound_count: receipt_ids.length,
      receipt_ids: Object.freeze([...receipt_ids]),
      replay,
    });
  }

  return Object.freeze({
    schema: CANONICAL_TASK_BINDING_SCHEMA,
    bound: true,
    truth_label: "LOCAL_CANONICAL_TASK_CHAIN_BOUND",
    chain_length: receipt_ids.length,
    receipt_ids: Object.freeze(receipt_ids),
    head: receipt_ids[receipt_ids.length - 1],
    replay,
  });
}
