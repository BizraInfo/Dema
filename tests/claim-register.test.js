import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateClaimRegister,
  MATURITY_STATUS,
  EVIDENCE_CLASSES,
} from "../scripts/claims/claim-register-check.mjs";
import { renderPublicClaims } from "../scripts/claims/generate-public-claims.mjs";

const GENERATOR_CLI = fileURLToPath(
  new URL("../scripts/claims/generate-public-claims.mjs", import.meta.url),
);
const REGISTER_PATH = fileURLToPath(
  new URL("../docs/claims/node0-claim-register.v0.1.json", import.meta.url),
);

// NODE0-CLAIM-MAP-PROOF-GAP-REGISTER-V0.1
// The register is the claim-to-proof compiler: every claim carries its maturity
// status, evidence, and the gate that blocks it from overclaiming. The validator
// fails closed so a drifted/overclaiming register cannot pass CI.

function goodClaim(over = {}) {
  return {
    id: "C-OK",
    text: "Dema is a local-first proof cockpit",
    scope: "dema",
    source: "README.md",
    evidence_class: "MEASURED",
    status: "MECHANISM_VERIFIED_SYNTHETIC",
    confidence: "high",
    blocked_wording: [],
    verification_path: "npm test",
    ...over,
  };
}

describe("claim register — validator", () => {
  it("a well-formed register passes", () => {
    const r = validateClaimRegister({ claims: [goodClaim()] });
    assert.equal(r.ok, true);
    assert.equal(r.violations.length, 0);
  });

  it("rejects a non-array claims field (R0)", () => {
    const r = validateClaimRegister({ claims: "nope" });
    assert.equal(r.ok, false);
    assert.match(r.violations[0].rule, /R0/);
  });

  it("flags a missing required field (R1)", () => {
    const c = goodClaim();
    delete c.verification_path;
    // empty verification_path also trips R3; assert R1 is present
    const r = validateClaimRegister({ claims: [c] });
    assert.equal(r.ok, false);
    assert.ok(r.violations.some((v) => v.rule.startsWith("R1")));
  });

  it("flags a duplicate id (R1_unique)", () => {
    const r = validateClaimRegister({
      claims: [goodClaim(), goodClaim()],
    });
    assert.ok(r.violations.some((v) => v.rule === "R1_unique"));
  });

  it("flags a bad status enum (R2)", () => {
    const r = validateClaimRegister({
      claims: [goodClaim({ status: "TOTALLY_LIVE" })],
    });
    assert.ok(r.violations.some((v) => v.rule === "R2_status"));
  });

  it("requires a verification_path for any non-DESIGNED status (R3)", () => {
    const r = validateClaimRegister({
      claims: [
        goodClaim({
          status: "MECHANISM_VERIFIED_SYNTHETIC",
          verification_path: "   ",
        }),
      ],
    });
    assert.ok(r.violations.some((v) => v.rule === "R3_evidence_path"));
  });

  it("a DESIGNED claim needs no verification_path", () => {
    const r = validateClaimRegister({
      claims: [goodClaim({ status: "DESIGNED", verification_path: "" })],
    });
    // R3 should not fire; R1 still requires the field present (empty string ok for DESIGNED? no)
    assert.ok(!r.violations.some((v) => v.rule === "R3_evidence_path"));
  });

  it("BLOCKS a gated claim from exceeding synthetic maturity (R4)", () => {
    const r = validateClaimRegister({
      claims: [
        goodClaim({
          id: "C-TOKEN",
          text: "Mumu can mint token rewards from verified impact",
          blocked_wording: ["token", "mint"],
          status: "PRODUCTION_ACTIVE",
        }),
      ],
    });
    assert.equal(r.ok, false);
    assert.ok(r.violations.some((v) => v.rule === "R4_gating"));
  });

  it("allows a gated claim at DESIGNED / synthetic maturity (R4 boundary)", () => {
    const r = validateClaimRegister({
      claims: [
        goodClaim({
          id: "C-FED",
          text: "Federation is a designed future capability",
          blocked_wording: ["federation"],
          status: "DESIGNED",
          verification_path: "ADR-037",
        }),
      ],
    });
    assert.ok(!r.violations.some((v) => v.rule === "R4_gating"));
  });

  it("R4 does NOT cap a sensitivity-only claim (private_data) — a local consented run can make it real", () => {
    // private_data is a sensitivity tag, not a forbidden capability. After a real
    // operator run on one's own data, the claim legitimately becomes verified.
    const r = validateClaimRegister({
      claims: [
        goodClaim({
          id: "C-REAL-RUN",
          text: "The loop served the operator's real private data in a real run",
          blocked_wording: ["private_data"],
          status: "REAL_OPERATOR_VERIFIED",
          evidence_class: "MEASURED",
          verification_path:
            "npm run node0 -- --root ... --consent ...; node0 mumu verify -> VERIFIED",
        }),
      ],
    });
    assert.equal(r.ok, true, JSON.stringify(r.violations));
    assert.ok(!r.violations.some((v) => v.rule === "R4_gating"));
  });

  it("R4 still caps a capability-gated claim even when mixed with a sensitivity tag", () => {
    const r = validateClaimRegister({
      claims: [
        goodClaim({
          id: "C-MIX",
          text: "token economy over private data",
          blocked_wording: ["private_data", "token"],
          status: "PRODUCTION_ACTIVE",
        }),
      ],
    });
    assert.ok(r.violations.some((v) => v.rule === "R4_gating"));
  });

  it("real/production status requires strong evidence_class (R5)", () => {
    const r = validateClaimRegister({
      claims: [
        goodClaim({
          status: "PRODUCTION_ACTIVE",
          evidence_class: "DESIGNED_NOT_LIVE",
        }),
      ],
    });
    assert.ok(r.violations.some((v) => v.rule === "R5_coherence"));
  });

  it("exposes the maturity + evidence vocabularies", () => {
    assert.ok(MATURITY_STATUS.includes("MECHANISM_VERIFIED_SYNTHETIC"));
    assert.ok(MATURITY_STATUS.includes("PUBLIC_MAIN_SYNCED"));
    assert.ok(EVIDENCE_CLASSES.includes("MEASURED"));
  });
});

describe("claim register — the seeded register file is valid", () => {
  it("docs/claims/node0-claim-register.v0.1.json passes the validator", () => {
    const path = fileURLToPath(
      new URL("../docs/claims/node0-claim-register.v0.1.json", import.meta.url),
    );
    const register = JSON.parse(readFileSync(path, "utf8"));
    const r = validateClaimRegister(register);
    assert.equal(
      r.ok,
      true,
      `seed register has violations: ${JSON.stringify(r.violations, null, 2)}`,
    );
  });
});

// CLAIM-MAP-PUBLIC-SYNC-AND-DOC-GENERATION-V0.1: public docs are GENERATED from
// the register, never hand-written — so they cannot drift from or overclaim past
// the gated truth state.
describe("claim register — public-claims generation", () => {
  const registerPath = fileURLToPath(
    new URL("../docs/claims/node0-claim-register.v0.1.json", import.meta.url),
  );
  const generatedPath = fileURLToPath(
    new URL("../docs/claims/PUBLIC_CLAIMS.generated.md", import.meta.url),
  );
  const register = JSON.parse(readFileSync(registerPath, "utf8"));

  it("renders one table row per claim", () => {
    const md = renderPublicClaims(register);
    for (const c of register.claims) {
      assert.ok(md.includes(c.id), `missing claim ${c.id}`);
    }
  });

  it("marks every gated claim as not-live (cannot read as a live assertion)", () => {
    const md = renderPublicClaims(register);
    const gated = register.claims.filter(
      (c) => Array.isArray(c.blocked_wording) && c.blocked_wording.length > 0,
    );
    for (const c of gated) {
      // each gated claim must be listed under the gated section with its status
      assert.match(
        md,
        new RegExp(`${c.id}[^\\n]*${c.status}`),
        `gated claim ${c.id} not labeled with its status`,
      );
    }
  });

  it("the not-live section lists capability-gated claims but not sensitivity-only ones (R4 consistency)", () => {
    const reg = {
      claims: [
        {
          id: "C-TOK",
          text: "token economy",
          scope: "economy",
          source: "x",
          evidence_class: "SCENARIO",
          status: "DESIGNED",
          confidence: "low",
          blocked_wording: ["token"],
          verification_path: "sim",
        },
        {
          id: "C-PRIV",
          text: "served real private data",
          scope: "node0",
          source: "x",
          evidence_class: "UNKNOWN",
          status: "DESIGNED",
          confidence: "low",
          blocked_wording: ["private_data"],
          verification_path: "pending",
        },
      ],
    };
    const md = renderPublicClaims(reg);
    assert.ok(md.includes("C-TOK") && md.includes("C-PRIV")); // both in the table
    const section = md.split("must NOT be stated as live")[1] || "";
    assert.ok(
      section.includes("C-TOK"),
      "capability-gated claim missing from not-live section",
    );
    assert.ok(
      !section.includes("C-PRIV"),
      "sensitivity-only (private_data) claim must NOT be capped by the not-live section",
    );
  });

  it("DRIFT GUARD: committed PUBLIC_CLAIMS.generated.md matches the register", () => {
    const committed = readFileSync(generatedPath, "utf8");
    const fresh = renderPublicClaims(register);
    assert.equal(
      committed,
      fresh,
      "PUBLIC_CLAIMS.generated.md is stale — run `npm run claims:generate`",
    );
  });
});

// The enforcing half: `claims:generate --check` is a release/hook gate that fails
// closed when the doc has drifted from the register — so a stale public claim
// can't reach main. Wired into scripts/check.mjs.
describe("public-claims generation — --check drift gate (CLI)", () => {
  function runCheck(regPath, docPath) {
    try {
      execFileSync(
        "node",
        [GENERATOR_CLI, "--check", "--register", regPath, "--out", docPath],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      return 0;
    } catch (e) {
      return e.status ?? 1;
    }
  }

  it("--check exits 0 when the doc matches the register", () => {
    const dir = mkdtempSync(join(tmpdir(), "claims-check-"));
    try {
      const reg = JSON.parse(readFileSync(REGISTER_PATH, "utf8"));
      const regPath = join(dir, "reg.json");
      const docPath = join(dir, "doc.md");
      writeFileSync(regPath, JSON.stringify(reg));
      writeFileSync(docPath, renderPublicClaims(reg));
      assert.equal(runCheck(regPath, docPath), 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("--check exits 1 when the doc has drifted from the register", () => {
    const dir = mkdtempSync(join(tmpdir(), "claims-check-"));
    try {
      const reg = JSON.parse(readFileSync(REGISTER_PATH, "utf8"));
      const regPath = join(dir, "reg.json");
      const docPath = join(dir, "doc.md");
      writeFileSync(regPath, JSON.stringify(reg));
      writeFileSync(docPath, "STALE — does not match the register\n");
      assert.equal(runCheck(regPath, docPath), 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
