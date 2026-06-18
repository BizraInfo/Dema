// DEMA-QUALITY-DELIVERY-SPINE-1A · UX first-look quality gate (stdlib only).

export const FIRST_LOOK_FORBIDDEN_PATTERNS = Object.freeze([
  /\bRing\s*0\b/i,
  /\bURP\b/,
  /gateway\s+unreachable/i,
  /runtime_not_measured/i,
  /declared_with_ihsan/i,
  /\bgather\b/i,
  /\bN=1\b/,
  /\bARTIFACT-\d+/i,
  /readiness\s+jargon/i,
]);

export const FIRST_LOOK_REQUIRED_MARKERS = Object.freeze([
  { id: "welcome", pattern: /welcome/i },
  { id: "recommended_next", pattern: /recommended next step/i },
  { id: "preview_boundary", pattern: /preview-only/i },
  { id: "doctor_path", pattern: /dema doctor/i },
  { id: "debug_path", pattern: /dema realm --debug/i },
]);

export function evaluateUxFirstLook(text) {
  const body = typeof text === "string" ? text : "";
  const violations = [];
  for (const re of FIRST_LOOK_FORBIDDEN_PATTERNS) {
    if (re.test(body)) violations.push(re.source);
  }
  const missing = [];
  for (const marker of FIRST_LOOK_REQUIRED_MARKERS) {
    if (!marker.pattern.test(body)) missing.push(marker.id);
  }
  return Object.freeze({
    pass: violations.length === 0 && missing.length === 0,
    violations: Object.freeze([...violations]),
    missing: Object.freeze([...missing]),
  });
}

export function evaluateUxFirstLookEnvelope(envelope) {
  const rendered =
    typeof envelope?.rendered_text === "string"
      ? envelope.rendered_text
      : "";
  const ux = evaluateUxFirstLook(rendered);
  const actions = Array.isArray(envelope?.simple_actions)
    ? envelope.simple_actions
    : [];
  const hasThreeActions = actions.length >= 3;
  const missing = [...ux.missing];
  if (!hasThreeActions) missing.push("three_simple_actions");
  return Object.freeze({
    ...ux,
    pass: ux.pass && hasThreeActions,
    action_count: actions.length,
    missing: Object.freeze(missing),
  });
}
