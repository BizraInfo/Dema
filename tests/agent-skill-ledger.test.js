// AGENT-SKILL-1A · Skill ledger + XP progression kernel tests
//
// Covers the 7 testable DOD criteria from the task contract embedded in
// AGENT_PROFILE_0_PREFLIGHT.md §10 (AGENT-SKILL-1A) plus PDF §11 load-
// bearing rules:
//
//   - No XP without proof.
//   - No reward without verified impact.
//   - No self-verification.
//   - No self-minting.
//   - SAT must validate reward eligibility.
//   - Skills require repeated verified performance.
//   - Levels summarize proof, not vibes.
//
// Surface:
//
//   buildSkillLedger({
//     agent_id, skill_grants, consentProof, demaHome, createdAtIso?
//   })
//
//   verifySkillLedger({ ledger, impactReceipts, satValidations, pubkeyPem })
//
// Schema: bizra.dema.agent_skill_ledger.v0.1
//
// Each grant: { skill_id, xp_amount, evidence_impact_receipt_hash,
//               sat_validation_receipt_hash }
//
// Local-only. No CLI. No payment surface. External pubkey for verify.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildSkillLedger,
  verifySkillLedger,
  AGENT_SKILL_LEDGER_SCHEMA,
  MUTATE_AGENT_SKILL_LEDGER_ACTION_TYPE,
} from "../packages/agents/src/agent-skill-ledger.js";

import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const AGENT_ID = "pat.teacher";
const OTHER_AGENT_ID = "sat.verifier";
const FIXED_CREATED = "2026-05-30T08:00:00.000Z";
const FIXED_CONSENT_NONCE = "deadbeef".repeat(8);
const FIXED_CONSENT_CREATED = "2026-05-30T08:00:00.000Z";
const FIXED_CONSENT_EXPIRES = "2026-05-30T08:05:00.000Z";

const PREV_HASH_GENESIS = "0".repeat(64);

// Fixture sha256 hex strings for receipt hashes.
const IMPACT_HASH_1 = "1".repeat(64);
const IMPACT_HASH_2 = "2".repeat(64);
const IMPACT_HASH_3 = "3".repeat(64);
const SAT_HASH_1 = "a".repeat(64);
const SAT_HASH_2 = "b".repeat(64);
const SAT_HASH_3 = "c".repeat(64);

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-agent-skill-test-"));
}

// Synthetic impact receipt — the kernel cares only about:
//   - receipt_hash  (content-address; matches grant.evidence_impact_receipt_hash)
//   - agent_id      (the agent who produced/owns the work; self-minting
//                    test compares this to ledger.agent_id)
//   - counterparty_signer_agent_id (presence proves non-self-minted; per
//                    PDF §11 "No self-minting" — work signed only by the
//                    same agent has no other-party witness)
function impactReceipt({
  receipt_hash,
  agent_id,
  counterparty_signer_agent_id,
}) {
  return Object.freeze({
    receipt_hash,
    agent_id,
    counterparty_signer_agent_id,
  });
}

// Synthetic SAT validation — the kernel cares only about:
//   - receipt_hash    (content-address; matches grant.sat_validation_receipt_hash)
//   - validator_agent_id (the SAT that signed the validation; must NOT
//                    equal ledger.agent_id per PDF §11 "No self-verification")
function satValidation({ receipt_hash, validator_agent_id }) {
  return Object.freeze({
    receipt_hash,
    validator_agent_id,
  });
}

// Build the projected ledger body the kernel will sign — must match the
// kernel's canonical body shape EXACTLY so consent target_hash binds.
function projectedLedgerBody({
  agent_id,
  skill_grants,
  skill_balances,
  xp_total,
  prev_hash,
  created_at_iso,
  operator_public_key_fingerprint,
}) {
  return {
    schema: AGENT_SKILL_LEDGER_SCHEMA,
    agent_id,
    skill_grants,
    skill_balances,
    xp_total,
    prev_hash,
    created_at_iso,
    operator_public_key_fingerprint,
  };
}

async function makeLedgerConsent({
  home,
  scopeOverride,
  agent_id = AGENT_ID,
  skill_grants,
  skill_balances,
  xp_total,
  prev_hash = PREV_HASH_GENESIS,
  created_at_iso = FIXED_CREATED,
}) {
  const { loadPublicKey } =
    await import("../packages/receipts/src/authorship-key-store.js");
  const { createPublicKey } = await import("node:crypto");
  const pub = await loadPublicKey(home);
  const pk = createPublicKey(pub);
  const fingerprint = sha256(
    pk.export({ type: "spki", format: "der" }).toString("hex"),
  );
  const projected = projectedLedgerBody({
    agent_id,
    skill_grants,
    skill_balances,
    xp_total,
    prev_hash,
    created_at_iso,
    operator_public_key_fingerprint: fingerprint,
  });
  const target_hash = sha256(stableStringify(projected));
  const scope = scopeOverride || {
    action_type: MUTATE_AGENT_SKILL_LEDGER_ACTION_TYPE,
    target_hash,
  };
  const cp = await buildConsentProof({
    phrase: "SIGN AUTHORSHIP RECEIPT",
    actionScope: scope,
    demaHome: home,
    nonce: FIXED_CONSENT_NONCE,
    createdAtIso: FIXED_CONSENT_CREATED,
    expiresAtIso: FIXED_CONSENT_EXPIRES,
  });
  if (!cp.built) {
    throw new Error(`ledger consent build failed: ${cp.error}`);
  }
  return cp;
}

// Build a 3-grant happy ledger:
//   sword: +10 (grant 1) and +5 (grant 2)  → balance 15
//   magic: +7  (grant 3)                   → balance 7
//   xp_total = 22
async function buildHappyLedger() {
  const home = await freshHome();
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  const skill_grants = [
    Object.freeze({
      skill_id: "sword",
      xp_amount: 10,
      evidence_impact_receipt_hash: IMPACT_HASH_1,
      sat_validation_receipt_hash: SAT_HASH_1,
    }),
    Object.freeze({
      skill_id: "sword",
      xp_amount: 5,
      evidence_impact_receipt_hash: IMPACT_HASH_2,
      sat_validation_receipt_hash: SAT_HASH_2,
    }),
    Object.freeze({
      skill_id: "magic",
      xp_amount: 7,
      evidence_impact_receipt_hash: IMPACT_HASH_3,
      sat_validation_receipt_hash: SAT_HASH_3,
    }),
  ];
  const skill_balances = { magic: 7, sword: 15 };
  const xp_total = 22;
  const cp = await makeLedgerConsent({
    home,
    skill_grants,
    skill_balances,
    xp_total,
  });
  const result = await buildSkillLedger({
    agent_id: AGENT_ID,
    skill_grants,
    consentProof: cp.consent_proof,
    demaHome: home,
    createdAtIso: FIXED_CREATED,
  });
  const impactReceipts = [
    impactReceipt({
      receipt_hash: IMPACT_HASH_1,
      agent_id: OTHER_AGENT_ID,
      counterparty_signer_agent_id: AGENT_ID,
    }),
    impactReceipt({
      receipt_hash: IMPACT_HASH_2,
      agent_id: OTHER_AGENT_ID,
      counterparty_signer_agent_id: AGENT_ID,
    }),
    impactReceipt({
      receipt_hash: IMPACT_HASH_3,
      agent_id: OTHER_AGENT_ID,
      counterparty_signer_agent_id: AGENT_ID,
    }),
  ];
  const satValidations = [
    satValidation({
      receipt_hash: SAT_HASH_1,
      validator_agent_id: OTHER_AGENT_ID,
    }),
    satValidation({
      receipt_hash: SAT_HASH_2,
      validator_agent_id: OTHER_AGENT_ID,
    }),
    satValidation({
      receipt_hash: SAT_HASH_3,
      validator_agent_id: OTHER_AGENT_ID,
    }),
  ];
  return { home, result, skill_grants, impactReceipts, satValidations };
}

describe("agent-skill-ledger · buildSkillLedger happy path (DOD-1)", () => {
  it("DOD-1: 3 grants across 2 skills (sword: 10+5, magic: 7) → xp_total=22, balances={sword:15, magic:7}", async () => {
    const { home, result } = await buildHappyLedger();
    try {
      assert.equal(result.built, true, `built failed: ${result.error}`);
      const led = result.ledger;
      assert.equal(led.schema, AGENT_SKILL_LEDGER_SCHEMA);
      assert.equal(led.agent_id, AGENT_ID);
      assert.equal(led.xp_total, 22);
      assert.equal(led.skill_balances.sword, 15);
      assert.equal(led.skill_balances.magic, 7);
      assert.equal(Object.keys(led.skill_balances).length, 2);
      assert.equal(led.skill_grants.length, 3);
      assert.equal(led.prev_hash, PREV_HASH_GENESIS);
      assert.equal(led.created_at_iso, FIXED_CREATED);
      assert.ok(/^[a-f0-9]{64}$/.test(led.ledger_proof_hash));
      assert.ok(/^[a-f0-9]{64}$/.test(led.operator_public_key_fingerprint));
      assert.ok(
        typeof led.ledger_signature_b64 === "string" &&
          led.ledger_signature_b64.length > 0,
      );
      assert.ok(typeof led.ledger_id === "string" && led.ledger_id.length > 0);
      assert.ok(Object.isFrozen(result));
      assert.ok(Object.isFrozen(led));
      assert.ok(Object.isFrozen(led.skill_grants));
      assert.ok(Object.isFrozen(led.skill_balances));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("happy path verifies with external pubkey → verified:true", async () => {
    const { home, result, impactReceipts, satValidations } =
      await buildHappyLedger();
    try {
      const v = verifySkillLedger({
        ledger: result.ledger,
        impactReceipts,
        satValidations,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, true, `expected verified; got ${v.reason}`);
      assert.equal(v.xp_total, 22);
      assert.equal(v.agent_id, AGENT_ID);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("agent-skill-ledger · fail-closed gates (DOD-2..DOD-6)", () => {
  it("DOD-2: xp_amount < 0 in any grant → xp_amount_negative", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const skill_grants = [
        {
          skill_id: "sword",
          xp_amount: -1,
          evidence_impact_receipt_hash: IMPACT_HASH_1,
          sat_validation_receipt_hash: SAT_HASH_1,
        },
      ];
      // Build any consent — won't reach scope check because negative xp
      // is caught at structural pass.
      const cp = await makeLedgerConsent({
        home,
        skill_grants,
        skill_balances: { sword: -1 },
        xp_total: -1,
      });
      const r = await buildSkillLedger({
        agent_id: AGENT_ID,
        skill_grants,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "xp_amount_negative");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-3: self-verification — sat_validation signed by same agent → self_verification_attempted", async () => {
    const { home, result, impactReceipts } = await buildHappyLedger();
    try {
      // SAT validations point to a validator whose agent_id matches the
      // ledger's agent_id — PDF §11 "No self-verification."
      const selfValidations = [
        satValidation({
          receipt_hash: SAT_HASH_1,
          validator_agent_id: AGENT_ID,
        }),
        satValidation({
          receipt_hash: SAT_HASH_2,
          validator_agent_id: OTHER_AGENT_ID,
        }),
        satValidation({
          receipt_hash: SAT_HASH_3,
          validator_agent_id: OTHER_AGENT_ID,
        }),
      ];
      const v = verifySkillLedger({
        ledger: result.ledger,
        impactReceipts,
        satValidations: selfValidations,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "self_verification_attempted");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-4: referenced impact receipt missing from supplied array → impact_receipt_missing", async () => {
    const { home, result, satValidations } = await buildHappyLedger();
    try {
      // Drop the first impact receipt — verifier cannot resolve grant 1.
      const reduced = [
        impactReceipt({
          receipt_hash: IMPACT_HASH_2,
          agent_id: OTHER_AGENT_ID,
          counterparty_signer_agent_id: AGENT_ID,
        }),
        impactReceipt({
          receipt_hash: IMPACT_HASH_3,
          agent_id: OTHER_AGENT_ID,
          counterparty_signer_agent_id: AGENT_ID,
        }),
      ];
      const v = verifySkillLedger({
        ledger: result.ledger,
        impactReceipts: reduced,
        satValidations,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "impact_receipt_missing");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-5: referenced SAT validation missing from supplied array → sat_validation_missing", async () => {
    const { home, result, impactReceipts } = await buildHappyLedger();
    try {
      const reduced = [
        satValidation({
          receipt_hash: SAT_HASH_2,
          validator_agent_id: OTHER_AGENT_ID,
        }),
        satValidation({
          receipt_hash: SAT_HASH_3,
          validator_agent_id: OTHER_AGENT_ID,
        }),
      ];
      const v = verifySkillLedger({
        ledger: result.ledger,
        impactReceipts,
        satValidations: reduced,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "sat_validation_missing");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-6: tampered xp_total → xp_total_mismatch", async () => {
    const { home, result, impactReceipts, satValidations } =
      await buildHappyLedger();
    try {
      const tampered = { ...result.ledger, xp_total: 999 };
      const v = verifySkillLedger({
        ledger: tampered,
        impactReceipts,
        satValidations,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "xp_total_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("tampered skill_balances → skill_balance_mismatch", async () => {
    const { home, result, impactReceipts, satValidations } =
      await buildHappyLedger();
    try {
      // Replace skill_balances with a wrong distribution that still sums
      // to xp_total but assigns the wrong xp to the wrong skill.
      const tampered = {
        ...result.ledger,
        skill_balances: Object.freeze({ sword: 22, magic: 0 }),
      };
      const v = verifySkillLedger({
        ledger: tampered,
        impactReceipts,
        satValidations,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "skill_balance_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("self-minting: impact receipt's agent_id == ledger agent_id with no counterparty → self_minting_attempted", async () => {
    const { home, result, satValidations } = await buildHappyLedger();
    try {
      const selfMint = [
        // First receipt has the same agent_id AND no counterparty signer
        // → self-minted. PDF §11 "No self-minting."
        impactReceipt({
          receipt_hash: IMPACT_HASH_1,
          agent_id: AGENT_ID,
          counterparty_signer_agent_id: null,
        }),
        impactReceipt({
          receipt_hash: IMPACT_HASH_2,
          agent_id: OTHER_AGENT_ID,
          counterparty_signer_agent_id: AGENT_ID,
        }),
        impactReceipt({
          receipt_hash: IMPACT_HASH_3,
          agent_id: OTHER_AGENT_ID,
          counterparty_signer_agent_id: AGENT_ID,
        }),
      ];
      const v = verifySkillLedger({
        ledger: result.ledger,
        impactReceipts: selfMint,
        satValidations,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "self_minting_attempted");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("grant missing evidence_impact_receipt_hash → xp_without_proof", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const skill_grants = [
        {
          skill_id: "sword",
          xp_amount: 10,
          // evidence_impact_receipt_hash omitted on purpose
          sat_validation_receipt_hash: SAT_HASH_1,
        },
      ];
      const cp = await makeLedgerConsent({
        home,
        skill_grants,
        skill_balances: { sword: 10 },
        xp_total: 10,
      });
      const r = await buildSkillLedger({
        agent_id: AGENT_ID,
        skill_grants,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "xp_without_proof");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("grant missing sat_validation_receipt_hash → reward_without_validation", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const skill_grants = [
        {
          skill_id: "sword",
          xp_amount: 10,
          evidence_impact_receipt_hash: IMPACT_HASH_1,
          // sat_validation_receipt_hash omitted on purpose
        },
      ];
      const cp = await makeLedgerConsent({
        home,
        skill_grants,
        skill_balances: { sword: 10 },
        xp_total: 10,
      });
      const r = await buildSkillLedger({
        agent_id: AGENT_ID,
        skill_grants,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "reward_without_validation");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("missing consent → consent_proof_required", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const r = await buildSkillLedger({
        agent_id: AGENT_ID,
        skill_grants: [],
        consentProof: undefined,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_proof_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("consent scoped to wrong action_type → consent_scope_mismatch", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const cp = await makeLedgerConsent({
        home,
        skill_grants: [],
        skill_balances: {},
        xp_total: 0,
        scopeOverride: {
          action_type: "MINT_VERDICT_RECEIPT",
          target_hash: "0".repeat(64),
        },
      });
      const r = await buildSkillLedger({
        agent_id: AGENT_ID,
        skill_grants: [],
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "consent_scope_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("no authorship key on disk → no_authorship_key", async () => {
    const home = await freshHome();
    try {
      const r = await buildSkillLedger({
        agent_id: AGENT_ID,
        skill_grants: [],
        consentProof: {
          schema: "bizra.dema.consent_proof.v0.1",
          consent_phrase: "x",
          action_scope: {
            action_type: MUTATE_AGENT_SKILL_LEDGER_ACTION_TYPE,
            target_hash: "a".repeat(64),
          },
          nonce: "x",
          created_at_iso: FIXED_CREATED,
          expires_at_iso: "2099-01-01T00:00:00.000Z",
          operator_public_key_fingerprint: "a".repeat(64),
          consent_signature_b64: "x",
          consent_proof_hash: "a".repeat(64),
        },
        demaHome: home,
        createdAtIso: FIXED_CREATED,
      });
      assert.equal(r.built, false);
      assert.equal(r.error, "no_authorship_key");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("agent-skill-ledger · DOD-7 no PRIVATE KEY material", () => {
  it("DOD-7: returned envelope contains NO private-key material", async () => {
    const { home, result } = await buildHappyLedger();
    try {
      const envStr = JSON.stringify(result);
      assert.ok(
        !envStr.includes("BEGIN PRIVATE KEY"),
        "envelope must not contain BEGIN PRIVATE KEY marker",
      );
      assert.ok(
        !envStr.includes("PRIVATE KEY"),
        "envelope must not contain any PRIVATE KEY marker",
      );
      assert.equal(result.ledger.private_key, undefined);
      assert.equal(result.ledger.private_key_pem, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("agent-skill-ledger · verifySkillLedger structural rejects", () => {
  it("wrong external pubkey → signature_invalid", async () => {
    const { home, result, impactReceipts, satValidations } =
      await buildHappyLedger();
    try {
      const wrong = generateEd25519Keypair();
      const v = verifySkillLedger({
        ledger: result.ledger,
        impactReceipts,
        satValidations,
        pubkeyPem: wrong.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("wrong schema → agent_skill_ledger_schema_mismatch", async () => {
    const { home, result, impactReceipts, satValidations } =
      await buildHappyLedger();
    try {
      const broken = { ...result.ledger, schema: "not.real.v0.1" };
      const v = verifySkillLedger({
        ledger: broken,
        impactReceipts,
        satValidations,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "agent_skill_ledger_schema_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("empty pubkey → external_pubkey_required or signature_invalid", async () => {
    const { home, result, impactReceipts, satValidations } =
      await buildHappyLedger();
    try {
      const v = verifySkillLedger({
        ledger: result.ledger,
        impactReceipts,
        satValidations,
        pubkeyPem: "",
      });
      assert.equal(v.verified, false);
      assert.ok(
        v.reason === "external_pubkey_required" ||
          v.reason === "signature_invalid",
        `unexpected reason: ${v.reason}`,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("negative xp_amount in ledger body bypassing build → xp_amount_negative at verify", async () => {
    const { home, result, impactReceipts, satValidations } =
      await buildHappyLedger();
    try {
      // Hand-craft a ledger with a negative xp grant. Bypass the build
      // gate by directly mutating the signed body — verifier MUST still
      // reject before getting to signature.
      const corruptGrants = [
        ...result.ledger.skill_grants.slice(0, 2),
        { ...result.ledger.skill_grants[2], xp_amount: -7 },
      ];
      const tampered = { ...result.ledger, skill_grants: corruptGrants };
      const v = verifySkillLedger({
        ledger: tampered,
        impactReceipts,
        satValidations,
        pubkeyPem: result.signer_public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "xp_amount_negative");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("agent-skill-ledger · module surface", () => {
  it("module exposes NO transfer / pay / settle / send surface", async () => {
    const mod = await import("../packages/agents/src/agent-skill-ledger.js");
    assert.equal(mod.transfer, undefined);
    assert.equal(mod.pay, undefined);
    assert.equal(mod.settle, undefined);
    assert.equal(mod.send, undefined);
  });
});
