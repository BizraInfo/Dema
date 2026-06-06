export function evaluateConsent({ phrase, requiredPhrase }) {
  const accepted = phrase === requiredPhrase;
  return {
    schema: "bizra.dema.fate_consent.v0.1",
    accepted,
    verdict: accepted ? "PERMIT_PREVIEW" : "BLOCK",
    truthLabel: "MEASURED",
    reason: accepted
      ? "Exact consent phrase matched."
      : "Exact consent phrase not provided.",
    requirement: "Exact phrase match; no fuzzy consent.",
  };
}
