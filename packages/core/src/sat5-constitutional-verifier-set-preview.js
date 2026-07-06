// SAT5-CONSTITUTIONAL-VERIFIER-SET-PREVIEW-1A — Preview-only SAT-5 constitutional verifier set: five deterministic verifier passes (receipt/hash integrity, consent/FATE, impact/no-riba, security/blast-radius, governance/doctrine) that JUDGE a Node0 outcome — fail-closed admissibility, SAT judges Node0 and does not serve it, inert output with no authority, no mint, no live SAT agent.
//
// RED-FIRST kernel scaffold. `plan` and `build...Payload` are real (consent gate +
// content addressing are universal); the slice-specific `verify` / `run` bodies
// throw `not_implemented` until you build them. Turn the mirrored test green
// before any commit — do not weaken the test to match an empty kernel.
//
// Pure kernel: no fs / network / process / clock / random unless injected and
// documented in this header. Every claim here is a preview; the boundary is all-false.

import { createHash } from "node:crypto";

export const SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_SCHEMA = "bizra.dema.sat5_constitutional_verifier_set_preview.v0.1";
export const SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_TRUTH_LABEL = "SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_MEASURED_REPO";
export const SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_GO_PHRASE = "GO: run sat5 constitutional verifier set";

// The five SAT roles. This is the PREVIEW DESIGN of the constitutional judge —
// NOT live SAT autonomy (that stays DESIGNED_NOT_LIVE). Core law: SAT judges
// Node0; it does not serve Node0. The law applies to the founder/Node0 first.
export const SAT_VERIFIER_ROLES = Object.freeze([
  { id: "SAT-1", role: "receipt_hash_integrity" },
  { id: "SAT-2", role: "consent_fate" },
  { id: "SAT-3", role: "impact_no_riba_economic_integrity" },
  { id: "SAT-4", role: "security_blast_radius" },
  { id: "SAT-5", role: "governance_doctrine" },
]);

export const SAT_VERDICTS = Object.freeze(["PASS", "FAIL", "ABSTAIN"]);

// Impact tripwires (SAT-3, no-riba/no-zann). Any true flag fails the pass.
export const SAT_IMPACT_TRIPWIRES = Object.freeze([
  "mint_claim",
  "cost_called_value",
  "simulated_impact_as_real",
  "unverified_impact_claimed",
]);

const BLAST_LEVELS = Object.freeze(["low", "medium", "high"]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isBool(v) {
  return typeof v === "boolean";
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

// Each verifier is a pure deterministic judge over injected facts. It returns
// PASS (evidence positively satisfies the law), FAIL (law violated), or ABSTAIN
// (insufficient evidence). ABSTAIN is fail-closed downstream — never eligible.
function verifierVerdict(id, ok, failReasons, abstainWhen) {
  if (abstainWhen) return { id, verdict: "ABSTAIN", reasons: Object.freeze(["insufficient_evidence"]) };
  return { id, verdict: ok ? "PASS" : "FAIL", reasons: Object.freeze(ok ? [] : [...failReasons]) };
}

export function deriveSatVerifierSet(outcome) {
  const roleOf = (id) => SAT_VERIFIER_ROLES.find((r) => r.id === id).role;

  // SAT-1 — receipt / hash integrity: the claimed content hash must re-derive.
  const r = outcome.receipt;
  const sat1 = verifierVerdict(
    "SAT-1",
    isNonEmptyString(r.claimed_content_hash) &&
      isNonEmptyString(r.body_hash_rederived) &&
      r.claimed_content_hash === r.body_hash_rederived,
    ["receipt_hash_mismatch"],
    !isNonEmptyString(r.claimed_content_hash) || !isNonEmptyString(r.body_hash_rederived),
  );

  // SAT-2 — consent / FATE: exact-string consent must be present and matched.
  const c = outcome.consent;
  const sat2 = verifierVerdict("SAT-2", c.phrase_present === true && c.exact_match === true, ["consent_absent_or_inexact"], false);

  // SAT-3 — impact / no-riba: no riba/zann tripwire may be asserted.
  const impact = outcome.impact;
  const tripped = SAT_IMPACT_TRIPWIRES.filter((k) => impact[k] === true);
  const sat3 = verifierVerdict("SAT-3", tripped.length === 0, tripped.map((k) => `riba_zann:${k}`), false);

  // SAT-4 — security / blast-radius: low passes; medium/high require reversible + backup.
  const b = outcome.blast;
  const blastKnown = BLAST_LEVELS.includes(b.blast_radius);
  const sat4Pass =
    blastKnown &&
    (b.blast_radius === "low" || (b.reversible === true && b.backup_present === true));
  const sat4 = verifierVerdict("SAT-4", sat4Pass, ["blast_radius_unmitigated"], !blastKnown);

  // SAT-5 — governance / doctrine: truth label present, boundary all-false, no
  // forbidden claims. SAT-5 is the meta-judge; it judges Node0, never serves it.
  const d = outcome.doctrine;
  const forbidden = Array.isArray(d.forbidden_claims) ? d.forbidden_claims.filter(isNonEmptyString) : [];
  const sat5Pass = d.truth_label_present === true && d.boundary_all_false === true && forbidden.length === 0;
  const sat5 = verifierVerdict(
    "SAT-5",
    sat5Pass,
    [
      ...(d.truth_label_present === true ? [] : ["truth_label_absent"]),
      ...(d.boundary_all_false === true ? [] : ["boundary_not_all_false"]),
      ...forbidden.map((f) => `forbidden_claim:${f}`),
    ],
    false,
  );

  const verifiers = [sat1, sat2, sat3, sat4, sat5].map((v) =>
    Object.freeze({ id: v.id, role: roleOf(v.id), verdict: v.verdict, reasons: v.reasons }),
  );
  const failing = verifiers.filter((v) => v.verdict !== "PASS");
  const admissible = failing.length === 0; // fail-closed: FAIL or ABSTAIN blocks
  return Object.freeze({
    subject: "node0",
    verifiers: Object.freeze(verifiers),
    set_verdict: admissible ? "ADMISSIBLE" : "REJECTED",
    admissible,
    failing_verifiers: Object.freeze(failing.map((v) => v.id)),
    // Constitutional stance — the load-bearing law of this slice.
    judges_node0: true,
    serves_node0: false,
    // Inert: a judgment, not an authority. No live SAT agent is animated.
    live_sat_agent: false,
    authority_delta: 0,
    mint_allowed: false,
    urp_live: false,
  });
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
export function sat5ConstitutionalVerifierSetPreviewBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

// Fail-closed plan. Collect every reason the action is blocked; eligible only
// when nothing blocks. Exact GO-phrase byte match — no fuzzy / partial consent.
// Absence of a block is NEVER validation: push a block until you can POSITIVELY
// prove the input is well-formed for this slice's ontology.
export function planSat5ConstitutionalVerifierSetPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else {
    const o = input.outcome;
    if (!o || typeof o !== "object") {
      blocked_by.push("outcome_missing");
    } else {
      if (o.subject !== "node0") blocked_by.push("subject_must_be_node0");
      const r = o.receipt;
      if (!r || typeof r !== "object" || typeof r.claimed_content_hash !== "string" || typeof r.body_hash_rederived !== "string") {
        blocked_by.push("receipt_invalid");
      }
      const c = o.consent;
      if (!c || typeof c !== "object" || !isBool(c.phrase_present) || !isBool(c.exact_match)) {
        blocked_by.push("consent_invalid");
      }
      const im = o.impact;
      if (!im || typeof im !== "object" || !SAT_IMPACT_TRIPWIRES.every((k) => isBool(im[k]))) {
        blocked_by.push("impact_invalid");
      }
      const b = o.blast;
      if (!b || typeof b !== "object" || typeof b.blast_radius !== "string" || !isBool(b.reversible) || !isBool(b.backup_present)) {
        blocked_by.push("blast_invalid");
      }
      const d = o.doctrine;
      if (
        !d || typeof d !== "object" || !isBool(d.truth_label_present) || !isBool(d.boundary_all_false) ||
        !Array.isArray(d.forbidden_claims) || !d.forbidden_claims.every(isNonEmptyString)
      ) {
        blocked_by.push("doctrine_invalid");
      }
    }
  }
  return Object.freeze({
    schema: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_SCHEMA,
    truth_label: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed payload. Reshape `body` to carry the real fields
// this slice attests; the content_hash binds the whole body.
export function buildSat5ConstitutionalVerifierSetPreviewPayload(input) {
  const body = {
    schema: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_SCHEMA,
    truth_label: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_TRUTH_LABEL,
    mode: "preview_only",
    input,
    judgment: deriveSatVerifierSet(input.outcome),
    boundary: sat5ConstitutionalVerifierSetPreviewBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier (REQUIRED by the core-kernels rule).
// Recompute the hash over the body MINUS its hash field and reject any mismatch,
// then add the slice-specific field checks. Body-bound, not seed-bound: a forged
// field with a recomputed hash must still fail because verify binds the WHOLE body
// against an independent anchor (e.g. a signature or an externally supplied hash).
export function verifySat5ConstitutionalVerifierSetPreview(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  const { content_hash, ...body } = payload;
  if (typeof content_hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(content_hash)) {
    blocked_by.push("content_hash_missing");
  } else if (`sha256:${sha256(stableStringify(body))}` !== content_hash) {
    blocked_by.push("content_hash_mismatch");
  }
  if (body.schema !== SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (body.truth_label !== SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (body.mode !== "preview_only") blocked_by.push("mode_not_preview_only");

  const canonical = sat5ConstitutionalVerifierSetPreviewBoundary();
  const canonicalKeys = Object.keys(canonical).sort();
  const boundaryKeys = body.boundary && typeof body.boundary === "object" ? Object.keys(body.boundary).sort() : [];
  if (
    boundaryKeys.length !== canonicalKeys.length ||
    !canonicalKeys.every((k, i) => boundaryKeys[i] === k && body.boundary[k] === false)
  ) {
    blocked_by.push("boundary_not_canonical_all_false");
  }

  // Independent anchor: the judgment is DERIVED, so verify re-derives every
  // verifier verdict from the input outcome. A forged ADMISSIBLE (a FAIL flipped
  // to PASS, or admissible flipped true, with a recomputed hash) still fails.
  let rederived = null;
  try {
    rederived = deriveSatVerifierSet(body.input.outcome);
  } catch {
    blocked_by.push("outcome_not_derivable");
  }
  if (rederived && stableStringify(rederived) !== stableStringify(body.judgment)) {
    blocked_by.push("judgment_not_rederivable");
  }

  // Constitutional invariants — never negotiable, whatever the input claimed.
  const j = body.judgment && typeof body.judgment === "object" ? body.judgment : {};
  if (j.judges_node0 !== true) blocked_by.push("must_judge_node0");
  if (j.serves_node0 !== false) blocked_by.push("must_not_serve_node0");
  if (j.live_sat_agent !== false) blocked_by.push("live_sat_agent_claimed");
  if (j.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (j.mint_allowed !== false) blocked_by.push("mint_allowed_claimed");
  if (j.urp_live !== false) blocked_by.push("urp_live_claimed");
  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    schema: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_SCHEMA,
    truth_label: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_TRUTH_LABEL,
    content_hash: typeof content_hash === "string" ? content_hash : null,
  });
}

// Orchestrator the review gate consumes. Run plan -> build -> verify -> tamper-reject
// and return the proof envelope: { ok, schema, truth_label, content_hash, boundary,
// blocked_by }. Push a named block on any failure so the gate fails closed.
export function runSat5ConstitutionalVerifierSetPreview({ consent, input } = {}) {
  const boundary = sat5ConstitutionalVerifierSetPreviewBoundary();
  const refuse = (codes) =>
    Object.freeze({
      ok: false,
      schema: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_SCHEMA,
      truth_label: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_TRUTH_LABEL,
      blocked_by: Object.freeze([...codes]),
      boundary,
    });

  const plan = planSat5ConstitutionalVerifierSetPreview({ consent, input });
  if (!plan.eligible) return refuse(plan.blocked_by);

  const payload = buildSat5ConstitutionalVerifierSetPreviewPayload(input);
  const verdict = verifySat5ConstitutionalVerifierSetPreview(payload);
  if (!verdict.ok) return refuse(verdict.blocked_by);

  // Tamper probes — a forged ADMISSIBLE must be POSITIVELY rejected.
  const hashTamper = verifySat5ConstitutionalVerifierSetPreview({ ...payload, content_hash: `sha256:${"0".repeat(64)}` });
  const forcedPass = {
    ...payload.judgment,
    verifiers: payload.judgment.verifiers.map((v) => ({ ...v, verdict: "PASS", reasons: [] })),
    set_verdict: "ADMISSIBLE",
    admissible: true,
    failing_verifiers: [],
  };
  const { content_hash: _oldHash, ...launderBody } = { ...payload, judgment: forcedPass };
  const laundered = verifySat5ConstitutionalVerifierSetPreview({
    ...launderBody,
    content_hash: `sha256:${sha256(stableStringify(launderBody))}`,
  });
  const alreadyAdmissible = payload.judgment.admissible === true;
  if (hashTamper.ok || (!alreadyAdmissible && laundered.ok)) return refuse(["tamper_probe_not_rejected"]);

  return Object.freeze({
    ok: true,
    schema: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_SCHEMA,
    truth_label: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_TRUTH_LABEL,
    mode: "preview_only",
    judgment: payload.judgment,
    content_hash: payload.content_hash,
    boundary: payload.boundary,
    blocked_by: Object.freeze([]),
  });
}
