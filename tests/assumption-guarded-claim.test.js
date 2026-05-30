// ASSUMPTION-GATE-1C · enforced Law-of-Assumption mutation gate
//
// Turns the validator from "invoked by the harness preview" (1B) into
// "enforced law": mintGuardedClaim writes a receipt to disk ONLY when the
// claim's assumption envelope passes validateAssumptionBoundary. A rejected
// envelope writes NOTHING — there is no legacy path around the gate, so the
// disproof bar ("a legacy path bypasses the validator") is structurally
// impossible. Every minted receipt records assumption_gate_result.
//
// Canon: docs/canon/LAW_OF_ASSUMPTION.md (V/D/A/U + assumption shape).
// Bulletproof law §22: "If it cannot be consented, it cannot mutate."
//
// SCOPE (this slice): one enforced mutation primitive. No CLI (1D), no PoI,
// no economy, no federation. Fail-closed on consent AND on the gate.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  mintGuardedClaim,
  GUARDED_CLAIM_CONSENT_PHRASE,
  GUARDED_CLAIM_SCHEMA,
} from "../packages/receipts/src/assumption-guarded-claim.js";

const NOW = "2026-05-30T10:00:00.000Z";

const VALID_ENVELOPE = Object.freeze({
  claim_state: "A",
  assumption: "PR #110 merged cleanly into main.",
  ground: "git merge-base --is-ancestor 78db0c6 main returned 0.",
  boundary: "No longer holds if main is force-pushed after this check.",
  rejectable: true,
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-guarded-claim-"));
}

async function receiptsListing(home) {
  try {
    return await readdir(join(home, "receipts"));
  } catch {
    return [];
  }
}

describe("ASSUMPTION-GATE-1C · mintGuardedClaim", () => {
  it("happy: valid bounded envelope + consent → minted, receipt written, gate result recorded", async () => {
    const home = await freshHome();
    try {
      const r = await mintGuardedClaim({
        claim: "main is at 3ac2b63",
        envelope: VALID_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      assert.equal(r.minted, true);
      assert.equal(r.assumption_gate_result.valid, true);
      assert.equal(r.claim_state, "A");
      assert.ok(/^[a-f0-9]{64}$/.test(r.receipt_id));
      // the receipt actually exists on disk
      const files = await receiptsListing(home);
      assert.equal(files.length, 1);
      assert.ok(files[0].startsWith("guarded-claim-"));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("ENFORCEMENT: missing assumption boundary → rejected, NO receipt written", async () => {
    const home = await freshHome();
    try {
      const { boundary, ...noBoundary } = VALID_ENVELOPE;
      const r = await mintGuardedClaim({
        claim: "x",
        envelope: noBoundary,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      assert.equal(r.minted, false);
      assert.equal(r.error, "assumption_assumption_boundary_missing");
      assert.equal(r.assumption_gate_result.valid, false);
      // the disproof bar: a rejected mint leaves ZERO files — no bypass
      assert.deepEqual(await receiptsListing(home), []);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("ENFORCEMENT: unsupported certainty (V without evidence) → rejected, no write", async () => {
    const home = await freshHome();
    try {
      const r = await mintGuardedClaim({
        claim: "x",
        envelope: { claim_state: "V" },
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      assert.equal(r.minted, false);
      assert.equal(r.error, "assumption_unsupported_certainty");
      assert.deepEqual(await receiptsListing(home), []);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("ENFORCEMENT: high-risk mutation under assumption without ack → rejected, no write", async () => {
    const home = await freshHome();
    try {
      const r = await mintGuardedClaim({
        claim: "x",
        envelope: { ...VALID_ENVELOPE, mutation: true, risk: "high" },
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      assert.equal(r.minted, false);
      assert.equal(
        r.error,
        "assumption_high_risk_uncertainty_not_acknowledged",
      );
      assert.deepEqual(await receiptsListing(home), []);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("§22 fail-closed: wrong consent → rejected, no write, gate never runs", async () => {
    const home = await freshHome();
    try {
      const r = await mintGuardedClaim({
        claim: "x",
        envelope: VALID_ENVELOPE,
        consent: "nope",
        demaHome: home,
        now: NOW,
      });
      assert.equal(r.minted, false);
      assert.equal(r.error, "consent_required");
      assert.deepEqual(await receiptsListing(home), []);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("determinism: missing now → created_at_iso_required (no wall-clock fallback)", async () => {
    const home = await freshHome();
    try {
      const r = await mintGuardedClaim({
        claim: "x",
        envelope: VALID_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
      });
      assert.equal(r.minted, false);
      assert.equal(r.error, "created_at_iso_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("receipt records schema, claim, claim_state, envelope, and assumption_gate_result", async () => {
    const home = await freshHome();
    try {
      const r = await mintGuardedClaim({
        claim: "main is at 3ac2b63",
        envelope: VALID_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      const body = JSON.parse(await readFile(r.receipt_path, "utf8"));
      assert.equal(body.schema, GUARDED_CLAIM_SCHEMA);
      assert.equal(body.claim, "main is at 3ac2b63");
      assert.equal(body.claim_state, "A");
      assert.equal(body.assumption_gate_result.valid, true);
      assert.equal(body.assumption_envelope.boundary, VALID_ENVELOPE.boundary);
      assert.equal(body.created_at_iso, NOW);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("deterministic + idempotent: same inputs twice → same receipt_id/path", async () => {
    const home = await freshHome();
    try {
      const a = await mintGuardedClaim({
        claim: "x",
        envelope: VALID_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      const b = await mintGuardedClaim({
        claim: "x",
        envelope: VALID_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      assert.equal(a.minted, true);
      assert.equal(b.minted, true);
      assert.equal(a.receipt_id, b.receipt_id);
      assert.equal(a.receipt_path, b.receipt_path);
      assert.equal((await receiptsListing(home)).length, 1);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("receipt carries no key/token/federation material", async () => {
    const home = await freshHome();
    try {
      const r = await mintGuardedClaim({
        claim: "x",
        envelope: VALID_ENVELOPE,
        consent: GUARDED_CLAIM_CONSENT_PHRASE,
        demaHome: home,
        now: NOW,
      });
      const raw = await readFile(r.receipt_path, "utf8");
      assert.ok(!raw.includes("PRIVATE KEY"));
      assert.ok(
        !/token_minted|federation|economic_claim|private_key/i.test(raw),
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
