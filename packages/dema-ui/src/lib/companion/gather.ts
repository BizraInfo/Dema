// Disk readers for the companion face. Read-only except writeOperatorBond,
// which the bond route calls only after the exact phrase matches.

import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { sha256CanonicalJsonV1 } from "../../../../canon/src/sha256-canonical-json-v1.js";
import {
  readOperatorLanguage,
  readOperatorPreferredName,
} from "../../../../core/src/operator-profile.js";
import { classifyMemoryEntry } from "../../../../core/src/pat-memory-curator.js";
import { listMemoryEntries } from "../../../../memory/src/memory-store.js";
import {
  loadCanonicalLedger,
  verifyCanonicalLedger,
} from "../../../../receipts/src/canonical-ledger.js";
import { loadPublicKey } from "../../../../receipts/src/authorship-key-store.js";
import {
  listSeasons,
  loadSeasonHead,
  resumeSeason,
} from "../../../../receipts/src/season-state-store.js";
import { projectCanonicalStanding } from "./receipt-standing.ts";
import { projectPresence } from "./presence-projection.ts";
import { projectWelcome } from "./welcome-projection.ts";

const ESTATE_RECEIPT_SCHEMA = "bizra.dema.founder_estate_mission_receipt.v0.1";

export function companionHome(demaHome?: string | null) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || undefined;
}

function estateRoot(demaHome?: string | null) {
  const root = demaHome || process.env.BIZRA_FOUNDER_DEMA_HOME || process.env.DEMA_HOME;
  if (!root || !root.startsWith("/") || resolve(root) === "/") return null;
  return resolve(root);
}

async function readVerifiedEstateReceipts(demaHome?: string | null) {
  const root = estateRoot(demaHome);
  if (!root) return { status: "absent" as const, receipts: [] as Array<{ mission_id: string; receipt_hash: string }> };
  const directory = join(root, "receipts", "founder-estate");
  let names: string[];
  try {
    names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  } catch (error: any) {
    if (error?.code === "ENOENT") return { status: "absent" as const, receipts: [] };
    return { status: "unknown" as const, receipts: [], reason: "estate_history_unavailable" };
  }
  const receipts: Array<{ mission_id: string; receipt_hash: string }> = [];
  for (const name of names) {
    try {
      const receipt = JSON.parse(await readFile(join(directory, name), "utf8"));
      if (!receipt || receipt.schema !== ESTATE_RECEIPT_SCHEMA || typeof receipt.receipt_hash !== "string") continue;
      const body = { ...receipt };
      delete body.receipt_hash;
      if (sha256CanonicalJsonV1(body) !== receipt.receipt_hash) continue;
      receipts.push({ mission_id: receipt.mission_id, receipt_hash: receipt.receipt_hash });
    } catch {
      // Malformed evidence is not a presence event and not standing.
    }
  }
  return { status: "verified" as const, receipts };
}

export async function gatherWelcome(demaHome?: string | null) {
  const home = companionHome(demaHome);
  const [listed, name, language] = await Promise.all([
    listSeasons({ demaHome: home }),
    readOperatorPreferredName(home),
    readOperatorLanguage(home),
  ]);
  let resume: Awaited<ReturnType<typeof resumeSeason>> | null = null;
  if (listed.ok && listed.season_ids.length === 1) {
    resume = await resumeSeason({ demaHome: home, seasonId: listed.season_ids[0] });
  }
  return projectWelcome({
    listed,
    resume,
    profile: {
      preferred_name: name,
      language_code: language.language_code,
      language_source: language.source,
    },
  });
}

export async function gatherPresence(demaHome?: string | null, sessionObserved = false) {
  const estate = await readVerifiedEstateReceipts(demaHome);
  const observations: Array<Record<string, unknown>> = [
    {
      source: "local_session",
      observed: sessionObserved === true,
      receipt_hash: null,
      reason: "session_cookie_is_not_a_receipt",
    },
  ];
  if (estate.status === "unknown") {
    observations.push({
      source: "founder_estate",
      receipt_hash: null,
      reason: estate.reason ?? "estate_history_unavailable",
    });
  } else {
    for (const receipt of estate.receipts) {
      observations.push({
        source: "founder_estate",
        mission_id: receipt.mission_id,
        receipt_hash: receipt.receipt_hash,
        reason: "estate_receipt_has_no_presence_kind_or_seq",
      });
    }
  }
  // No on-disk presence event log exists in this repository. Do not invent seq.
  return projectPresence({ events: [], observations });
}

export async function gatherStanding(demaHome?: string | null) {
  const home = companionHome(demaHome);
  let entries: any[] | null = null;
  try {
    entries = await loadCanonicalLedger({ demaHome: home });
  } catch {
    return projectCanonicalStanding({
      readable: false,
      verified: false,
      entries: [],
      reason: "ledger_unreadable",
    });
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return projectCanonicalStanding({ readable: true, verified: true, entries: [] });
  }
  const pubkey = await loadPublicKey(home);
  if (!pubkey) {
    return projectCanonicalStanding({
      readable: true,
      verified: false,
      entries,
      reason: "no_authorship_key",
    });
  }
  let verified;
  try {
    verified = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: pubkey });
  } catch {
    return projectCanonicalStanding({
      readable: true,
      verified: false,
      entries,
      reason: "ledger_verify_threw",
    });
  }
  if (!verified?.verified) {
    return projectCanonicalStanding({
      readable: true,
      verified: false,
      entries,
      reason: verified?.reason ?? "ledger_unverified",
    });
  }
  return projectCanonicalStanding({ readable: true, verified: true, entries });
}

export async function readHeadSeasonReceipt(demaHome: string | null | undefined, hash: string) {
  if (typeof hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(hash)) {
    return { ok: false, status: 422, reason: "receipt_hash_malformed" };
  }
  const home = companionHome(demaHome);
  const listed = await listSeasons({ demaHome: home });
  if (!listed.ok) return { ok: false, status: 503, reason: listed.reason ?? "season_listing_failed" };
  if (listed.season_ids.length === 0) return { ok: false, status: 404, reason: "receipt_not_found" };
  if (listed.season_ids.length > 1) return { ok: false, status: 409, reason: "season_ambiguous", season_ids: listed.season_ids };
  const loaded = await loadSeasonHead({ demaHome: home, seasonId: listed.season_ids[0] });
  if (!loaded.ok || loaded.outcome !== "OK") {
    return { ok: false, status: 404, reason: loaded.reason ?? "receipt_not_found" };
  }
  if (loaded.receipt?.receipt_hash !== hash) {
    return { ok: false, status: 404, reason: "receipt_not_head" };
  }
  return {
    ok: true,
    status: 200,
    season_id: listed.season_ids[0],
    receipt_hash: loaded.receipt.receipt_hash,
    receipt: loaded.receipt,
  };
}

export async function gatherMemoryIndex(demaHome?: string | null) {
  const home = companionHome(demaHome);
  let entries: Array<{ name: string }> = [];
  try {
    entries = await listMemoryEntries(home);
  } catch {
    return {
      ok: false,
      truth_label: "UNKNOWN",
      reason: "memory_index_unavailable",
      entries: [],
    };
  }
  return {
    ok: true,
    truth_label: entries.length === 0 ? "EMPTY" : "PREVIEW_ONLY",
    reason: entries.length === 0 ? "no_memory_entries" : null,
    receipt_linkage: "UNKNOWN",
    receipt_reason: "memory entries are not receipt-backed",
    entries: entries.map((entry) => {
      const classification = classifyMemoryEntry({ entry_name: entry.name });
      return {
        name: entry.name,
        suggested_category: classification.suggested_category,
        classification_confidence: classification.classification_confidence,
        truth_label: classification.truth_label,
        receipt_hash: null,
      };
    }),
  };
}
