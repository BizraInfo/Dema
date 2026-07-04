import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import {
  ABSENCE_STEWARD_QUEUE_ITEM_SCHEMA,
  ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL,
  validateAbsenceStewardQueueItem,
  absenceStewardQueueBoundary,
} from "../packages/core/src/absence-steward-queue-schema.js";
import { verifyAbsenceStewardQueueItem } from "../packages/core/src/absence-steward-queue-verify.js";
import {
  ABSENCE_STEWARD_QUEUE_RECEIPT_SCHEMA,
  ABSENCE_STEWARD_QUEUE_RECEIPT_TRUTH_LABEL,
  expectedAbsenceStewardQueueReceiptConsent,
  writeAbsenceStewardQueueReceipt,
} from "../packages/core/src/absence-steward-queue-receipt.js";

// ABSENCE-STEWARD-QUEUE-RECEIPT-1A — schema proves shape; verify proves no
// laundering; receipt proves human consent to RECORD. None proves approval.
// None proves execution.

const NOW_ISO = "2026-07-04T05:00:00.000Z";

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

function withHash(body) {
  const { queue_item_hash, ...rest } = body;
  const normalized = {
    ...rest,
    allowed_by_contract: [...new Set(rest.allowed_by_contract)].sort(),
    forbidden_by_contract: [...new Set(rest.forbidden_by_contract)].sort(),
  };
  return {
    ...body,
    queue_item_hash:
      "sha256:" + createHash("sha256").update(stable(normalized), "utf8").digest("hex"),
  };
}

function validItem(overrides = {}) {
  return withHash({
    schema: ABSENCE_STEWARD_QUEUE_ITEM_SCHEMA,
    queue_item_id: "qitem-docs-refresh-0003",
    truth_label: ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL,
    operator_id: "mumu",
    node_id: "NODE0",
    contract_id: "away-2026-07-04-0101",
    contract_hash: `sha256:${"a".repeat(64)}`,
    readiness_report_hash: `sha256:${"b".repeat(64)}`,
    return_review_requirement: true,
    proposed_action_class: "DOCS_ONLY",
    proposed_action_summary: "refresh stale TESTING rows",
    proposed_inputs_summary: "docs/TESTING.md",
    required_human_decision: true,
    allowed_by_contract: ["READ_ONLY", "DOCS_ONLY"],
    forbidden_by_contract: ["PUSH_ALLOWED", "MODEL_ALLOWED"],
    status: "PROPOSED",
    created_at: "2026-07-04T04:00:00.000Z",
    expires_at: "2026-07-04T12:00:00.000Z",
    boundary: absenceStewardQueueBoundary(),
    ...overrides,
  });
}

function fullInput(overrides = {}) {
  const queue_item = validItem(overrides.item_overrides ?? {});
  const validation_result = validateAbsenceStewardQueueItem(queue_item, { now_iso: NOW_ISO });
  const verify_result = verifyAbsenceStewardQueueItem(
    { queue_item, validation_result },
    { now_iso: NOW_ISO },
  );
  assert.equal(verify_result.valid, true, "fixture must verify");
  const consent =
    overrides.consent ?? expectedAbsenceStewardQueueReceiptConsent(queue_item, verify_result);
  return { queue_item, validation_result, verify_result, consent, ...overrides.input };
}

function withHome(fn) {
  const home = mkdtempSync(join(tmpdir(), "queue-receipt-"));
  return Promise.resolve(fn(home)).finally(() =>
    rmSync(home, { recursive: true, force: true }),
  );
}

function thaw(value) {
  return JSON.parse(JSON.stringify(value));
}

test("exact consent writes one queue receipt at the disclosed path", async () => {
  await withHome(async (home) => {
    const input = fullInput();
    const result = await writeAbsenceStewardQueueReceipt(input, {
      dem_home: home,
      now_iso: NOW_ISO,
    });

    assert.equal(result.written, true, result.blocked_by.join(","));
    assert.equal(result.schema, "bizra.dema.absence_steward.queue_item.receipt_write_result.v0.1");
    assert.equal(result.truth_label, ABSENCE_STEWARD_QUEUE_RECEIPT_TRUTH_LABEL);
    assert.equal(result.resolved_dema_home, home);
    const hash12 = input.queue_item.queue_item_hash.slice(7, 19);
    assert.equal(
      result.receipt_path,
      join(home, "absence-steward", "queue", "receipts", `qitem-docs-refresh-0003-${hash12}.json`),
    );
    assert.ok(existsSync(result.receipt_path));

    const receipt = JSON.parse(readFileSync(result.receipt_path, "utf8"));
    assert.equal(receipt.schema, ABSENCE_STEWARD_QUEUE_RECEIPT_SCHEMA);
    assert.equal(receipt.created_at, NOW_ISO);
    assert.equal(receipt.status, "PROPOSED");
    assert.match(receipt.what_this_proves, /proposal receipt only/i);
  });
});

test("receipt_hash is self-excluding and recomputes", async () => {
  await withHome(async (home) => {
    const result = await writeAbsenceStewardQueueReceipt(fullInput(), {
      dem_home: home,
      now_iso: NOW_ISO,
    });
    const receipt = JSON.parse(readFileSync(result.receipt_path, "utf8"));
    const { receipt_hash, ...body } = receipt;
    const recomputed =
      "sha256:" + createHash("sha256").update(stable(body), "utf8").digest("hex");
    assert.equal(recomputed, receipt_hash);
    assert.equal(result.receipt.receipt_hash, receipt_hash);
  });
});

test("missing consent rejects, disclosing expected_consent and resolved home, writing nothing", async () => {
  await withHome(async (home) => {
    const input = fullInput();
    delete input.consent;
    const result = await writeAbsenceStewardQueueReceipt(input, {
      dem_home: home,
      now_iso: NOW_ISO,
    });
    assert.equal(result.written, false);
    assert.ok(result.blocked_by.includes("consent_missing"));
    assert.match(result.expected_consent, /^GO: write absence-steward queue receipt qitem-docs-refresh-0003 [a-f0-9]{12}$/);
    assert.equal(result.resolved_dema_home, home);
    assert.equal(existsSync(join(home, "absence-steward")), false);
  });
});

test("byte-exact consent: trailing space, wrong id, wrong hash12 all reject without writing", async () => {
  await withHome(async (home) => {
    const input = fullInput();
    const good = input.consent;
    const bads = [
      `${good} `,
      good.replace("qitem-docs-refresh-0003", "qitem-other-0001"),
      good.replace(/[a-f0-9]{12}$/, "000000000000"),
    ];
    for (const bad of bads) {
      const result = await writeAbsenceStewardQueueReceipt(
        { ...input, consent: bad },
        { dem_home: home, now_iso: NOW_ISO },
      );
      assert.equal(result.written, false, bad);
      assert.ok(result.blocked_by.includes("consent_mismatch"), bad);
    }
    assert.equal(existsSync(join(home, "absence-steward")), false);
  });
});

test("invalid item / forged verify / laundered pair reject before any mkdir", async () => {
  await withHome(async (home) => {
    const good = fullInput();

    const badItem = await writeAbsenceStewardQueueReceipt(
      { ...good, queue_item: validItem({ status: "EXECUTING" }) },
      { dem_home: home, now_iso: NOW_ISO },
    );
    assert.equal(badItem.written, false);
    assert.ok(badItem.blocked_by.includes("internal_verify_failed"));

    const forgedVerify = { ...thaw(good.verify_result), valid: false };
    const badVerify = await writeAbsenceStewardQueueReceipt(
      { ...good, verify_result: forgedVerify },
      { dem_home: home, now_iso: NOW_ISO },
    );
    assert.equal(badVerify.written, false);
    assert.ok(badVerify.blocked_by.includes("verify_result_not_valid"));

    const drifted = validItem({ proposed_action_summary: "push everything quietly" });
    const laundered = await writeAbsenceStewardQueueReceipt(
      { ...good, queue_item: drifted },
      { dem_home: home, now_iso: NOW_ISO },
    );
    assert.equal(laundered.written, false);

    const missing = await writeAbsenceStewardQueueReceipt(null, {
      dem_home: home,
      now_iso: NOW_ISO,
    });
    assert.ok(missing.blocked_by.includes("input_not_object"));

    assert.equal(existsSync(join(home, "absence-steward")), false);
  });
});

test("F4 regression: a validation_result whose item_hash disagrees with the raw item is rejected, nothing written", async () => {
  await withHome(async (home) => {
    const good = fullInput();
    // Tamper the validation_result.item_hash so it no longer equals the raw
    // item's genuine re-derived hash. The receipt writer must reject (via the
    // re-derivation guard) and write nothing — the old tautological check
    // (validation_result.item_hash !== internal.validation_item_hash, an echo)
    // could never have caught this.
    const tampered = thaw(good.validation_result);
    tampered.item_hash = "sha256:" + "0".repeat(64);
    const result = await writeAbsenceStewardQueueReceipt(
      { ...good, validation_result: tampered },
      { dem_home: home, now_iso: NOW_ISO },
    );
    assert.equal(result.written, false);
    assert.ok(result.blocked_by.length > 0);
    assert.equal(existsSync(join(home, "absence-steward")), false);
  });
});

test("duplicate receipt rejects — no overwrite", async () => {
  await withHome(async (home) => {
    const first = await writeAbsenceStewardQueueReceipt(fullInput(), {
      dem_home: home,
      now_iso: NOW_ISO,
    });
    assert.equal(first.written, true);

    const second = await writeAbsenceStewardQueueReceipt(fullInput(), {
      dem_home: home,
      now_iso: NOW_ISO,
    });
    assert.equal(second.written, false);
    assert.ok(second.blocked_by.includes("receipt_already_exists"));
  });
});

test("receipt boundary: receipt_written true, approval/execution/runtime flags all false", async () => {
  await withHome(async (home) => {
    const result = await writeAbsenceStewardQueueReceipt(fullInput(), {
      dem_home: home,
      now_iso: NOW_ISO,
    });
    const receipt = JSON.parse(readFileSync(result.receipt_path, "utf8"));
    assert.deepEqual(receipt.boundary, {
      receipt_written: true,
      queue_started: false,
      queue_runner_started: false,
      scheduler_started: false,
      daemon_started: false,
      task_executed: false,
      model_invoked: false,
      network_used: false,
      wallet_used: false,
      token_minted: false,
      public_urp_touched: false,
      auto_consent: false,
      self_approved: false,
      approved: false,
      executed: false,
    });
    assert.match(receipt.what_this_does_not_prove, /not approval/i);
    assert.match(receipt.what_this_does_not_prove, /not execution/i);
    assert.match(receipt.what_this_does_not_prove, /not queue runtime/i);
  });
});

test("dem_home precedence: options.dem_home > input.dem_home > DEMA_HOME env > ~/.dema", async () => {
  await withHome(async (home) => {
    const optHome = join(home, "opt");
    const inputHome = join(home, "input");
    const envHome = join(home, "env");

    // options wins over input and env
    const viaOptions = await writeAbsenceStewardQueueReceipt(
      { ...fullInput(), dem_home: inputHome },
      { dem_home: optHome, now_iso: NOW_ISO },
    );
    assert.equal(viaOptions.resolved_dema_home, optHome);
    assert.ok(viaOptions.receipt_path.startsWith(optHome));

    // input wins over env
    const prevEnv = process.env.DEMA_HOME;
    process.env.DEMA_HOME = envHome;
    try {
      const viaInput = await writeAbsenceStewardQueueReceipt(
        { ...fullInput({ item_overrides: { queue_item_id: "qitem-docs-refresh-0004" } }), dem_home: inputHome },
        { now_iso: NOW_ISO },
      );
      assert.equal(viaInput.resolved_dema_home, inputHome);

      // env wins over fallback
      const viaEnv = await writeAbsenceStewardQueueReceipt(
        fullInput({ item_overrides: { queue_item_id: "qitem-docs-refresh-0005" } }),
        { now_iso: NOW_ISO },
      );
      assert.equal(viaEnv.resolved_dema_home, envHome);

      // fallback is DISCLOSED on a consent-missing reject — never written to
      process.env.DEMA_HOME = "";
      const input = fullInput({ item_overrides: { queue_item_id: "qitem-docs-refresh-0006" } });
      delete input.consent;
      const fallback = await writeAbsenceStewardQueueReceipt(input, { now_iso: NOW_ISO });
      assert.equal(fallback.written, false);
      assert.ok(fallback.resolved_dema_home.endsWith(".dema"));
    } finally {
      if (prevEnv === undefined) delete process.env.DEMA_HOME;
      else process.env.DEMA_HOME = prevEnv;
    }
  });
});

test("writer source has no network / child_process / model / clock reach", () => {
  const source = readFileSync(
    new URL("../packages/core/src/absence-steward-queue-receipt.js", import.meta.url),
    "utf8",
  );
  // usage paths forbidden; the boundary's honest false-keys (wallet_used,
  // token_minted, model_invoked) are exactly the opposite of usage
  assert.doesNotMatch(source, /node:net|node:http|node:https|child_process|fetch\(/);
  assert.doesNotMatch(source, /Date\.now|new Date\(\)|Math\.random/);
  assert.doesNotMatch(source, /invokeDemaTalk|ollama|localhost:11434/i);
});
