// NODE0-UNDO-PROVEN-1A — measured inverse correction preview envelope.
//
// Composes execute + undo gate output into a sealed undo-proven receipt shape.
// PREVIEW_ONLY — does not execute; review gate runs measured sandbox proof.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  NODE0_REVERSIBLE_EXECUTE_GATE_SCHEMA,
  NODE0_REVERSIBLE_EXECUTE_TRUTH_LABEL,
  NODE0_REVERSIBLE_EXECUTE_RECEIPT_SCHEMA,
  runNode0ReversibleExecuteGate,
} from "./node0-reversible-execute-gate.js";

export const NODE0_UNDO_PROVEN_PREVIEW_SCHEMA =
  "bizra.dema.node0_undo_proven_preview.v0.1";

export const NODE0_UNDO_PROVEN_PREVIEW_TRUTH_LABEL =
  "NODE0_UNDO_PROVEN_PREVIEW_ONLY";

export const NODE0_UNDO_PROVEN_STAGE = "NODE0_MEASURED_INVERSE_CORRECTION_PREVIEW";

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item) ?? "null").join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const serialized = stableStringify(value[key]);
        return serialized === undefined ? [] : [`${JSON.stringify(key)}:${serialized}`];
      });
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function contentHash(body) {
  return `sha256:${createHash("sha256").update(stableStringify(body), "utf8").digest("hex")}`;
}

export function buildNode0UndoProvenPreview({ gate_result } = {}) {
  const gate = gate_result && typeof gate_result === "object" ? gate_result : null;
  const receipt = gate?.receipt ?? null;
  const undo = gate?.undo ?? null;
  const proven =
    gate?.undo_proven === true &&
    undo?.proven === true &&
    undo?.undone === true &&
    typeof undo?.restored_hash === "string";

  const body = {
    schema: NODE0_UNDO_PROVEN_PREVIEW_SCHEMA,
    truth_label: NODE0_UNDO_PROVEN_PREVIEW_TRUTH_LABEL,
    stage: NODE0_UNDO_PROVEN_STAGE,
    source_gate_schema: gate?.schema ?? null,
    source_gate_truth_label: gate?.truth_label ?? null,
    inverse_operation: "rename_restore_from_backup",
    undo_proven: proven,
    execute_content_hash: gate?.content_hash ?? receipt?.content_hash ?? null,
    execute_state_hash: gate?.state_hash ?? receipt?.state_hash ?? null,
    restored_hash: undo?.restored_hash ?? null,
    backup_hash: receipt?.backup?.hash ?? null,
    sandbox_root: gate?.sandbox_root ?? receipt?.sandbox_root ?? null,
    action_type: gate?.action_type ?? receipt?.action_type ?? null,
    measured_status: proven ? "MEASURED" : "NOT_MEASURED",
    consent_observed: receipt?.consent?.go_phrase_hash != null,
    boundary: buildPreviewBoundary(),
    what_this_proves: proven
      ? [
          "One sandbox rename was executed and inverse-restored with backup-anchored byte proof.",
        ]
      : ["Undo proof envelope only — gate did not complete measured inverse correction."],
    what_this_does_not_prove: [
      "Live governed runtime, federation, economic rights, autonomous repair, or production rollback.",
      "Undo across arbitrary action classes beyond the measured rename gate.",
    ],
  };

  return freezeDeep({
    ...body,
    preview_hash: contentHash(body),
  });
}

export function verifyNode0UndoProvenPreview(preview) {
  const blocked_by = [];
  if (!preview || preview.schema !== NODE0_UNDO_PROVEN_PREVIEW_SCHEMA) {
    return freezeDeep({ ok: false, blocked_by: ["invalid_schema"] });
  }
  if (preview.truth_label !== NODE0_UNDO_PROVEN_PREVIEW_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (preview.stage !== NODE0_UNDO_PROVEN_STAGE) {
    blocked_by.push("invalid_stage");
  }
  if (preview.undo_proven === true) {
    if (!preview.restored_hash || !preview.backup_hash) {
      blocked_by.push("undo_hash_missing");
    }
    if (preview.restored_hash !== preview.backup_hash) {
      blocked_by.push("restored_hash_not_equal_backup_hash");
    }
    if (preview.measured_status !== "MEASURED") {
      blocked_by.push("measured_status_mismatch");
    }
  }
  const boundary = preview.boundary;
  if (!boundary || typeof boundary !== "object") {
    blocked_by.push("boundary_missing");
  } else {
    for (const [key, value] of Object.entries(boundary)) {
      if (value !== false) blocked_by.push(`boundary_not_false:${key}`);
    }
  }
  const { preview_hash: _omit, ...hashBody } = preview;
  if (preview.preview_hash !== contentHash(hashBody)) {
    blocked_by.push("preview_hash_mismatch");
  }
  return freezeDeep({ ok: blocked_by.length === 0, blocked_by });
}

export function runNode0UndoProvenPreviewGate({
  fs,
  sandboxRoot,
  fixture,
  now = "2026-06-30T12:00:00.000Z",
} = {}) {
  const gate = runNode0ReversibleExecuteGate({ fs, sandboxRoot, fixture, now });
  const preview = buildNode0UndoProvenPreview({ gate_result: gate });
  const verified = verifyNode0UndoProvenPreview(preview);
  const blocked_by = [...(gate.blocked_by ?? [])];
  if (!verified.ok) blocked_by.push(...verified.blocked_by.map((c) => `preview:${c}`));
  return freezeDeep({
    ok: gate.ok === true && verified.ok === true && preview.undo_proven === true,
    schema: NODE0_UNDO_PROVEN_PREVIEW_SCHEMA,
    truth_label: NODE0_UNDO_PROVEN_PREVIEW_TRUTH_LABEL,
    undo_proven: preview.undo_proven === true,
    preview_hash: preview.preview_hash,
    source_gate_schema: NODE0_REVERSIBLE_EXECUTE_GATE_SCHEMA,
    source_gate_truth_label: NODE0_REVERSIBLE_EXECUTE_TRUTH_LABEL,
    execute_receipt_schema: NODE0_REVERSIBLE_EXECUTE_RECEIPT_SCHEMA,
    verified,
    preview,
    gate,
    blocked_by: Object.freeze(blocked_by),
  });
}
