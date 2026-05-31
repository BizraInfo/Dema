// FLYWHEEL-1C · durable local impact ledger append.
//
// Takes the FLYWHEEL-1B settlement bridge and makes it durable:
//   verified flywheel receipt + scoped consent
//     -> signed local IMPACT ledger entry
//     -> append to $DEMA_HOME/econ/flywheel-impact-ledger.ndjson
//     -> replay the whole ledger with ECON-1B before returning success
//
// No CLI, no public economy, no transfer, no XP, no House of Wisdom.

import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { verifyLedgerReplay } from "../../econ/src/dual-token-ledger-replay.js";
import { settleOneTaskFlywheelImpact } from "./flywheel-settlement.js";

export const FLYWHEEL_LEDGER_APPEND_SCHEMA =
  "bizra.dema.flywheel_impact_ledger_append.v0.1";

export const FLYWHEEL_IMPACT_LEDGER_RELPATH =
  "econ/flywheel-impact-ledger.ndjson";

const SUCCESS_BOUNDARY = Object.freeze({
  local_only: true,
  file_write_performed: true,
  operator_dema_home_mutated: true,
  network_used: false,
  federation_used: false,
  public_economic_claim_made: false,
  exchange_value_claimed: false,
  public_transfer_performed: false,
});

const FAIL_BOUNDARY = Object.freeze({
  local_only: true,
  file_write_performed: false,
  operator_dema_home_mutated: false,
  network_used: false,
  federation_used: false,
  public_economic_claim_made: false,
  exchange_value_claimed: false,
  public_transfer_performed: false,
});

function resolveHome(override) {
  if (typeof override === "string" && override.length > 0) return override;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

function ledgerPath(demaHome) {
  return join(resolveHome(demaHome), FLYWHEEL_IMPACT_LEDGER_RELPATH);
}

function fail(error, extra = {}) {
  return Object.freeze({
    schema: FLYWHEEL_LEDGER_APPEND_SCHEMA,
    appended: false,
    truth_label: "LOCAL_FLYWHEEL_IMPACT_LEDGER_APPEND_FAILED",
    error,
    ...extra,
    boundary: FAIL_BOUNDARY,
  });
}

export async function loadFlywheelImpactLedger({ demaHome } = {}) {
  let raw;
  try {
    raw = await readFile(ledgerPath(demaHome), "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return [];
    throw err;
  }
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

export async function verifyFlywheelImpactLedger({ demaHome, pubkeyPem } = {}) {
  const entries = await loadFlywheelImpactLedger({ demaHome });
  if (entries.length === 0) {
    return Object.freeze({ verified: true, total_entries: 0 });
  }
  return verifyLedgerReplay({ entries, pubkeyPem });
}

export async function appendFlywheelImpactSettlement({
  flywheelReceipt,
  actionReceiptId,
  consentProof,
  operatorPubkeyPem,
  demaHome,
  now,
  createdAtIso,
} = {}) {
  let entries;
  try {
    entries = await loadFlywheelImpactLedger({ demaHome });
  } catch {
    return fail("ledger_unreadable");
  }

  if (entries.length > 0) {
    const existingReplay = verifyLedgerReplay({
      entries,
      pubkeyPem: operatorPubkeyPem,
    });
    if (!existingReplay.verified) {
      return fail("ledger_chain_broken", {
        reason: existingReplay.reason,
        replay: existingReplay,
      });
    }
  }

  // Reject duplicate settlements: the same flywheel action must not mint a
  // second IMPACT_CREDIT. A doubled chain still replays, so the guard lives
  // here — scan existing evidence for this flywheel receipt id.
  const flywheelReceiptId = flywheelReceipt && flywheelReceipt.receipt_id;
  if (
    flywheelReceiptId &&
    entries.some(
      (e) =>
        Array.isArray(e.evidence_receipt_hashes) &&
        e.evidence_receipt_hashes.includes(flywheelReceiptId),
    )
  ) {
    return fail("duplicate_settlement");
  }

  const prevLedgerHash =
    entries.length > 0 ? entries[entries.length - 1].entry_hash : null;

  const settlement = await settleOneTaskFlywheelImpact({
    flywheelReceipt,
    actionReceiptId,
    consentProof,
    operatorPubkeyPem,
    demaHome,
    now,
    createdAtIso,
    prevLedgerHash,
  });
  if (!settlement.settled) {
    return fail(settlement.error, {
      stage: "settlement",
      settlement,
    });
  }

  const nextEntries = [...entries, settlement.ledger_entry];
  const replay = verifyLedgerReplay({
    entries: nextEntries,
    pubkeyPem: operatorPubkeyPem,
  });
  if (!replay.verified) {
    return fail("ledger_replay_failed", { reason: replay.reason, replay });
  }

  // SINGLE-WRITER ASSUMPTION (v0.1 LOCAL_ONLY): tmp+rename makes each write
  // atomic, but two concurrent Dema processes against the same DEMA_HOME could
  // read the same head and lose one append. Node0 is single-operator /
  // single-process, so this is a documented limitation, not a live exploit; a
  // lockfile / compare-and-swap is future hardening before any multi-writer use.
  const path = ledgerPath(demaHome);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const content =
    nextEntries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
  const tmp = `${path}.${settlement.ledger_entry.entry_hash.slice(0, 12)}.tmp`;
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

  return Object.freeze({
    schema: FLYWHEEL_LEDGER_APPEND_SCHEMA,
    appended: true,
    truth_label: "LOCAL_FLYWHEEL_IMPACT_LEDGER_APPEND_VERIFIED",
    path,
    length: nextEntries.length,
    head: settlement.ledger_entry.entry_hash,
    ledger_entry: settlement.ledger_entry,
    settlement,
    replay,
    boundary: SUCCESS_BOUNDARY,
  });
}
