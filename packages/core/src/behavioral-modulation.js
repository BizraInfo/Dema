import { evaluateIhsanFloorPreview } from "../../verifier/src/ihsan-floor-preview.js";
import {
  buildEvidenceReceiptPreview,
  verifyEvidenceReceiptPreview
} from "../../verifier/src/evidence-receipt-preview.js";

export const BEHAVIORAL_MODULATION_PREVIEW_SCHEMA =
  "bizra.dema.behavioral_modulation_preview.v0.1";
export const BEHAVIORAL_MODULATION_CONSENT_PHRASE =
  "GO: preview behavioral modulation only";

const FORBIDDEN_TECHNIQUES = [
  { code: "covert_persuasion", pattern: /\b(covert|subliminal|without (?:them|user) knowing)\b/i },
  { code: "manipulation", pattern: /\bmanipulat(?:e|ion|ive)\b/i },
  { code: "dark_pattern", pattern: /\bdark pattern\b/i },
  { code: "addiction_loop", pattern: /\b(addict(?:ion|ive)?|hook(?:ed)?|compulsion)\b/i },
  { code: "emotional_exploitation", pattern: /\bexploit (?:fear|guilt|shame|loneliness)\b/i },
  { code: "financial_pressure", pattern: /\bpressure .* (?:buy|pay|invest|token|reward)\b/i }
];

const ALLOWED_SURFACES = new Set([
  "tone",
  "prioritization",
  "safety_boundary",
  "interface_guidance",
  "recommendation_style"
]);

function classifySurface(intent) {
  const text = intent.toLowerCase();
  if (/\btone|voice|wording|language\b/.test(text)) return "tone";
  if (/\bprioriti[sz]e|rank|order|focus\b/.test(text)) return "prioritization";
  if (/\bsafety|boundary|block|gate|halt\b/.test(text)) return "safety_boundary";
  if (/\binterface|ui|display|show|guide\b/.test(text)) return "interface_guidance";
  return "recommendation_style";
}

function forbiddenFindings(intent) {
  return FORBIDDEN_TECHNIQUES
    .filter(({ pattern }) => pattern.test(intent))
    .map(({ code }) => code);
}

function check(name, pass, detail) {
  return { check: name, pass, detail };
}

export function buildBehavioralModulationPreview({
  intent,
  consentPhrase = "",
  ihsanScore = 0.95,
  now = new Date()
} = {}) {
  const naturalLanguage = String(intent ?? "").trim();
  const surface = naturalLanguage ? classifySurface(naturalLanguage) : null;
  const forbidden = naturalLanguage ? forbiddenFindings(naturalLanguage) : [];
  const consentAccepted = consentPhrase === BEHAVIORAL_MODULATION_CONSENT_PHRASE;
  const ihsan = evaluateIhsanFloorPreview({ score: ihsanScore, now });

  const checks = [
    check(
      "intent_non_empty",
      naturalLanguage.length > 0,
      naturalLanguage.length > 0 ? "intent present" : "intent required"
    ),
    check(
      "exact_preview_consent_phrase",
      consentAccepted,
      consentAccepted
        ? "exact preview consent phrase matched"
        : `expected ${JSON.stringify(BEHAVIORAL_MODULATION_CONSENT_PHRASE)}`
    ),
    check(
      "surface_is_allowed_preview_class",
      surface !== null && ALLOWED_SURFACES.has(surface),
      surface ? `surface=${surface}` : "surface unavailable without intent"
    ),
    check(
      "forbidden_behavior_shaping_absent",
      forbidden.length === 0,
      forbidden.length === 0 ? "no forbidden behavior-shaping pattern detected" : forbidden.join(",")
    ),
    check(
      "ihsan_floor_preview_not_rejected",
      ihsan.verdict !== "PREVIEW_REJECT",
      `ihsan_floor_verdict=${ihsan.verdict}`
    )
  ];

  const verdict = checks.every((item) => item.pass) ? "PARTIAL_PLACEHOLDER" : "PREVIEW_REJECT";
  const proposedModulation = {
    surface,
    consent_level: "C1_SUGGEST",
    user_visible: true,
    reversible: true,
    hidden_personalization: false,
    external_effect: false,
    economic_or_governance_effect: false,
    execution_enabled: false,
    proposed_rule:
      surface === null
        ? null
        : "Adjust only visible guidance behavior inside the requested scope; do not execute actions."
  };

  const policy = {
    version: "behavioral_modulation_preview.v0.1",
    exact_consent_phrase: BEHAVIORAL_MODULATION_CONSENT_PHRASE,
    allowed_surfaces: [...ALLOWED_SURFACES].sort(),
    forbidden_techniques: FORBIDDEN_TECHNIQUES.map((item) => item.code),
    required_properties: ["user_visible", "reversible", "hidden_personalization:false"]
  };

  const receiptPreview = buildEvidenceReceiptPreview({
    input: {
      intent: naturalLanguage,
      consent_phrase_supplied: consentPhrase
    },
    output: proposedModulation,
    policy,
    toolCalls: [],
    decision: {
      verdict,
      ihsan_floor_preview: ihsan
    },
    now
  });
  const receiptPreviewVerdict = {
    ...verifyEvidenceReceiptPreview(receiptPreview),
    checked_at: now.toISOString()
  };

  return {
    schema: BEHAVIORAL_MODULATION_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    generated_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    certifies: false,
    verdict,
    intent: naturalLanguage,
    proposed_modulation: proposedModulation,
    constitutional_gate: {
      status: verdict,
      checks
    },
    ihsan_floor_preview: ihsan,
    evidence_receipt_preview: receiptPreview,
    evidence_receipt_preview_verdict: receiptPreviewVerdict,
    boundary: {
      approval_recorded: false,
      capability_minted: false,
      receipt_minted: false,
      runtime_gate_executed: false,
      behavior_changed: false,
      external_effect: false,
      hidden_modulation_allowed: false,
      identity_bound: false,
      network_connection_attempted: false,
      external_posting_performed: false
    }
  };
}

export function formatBehavioralModulationPreview(preview) {
  const lines = [
    "DEMA Behavioral Modulation Preview",
    "",
    `Mode: ${preview.mode}`,
    `Verdict: ${preview.verdict}`,
    `Intent: ${preview.intent || "(missing)"}`,
    `Surface: ${preview.proposed_modulation.surface ?? "(none)"}`,
    `Consent level: ${preview.proposed_modulation.consent_level}`,
    `Receipt preview digest: ${preview.evidence_receipt_preview.self_digest}`,
    "",
    "Constitutional checks:"
  ];

  for (const item of preview.constitutional_gate.checks) {
    lines.push(`  - ${item.pass ? "PASS" : "REJECT"} ${item.check}: ${item.detail}`);
  }

  lines.push("");
  lines.push(
    "Boundary: preview-only; no approval recorded; no behavior changed; no receipt minted; no network; no external posting."
  );
  return lines.join("\n");
}
