// FLYWHEEL-1A · minimal one-task flywheel (slice 1 of §19)
//
// The beating heart of the §19 acceptance test, with REAL receipts and zero
// synthetic data: enforced action (ASSUMPTION-GATE-1C mintGuardedClaim) →
// deterministic grounding score (re-derivable from the recorded claim_state) →
// chained flywheel receipt → replay re-derives the score from recorded fact.
//
// This is §19 steps 6–9 + 17 (verified action → receipt → score → replay) for
// ONE task. It deliberately does NOT cover mission select / PAT-SAT / token
// ledger / XP / Teacher lesson / perf delta — those are later slices. No fake
// 17-step run; every receipt on disk is real and content-addressed.
//
// SCOPE: localhost only, fail-closed, no PoI economy mutation, no federation,
// no signing key. The score is a deterministic proof-quality measure derived
// from the action's declared V/D/A/U label — Level-B re-derivable, not
// model-scored.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runOneTaskFlywheel,
  replayOneTaskFlywheel,
  scoreEpistemicGrounding,
  FLYWHEEL_SCHEMA,
  GROUNDING_SCORE_RULE_ID,
} from "../packages/flywheel/src/flywheel-one-task.js";
import { GUARDED_CLAIM_CONSENT_PHRASE } from "../packages/receipts/src/assumption-guarded-claim.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

// Re-seal a (possibly forged) flywheel body so its receipt_id is self-consistent
// — proves replay rejects on contract grounds, not merely on a hash mismatch.
function reseal(receipt) {
  const { receipt_id, ...body } = receipt;
  return { ...body, receipt_id: sha256(stableStringify(body)) };
}

const NOW = "2026-05-30T13:00:00.000Z";
const A_ENVELOPE = Object.freeze({
  claim_state: "A",
  assumption: "Task X is complete.",
  ground: "tests/x.test.js passed 9/9.",
  boundary: "Invalid if x.test.js regresses.",
  rejectable: true,
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-flywheel-"));
}
async function receiptsListing(h) {
  try {
    return await readdir(join(h, "receipts"));
  } catch {
    return [];
  }
}

describe("FLYWHEEL-1A · runOneTaskFlywheel", () => {
  it("happy: action enforced → scored → chained receipt → replay re-derives", async () => {
    const home = await freshHome();
    try {
      const r = await runOneTaskFlywheel({
        task: "ship FLYWHEEL-1A",
        envelope: A_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      assert.equal(r.completed, true);
      assert.equal(r.claim_state, "A");
      assert.equal(r.score, scoreEpistemicGrounding("A"));
      assert.equal(r.flywheel_receipt.schema, FLYWHEEL_SCHEMA);
      // both real receipts exist on disk (action + flywheel)
      const files = await receiptsListing(home);
      assert.equal(files.length, 2);
      assert.ok(files.some((f) => f.startsWith("guarded-claim-")));
      assert.ok(files.some((f) => f.startsWith("flywheel-")));
      // replay confirms the chain with zero trust in the producer
      const rp = replayOneTaskFlywheel({
        flywheelReceipt: r.flywheel_receipt,
        actionReceiptId: r.action_receipt_id,
      });
      assert.equal(rp.replayed, true);
      assert.equal(rp.score, scoreEpistemicGrounding("A"));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("chain: flywheel receipt prev_hash === action receipt id", async () => {
    const home = await freshHome();
    try {
      const r = await runOneTaskFlywheel({
        task: "t",
        envelope: A_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      assert.equal(r.flywheel_receipt.prev_hash, r.action_receipt_id);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed action: invalid envelope → not completed at action stage, no receipts", async () => {
    const home = await freshHome();
    try {
      const { boundary, ...noBoundary } = A_ENVELOPE;
      const r = await runOneTaskFlywheel({
        task: "t",
        envelope: noBoundary,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      assert.equal(r.completed, false);
      assert.equal(r.stage, "action");
      assert.equal(r.error, "assumption_assumption_boundary_missing");
      assert.deepEqual(await receiptsListing(home), []);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed consent: wrong consent → not completed, no receipts", async () => {
    const home = await freshHome();
    try {
      const r = await runOneTaskFlywheel({
        task: "t",
        envelope: A_ENVELOPE,
        consent: "nope",
        demaHome: home,
        now: NOW,
      });
      assert.equal(r.completed, false);
      assert.equal(r.stage, "action");
      assert.equal(r.error, "consent_required");
      assert.deepEqual(await receiptsListing(home), []);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REPLAY REJECT: a receipt claiming a score its claim_state doesn't warrant → score_rederivation_mismatch", async () => {
    const home = await freshHome();
    try {
      const r = await runOneTaskFlywheel({
        task: "t",
        envelope: A_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      // forge a higher score than the recorded "A" claim warrants
      const forged = { ...r.flywheel_receipt, score: 1.0 };
      const rp = replayOneTaskFlywheel({
        flywheelReceipt: forged,
        actionReceiptId: r.action_receipt_id,
      });
      assert.equal(rp.replayed, false);
      assert.equal(rp.reason, "score_rederivation_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REPLAY REJECT: broken chain link → chain_link_mismatch", async () => {
    const home = await freshHome();
    try {
      const r = await runOneTaskFlywheel({
        task: "t",
        envelope: A_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      const rp = replayOneTaskFlywheel({
        flywheelReceipt: r.flywheel_receipt,
        actionReceiptId: "0".repeat(64),
      });
      assert.equal(rp.replayed, false);
      assert.equal(rp.reason, "chain_link_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REPLAY REJECT: tampered flywheel body (hash no longer matches) → flywheel_hash_mismatch", async () => {
    const home = await freshHome();
    try {
      const r = await runOneTaskFlywheel({
        task: "t",
        envelope: A_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      // mutate a hashed field but keep score consistent → hash must fail
      const tampered = { ...r.flywheel_receipt, task: "DIFFERENT" };
      const rp = replayOneTaskFlywheel({
        flywheelReceipt: tampered,
        actionReceiptId: r.action_receipt_id,
      });
      assert.equal(rp.replayed, false);
      assert.equal(rp.reason, "flywheel_hash_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("deterministic: same inputs twice → same flywheel receipt id", async () => {
    const home = await freshHome();
    try {
      const a = await runOneTaskFlywheel({
        task: "t",
        envelope: A_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      const b = await runOneTaskFlywheel({
        task: "t",
        envelope: A_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      assert.equal(
        a.flywheel_receipt.receipt_id,
        b.flywheel_receipt.receipt_id,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("scoreEpistemicGrounding is deterministic V>D>A>U", () => {
    assert.equal(scoreEpistemicGrounding("V"), 1.0);
    assert.equal(scoreEpistemicGrounding("D"), 0.8);
    assert.equal(scoreEpistemicGrounding("A"), 0.6);
    assert.equal(scoreEpistemicGrounding("U"), 0.2);
    assert.ok(
      scoreEpistemicGrounding("V") > scoreEpistemicGrounding("A") &&
        scoreEpistemicGrounding("A") > scoreEpistemicGrounding("U"),
    );
  });

  it("exports rule id + schema; receipts carry no key/token material", async () => {
    assert.equal(GROUNDING_SCORE_RULE_ID, "epistemic_grounding_score.v0.1");
    assert.equal(FLYWHEEL_SCHEMA, "bizra.dema.flywheel_one_task.v0.1");
    const home = await freshHome();
    try {
      const r = await runOneTaskFlywheel({
        task: "t",
        envelope: A_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      const s = JSON.stringify(r.flywheel_receipt);
      assert.ok(!s.includes("PRIVATE KEY"));
      assert.ok(!/token_minted|federation|private_key/i.test(s));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  // ── review hardening (PR #112): replay must fail closed ──────────
  it("REJECT (orphan): replay without actionReceiptId → action_receipt_id_required", async () => {
    const home = await freshHome();
    try {
      const r = await runOneTaskFlywheel({
        task: "t",
        envelope: A_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      const rp = replayOneTaskFlywheel({ flywheelReceipt: r.flywheel_receipt });
      assert.equal(rp.replayed, false);
      assert.equal(rp.reason, "action_receipt_id_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REJECT (contract): self-consistent receipt with wrong schema → schema_mismatch", async () => {
    const home = await freshHome();
    try {
      const r = await runOneTaskFlywheel({
        task: "t",
        envelope: A_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      const forged = reseal({
        ...r.flywheel_receipt,
        schema: "bizra.dema.evil.v0.1",
      });
      const rp = replayOneTaskFlywheel({
        flywheelReceipt: forged,
        actionReceiptId: r.action_receipt_id,
      });
      assert.equal(rp.replayed, false);
      assert.equal(rp.reason, "schema_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REJECT (contract): self-consistent receipt with wrong score_rule_id → score_rule_mismatch", async () => {
    const home = await freshHome();
    try {
      const r = await runOneTaskFlywheel({
        task: "t",
        envelope: A_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      const forged = reseal({
        ...r.flywheel_receipt,
        score_rule_id: "made_up_rule.v9",
      });
      const rp = replayOneTaskFlywheel({
        flywheelReceipt: forged,
        actionReceiptId: r.action_receipt_id,
      });
      assert.equal(rp.replayed, false);
      assert.equal(rp.reason, "score_rule_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REJECT (contract): self-consistent receipt with out-of-spec claim_state → claim_state_invalid", async () => {
    const home = await freshHome();
    try {
      const r = await runOneTaskFlywheel({
        task: "t",
        envelope: A_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      // claim_state "Z" scores 0; keep score self-consistent so only the
      // claim-state contract check can catch it.
      const forged = reseal({
        ...r.flywheel_receipt,
        claim_state: "Z",
        score: scoreEpistemicGrounding("Z"),
      });
      const rp = replayOneTaskFlywheel({
        flywheelReceipt: forged,
        actionReceiptId: r.action_receipt_id,
      });
      assert.equal(rp.replayed, false);
      assert.equal(rp.reason, "claim_state_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
