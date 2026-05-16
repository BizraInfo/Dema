import { createHash } from "node:crypto";

export const MELAE_GATE_PREVIEW_SCHEMA = "bizra.dema.melae_gate_preview.v0.1";
export const SAPE_SCORECARD_PREVIEW_SCHEMA = "bizra.dema.sape_scorecard_preview.v0.1";
export const DEFAULT_MELAE_FLOOR = 0.95;

export const SAPE_PROBES = Object.freeze([
  { id: "counterfactual", weight: 0.10 },
  { id: "boundary", weight: 0.15 },
  { id: "analogical", weight: 0.10 },
  { id: "formalization", weight: 0.15 },
  { id: "program_sketch", weight: 0.10 },
  { id: "compression", weight: 0.10 },
  { id: "expansion", weight: 0.10 },
  { id: "adversarial", weight: 0.15 },
  { id: "ethical_overlay", weight: 0.05 }
]);

const PROBE_WEIGHTS = new Map(SAPE_PROBES.map((probe) => [probe.id, probe.weight]));

function assertSupportedJson(value, path = "$") {
  if (value === null) return;
  const type = typeof value;
  if (type === "string" || type === "boolean") return;
  if (type === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path} must be a finite number`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSupportedJson(item, `${path}[${index}]`));
    return;
  }
  if (type === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) throw new TypeError(`${path}.${key} must not be undefined`);
      assertSupportedJson(item, `${path}.${key}`);
    }
    return;
  }
  throw new TypeError(`${path} has unsupported JSON type ${type}`);
}

export function canonicalJson(value) {
  assertSupportedJson(value);
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`
  )).join(",")}}`;
}

export function sha256Canonical(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function finiteUnitNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function probeIds() {
  return SAPE_PROBES.map((probe) => probe.id);
}

function normalizeProbeScore(entry) {
  const id = typeof entry?.probe_id === "string" ? entry.probe_id : entry?.id;
  const score = entry?.score;
  const weight = PROBE_WEIGHTS.get(id);
  return {
    probe_id: typeof id === "string" ? id : null,
    score: finiteUnitNumber(score) ? score : null,
    weight: weight ?? null,
    passed: Boolean(weight) && finiteUnitNumber(score) && score >= DEFAULT_MELAE_FLOOR,
    notes: Array.isArray(entry?.notes) ? entry.notes.map(String) : []
  };
}

function summarizeProbeSet(normalized) {
  const seen = new Set();
  const duplicate_probe_ids = [];
  for (const probe of normalized) {
    if (!probe.probe_id) continue;
    if (seen.has(probe.probe_id)) duplicate_probe_ids.push(probe.probe_id);
    seen.add(probe.probe_id);
  }

  const expected = probeIds();
  const supplied = new Set(normalized.map((probe) => probe.probe_id).filter(Boolean));
  return {
    missing_probe_ids: expected.filter((id) => !supplied.has(id)),
    unknown_probe_ids: [...supplied].filter((id) => !PROBE_WEIGHTS.has(id)),
    duplicate_probe_ids
  };
}

export function buildSapeScorecardPreview({
  probeScores,
  floor = DEFAULT_MELAE_FLOOR,
  now = new Date()
} = {}) {
  const normalized = Array.isArray(probeScores) ? probeScores.map(normalizeProbeScore) : [];
  const probeSet = summarizeProbeSet(normalized);
  const floorOk = finiteUnitNumber(floor);
  const complete =
    normalized.length === SAPE_PROBES.length &&
    probeSet.missing_probe_ids.length === 0 &&
    probeSet.unknown_probe_ids.length === 0 &&
    probeSet.duplicate_probe_ids.length === 0;
  const shapeOk = floorOk && complete && normalized.every(
    (probe) => probe.probe_id && finiteUnitNumber(probe.score) && finiteUnitNumber(probe.weight)
  );
  const weightedScore = shapeOk
    ? normalized.reduce((total, probe) => total + probe.score * probe.weight, 0)
    : null;
  const floorMet = weightedScore !== null && weightedScore >= floor;

  const scorecard = {
    schema: SAPE_SCORECARD_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    certifies: false,
    checked_at: now.toISOString(),
    floor: floorOk ? floor : DEFAULT_MELAE_FLOOR,
    weighted_score: weightedScore,
    verdict: shapeOk && floorMet ? "PARTIAL_PLACEHOLDER" : "PREVIEW_REJECT",
    probes: normalized,
    expected_probe_ids: probeIds(),
    checks: [
      { check: "probe_scores_are_array", pass: Array.isArray(probeScores) },
      { check: "all_required_probes_present_once", pass: complete },
      { check: "scores_and_weights_are_unit_numbers", pass: shapeOk },
      { check: "floor_met", pass: floorMet }
    ],
    ...probeSet,
    boundary: {
      canonical_sape_computed_here: false,
      runtime_gate_executed: false,
      receipt_minted: false,
      filesystem_write_performed: false
    }
  };
  scorecard.scorecard_digest = sha256Canonical({
    schema: scorecard.schema,
    floor: scorecard.floor,
    weighted_score: scorecard.weighted_score,
    probes: scorecard.probes.map(({ probe_id, score, weight }) => ({ probe_id, score, weight })),
    verdict: scorecard.verdict
  });
  return scorecard;
}

export function evaluateMelaeGatePreview({
  probeScores,
  snr,
  ihsan,
  floor = DEFAULT_MELAE_FLOOR,
  now = new Date()
} = {}) {
  const sape = buildSapeScorecardPreview({ probeScores, floor, now });
  const snrOk = finiteUnitNumber(snr);
  const ihsanOk = finiteUnitNumber(ihsan);
  const snrMet = snrOk && snr >= floor;
  const ihsanMet = ihsanOk && ihsan >= floor;
  const sapeMet = sape.verdict === "PARTIAL_PLACEHOLDER";

  return {
    schema: MELAE_GATE_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    certifies: false,
    checked_at: now.toISOString(),
    floor,
    snr: snrOk ? snr : null,
    ihsan: ihsanOk ? ihsan : null,
    sape,
    verdict: sapeMet && snrMet && ihsanMet ? "PARTIAL_PLACEHOLDER" : "PREVIEW_REJECT",
    checks: [
      { check: "sape_floor_met", pass: sapeMet },
      { check: "snr_floor_met", pass: snrMet },
      { check: "ihsan_floor_met", pass: ihsanMet }
    ],
    boundary: {
      production_certification_issued: false,
      runtime_gate_executed: false,
      receipt_minted: false,
      signature_emitted: false
    },
    note:
      "MELAE/SAPE is preview-only in Dema. It ranks evidence for review but does not certify " +
      "production, execute runtime gates, mint receipts, or emit signatures."
  };
}
