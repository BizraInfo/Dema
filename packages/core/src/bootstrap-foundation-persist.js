// Bootstrap foundation persist v0.1 — the first consent-gated WRITE path.
//
// Every prior kernel was pure/ephemeral (no write). This one composes the
// existing atomic, idempotent runSetup (packages/installer/src/setup.js) behind
// an exact-string consent gate, making ADR-005 real for the node foundation:
//   - "GO: CREATE LOCAL NODE FOUNDATION ONLY" → write the foundation under an EXPLICIT root.
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

// Root hardening: a real write requires an EXPLICIT root. The kernel never reads
// DEMA_HOME or homedir itself — the caller (e.g. a future CLI) must resolve and pass
// the write location, so no ambient `~/.dema` write can happen by default.
function isExplicitRoot(root) {
  return typeof root === "string" && root.trim().length > 0;
}

export async function bootstrapFoundationPersist({
  consent = "",
  root,
  dryRun = false,
} = {}) {
  const base = {
    schema: BOOTSTRAP_FOUNDATION_PERSIST_SCHEMA,
    root: root ?? null,
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

  // Root hardening: refuse to write to an ambient/implicit location. A real
  // foundation write must name its root explicitly (consent alone is not enough).
  if (!isExplicitRoot(root)) {
    return deepFreeze({
      ...base,
      mode: "refused",
      persisted: false,
      reason: "explicit_root_required",
      message:
        "a real foundation write requires an explicit root; refusing the ambient default",
      setup_result: null,
      boundary: buildBoundary({ wrote: false, consented: true }),
    });
  }

  // Consent verified + explicit root → compose the existing atomic, idempotent writer.
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
