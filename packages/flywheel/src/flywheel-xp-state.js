// FLYWHEEL-1F · durable local XP state append.
//
// Takes the FLYWHEEL-1E XP mint bridge and makes the signed skill ledger
// durable:
//   verified impact entry + SAT validation + scoped consent
//     -> signed AGENT-SKILL-1A ledger
//     -> append replayable XP state record to DEMA_HOME
//     -> verify the whole XP state chain before success
//
// No CLI, no public economy, no transfer, no marketplace, no House of Wisdom,
// no performance delta, and no full Node0-complete claim.

import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { verifyLedgerEntry } from "../../econ/src/dual-token-ledger.js";
import { verifySkillLedger } from "../../agents/src/agent-skill-ledger.js";
import { verifySatValidationReceipt } from "./flywheel-sat-validation.js";
import { mintFlywheelXpGrant } from "./flywheel-xp-mint.js";

export const FLYWHEEL_XP_STATE_APPEND_SCHEMA =
  "bizra.dema.flywheel_xp_state_append.v0.1";

export const FLYWHEEL_XP_STATE_RECORD_SCHEMA =
  "bizra.dema.flywheel_xp_state_record.v0.1";

export const FLYWHEEL_XP_STATE_RELPATH = "agents/flywheel-xp-state.ndjson";

const SUCCESS_BOUNDARY = Object.freeze({
  local_only: true,
  file_write_performed: true,
  operator_dema_home_mutated: true,
  network_used: false,
  federation_used: false,
  public_economic_claim_made: false,
  public_transfer_performed: false,
  marketplace_used: false,
  house_of_wisdom_mutated: false,
  performance_delta_recorded: false,
  full_node0_complete_claimed: false,
  private_key_material_returned: false,
  xp_state_appended: true,
});

const FAIL_BOUNDARY = Object.freeze({
  local_only: true,
  file_write_performed: false,
  operator_dema_home_mutated: false,
  network_used: false,
  federation_used: false,
  public_economic_claim_made: false,
  public_transfer_performed: false,
  marketplace_used: false,
  house_of_wisdom_mutated: false,
  performance_delta_recorded: false,
  full_node0_complete_claimed: false,
  private_key_material_returned: false,
  xp_state_appended: false,
});

const FORBIDDEN_RECORD_KEYS = Object.freeze([
  "private_key",
  "private_key_pem",
  "exchange_value",
  "fiat_value",
  "public_mint",
  "market_price",
  "federation_target",
  "settlement_target",
  "transfer_target",
  "public_transfer",
  "mint_authority",
  "supply_curve",
]);

function resolveHome(override) {
  if (typeof override === "string" && override.length > 0) return override;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

function statePath(demaHome) {
  return join(resolveHome(demaHome), FLYWHEEL_XP_STATE_RELPATH);
}

function fail(error, extra = {}) {
  return Object.freeze({
    schema: FLYWHEEL_XP_STATE_APPEND_SCHEMA,
    appended: false,
    truth_label: "LOCAL_FLYWHEEL_XP_STATE_APPEND_FAILED",
    error,
    ...extra,
    boundary: FAIL_BOUNDARY,
  });
}

function reject(reason, at_index) {
  if (at_index === undefined) {
    return Object.freeze({ verified: false, reason });
  }
  return Object.freeze({ verified: false, reason, at_index });
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isSha256Hex(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}

function deepFreeze(v) {
  if (!v || typeof v !== "object" || Object.isFrozen(v)) return v;
  for (const value of Object.values(v)) {
    deepFreeze(value);
  }
  return Object.freeze(v);
}

function hasForbiddenRecordKey(v) {
  if (!v || typeof v !== "object") return false;
  for (const key of Object.keys(v)) {
    if (FORBIDDEN_RECORD_KEYS.includes(key)) return true;
    if (hasForbiddenRecordKey(v[key])) return true;
  }
  return false;
}

function impactReceiptFromLedgerEntry(entry) {
  return Object.freeze({
    receipt_hash: entry.entry_hash,
    entry_type: entry.entry_type,
    token_class: entry.token_class,
  });
}

function stableRecordBody(record) {
  const { state_hash, ...body } = record;
  return body;
}

function hashRecordBody(record) {
  return sha256(stableStringify(stableRecordBody(record)));
}

function aggregateSummaries(records) {
  const summaries = {};
  for (const record of records) {
    if (!summaries[record.agent_id]) {
      summaries[record.agent_id] = {
        xp_total: 0,
        skill_balances: {},
      };
    }
    const summary = summaries[record.agent_id];
    for (const grant of record.skill_ledger.skill_grants) {
      summary.xp_total += grant.xp_amount;
      summary.skill_balances[grant.skill_id] =
        (summary.skill_balances[grant.skill_id] || 0) + grant.xp_amount;
    }
  }
  for (const [agentId, summary] of Object.entries(summaries)) {
    summaries[agentId] = Object.freeze({
      xp_total: summary.xp_total,
      skill_balances: Object.freeze({ ...summary.skill_balances }),
    });
  }
  return Object.freeze(summaries);
}

function buildStateRecord({
  prevStateHash,
  mint,
  ledgerEntry,
  satValidationReceipt,
  consentProof,
}) {
  const body = {
    schema: FLYWHEEL_XP_STATE_RECORD_SCHEMA,
    agent_id: mint.agent_id,
    prev_state_hash: prevStateHash,
    created_at_iso: mint.skill_ledger.created_at_iso,
    xp_rule_id: mint.xp_rule_id,
    consent_proof_hash: consentProof.consent_proof_hash,
    skill_ledger_proof_hash: mint.skill_ledger.ledger_proof_hash,
    impact_ledger_entry: ledgerEntry,
    sat_validation_receipt: satValidationReceipt,
    skill_ledger: mint.skill_ledger,
  };
  return deepFreeze({
    ...body,
    state_hash: sha256(stableStringify(body)),
  });
}

export async function loadFlywheelXpState({ demaHome } = {}) {
  let raw;
  try {
    raw = await readFile(statePath(demaHome), "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return [];
    throw err;
  }
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

export function verifyFlywheelXpStateRecords({ records, pubkeyPem } = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    return Object.freeze({
      verified: true,
      total_records: 0,
      agent_summaries: Object.freeze({}),
    });
  }

  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    if (!isPlainObject(record)) {
      return reject("xp_state_record_malformed", i);
    }
    if (record.schema !== FLYWHEEL_XP_STATE_RECORD_SCHEMA) {
      return reject("xp_state_schema_mismatch", i);
    }
    if (hasForbiddenRecordKey(record)) {
      return reject("forbidden_field_present", i);
    }
    if (i === 0) {
      if (record.prev_state_hash !== null) {
        return reject("genesis_prev_state_hash_not_null", i);
      }
    } else if (record.prev_state_hash !== records[i - 1].state_hash) {
      return reject("prev_state_hash_mismatch", i);
    }
    if (!isSha256Hex(record.state_hash)) {
      return reject("state_hash_mismatch", i);
    }

    const impactVerification = verifyLedgerEntry({
      entry: record.impact_ledger_entry,
      pubkeyPem,
    });
    if (!impactVerification.verified) {
      return Object.freeze({
        verified: false,
        reason: "impact_entry_verification_failed",
        impact_reason: impactVerification.reason,
        at_index: i,
      });
    }
    if (
      record.impact_ledger_entry.entry_type !== "IMPACT_CREDIT" ||
      record.impact_ledger_entry.token_class !== "IMPACT"
    ) {
      return reject("not_an_impact_credit", i);
    }

    const satVerification = verifySatValidationReceipt({
      receipt: record.sat_validation_receipt,
      pubkeyPem,
    });
    if (!satVerification.verified) {
      return Object.freeze({
        verified: false,
        reason: "sat_validation_verification_failed",
        sat_reason: satVerification.reason,
        at_index: i,
      });
    }

    if (record.skill_ledger_proof_hash !== record.skill_ledger?.ledger_proof_hash) {
      return reject("skill_ledger_proof_hash_mismatch", i);
    }
    if (record.agent_id !== record.skill_ledger?.agent_id) {
      return reject("agent_id_mismatch", i);
    }

    const skillLedgerVerification = verifySkillLedger({
      ledger: record.skill_ledger,
      impactReceipts: [impactReceiptFromLedgerEntry(record.impact_ledger_entry)],
      satValidations: [record.sat_validation_receipt],
      pubkeyPem,
    });
    if (!skillLedgerVerification.verified) {
      return Object.freeze({
        verified: false,
        reason: "skill_ledger_verification_failed",
        skill_reason: skillLedgerVerification.reason,
        at_index: i,
      });
    }

    const recomputed = hashRecordBody(record);
    if (recomputed !== record.state_hash) {
      return reject("state_hash_mismatch", i);
    }
  }

  return deepFreeze({
    verified: true,
    total_records: records.length,
    chain_root_hash: records[records.length - 1].state_hash,
    agent_summaries: aggregateSummaries(records),
  });
}

export async function verifyFlywheelXpState({ demaHome, pubkeyPem } = {}) {
  const records = await loadFlywheelXpState({ demaHome });
  return verifyFlywheelXpStateRecords({ records, pubkeyPem });
}

export async function appendFlywheelXpState({
  proposal,
  ledgerEntry,
  satValidationReceipt,
  operatorPubkeyPem,
  consentProof,
  demaHome,
  createdAtIso,
} = {}) {
  let records;
  try {
    records = await loadFlywheelXpState({ demaHome });
  } catch {
    return fail("xp_state_unreadable");
  }

  if (records.length > 0) {
    const existingReplay = verifyFlywheelXpStateRecords({
      records,
      pubkeyPem: operatorPubkeyPem,
    });
    if (!existingReplay.verified) {
      return fail("xp_state_chain_broken", {
        reason: existingReplay.reason,
        replay: existingReplay,
      });
    }
  }

  const mint = await mintFlywheelXpGrant({
    proposal,
    ledgerEntry,
    satValidationReceipt,
    operatorPubkeyPem,
    consentProof,
    demaHome,
    createdAtIso,
  });
  if (!mint.minted) {
    return fail(mint.error, {
      stage: "xp_mint",
      mint,
    });
  }

  const prevStateHash =
    records.length > 0 ? records[records.length - 1].state_hash : null;
  const record = buildStateRecord({
    prevStateHash,
    mint,
    ledgerEntry,
    satValidationReceipt,
    consentProof,
  });
  const nextRecords = [...records, record];
  const replay = verifyFlywheelXpStateRecords({
    records: nextRecords,
    pubkeyPem: operatorPubkeyPem,
  });
  if (!replay.verified) {
    return fail("xp_state_replay_failed", {
      reason: replay.reason,
      replay,
    });
  }

  const path = statePath(demaHome);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const content =
    nextRecords.map((stateRecord) => JSON.stringify(stateRecord)).join("\n") +
    "\n";
  const tmp = `${path}.${record.state_hash.slice(0, 12)}.tmp`;
  try {
    await writeFile(tmp, content, { encoding: "utf8", mode: 0o600 });
    await rename(tmp, path);
  } catch (err) {
    try {
      await unlink(tmp);
    } catch {
      /* tmp already gone */
    }
    throw err;
  }

  return deepFreeze({
    schema: FLYWHEEL_XP_STATE_APPEND_SCHEMA,
    appended: true,
    truth_label: "LOCAL_FLYWHEEL_XP_STATE_APPEND_VERIFIED",
    path,
    length: nextRecords.length,
    head: record.state_hash,
    record,
    xp_mint: mint,
    replay,
    boundary: SUCCESS_BOUNDARY,
  });
}
