// SAT (System Agentic Team) verifier — PLACEHOLDER for v0.3.0.
//
// This is NOT the real SAT verifier. SAT-5 lives upstream in bizra-omega
// per docs/02-architecture/pat-builder-sat-validator.md. This placeholder
// exists so the active kernel can emit a verification report shape that
// future SAT-5 will fill, without making any false claim about
// certification today.
//
// What this DOES (the shallow check):
//   - Reads the receipt
//   - Verifies the receipt declares scope: "read-only"
//   - Verifies rollback_required is false
//   - Verifies a payload digest exists
//
// What this does NOT do:
//   - Re-derive the digest from the underlying observation (would require
//     re-running the task, which has its own observation cost)
//   - Run the 4-gate admissibility chain (Ihsān/Adl/Guardian/Confidence)
//   - Issue a binding PERMIT verdict
//
// Verdict shape mirrors the upstream GateVerdict enum (PERMIT/REJECT/
// REVIEW/SCORE_ONLY) for forward-compat. v0.3.0 only ever returns
// PARTIAL_PLACEHOLDER — never PERMIT — to make the boundary explicit.

export const SAT_PLACEHOLDER_SCHEMA = "bizra.dema.sat_verdict.v0.1";

export function verifyReceiptPlaceholder(receipt) {
  const checks = [];

  // Shallow check 1: scope must be declared read-only for a v0.3.0 task receipt.
  const scopeOk = receipt?.scope === "read-only";
  checks.push({
    check: "scope_declared_read_only",
    pass: scopeOk,
    detail: scopeOk
      ? `scope: read-only`
      : `expected scope: read-only, got: ${receipt?.scope ?? "(missing)"}`
  });

  // Shallow check 2: rollback_required must be false (no mutation to undo).
  const rollbackOk = receipt?.rollback_required === false;
  checks.push({
    check: "rollback_not_required",
    pass: rollbackOk,
    detail: rollbackOk
      ? `rollback_required: false`
      : `expected rollback_required: false, got: ${receipt?.rollback_required}`
  });

  // Shallow check 3: payload digest present (binds the receipt to its own contents).
  const digestOk =
    typeof receipt?.payload_digest === "string" && /^[0-9a-f]{64}$/.test(receipt.payload_digest);
  checks.push({
    check: "payload_digest_present",
    pass: digestOk,
    detail: digestOk
      ? `payload_digest: ${receipt.payload_digest.slice(0, 16)}…`
      : `payload_digest missing or malformed`
  });

  // Shallow check 4: receipt declares the placeholder verdict honestly.
  const honestyOk = receipt?.sat_verdict === "PARTIAL_PLACEHOLDER";
  checks.push({
    check: "verdict_honestly_declared_as_placeholder",
    pass: honestyOk,
    detail: honestyOk
      ? `receipt declares sat_verdict: PARTIAL_PLACEHOLDER (honest)`
      : `receipt claims sat_verdict: ${receipt?.sat_verdict} — placeholder MUST decline to over-claim`
  });

  const allPassed = checks.every((c) => c.pass);
  const verdict = allPassed ? "PARTIAL_PLACEHOLDER" : "REJECT";

  return {
    schema: SAT_PLACEHOLDER_SCHEMA,
    verdict,
    truth_label: "DECLARED",
    checked_at: new Date().toISOString(),
    receipt_id: receipt?.receipt_id ?? null,
    checks,
    note:
      "SAT verifier is a placeholder in v0.3.0. The shallow checks above only confirm the receipt declares the right shape — they do NOT certify admissibility. Real SAT verification arrives with v0.3.2 (verifier sibling) and the SAT-5 Rust roster (PLANNED upstream in bizra-data-lake). Per the autonomy envelope: an L4 receipt absent a real SAT verdict MUST be rejected by the chain reader."
  };
}

export function formatVerdict(verdict) {
  if (!verdict) return "(no verdict)";
  const lines = [
    `SAT verdict:    ${verdict.verdict}`,
    `Truth label:    ${verdict.truth_label}`,
    `Checked:        ${verdict.checked_at}`,
    ``,
    `Shallow checks:`
  ];
  for (const c of verdict.checks) {
    const mark = c.pass ? "✓" : "✗";
    lines.push(`  ${mark} ${c.check} — ${c.detail}`);
  }
  lines.push("");
  lines.push("Note:");
  lines.push(`  ${verdict.note}`);
  return lines.join("\n");
}

// ─── v0.3.2 SAT verifier sibling — dual-schema dispatch ────────────────
//
// Per docs/02-architecture/sat-verifier-sibling-spec.md (DECLARED 2026-05-07).
//
// Today's verifier handles only the task-receipt schema. Production receipts
// use TWO schemas: task receipts (Dema-issued) and gateway-handoff receipts
// (mirror of upstream-issued mission receipts like ARTIFACT-011). The probe
// run on 2026-05-07 confirmed gateway receipts had zero verifier coverage —
// not even placeholder-grade.
//
// `verifyReceipt(receipt)` is the single dispatch entry point. It routes by
// `receipt.schema`, falls closed on unknown schema, and returns a verdict in
// the existing `bizra.dema.sat_verdict.v0.1` envelope. The per-schema check
// lists differ; the verdict envelope is uniform.
//
// Truth-label discipline preserved: this verifier never returns PERMIT from
// local logic. Only real SAT-5 (PLANNED upstream in bizra-data-lake) issues
// PERMIT. v0.3.2 caps at PARTIAL_PLACEHOLDER for the happy path.

// Imported from a true-leaf module (no outbound imports) to break the
// file-resolution cycle that otherwise forms via
// core/behavioral-modulation.js -> verifier/* -> core/mission.js.
import { BOUNDED_DIAGNOSTIC_CONSENT_PHRASE } from "../../core/src/diagnostic-consent.js";

const TASK_RECEIPT_SCHEMA = "bizra.dema.task_receipt.v0.1";
const GATEWAY_HANDOFF_SCHEMA = "bizra.dema.gateway_receipt_handoff.v0.1";
const REQUIRED_GATEWAY_SCORERS = Object.freeze([
  "ZANN_ZERO",
  "CLAIM_MUST_BIND",
  "RIBA_ZERO",
  "NO_SHADOW_STATE",
  "IHSAN_FLOOR"
]);
const IHSAN_FLOOR = 0.95;

// Known action → canonical exact-string consent phrase. v0.3.2 lists
// only ARTIFACT-011's phrase. Future actions add entries; receipts
// with an unknown `action` fall back to "non-empty string" — informational.
const KNOWN_ACTION_PHRASES = Object.freeze({
  bounded_diagnostic_activation: BOUNDED_DIAGNOSTIC_CONSENT_PHRASE
});

export function verifyReceipt(receipt) {
  const schema = receipt?.schema;

  if (schema === TASK_RECEIPT_SCHEMA) {
    return verifyReceiptPlaceholder(receipt);
  }

  if (schema === GATEWAY_HANDOFF_SCHEMA) {
    return verifyGatewayHandoffReceipt(receipt);
  }

  // Fail-closed on unknown / missing schema (A4.5 §"Core law": rejective by default).
  return {
    schema: SAT_PLACEHOLDER_SCHEMA,
    verdict: "REJECT",
    truth_label: "DECLARED",
    checked_at: new Date().toISOString(),
    receipt_id: receipt?.receipt_id ?? null,
    checks: [
      {
        check: "schema_supported",
        pass: false,
        detail: `unsupported_schema: ${JSON.stringify(schema ?? null)} (expected ${TASK_RECEIPT_SCHEMA} or ${GATEWAY_HANDOFF_SCHEMA})`
      }
    ],
    note:
      "verifyReceipt: schema is missing or not in the supported set. Refused by default per A4.5 fail-closed rule. New schemas require an explicit handler before they may pass."
  };
}

export function verifyGatewayHandoffReceipt(receipt) {
  const checks = [];

  // Check 1: schema explicitly declared as gateway_receipt_handoff.
  const schemaOk = receipt?.schema === GATEWAY_HANDOFF_SCHEMA;
  checks.push({
    check: "schema_declared_as_gateway_handoff",
    pass: schemaOk,
    detail: schemaOk
      ? `schema: ${GATEWAY_HANDOFF_SCHEMA}`
      : `expected ${GATEWAY_HANDOFF_SCHEMA}, got: ${receipt?.schema ?? "(missing)"}`
  });

  // Check 2: truth_label is GATEWAY_ISSUED_HANDOFF (the Dema-side mirror label).
  const labelOk = receipt?.truth_label === "GATEWAY_ISSUED_HANDOFF";
  checks.push({
    check: "truth_label_is_gateway_handoff",
    pass: labelOk,
    detail: labelOk
      ? `truth_label: GATEWAY_ISSUED_HANDOFF`
      : `expected GATEWAY_ISSUED_HANDOFF, got: ${receipt?.truth_label ?? "(missing)"}`
  });

  // Check 3: gateway.admissibility_verdict === "Permit" (top-level recorded verdict).
  const verdictOk = receipt?.gateway?.admissibility_verdict === "Permit";
  checks.push({
    check: "gateway_admissibility_permit",
    pass: verdictOk,
    detail: verdictOk
      ? `gateway.admissibility_verdict: Permit`
      : `expected Permit, got: ${receipt?.gateway?.admissibility_verdict ?? "(missing)"}`
  });

  // Check 4: chain_head present and 64-hex (the upstream chain head this receipt was
  // sealed against).
  const chainHead = receipt?.gateway?.chain_head;
  const chainHeadOk = typeof chainHead === "string" && /^[0-9a-f]{64}$/.test(chainHead);
  checks.push({
    check: "chain_head_present_64hex",
    pass: chainHeadOk,
    detail: chainHeadOk
      ? `chain_head: ${chainHead.slice(0, 16)}…`
      : `chain_head missing or not 64-hex`
  });

  // Check 5: consent_phrase_record present AND, when the action is known to
  // require an exact phrase, byte-for-byte equality with the canonical phrase.
  // Per CodeRabbit + Copilot + Codex review feedback on PR #18 — non-empty
  // string was too loose for ARTIFACT-011, which the spec says MUST match
  // BOUNDED_DIAGNOSTIC_CONSENT_PHRASE byte-for-byte.
  const consentValue = receipt?.consent_phrase_record;
  const consentNonEmpty = typeof consentValue === "string" && consentValue.length > 0;
  const expectedPhrase = KNOWN_ACTION_PHRASES[receipt?.action];

  let consentPass;
  let consentDetail;
  if (!consentNonEmpty) {
    consentPass = false;
    consentDetail = "consent_phrase_record missing";
  } else if (expectedPhrase !== undefined) {
    if (consentValue === expectedPhrase) {
      consentPass = true;
      consentDetail = `consent_phrase matches canonical phrase for action '${receipt.action}'`;
    } else {
      consentPass = false;
      consentDetail =
        `consent_phrase_record does NOT match canonical phrase for action '${receipt.action}' ` +
        `(per A4.5 anti-pattern #4: shadow consent surfaces — only the exact phrase is valid)`;
    }
  } else {
    // Unknown action — no canonical phrase registered yet. Non-empty is
    // informational; future actions register their phrase in KNOWN_ACTION_PHRASES.
    consentPass = true;
    consentDetail =
      `consent_phrase_record present (${consentValue.length} chars; ` +
      `action '${receipt?.action ?? "?"}' has no canonical phrase registered yet — informational)`;
  }
  checks.push({
    check: "consent_phrase_recorded_and_canonical",
    pass: consentPass,
    detail: consentDetail
  });

  // Check 6: gate verdicts (when exposed) — all required scorers Permit, IHSAN ≥ 0.95.
  const gateVerdicts = receipt?.preserved_post_response_body?.admissibility?.gateVerdicts;
  if (Array.isArray(gateVerdicts) && gateVerdicts.length > 0) {
    const allPermit = gateVerdicts.every((v) => v?.verdict === "Permit");
    const presentScorers = new Set(gateVerdicts.map((v) => v?.scorerId));
    const missingScorers = REQUIRED_GATEWAY_SCORERS.filter((s) => !presentScorers.has(s));
    const ihsanScore = gateVerdicts.find((v) => v?.scorerId === "IHSAN_FLOOR")?.score;
    const ihsanOk = typeof ihsanScore === "number" && ihsanScore >= IHSAN_FLOOR;
    const gatesOk = allPermit && missingScorers.length === 0 && ihsanOk;
    checks.push({
      check: "gate_verdicts_all_permit_with_required_scorers",
      pass: gatesOk,
      detail: gatesOk
        ? `${gateVerdicts.length} gates Permit; required scorers present; IHSAN ${ihsanScore.toFixed(2)} ≥ ${IHSAN_FLOOR}`
        : `gate issue: missing=[${missingScorers.join(",") || "none"}], all_permit=${allPermit}, ihsan=${ihsanScore ?? "missing"}`
    });
  } else {
    // SOFT finding — informational, not blocking. Per spec §"Receipt-shape
    // integrity rules" + 3-reviewer convergence on PR #18: absence of the
    // scorer breakdown does not invalidate the receipt; the gateway's top-level
    // admissibility_verdict (already checked above) is the load-bearing field.
    // Real SAT-5 will resolve this by querying the live gateway directly when
    // the Rust roster lands upstream. Keep as pass:true so the aggregate
    // verdict stays non-REJECT when only this check is informational.
    checks.push({
      check: "gate_verdicts_exposed",
      pass: true,
      detail:
        "preserved_post_response_body.admissibility.gateVerdicts not exposed in this receipt — informational; live cross-check (PLANNED with real SAT-5 upstream) would resolve"
    });
  }

  const allPassed = checks.every((c) => c.pass);
  const verdict = allPassed ? "PARTIAL_PLACEHOLDER" : "REJECT";

  return {
    schema: SAT_PLACEHOLDER_SCHEMA,
    verdict,
    truth_label: "DECLARED",
    checked_at: new Date().toISOString(),
    receipt_id: receipt?.receipt_id ?? null,
    checks,
    note:
      "Gateway handoff receipt verification is PLACEHOLDER-GRADE in v0.3.2. " +
      "The shallow checks above confirm the receipt declares the right shape and " +
      "that the gateway returned Permit at issuance time — they do NOT cross-check " +
      "the live gateway /chain (offline-safe), do NOT re-derive the niyyah evidence " +
      "hash, and do NOT certify the upstream admissibility chain's verdict beyond " +
      "reading the recorded value. Real verification with live cross-check arrives " +
      "when the SAT-5 Rust roster lands upstream in bizra-data-lake."
  };
}
