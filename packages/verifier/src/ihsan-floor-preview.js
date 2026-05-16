export const IHSAN_FLOOR_PREVIEW_SCHEMA = "bizra.dema.ihsan_floor_preview.v0.1";
export const IHSAN_SCORER_ID = "IHSAN_FLOOR";
export const DEFAULT_IHSAN_FLOOR = 0.95;

function finiteUnitNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function evaluateIhsanFloorPreview({
  score,
  floor = DEFAULT_IHSAN_FLOOR,
  scorerId = IHSAN_SCORER_ID,
  now = new Date()
} = {}) {
  const scoreOk = finiteUnitNumber(score);
  const floorOk = finiteUnitNumber(floor);
  const scorerOk = scorerId === IHSAN_SCORER_ID;
  const floorMet = scoreOk && floorOk && score >= floor;
  const acceptedShape = scoreOk && floorOk && scorerOk;

  return {
    schema: IHSAN_FLOOR_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    checked_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    certifies: false,
    scorer_id: scorerId,
    score: scoreOk ? score : null,
    floor: floorOk ? floor : DEFAULT_IHSAN_FLOOR,
    verdict: acceptedShape && floorMet ? "PARTIAL_PLACEHOLDER" : "PREVIEW_REJECT",
    checks: [
      {
        check: "score_is_unit_number",
        pass: scoreOk,
        detail: scoreOk ? `score=${score.toFixed(4)}` : "score must be a finite number in [0,1]"
      },
      {
        check: "floor_is_unit_number",
        pass: floorOk,
        detail: floorOk ? `floor=${floor.toFixed(4)}` : "floor must be a finite number in [0,1]"
      },
      {
        check: "scorer_id_matches_upstream_floor",
        pass: scorerOk,
        detail: scorerOk
          ? `scorer_id=${IHSAN_SCORER_ID}`
          : `expected scorer_id=${IHSAN_SCORER_ID}, got ${JSON.stringify(scorerId)}`
      },
      {
        check: "floor_met",
        pass: floorMet,
        detail: floorMet
          ? `score ${score.toFixed(4)} >= floor ${floor.toFixed(4)}`
          : "score is missing, invalid, or below the floor"
      }
    ],
    boundary: {
      canonical_ihsan_computed_here: false,
      runtime_gate_executed: false,
      receipt_minted: false,
      identity_bound: false,
      network_connection_attempted: false,
      external_posting_performed: false
    },
    note:
      "Dema only previews the upstream Ihsan floor check from an externally supplied scalar. " +
      "The canonical scorer lives in the governed Node0/SAT admissibility path."
  };
}

export function formatIhsanFloorPreview(preview) {
  const lines = [
    "DEMA Ihsan Floor Preview",
    "",
    `Mode: ${preview.mode}`,
    `Truth label: ${preview.truth_label}`,
    `Verdict: ${preview.verdict}`,
    `Score: ${preview.score === null ? "invalid" : preview.score.toFixed(4)}`,
    `Floor: ${preview.floor.toFixed(4)}`,
    `Certifies: ${preview.certifies}`,
    "",
    "Checks:",
    ...preview.checks.map((check) => `  - ${check.pass ? "pass" : "fail"} ${check.check}: ${check.detail}`),
    "",
    "Boundary: preview-only; canonical scorer not computed here; no runtime gate; no receipt mint; no identity binding; no network; no external posting."
  ];

  return lines.join("\n");
}
