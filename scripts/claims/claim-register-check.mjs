#!/usr/bin/env node
// NODE0-CLAIM-MAP-PROOF-GAP-REGISTER-V0.1
//
// The claim-to-proof compiler. Every public-facing claim about BIZRA — README
// lines, demo text, reports, agent output — should be generated from a single
// machine-readable register, not from memory or enthusiasm. This validator is
// the gate that keeps the register honest and fails closed on overclaim.
//
// Two axes, deliberately separate:
//   evidence_class — HOW a claim is evidenced (reuses docs/CLAIM_REGISTER_v0.1
//     taxonomy: VERIFIED/MEASURED/DERIVED/SCENARIO/DESIGNED_NOT_LIVE/UNKNOWN).
//   status         — WHERE a claim sits on the maturity ladder (new this gate).
//
// Criterion 5 ("flag strong unlabeled claims in prose") is handled by the
// existing scripts/claim-ledger-check.mjs (wired as `npm run claim:check`); we
// re-export its scanner here rather than duplicate the patterns.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { auditMarkdown, RISK_PATTERNS } from "../claim-ledger-check.mjs";

export { auditMarkdown, RISK_PATTERNS };

// Maturity ladder (operator spec, GO criterion 6). DESIGNED is the floor;
// PUBLIC_MAIN_SYNCED marks "the fix is on public main, not just a local branch"
// — the exact gap a self-audit caught (local branch truth != public-main truth).
export const MATURITY_STATUS = [
  "DESIGNED",
  "MECHANISM_VERIFIED_SYNTHETIC",
  "REAL_OPERATOR_VERIFIED",
  "PUBLIC_MAIN_SYNCED",
  "PRODUCTION_ACTIVE",
];

// Evidence vocabulary aligned to docs/CLAIM_REGISTER_v0.1.md (do not invent a
// third taxonomy).
export const EVIDENCE_CLASSES = [
  "VERIFIED",
  "MEASURED",
  "DERIVED",
  "SCENARIO",
  "DESIGNED_NOT_LIVE",
  "UNKNOWN",
];

export const CONFIDENCE = ["low", "medium", "high"];

const REQUIRED_FIELDS = [
  "id",
  "text",
  "scope",
  "source",
  "evidence_class",
  "status",
  "confidence",
  "blocked_wording",
  "verification_path",
];

// The R4 overclaim gate distinguishes two kinds of blocked_wording:
//
//   FOREVER_GATED — forbidden CAPABILITIES (token economy, federation, public
//     network, production readiness, Shariah certification). These need external
//     scholarly/legal/operational validation and may NEVER be marked beyond
//     synthetic maturity from inside the repo. R4 caps them hard.
//
//   sensitivity tags (e.g. private_data) — NOT capabilities. They flag that a
//     claim touches sensitive ground, but a local, consented operator run over
//     one's own data legitimately makes such a claim REAL_OPERATOR_VERIFIED.
//     Capping these would forbid the loop's own purpose, so R4 ignores them.
//
// A claim is R4-capped only if its blocked_wording intersects FOREVER_GATED.
export const FOREVER_GATED_WORDING = new Set([
  "token",
  "mint",
  "reward",
  "economic",
  "federation",
  "public_network",
  "production",
  "shariah",
]);
const ALLOWED_FOR_GATED = new Set(["DESIGNED", "MECHANISM_VERIFIED_SYNTHETIC"]);

export function isCapabilityGated(claim) {
  return (
    Array.isArray(claim?.blocked_wording) &&
    claim.blocked_wording.some((w) => FOREVER_GATED_WORDING.has(w))
  );
}

// Statuses that assert real-world / production truth need hard evidence.
const REAL_STATUSES = new Set(["REAL_OPERATOR_VERIFIED", "PRODUCTION_ACTIVE"]);
const STRONG_EVIDENCE = new Set(["VERIFIED", "MEASURED"]);

function isEmpty(v) {
  return (
    v === undefined || v === null || (typeof v === "string" && v.trim() === "")
  );
}

export function validateClaimRegister(register) {
  const violations = [];
  const claims = register?.claims;
  if (!Array.isArray(claims)) {
    return {
      ok: false,
      violations: [
        {
          id: null,
          rule: "R0_shape",
          detail: "register.claims must be an array",
        },
      ],
    };
  }

  const seen = new Set();
  for (const c of claims) {
    const id = c?.id ?? "(no id)";

    // R1 — required fields present and non-empty (blocked_wording must be an array).
    for (const f of REQUIRED_FIELDS) {
      if (f === "blocked_wording") {
        if (!Array.isArray(c?.[f])) {
          violations.push({
            id,
            rule: "R1_fields",
            detail: "blocked_wording must be an array",
          });
        }
        continue;
      }
      // verification_path may be empty ONLY for DESIGNED claims (checked by R3);
      // every other field must be non-empty.
      if (f === "verification_path" && c?.status === "DESIGNED") continue;
      if (isEmpty(c?.[f])) {
        violations.push({
          id,
          rule: "R1_fields",
          detail: `missing/empty field: ${f}`,
        });
      }
    }

    // R1_unique — ids must be unique.
    if (seen.has(c?.id)) {
      violations.push({ id, rule: "R1_unique", detail: "duplicate id" });
    }
    seen.add(c?.id);

    // R2 — enums.
    if (c?.status && !MATURITY_STATUS.includes(c.status)) {
      violations.push({
        id,
        rule: "R2_status",
        detail: `bad status: ${c.status}`,
      });
    }
    if (c?.evidence_class && !EVIDENCE_CLASSES.includes(c.evidence_class)) {
      violations.push({
        id,
        rule: "R2_evidence",
        detail: `bad evidence_class: ${c.evidence_class}`,
      });
    }
    if (c?.confidence && !CONFIDENCE.includes(c.confidence)) {
      violations.push({
        id,
        rule: "R2_confidence",
        detail: `bad confidence: ${c.confidence}`,
      });
    }

    // R3 — any non-DESIGNED status must point at how it is verified.
    if (c?.status && c.status !== "DESIGNED" && isEmpty(c?.verification_path)) {
      violations.push({
        id,
        rule: "R3_evidence_path",
        detail: `status ${c.status} requires a verification_path`,
      });
    }

    // R4 — capability-gated claims cannot exceed synthetic maturity. Sensitivity
    // tags (e.g. private_data) are not capped — see FOREVER_GATED_WORDING.
    if (isCapabilityGated(c) && c?.status && !ALLOWED_FOR_GATED.has(c.status)) {
      const gated = c.blocked_wording.filter((w) =>
        FOREVER_GATED_WORDING.has(w),
      );
      violations.push({
        id,
        rule: "R4_gating",
        detail: `capability-gated claim (${gated.join(", ")}) cannot be ${c.status}; max MECHANISM_VERIFIED_SYNTHETIC`,
      });
    }

    // R5 — real/production status requires strong evidence.
    if (
      c?.status &&
      REAL_STATUSES.has(c.status) &&
      c?.evidence_class &&
      !STRONG_EVIDENCE.has(c.evidence_class)
    ) {
      violations.push({
        id,
        rule: "R5_coherence",
        detail: `status ${c.status} requires evidence_class VERIFIED|MEASURED, got ${c.evidence_class}`,
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

function main(argv) {
  const wantJson = argv.includes("--json");
  const fileArg = argv.find((a) => !a.startsWith("--"));
  const path = resolve(fileArg || "docs/claims/node0-claim-register.v0.1.json");
  let register;
  try {
    register = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(
      `[CLAIM-REGISTER] cannot read ${path}: ${err.code || err.message}. Exit 1.`,
    );
    process.exit(1);
  }
  const result = validateClaimRegister(register);
  const report = {
    schema: "bizra.dema.claim_register_check.v0.1",
    register: path,
    claim_count: Array.isArray(register?.claims) ? register.claims.length : 0,
    ok: result.ok,
    violations: result.violations,
    boundary: {
      read_only: true,
      runtime_execution_performed: false,
      mutation_performed: false,
    },
  };
  if (wantJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `[CLAIM-REGISTER] ${report.claim_count} claims · ${result.ok ? "OK" : `${result.violations.length} VIOLATION(S)`}`,
    );
    for (const v of result.violations)
      console.error(`  ${v.rule} [${v.id}] ${v.detail}`);
  }
  if (!result.ok) process.exit(1);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2));
}
