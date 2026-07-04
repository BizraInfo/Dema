import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AWAY_CONTRACT_SCHEMA,
  validateAwayContract,
} from "../packages/core/src/away-contract-schema.js";
import { verifyAwayContract } from "../packages/core/src/away-contract-verify.js";
import {
  AWAY_CONTRACT_RECEIPT_SCHEMA,
  AWAY_CONTRACT_RECEIPT_WRITE_RESULT_SCHEMA,
  AWAY_CONTRACT_RECEIPT_TRUTH_LABEL,
  expectedAwayContractReceiptConsent,
  writeAwayContractReceipt,
} from "../packages/core/src/away-contract-receipt.js";

// AWAY-CONTRACT-RECEIPT-1A — consent-gated receipt writer. Writes prove that a
// verified Away Contract body was receipted under exact operator consent.
// Writing a receipt never starts Away Mode, never executes, never compiles.

const NOW_ISO = "2026-07-03T22:00:00.000Z";

function validContract(overrides = {}) {
  return {
    schema: AWAY_CONTRACT_SCHEMA,
    contract_id: "away-2026-07-03-0003",
    operator_id: "mumu",
    node_id: "NODE0",
    mission_scope: "docs-only: refresh stale TESTING rows",
    allowed_actions: ["READ_ONLY", "DOCS_ONLY", "TEST_ONLY", "LOCAL_EDIT", "COMMIT_ALLOWED"],
    forbidden_actions: ["PUSH_ALLOWED", "MODEL_ALLOWED", "NETWORK_ALLOWED"],
    data_scope: "repo:docs/**",
    model_policy: "forbidden",
    tool_policy: "npm test · npm run check only",
    commit_policy: "local commits on the active feat branch only",
    push_policy: "forbidden",
    network_policy: "forbidden",
    mobile_escalation_policy: "LEVEL_1_SUMMARY_ONLY",
    risk_ceiling: 1,
    expires_at: "2026-07-04T06:00:00.000Z",
    stop_conditions: ["test failure", "unexpected file mutation"],
    receipt_required: true,
    review_required_on_return: true,
    ...overrides,
  };
}

function fullInput(overrides = {}) {
  const contract = validContract(overrides.contract_overrides ?? {});
  const validation_result = validateAwayContract(contract, { now_iso: NOW_ISO });
  const verify_result = verifyAwayContract({ contract, validation_result }, { now_iso: NOW_ISO });
  assert.equal(verify_result.valid, true, "fixture must verify");
  const typed_go =
    overrides.typed_go ?? expectedAwayContractReceiptConsent(verify_result);
  return { contract, validation_result, verify_result, typed_go, ...overrides.input };
}

function withHome(fn) {
  const home = mkdtempSync(join(tmpdir(), "away-receipt-"));
  return Promise.resolve(fn(home)).finally(() =>
    rmSync(home, { recursive: true, force: true }),
  );
}

function thaw(value) {
  return JSON.parse(JSON.stringify(value));
}

test("expected consent phrase is deterministic and bound to contract_id + short hash", () => {
  const { verify_result } = fullInput();
  const a = expectedAwayContractReceiptConsent(verify_result);
  const b = expectedAwayContractReceiptConsent(thaw(verify_result));
  assert.equal(a, b);
  assert.ok(a.startsWith("GO: write away-contract receipt away-2026-07-03-0003 "));
  assert.match(a, /[a-f0-9]{12}$/);

  assert.throws(() => expectedAwayContractReceiptConsent(null), /verify_result/i);
  assert.throws(
    () => expectedAwayContractReceiptConsent({ ...thaw(verify_result), valid: false }),
    /verify_result/i,
  );
});

test("valid contract + validation + verify + exact typed_go writes the receipt", async () => {
  await withHome(async (home) => {
    const result = await writeAwayContractReceipt(fullInput(), {
      dema_home: home,
      now_iso: NOW_ISO,
    });

    assert.equal(result.written, true, result.blocked_by.join(","));
    assert.equal(result.rejected, false);
    assert.equal(result.schema, AWAY_CONTRACT_RECEIPT_WRITE_RESULT_SCHEMA);
    assert.equal(result.truth_label, AWAY_CONTRACT_RECEIPT_TRUTH_LABEL);
    assert.equal(result.contract_id, "away-2026-07-03-0003");
    assert.match(result.receipt_hash, /^sha256:[a-f0-9]{64}$/);
    assert.ok(result.receipt_path.startsWith(home));
    assert.ok(existsSync(result.receipt_path));

    const receipt = JSON.parse(readFileSync(result.receipt_path, "utf8"));
    assert.equal(receipt.schema, AWAY_CONTRACT_RECEIPT_SCHEMA);
    assert.equal(receipt.truth_label, AWAY_CONTRACT_RECEIPT_TRUTH_LABEL);
    assert.equal(receipt.contract_id, "away-2026-07-03-0003");
    assert.equal(receipt.consent_verified, true);
    assert.equal(receipt.created_at, NOW_ISO);
    assert.equal(receipt.operator_id, "mumu");
    assert.equal(receipt.node_id, "NODE0");
    assert.ok(receipt.receipt_id);
    assert.ok(receipt.validation_summary);
    assert.ok(receipt.verification_summary);
  });
});

test("written receipt carries all-false runtime boundary", async () => {
  await withHome(async (home) => {
    const result = await writeAwayContractReceipt(fullInput(), {
      dema_home: home,
      now_iso: NOW_ISO,
    });
    const receipt = JSON.parse(readFileSync(result.receipt_path, "utf8"));
    assert.deepEqual(receipt.boundary, {
      execution_attempted: false,
      contract_started: false,
      model_invocation: false,
      network: false,
      token_mint: false,
      activation: false,
      daemon_started: false,
      compiler_invoked: false,
    });
  });
});

test("receipt_hash is deterministic and excludes itself from the preimage", async () => {
  const hashes = [];
  for (let i = 0; i < 2; i += 1) {
    await withHome(async (home) => {
      const result = await writeAwayContractReceipt(fullInput(), {
        dema_home: home,
        now_iso: NOW_ISO,
      });
      hashes.push(result.receipt_hash);
      const receipt = JSON.parse(readFileSync(result.receipt_path, "utf8"));
      assert.equal(receipt.receipt_hash, result.receipt_hash);
      // forbidden-field-style probe: recomputing over the body WITH the hash
      // embedded must NOT reproduce the hash (hash excludes itself)
      const { createHash } = await import("node:crypto");
      const withHash = JSON.stringify(receipt);
      const naive = "sha256:" + createHash("sha256").update(withHash, "utf8").digest("hex");
      assert.notEqual(naive, receipt.receipt_hash);
    });
  }
  assert.equal(hashes[0], hashes[1]);
});

test("missing dema_home / now_iso / typed_go reject", async () => {
  const input = fullInput();

  const noHome = await writeAwayContractReceipt(input, { now_iso: NOW_ISO });
  assert.ok(noHome.blocked_by.includes("dema_home_missing"));
  assert.equal(noHome.written, false);

  await withHome(async (home) => {
    const noNow = await writeAwayContractReceipt(input, { dema_home: home });
    assert.ok(noNow.blocked_by.includes("now_iso_missing"));

    const noGo = await writeAwayContractReceipt(
      { ...input, typed_go: undefined },
      { dema_home: home, now_iso: NOW_ISO },
    );
    assert.ok(noGo.blocked_by.includes("consent_missing"));
    assert.ok(noGo.expected_consent, "expected consent surfaced for the operator");
  });
});

test("wrong typed_go rejects byte-exactly (trailing space included)", async () => {
  await withHome(async (home) => {
    const input = fullInput();
    for (const bad of ["GO", `${input.typed_go} `, input.typed_go.toUpperCase()]) {
      const result = await writeAwayContractReceipt(
        { ...input, typed_go: bad },
        { dema_home: home, now_iso: NOW_ISO },
      );
      assert.equal(result.written, false, bad);
      assert.ok(result.blocked_by.includes("consent_mismatch"));
      assert.equal(existsSync(join(home, "away-contracts")), false);
    }
  });
});

test("missing contract / validation_result / verify_result reject", async () => {
  await withHome(async (home) => {
    const input = fullInput();
    for (const [drop, code] of [
      ["contract", "contract_missing"],
      ["validation_result", "validation_result_missing"],
      ["verify_result", "verify_result_missing"],
    ]) {
      const broken = { ...input };
      delete broken[drop];
      const result = await writeAwayContractReceipt(broken, {
        dema_home: home,
        now_iso: NOW_ISO,
      });
      assert.equal(result.written, false, drop);
      assert.ok(result.blocked_by.includes(code), `expected ${code}`);
    }
    const nothing = await writeAwayContractReceipt(null, {
      dema_home: home,
      now_iso: NOW_ISO,
    });
    assert.ok(nothing.blocked_by.includes("input_not_object"));
  });
});

test("invalid contract rejects even with a forged verify_result", async () => {
  await withHome(async (home) => {
    const good = fullInput();
    const badContract = validContract({ risk_ceiling: 99 });
    const result = await writeAwayContractReceipt(
      {
        contract: badContract,
        validation_result: thaw(good.validation_result),
        verify_result: { ...thaw(good.verify_result), valid: true },
        typed_go: good.typed_go,
      },
      { dema_home: home, now_iso: NOW_ISO },
    );
    assert.equal(result.written, false);
    assert.ok(result.blocked_by.includes("internal_verify_failed"));
  });
});

test("contract changed after verify rejects (hash binding)", async () => {
  await withHome(async (home) => {
    const good = fullInput();
    const drifted = validContract({ mission_scope: "docs-only PLUS push everything" });
    const result = await writeAwayContractReceipt(
      {
        contract: drifted,
        validation_result: validateAwayContract(drifted, { now_iso: NOW_ISO }),
        verify_result: thaw(good.verify_result),
        typed_go: good.typed_go,
      },
      { dema_home: home, now_iso: NOW_ISO },
    );
    assert.equal(result.written, false);
    assert.ok(
      result.blocked_by.includes("verify_result_hash_mismatch") ||
        result.blocked_by.includes("verify_result_body_mismatch"),
    );
  });
});

test("forged verify_result verdict over rejected verify rejects", async () => {
  await withHome(async (home) => {
    const good = fullInput();
    const forged = thaw(good.verify_result);
    forged.valid = false;
    const result = await writeAwayContractReceipt(
      { ...good, verify_result: forged },
      { dema_home: home, now_iso: NOW_ISO },
    );
    assert.equal(result.written, false);
    assert.ok(result.blocked_by.includes("verify_result_not_valid"));
  });
});

test("unsafe contract_id (path traversal / separators) rejects before any write", async () => {
  await withHome(async (home) => {
    for (const evil of ["../escape", "a/b", "a\\b", "..", ".hidden", "id with space"]) {
      const input = fullInput({ contract_overrides: { contract_id: evil } });
      const result = await writeAwayContractReceipt(input, {
        dema_home: home,
        now_iso: NOW_ISO,
      });
      assert.equal(result.written, false, evil);
      assert.ok(result.blocked_by.includes("unsafe_contract_id"), evil);
    }
    assert.equal(existsSync(join(home, "away-contracts")), false);
  });
});

test("duplicate receipt rejects by default — no overwrite", async () => {
  await withHome(async (home) => {
    const first = await writeAwayContractReceipt(fullInput(), {
      dema_home: home,
      now_iso: NOW_ISO,
    });
    assert.equal(first.written, true);

    const second = await writeAwayContractReceipt(fullInput(), {
      dema_home: home,
      now_iso: NOW_ISO,
    });
    assert.equal(second.written, false);
    assert.ok(second.blocked_by.includes("receipt_already_exists"));
  });
});

test("write-result boundary is all-false on every path", async () => {
  await withHome(async (home) => {
    const paths = [
      await writeAwayContractReceipt(fullInput(), { dema_home: home, now_iso: NOW_ISO }),
      await writeAwayContractReceipt(null, { dema_home: home, now_iso: NOW_ISO }),
      await writeAwayContractReceipt(fullInput({ typed_go: "GO" }), {
        dema_home: home,
        now_iso: NOW_ISO,
      }),
    ];
    for (const result of paths) {
      assert.deepEqual(result.boundary, {
        execution_attempted: false,
        contract_started: false,
        model_invocation: false,
        network: false,
        token_mint: false,
        activation: false,
        daemon_started: false,
        compiler_invoked: false,
      });
    }
  });
});

test("receipt lands under DEMA_HOME/away-contracts/receipts/<contract_id>.json", async () => {
  await withHome(async (home) => {
    const result = await writeAwayContractReceipt(fullInput(), {
      dema_home: home,
      now_iso: NOW_ISO,
    });
    assert.equal(
      result.receipt_path,
      join(home, "away-contracts", "receipts", "away-2026-07-03-0003.json"),
    );
  });
});
