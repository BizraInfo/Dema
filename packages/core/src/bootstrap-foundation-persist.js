// Bootstrap foundation persist v0.1 — the first consent-gated WRITE path.
//
// Every prior kernel was pure/ephemeral (no write). This one composes the
// existing atomic, idempotent runSetup (packages/installer/src/setup.js) behind
// an exact-string consent gate, making ADR-005 real for the node foundation:
//   - "GO: CREATE LOCAL NODE FOUNDATION ONLY" → write the foundation under DEMA_HOME.
//   - "SKIP: EPHEMERAL MODE ONLY"             → write nothing (operator declines).
//   - anything else                           → fail closed, no write.
//
// Boundary: a real write CANNOT use the canonical 16-key preview boundary —
// `filesystem_write_performed` is in RUNTIME_EMISSION_STRICTLY_FALSE_KEY_SET. Like
// every other writer (authorship-key-store, verdict-attest, local-index-writer),
// this kernel attests with its OWN domain boundary vocab. The write-true flag
// appears only here, only on the consented branch, never in the universal vocab.
//
// This kernel does NOT change any existing command. `dema setup` / `dema first-run`
// still call runSetup directly (un-gated) today; routing them through this gate is
// a separate, deliberate behavior-change slice.

import { join } from "node:path";
import { homedir } from "node:os";
import { runSetup } from "../../installer/src/setup.js";

export const FOUNDATION_PERSIST_CONSENT_PHRASE =
  "GO: CREATE LOCAL NODE FOUNDATION ONLY";
export const FOUNDATION_EPHEMERAL_PHRASE = "SKIP: EPHEMERAL MODE ONLY";
export const BOOTSTRAP_FOUNDATION_PERSIST_SCHEMA =
  "bizra.dema.bootstrap_foundation_persist.v0.1";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

// Domain boundary for a foundation write. `wrote` = this call performed a write;
// `consented` = the exact consent phrase was verified. All runtime/economic
// effects stay false — a foundation write is local-only.
function buildBoundary({ wrote, consented }) {
  return {
    foundation_persist_performed: wrote === true,
    consent_verified: consented === true,
    network_used: false,
    federation_used: false,
    model_invocation_performed: false,
    receipt_mint_performed: false,
    token_minted: false,
  };
}

function defaultRoot() {
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

export async function bootstrapFoundationPersist({
  consent = "",
  root = defaultRoot(),
  dryRun = false,
} = {}) {
  const base = {
    schema: BOOTSTRAP_FOUNDATION_PERSIST_SCHEMA,
    root,
    consent_required: FOUNDATION_PERSIST_CONSENT_PHRASE,
    ephemeral_phrase: FOUNDATION_EPHEMERAL_PHRASE,
  };

  // Operator explicitly declines — ephemeral, nothing saved.
  if (consent === FOUNDATION_EPHEMERAL_PHRASE) {
    return deepFreeze({
      ...base,
      mode: "ephemeral",
      persisted: false,
      reason: "operator_selected_ephemeral",
      message: "nothing was saved",
      setup_result: null,
      boundary: buildBoundary({ wrote: false, consented: false }),
    });
  }

  // Fail closed: no exact phrase → no write (consent checked before any I/O).
  if (consent !== FOUNDATION_PERSIST_CONSENT_PHRASE) {
    return deepFreeze({
      ...base,
      mode: "refused",
      persisted: false,
      reason: "consent_phrase_mismatch",
      required_phrase: FOUNDATION_PERSIST_CONSENT_PHRASE,
      setup_result: null,
      boundary: buildBoundary({ wrote: false, consented: false }),
    });
  }

  // Consent verified, but a dry run still writes nothing.
  if (dryRun) {
    return deepFreeze({
      ...base,
      mode: "local",
      persisted: false,
      reason: "dry_run",
      dry_run: true,
      setup_result: null,
      boundary: buildBoundary({ wrote: false, consented: true }),
    });
  }

  // Consent verified → compose the existing atomic, idempotent writer.
  const setup_result = await runSetup(root);
  return deepFreeze({
    ...base,
    mode: "local",
    persisted: true,
    reason: "consent_verified",
    dry_run: false,
    setup_result,
    boundary: buildBoundary({
      wrote: setup_result.created === true,
      consented: true,
    }),
  });
}
