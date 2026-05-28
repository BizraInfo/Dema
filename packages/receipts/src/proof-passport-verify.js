import { readFile } from "node:fs/promises";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { PROOF_PASSPORT_SCHEMA } from "./proof-passport.js";

export const PASSPORT_VERIFY_SCHEMA = "bizra.dema.proof_passport_verify.v0.1";

const REQUIRED_BOUNDARY_KEYS = Object.freeze({
  passport_signed: false,
  private_key_loaded: false,
  network_used: false,
  federation_used: false,
  token_minted: false,
  legal_identity_asserted: false,
  production_claimed: false,
  receipt_content_included: false,
});

const VERIFIER_BOUNDARY = Object.freeze({
  network_used: false,
  federation_used: false,
  receipt_mutated: false,
  private_key_loaded: false,
  token_minted: false,
});

export async function verifyProofPassportFile(passportPath) {
  if (!passportPath || typeof passportPath !== "string") {
    return fail("no_passport_path", []);
  }

  let raw;
  try {
    raw = JSON.parse(await readFile(passportPath, "utf8"));
  } catch {
    return fail("cannot_read_passport", []);
  }

  return verifyProofPassport(raw, passportPath);
}

export function verifyProofPassport(passport, passportPath = null) {
  const checks = [];

  const isObject = passport && typeof passport === "object";
  checks.push(check("is_object", isObject));
  if (!isObject) return fail("not_an_object", checks, passportPath);

  checks.push(
    check("schema_matches", passport.schema === PROOF_PASSPORT_SCHEMA, {
      expected: PROOF_PASSPORT_SCHEMA,
      got: passport.schema,
    }),
  );

  checks.push(
    check("generated_at_present", typeof passport.generated_at === "string"),
  );

  checks.push(
    check("passport_hash_present", typeof passport.passport_hash === "string"),
  );

  const { passport_hash, generated_at, ...body } = passport;
  let recomputedHash = null;
  try {
    recomputedHash = sha256(stableStringify(body));
  } catch {
    recomputedHash = null;
  }
  checks.push(
    check(
      "passport_hash_matches",
      recomputedHash !== null && recomputedHash === passport_hash,
      { recomputed: recomputedHash, declared: passport_hash },
    ),
  );

  const boundary = passport.boundary ?? {};
  const boundaryOk = Object.entries(REQUIRED_BOUNDARY_KEYS).every(
    ([k, v]) => boundary[k] === v,
  );
  checks.push(check("boundary_canonical", boundaryOk, { boundary }));

  const receipts = Array.isArray(passport.receipts) ? passport.receipts : null;
  checks.push(check("receipts_is_array", receipts !== null));

  const aggregate = passport.aggregate ?? {};
  if (receipts) {
    const total = aggregate.total_receipts;
    const verifiedCount = receipts.filter(
      (r) => r.verdict === "VERIFIED",
    ).length;
    const failedCount = receipts.filter((r) => r.verdict === "FAILED").length;

    checks.push(
      check("aggregate_total_matches", total === receipts.length, {
        declared: total,
        actual: receipts.length,
      }),
    );
    checks.push(
      check(
        "aggregate_verified_matches",
        aggregate.verified_count === verifiedCount,
        {
          declared: aggregate.verified_count,
          actual: verifiedCount,
        },
      ),
    );
    checks.push(
      check(
        "aggregate_failed_matches",
        aggregate.failed_count === failedCount,
        {
          declared: aggregate.failed_count,
          actual: failedCount,
        },
      ),
    );

    const expectedVerdict =
      receipts.length === 0
        ? "EMPTY"
        : verifiedCount === receipts.length
          ? "ALL_VERIFIED"
          : verifiedCount === 0
            ? "NONE_VERIFIED"
            : "PARTIAL";
    checks.push(
      check(
        "aggregate_verdict_consistent",
        aggregate.verdict === expectedVerdict,
        { declared: aggregate.verdict, expected: expectedVerdict },
      ),
    );

    const expectedTruthLabel = {
      EMPTY: "LOCAL_PROOF_PASSPORT_EMPTY",
      ALL_VERIFIED: "LOCAL_PROOF_PASSPORT_ALL_VERIFIED",
      PARTIAL: "LOCAL_PROOF_PASSPORT_PARTIAL",
      NONE_VERIFIED: "LOCAL_PROOF_PASSPORT_NONE_VERIFIED",
    }[expectedVerdict];
    checks.push(
      check(
        "truth_label_consistent",
        passport.truth_label === expectedTruthLabel,
        { declared: passport.truth_label, expected: expectedTruthLabel },
      ),
    );
  }

  const serialized = JSON.stringify(passport);
  checks.push(
    check(
      "no_private_key_material",
      !serialized.includes("BEGIN PRIVATE KEY") &&
        !serialized.includes("private_key_pem"),
    ),
  );
  checks.push(
    check(
      "no_receipt_content_embedded",
      receipts === null ||
        receipts.every((r) => !("content" in r) && !("payload" in r)),
    ),
  );

  const verified = checks.every((c) => c.pass);
  return Object.freeze({
    schema: PASSPORT_VERIFY_SCHEMA,
    verified,
    verdict: verified ? "VERIFIED" : "FAILED",
    passport_path: passportPath,
    passport_hash: passport.passport_hash ?? null,
    checks: Object.freeze(checks),
    boundary: VERIFIER_BOUNDARY,
  });
}

export function formatProofPassportVerification(result) {
  const lines = [
    `Proof Passport Verification: ${result.verdict}`,
    "=".repeat(40),
  ];
  if (result.passport_path) lines.push(`  Path: ${result.passport_path}`);
  if (result.passport_hash) lines.push(`  Hash: ${result.passport_hash}`);
  lines.push("  Checks:");
  for (const c of result.checks) {
    lines.push(`    ${c.pass ? "✓" : "✗"} ${c.name}`);
  }
  return lines.join("\n");
}

function check(name, pass, details = null) {
  return details === null
    ? Object.freeze({ name, pass })
    : Object.freeze({ name, pass, ...details });
}

function fail(error, checks, passportPath = null) {
  return Object.freeze({
    schema: PASSPORT_VERIFY_SCHEMA,
    verified: false,
    verdict: "FAILED",
    passport_path: passportPath,
    error,
    checks: Object.freeze(checks),
    boundary: VERIFIER_BOUNDARY,
  });
}
