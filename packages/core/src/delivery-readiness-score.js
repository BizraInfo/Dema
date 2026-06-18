// DEMA-QUALITY-DELIVERY-SPINE-1A · delivery readiness scoring (read-only).

export const TRUTH_LABELS = Object.freeze([
  "DESIGNED",
  "IMPLEMENTED_LOCAL",
  "TESTED_LOCAL",
  "MAINLINE_SEALED",
  "SIGNED",
  "ECONOMICALLY_MEASURED",
  "NOT_LIVE",
]);

export const DEFAULT_RENDER_EFFECT_BOUNDARY = Object.freeze({
  render_only: true,
  effect_class: "read_render",
  consent_required: false,
  writes_files: false,
  uses_network: false,
  generates_keys: false,
  signs_receipts: false,
  starts_daemon: false,
  touches_datalake: false,
  touches_tokens: false,
});

export function assertProofBoundary(boundary) {
  const proves =
    typeof boundary?.what_this_proves === "string" &&
    boundary.what_this_proves.length > 0;
  const doesNot =
    typeof boundary?.what_this_does_not_prove === "string" &&
    boundary.what_this_does_not_prove.length > 0;
  return Object.freeze({
    pass: proves && doesNot,
    has_what_this_proves: proves,
    has_what_this_does_not_prove: doesNot,
  });
}

export function scoreEffectBoundary(boundary, expected = DEFAULT_RENDER_EFFECT_BOUNDARY) {
  const mismatches = [];
  for (const key of Object.keys(expected)) {
    if (boundary?.[key] !== expected[key]) mismatches.push(key);
  }
  return Object.freeze({
    pass: mismatches.length === 0,
    mismatches: Object.freeze([...mismatches]),
  });
}

export function computeDeliveryReadiness({
  ux = { pass: false },
  proof = { pass: false },
  security = { pass: false },
  performance = { pass: true },
} = {}) {
  const gates = Object.freeze({
    ux: Boolean(ux.pass),
    proof: Boolean(proof.pass),
    security: Boolean(security.pass),
    performance: Boolean(performance.pass),
  });
  const pass = gates.ux && gates.proof && gates.security && gates.performance;
  const score =
    (Number(gates.ux) +
      Number(gates.proof) +
      Number(gates.security) +
      Number(gates.performance)) /
    4;
  return Object.freeze({
    schema: "bizra.dema.delivery_readiness_score.v1",
    truth_label: pass ? "TESTED_LOCAL" : "IMPLEMENTED_LOCAL",
    pass,
    score,
    gates,
    what_this_proves:
      "Automated delivery-readiness gates evaluated for the first-look companion surface.",
    what_this_does_not_prove:
      "Does not prove production readiness, runtime activation, economic measurement, or signed release.",
  });
}
