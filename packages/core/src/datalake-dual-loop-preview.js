// DATALAKE-DUAL-LOOP-PREVIEW-1A · metadata-only face/body loop composition.
//
// Composes the Dema face proof spine (ADR-030 alignment spine) with read-only
// Data Lake body expectation stages. Reference and expectation only — no runtime
// sync, no Data Lake mutation, no cross-repo writes, no network.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPreviewBoundary } from "./preview-boundary.js";

export const DATALAKE_DUAL_LOOP_PREVIEW_SCHEMA =
  "bizra.dema.datalake_dual_loop_preview.v0.1";

export const DATALAKE_DUAL_LOOP_TRUTH_LABEL = "DATALAKE_DUAL_LOOP_PREVIEW";

export const DATALAKE_ALIGNMENT_LAYER_ID = "adr-030-dema-datalake-alignment";

export const DEFAULT_PROOF_GAPS = Object.freeze([
  "GAP_FUTURE_IMPLEMENTATION_REQUIRED",
  "GAP_EXTERNAL_REVIEW_PENDING",
  "GAP_REFERENCE_EXPECTATION_ONLY",
]);

export const DEMA_FACE_LOOP_STAGES = Object.freeze([
  Object.freeze({
    key: "receipt_review",
    label: "Receipt review",
    boundary_ref: "docs/06-adr/ADR-028-atomic-impact-receipt-lifecycle-boundary.md",
  }),
  Object.freeze({
    key: "local_writer",
    label: "Local writer",
    boundary_ref: "docs/06-adr/ADR-027-reward-receipt-local-writer-boundary.md",
  }),
  Object.freeze({
    key: "air_lifecycle",
    label: "AIR lifecycle",
    boundary_ref: "tests/atomic-impact-receipt-lifecycle-mock.test.js",
  }),
  Object.freeze({
    key: "mission_state",
    label: "Mission-centric state",
    boundary_ref: "docs/06-adr/ADR-029-mission-centric-state-ecosystem-boundary.md",
  }),
  Object.freeze({
    key: "alignment_ref",
    label: "Data-Lake alignment ref",
    boundary_ref: "docs/06-adr/ADR-030-dema-data-lake-alignment-boundary.md",
  }),
]);

export const DATALAKE_BODY_LOOP_STAGES = Object.freeze([
  Object.freeze({
    key: "body_artifact_ref",
    label: "Data Lake body artifact ref",
    runtime_implemented: false,
  }),
  Object.freeze({
    key: "pat7_expectation",
    label: "PAT-7 expectation",
    runtime_implemented: false,
  }),
  Object.freeze({
    key: "sat5_expectation",
    label: "SAT-5 expectation",
    runtime_implemented: false,
  }),
  Object.freeze({
    key: "fate_expectation",
    label: "FATE expectation",
    runtime_implemented: false,
  }),
  Object.freeze({
    key: "urp_expectation",
    label: "URP expectation",
    runtime_implemented: false,
  }),
  Object.freeze({
    key: "bridge_boundary",
    label: "Future proof-gated bridge",
    runtime_implemented: false,
  }),
]);

const ALIGNMENT_LAYER_MANIFEST = Object.freeze({
  layer_id: DATALAKE_ALIGNMENT_LAYER_ID,
  layer_name: "ADR-030 Dema/Data-Lake Alignment",
  boundary_ref: "docs/06-adr/ADR-030-dema-data-lake-alignment-boundary.md",
  schema_ref: "bizra.dema.datalake.alignment.v0.1.local",
  test_scaffold_ref: "tests/dema-datalake-alignment-boundary.test.js",
  mock_ref: "tests/dema-datalake-alignment-mock.test.js",
  delivery_check_marker:
    "ADR-030 Dema Data-Lake alignment mock integrated: PASS",
});

const REPO_ROOT_FROM_CORE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const v of Object.values(value)) freezeDeep(v);
  return value;
}

function readOnlyBoundary() {
  return Object.freeze({
    ...buildPreviewBoundary(),
    datalake_mutation_performed: false,
    runtime_sync_performed: false,
    cross_repo_write_performed: false,
    pat_runtime_invoked: false,
    sat_runtime_invoked: false,
    fate_runtime_invoked: false,
    urp_sync_performed: false,
  });
}

function stageNode(loopKey, stage) {
  return Object.freeze({
    node_id: `${loopKey}:${stage.key}`,
    loop: loopKey,
    kind: "loop_stage",
    label: stage.label,
    metadata: Object.freeze({
      boundary_ref: stage.boundary_ref ?? null,
      runtime_implemented: stage.runtime_implemented ?? null,
    }),
  });
}

function sequenceEdge(from, to) {
  return Object.freeze({
    edge_id: `sha256:${sha256(`${from}|${to}|sequences`)}`,
    from,
    to,
    relation: "sequences",
  });
}

function resolveBoundaryRefs(root, exists) {
  const refs = [];
  for (const stage of DEMA_FACE_LOOP_STAGES) {
    const rel = stage.boundary_ref;
    const present = rel ? exists(join(root, rel)) : false;
    refs.push(
      Object.freeze({
        stage_key: stage.key,
        boundary_ref: rel,
        present,
      }),
    );
  }
  const layerRefs = [
    ["boundary_ref", ALIGNMENT_LAYER_MANIFEST.boundary_ref],
    ["test_scaffold_ref", ALIGNMENT_LAYER_MANIFEST.test_scaffold_ref],
    ["mock_ref", ALIGNMENT_LAYER_MANIFEST.mock_ref],
  ].map(([field, rel]) =>
    Object.freeze({
      field,
      path: rel,
      present: exists(join(root, rel)),
    }),
  );
  return Object.freeze({
    face_stage_refs: Object.freeze(refs),
    alignment_layer_refs: Object.freeze(layerRefs),
    all_face_refs_present: refs.every((r) => r.present),
    all_alignment_refs_present: layerRefs.every((r) => r.present),
  });
}

/**
 * Pure builder for the dual-loop preview envelope.
 *
 * @param {object} opts
 * @param {string} opts.renderedAtIso
 * @param {object} [opts.boundaryRefs]
 * @param {string[]} [opts.proofGaps]
 */
export function buildDatalakeDualLoopPreview({
  renderedAtIso,
  boundaryRefs = null,
  proofGaps = DEFAULT_PROOF_GAPS,
} = {}) {
  const nodes = [];
  const edges = [];

  const faceRoot = Object.freeze({
    node_id: "dema_face:root",
    loop: "dema_face",
    kind: "loop_root",
    label: "Dema face loop",
    metadata: Object.freeze({ repo_role: "constitutional_face" }),
  });
  nodes.push(faceRoot);

  const bodyRoot = Object.freeze({
    node_id: "datalake_body:root",
    loop: "datalake_body",
    kind: "loop_root",
    label: "Data Lake body loop",
    metadata: Object.freeze({
      repo_role: "computational_body",
      datalake_repo_ref: "bizra-data-lake",
    }),
  });
  nodes.push(bodyRoot);

  let previousFaceId = faceRoot.node_id;
  const faceStages = [];
  for (const stage of DEMA_FACE_LOOP_STAGES) {
    const node = stageNode("dema_face", stage);
    faceStages.push(node);
    nodes.push(node);
    edges.push(sequenceEdge(previousFaceId, node.node_id));
    previousFaceId = node.node_id;
  }

  let previousBodyId = bodyRoot.node_id;
  const bodyStages = [];
  for (const stage of DATALAKE_BODY_LOOP_STAGES) {
    const node = stageNode("datalake_body", stage);
    bodyStages.push(node);
    nodes.push(node);
    edges.push(sequenceEdge(previousBodyId, node.node_id));
    previousBodyId = node.node_id;
  }

  const alignmentFaceStage = faceStages[faceStages.length - 1];
  const bodyArtifactStage = bodyStages[0];
  edges.push(
    Object.freeze({
      edge_id: `sha256:${sha256(`${alignmentFaceStage.node_id}|${bodyArtifactStage.node_id}|aligns_with`)}`,
      from: alignmentFaceStage.node_id,
      to: bodyArtifactStage.node_id,
      relation: "aligns_with",
      metadata: Object.freeze({
        face_body_alignment_status: "REFERENCE_EXPECTATION_ONLY",
        runtime_sync: false,
      }),
    }),
  );

  const refsOk = boundaryRefs?.all_face_refs_present === true &&
    boundaryRefs?.all_alignment_refs_present === true;

  return freezeDeep({
    schema: DATALAKE_DUAL_LOOP_PREVIEW_SCHEMA,
    truth_label: DATALAKE_DUAL_LOOP_TRUTH_LABEL,
    mode: "reference_expectation_only",
    rendered_at_iso: renderedAtIso,
    face_body_alignment_status: "REFERENCE_EXPECTATION_ONLY",
    alignment_layer: ALIGNMENT_LAYER_MANIFEST,
    loops: Object.freeze({
      dema_face: Object.freeze({
        stage_count: DEMA_FACE_LOOP_STAGES.length,
        stages: Object.freeze(DEMA_FACE_LOOP_STAGES.map((s) => s.key)),
      }),
      datalake_body: Object.freeze({
        stage_count: DATALAKE_BODY_LOOP_STAGES.length,
        stages: Object.freeze(DATALAKE_BODY_LOOP_STAGES.map((s) => s.key)),
      }),
    }),
    bridge: Object.freeze({
      relation: "aligns_with",
      from_stage: "alignment_ref",
      to_stage: "body_artifact_ref",
      runtime_sync: false,
      cross_repo_write: false,
    }),
    boundary_refs: boundaryRefs,
    proof_gaps: Object.freeze([...proofGaps]),
    summary: Object.freeze({
      node_count: nodes.length,
      edge_count: edges.length,
      boundary_refs_ok: refsOk,
      face_stage_count: DEMA_FACE_LOOP_STAGES.length,
      body_stage_count: DATALAKE_BODY_LOOP_STAGES.length,
    }),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    next_safe_action:
      "Review ADR-030 alignment boundary and proof gaps before any bridge work",
    boundary: readOnlyBoundary(),
  });
}

export async function gatherDatalakeDualLoopPreview(options = {}) {
  const now = options.now || new Date();
  const root = options.repoRoot ?? REPO_ROOT_FROM_CORE;
  const exists = options.exists ?? existsSync;
  const boundaryRefs = resolveBoundaryRefs(root, exists);
  return buildDatalakeDualLoopPreview({
    renderedAtIso: now.toISOString(),
    boundaryRefs,
  });
}

export function renderDatalakeDualLoopPreview(preview, { useColor = false } = {}) {
  void useColor;
  const lines = [
    "DEMA · DATA LAKE DUAL-LOOP PREVIEW",
    `truth: ${preview.truth_label} · status: ${preview.face_body_alignment_status}`,
    `face stages: ${preview.loops.dema_face.stage_count} · body stages: ${preview.loops.datalake_body.stage_count}`,
    `nodes: ${preview.summary.node_count} · edges: ${preview.summary.edge_count}`,
    `boundary refs: ${preview.summary.boundary_refs_ok ? "OK" : "INCOMPLETE"}`,
    "",
    "Dema face loop:",
    ...preview.loops.dema_face.stages.map((key) => `  · ${key}`),
    "",
    "Data Lake body loop (expectation only):",
    ...preview.loops.datalake_body.stages.map((key) => `  · ${key}`),
    "",
    `Next: ${preview.next_safe_action}`,
    "Boundary: reference-only · no sync · no mutation · no network",
  ];
  return lines.join("\n");
}
