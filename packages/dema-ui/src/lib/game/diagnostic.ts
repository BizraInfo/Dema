// ============================================================================
// bizra.dema.ui_preview.diagnostic.v0.1 — Forwarder Diagnostic Doxology (UI game)
// PREVIEW_ONLY / SYNTHETIC_DEMO. This is a client-side game mechanic that
// TEACHES the FDE lens vocabulary — it does NOT import, wrap, or certify the
// real shipped FDE kernel. Nothing produced here is a certified receipt.
//
// Core Law (taught, not enforced by any real kernel):
//   If the code failed, patch the code.       (Inward)
//   If the proof failed, repair the proof.    (Inward)
//   If the world failed, repair the env.      (Outward)
//   If consent is missing, stop.              (Boundary)
//   If impact is simulated, do not mint.      (Economy)
//   If cost is measured, do not call it value.(Metrics)
//
// Critical invariant: A failure classification CANNOT increase system authority.
// ============================================================================

import type { AgentColor } from "./types";

export type FailureLens = "inward" | "outward" | "boundary" | "economy" | "metrics" | "governance";
export type FailureClass =
  | "code"
  | "proof"
  | "schema"
  | "ci_unavailable"
  | "permission"
  | "device_unregistered"
  | "network"
  | "consent_missing"
  | "impact_simulated"
  | "cost_measured"
  | "public_safety_unproven";

export type AllowedAction =
  | "autopatch"
  | "proof_repair"
  | "environment_repair"
  | "operator_action"
  | "stop"
  | "diagnose"
  | "report_cost"
  | "keep_private";

export interface FailureClassDef {
  id: FailureClass;
  label: string;
  lens: FailureLens;
  glyph: string;
  color: AgentColor;
  examples: string;
  allowed: AllowedAction[];
  forbidden: string;
  authority_delta: 0 | -1; // never positive — the invariant
}

// ---------------------------------------------------------------------------
// THE DECISION MATRIX — sealed, exhaustive, non-bypassable
// ---------------------------------------------------------------------------
export const FAILURE_CLASSES: FailureClassDef[] = [
  {
    id: "code",
    label: "Code Failure",
    lens: "inward",
    glyph: "🔨",
    color: "verified",
    examples: "unit test failure, logic regression, broken canonical JSON",
    allowed: ["autopatch", "proof_repair", "diagnose"],
    forbidden: "do not hide the failure; receipt required",
    authority_delta: 0,
  },
  {
    id: "proof",
    label: "Proof Failure",
    lens: "inward",
    glyph: "⛓",
    color: "proof",
    examples: "stale receipt hash, broken chain, invalid manifest",
    allowed: ["proof_repair", "diagnose"],
    forbidden: "do not weaken the verifier to pass",
    authority_delta: 0,
  },
  {
    id: "schema",
    label: "Schema Failure",
    lens: "inward",
    glyph: "📐",
    color: "knowledge",
    examples: "schema mismatch, missing required field, invalid tree-map label",
    allowed: ["autopatch", "proof_repair", "diagnose"],
    forbidden: "do not bypass the validator",
    authority_delta: 0,
  },
  {
    id: "ci_unavailable",
    label: "CI Unavailable",
    lens: "outward",
    glyph: "🚫",
    color: "fail",
    examples: "GitHub Actions down, runner unavailable, billing lock",
    allowed: ["stop", "diagnose", "operator_action"],
    forbidden: "do not call CI failure a code failure",
    authority_delta: 0,
  },
  {
    id: "permission",
    label: "Permission Missing",
    lens: "outward",
    glyph: "🔑",
    color: "consent",
    examples: "missing GitHub permission, drive connector unauthorized",
    allowed: ["stop", "diagnose", "operator_action"],
    forbidden: "do not weaken gates; do not fake connectivity",
    authority_delta: 0,
  },
  {
    id: "device_unregistered",
    label: "Device Unregistered",
    lens: "outward",
    glyph: "📱",
    color: "fail",
    examples: "phone not registered, external device disconnected, path not mounted",
    allowed: ["stop", "diagnose", "operator_action"],
    forbidden: "do not pretend it is connected",
    authority_delta: 0,
  },
  {
    id: "network",
    label: "Network Failure",
    lens: "outward",
    glyph: "📡",
    color: "unknown",
    examples: "network unreachable, endpoint timeout, DNS failure",
    allowed: ["stop", "diagnose"],
    forbidden: "do not mark blocked external state as verified",
    authority_delta: 0,
  },
  {
    id: "consent_missing",
    label: "Consent Missing",
    lens: "boundary",
    glyph: "🜪",
    color: "consent",
    examples: "identity/seal action without exact consent, blanket consent",
    allowed: ["stop", "diagnose"],
    forbidden: "no action; no autopatch; no mint",
    authority_delta: -1,
  },
  {
    id: "impact_simulated",
    label: "Impact Simulated",
    lens: "economy",
    glyph: "◈",
    color: "consent",
    examples: "preview-only Impact Tokens treated as real value",
    allowed: ["diagnose", "report_cost"],
    forbidden: "do not mint; simulation is not value",
    authority_delta: -1,
  },
  {
    id: "cost_measured",
    label: "Cost Measured",
    lens: "metrics",
    glyph: "📊",
    color: "snr",
    examples: "compute cost reported as token value",
    allowed: ["report_cost", "diagnose"],
    forbidden: "cost ≠ value; report only",
    authority_delta: 0,
  },
  {
    id: "public_safety_unproven",
    label: "Public Safety Unproven",
    lens: "governance",
    glyph: "🛡",
    color: "fail",
    examples: "claiming PUBLIC_SAFE without remote proof",
    allowed: ["keep_private", "diagnose"],
    forbidden: "no public claim; stay local",
    authority_delta: -1,
  },
];

export const failureById = (id: FailureClass) =>
  FAILURE_CLASSES.find((f) => f.id === id)!;

export const LENS_META: Record<FailureLens, { label: string; glyph: string; color: AgentColor; law: string }> = {
  inward: { label: "Inward", glyph: "↻", color: "verified", law: "Repair the defect. Receipt required." },
  outward: { label: "Outward", glyph: "↯", color: "fail", law: "Stop. Diagnose. Ask the operator." },
  boundary: { label: "Boundary", glyph: "🜪", color: "consent", law: "Stop. No action without consent." },
  economy: { label: "Economy", glyph: "◈", color: "consent", law: "Do not mint. Simulation is not value." },
  metrics: { label: "Metrics", glyph: "📊", color: "snr", law: "Report cost only. Cost is not value." },
  governance: { label: "Governance", glyph: "🛡", color: "fail", law: "Keep private. No public claim." },
};

// ---------------------------------------------------------------------------
// CLASSIFIER — given an observed failure, returns the sealed verdict
// ---------------------------------------------------------------------------
export interface FailureInput {
  source: string;
  message: string;
  evidence: string[];
  implicated: {
    code?: boolean;
    proof?: boolean;
    environment?: boolean;
    consent?: boolean;
    impact?: boolean;
  };
}

export interface DiagnosticVerdict {
  schema: "bizra.dema.ui_preview.diagnostic.v0.1";
  truth_label: "PREVIEW_ONLY";
  certifies: false;
  source_kind: "SYNTHETIC_DEMO";
  input: FailureInput;
  failure_class: FailureClassDef;
  lens: FailureLens;
  allowed_actions: AllowedAction[];
  forbidden: string;
  authority_delta: 0 | -1;
  autopatch_allowed: boolean;
  proof_repair_allowed: boolean;
  environment_repair_required: boolean;
  operator_action_required: boolean;
  mint_allowed: boolean;
  continue_allowed: boolean;
  receipt_required: true;
  receipt_type: "diagnostic_doxology";
  proves: string;
  does_not_prove: string;
  observed_at: number;
}

/**
 * classify — pure function. The sealed classifier.
 * Rule precedence (deliberate, non-bypassable):
 *   1. consent_missing   → Boundary (hard stop)
 *   2. impact_simulated  → Economy  (no mint)
 *   3. environment       → Outward  (stop, do not patch code)
 *   4. proof             → Inward   (repair proof)
 *   5. code/schema       → Inward   (patch)
 * Default → outward (fail safe; never autopatch on ambiguous evidence)
 */
export function classify(input: FailureInput): DiagnosticVerdict {
  let cls: FailureClass;
  if (input.implicated.consent) cls = "consent_missing";
  else if (input.implicated.impact) cls = "impact_simulated";
  else if (input.implicated.environment) {
    // distinguish outward sub-classes by message signal
    if (/permission|github|drive|connector/i.test(input.message)) cls = "permission";
    else if (/phone|device|registered|mount/i.test(input.message)) cls = "device_unregistered";
    else if (/network|dns|timeout|unreachable/i.test(input.message)) cls = "network";
    else cls = "ci_unavailable";
  } else if (input.implicated.proof) cls = "proof";
  else if (input.implicated.code) cls = "code";
  else cls = "code"; // schema falls here; message signals refine

  // public_safety override — governance lens
  if (/public.?safe|ready.?remote|federation/i.test(input.message)) cls = "public_safety_unproven";
  // cost override
  if (/cost|billing|budget/i.test(input.message) && !input.implicated.code) cls = "cost_measured";

  const def = failureById(cls);
  const lens = def.lens;
  const inward = lens === "inward";
  const outward = lens === "outward";

  return {
    schema: "bizra.dema.ui_preview.diagnostic.v0.1",
    truth_label: "PREVIEW_ONLY",
    certifies: false,
    source_kind: "SYNTHETIC_DEMO",
    input,
    failure_class: def,
    lens,
    allowed_actions: def.allowed,
    forbidden: def.forbidden,
    authority_delta: def.authority_delta,
    autopatch_allowed: inward && def.allowed.includes("autopatch"),
    proof_repair_allowed: inward && def.allowed.includes("proof_repair"),
    environment_repair_required: outward,
    operator_action_required: outward,
    mint_allowed: false, // never — minting is a separate consent-gated path
    continue_allowed: inward,
    receipt_required: true,
    receipt_type: "diagnostic_doxology",
    proves: inward
      ? `Inward defect identified (${def.label}). Repair permitted within existing authority.`
      : `${LENS_META[lens].label} condition (${def.label}). Authority may not increase. ${LENS_META[lens].law}`,
    does_not_prove: outward
      ? "Does not prove code is defective. Does not prove connectivity. Does not prove public safety."
      : "Does not prove the repair is correct until re-verification. Does not prove public safety.",
    observed_at: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Preview log-entry shape (what the in-game ledger stores)
// NOT a receipt: certifies:false, truth_label PREVIEW_ONLY on the verdict.
// demo_ref is a deterministic, non-cryptographic display string — never
// present it, store it, or bind it as a receipt hash / content address.
// ---------------------------------------------------------------------------
export interface DiagnosticReceipt {
  id: string;
  demo_ref: string;
  verdict: DiagnosticVerdict;
  forged_at: number;
}

const HEX = "0123456789abcdef";
function demoRefStr(s: string): string {
  // deterministic display string derived from content (NOT Math.random,
  // NOT cryptographic) — labeled non-evidence via DiagnosticReceipt.demo_ref
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let out = "demo-";
  for (let i = 0; i < 6; i++) {
    out += HEX[(h >>> (i * 4)) & 0xf];
  }
  out += "…";
  for (let i = 6; i < 10; i++) {
    out += HEX[(h >>> (i * 4)) & 0xf];
  }
  return out;
}

export function forgeDiagnosticReceipt(
  verdict: DiagnosticVerdict
): DiagnosticReceipt {
  const canonical =
    verdict.schema +
    "|" +
    verdict.failure_class.id +
    "|" +
    verdict.input.source +
    "|" +
    verdict.input.message +
    "|" +
    verdict.observed_at;
  return {
    id: "dx_" + Math.random().toString(36).slice(2, 9),
    demo_ref: demoRefStr(canonical),
    verdict,
    forged_at: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Sample failure scenarios — for the operator to practice classification
// (used by the Diagnostic Doxology scene)
// ---------------------------------------------------------------------------
export interface ScenarioCase {
  id: string;
  title: string;
  input: FailureInput;
  // the sealed-correct class for scoring
  correct: FailureClass;
  explanation: string;
}

export const DIAGNOSTIC_SCENARIOS: ScenarioCase[] = [
  {
    id: "d1",
    title: "Test suite exits non-zero after a refactor",
    input: {
      source: "ci-runner",
      message: "unit test failure in proof-forge module",
      evidence: ["exit code 1", "stack trace in log"],
      implicated: { code: true },
    },
    correct: "code",
    explanation: "Inward — code defect. Autopatch + proof repair allowed. Receipt required. Do not hide the failure.",
  },
  {
    id: "d2",
    title: "GitHub Actions runner is unreachable",
    input: {
      source: "ci-connector",
      message: "GitHub Actions unavailable",
      evidence: ["5xx from api.github.com", "runner offline"],
      implicated: { environment: true },
    },
    correct: "ci_unavailable",
    explanation: "Outward — environment failure. Stop. Diagnose. Do NOT call this a code failure. Do not weaken gates.",
  },
  {
    id: "d3",
    title: "Daemon requests sealing node identity without prompting",
    input: {
      source: "daemon-core",
      message: "auto-seal identity action requested",
      evidence: ["no consent event in ledger"],
      implicated: { consent: true },
    },
    correct: "consent_missing",
    explanation: "Boundary — consent missing. Hard stop. No autopatch, no mint. Authority delta −1.",
  },
  {
    id: "d4",
    title: "Service tries to mint Impact Tokens as fiat value",
    input: {
      source: "token-economy",
      message: "mint real Impact Tokens",
      evidence: ["preview-only flag set", "no wallet configured"],
      implicated: { impact: true },
    },
    correct: "impact_simulated",
    explanation: "Economy — impact is simulated. Do not mint. Simulation is not value. Report cost only.",
  },
  {
    id: "d5",
    title: "Phone bridge reports device not registered",
    input: {
      source: "phone-bridge",
      message: "phone not registered with service",
      evidence: ["registration table empty"],
      implicated: { environment: true },
    },
    correct: "device_unregistered",
    explanation: "Outward — device unregistered. Stop. Ask operator to register. Do not pretend it is connected.",
  },
  {
    id: "d6",
    title: "Receipt hash does not match previous in chain",
    input: {
      source: "proof-forge",
      message: "stale receipt hash, broken chain link",
      evidence: ["chain.verify() → MISMATCH at index 4"],
      implicated: { proof: true },
    },
    correct: "proof",
    explanation: "Inward — proof failure. Repair the proof. Do not weaken the verifier to pass.",
  },
  {
    id: "d7",
    title: "Draft claims the node is PUBLIC_SAFE",
    input: {
      source: "release-bay",
      message: "claiming PUBLIC_SAFE without remote proof",
      evidence: ["no federation runtime", "no remote attestation"],
      implicated: { environment: true },
    },
    correct: "public_safety_unproven",
    explanation: "Governance — public safety unproven. Keep private. No public claim. Stay LOCAL_ONLY.",
  },
  {
    id: "d8",
    title: "Compute cost reported as token value",
    input: {
      source: "resource-steward",
      message: "compute cost measured at 42 units",
      evidence: ["steward.cost_log entry 9912"],
      implicated: { impact: false },
    },
    correct: "cost_measured",
    explanation: "Metrics — cost measured. Report cost only. Cost is not value. Do not mint.",
  },
];
