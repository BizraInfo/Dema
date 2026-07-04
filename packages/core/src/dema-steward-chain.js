// DEMA-STEWARD-CHAIN-1A — Steward-chain verifier: verifies the FIRST_USER
// standing-receipt chain (consecutive UTC days, per-receipt re-derivation,
// drain series) and emits honest day-N-of-required / broken / complete
// verdicts, including the Day-N report payload once — and only once — the
// chain is actually complete on disk.
//
// The calendar cannot be compressed without lying: this kernel exists so the
// only thing left pending is real mornings. It never fabricates days.
//
// Pure kernel: no fs / network / process / clock / random. `today_utc_date`
// and the receipt payloads are injected by the read-only gatherer at the CLI
// boundary. Date arithmetic is pure integer math (days-from-civil), not Date.

import { createHash } from "node:crypto";

import { verifyDemaStand } from "./dema-stand.js";

export const DEMA_STEWARD_CHAIN_SCHEMA = "bizra.dema.dema_steward_chain.v0.1";
export const DEMA_STEWARD_CHAIN_TRUTH_LABEL = "FIRST_USER_STEWARD_CHAIN_LOCAL_ONLY";
export const DEMA_STEWARD_CHAIN_GO_PHRASE = "GO: verify steward chain";

export const DEMA_STEWARD_CHAIN_VERDICTS = Object.freeze([
  "NOT_STARTED",
  "RECEIPTS_INVALID",
  "CHAIN_BROKEN",
  "IN_PROGRESS",
  "COMPLETE",
]);
export const DEMA_STEWARD_CHAIN_DEFAULT_REQUIRED_DAYS = 7;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

// Howard Hinnant's days-from-civil: proleptic Gregorian date -> serial day
// count. Pure integer math — no Date object (kernel purity).
export function daysFromCivilDate(dateText) {
  const [y0, m, d] = dateText.split("-").map(Number);
  const y = m <= 2 ? y0 - 1 : y0;
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z0) {
  const z = z0 + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  const yy = m <= 2 ? y + 1 : y;
  const pad = (n, w) => String(n).padStart(w, "0");
  return `${pad(yy, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

export function demaStewardChainBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

function validateInput(input, blocked_by) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    blocked_by.push("input_not_object");
    return;
  }
  if (typeof input.today_utc_date !== "string" || !DATE_RE.test(input.today_utc_date)) {
    blocked_by.push("today_utc_date_invalid");
  }
  const required = input.required_days ?? DEMA_STEWARD_CHAIN_DEFAULT_REQUIRED_DAYS;
  if (!Number.isInteger(required) || required < 1 || required > 30) {
    blocked_by.push("required_days_invalid");
  }
  if (input.receipts !== undefined && !Array.isArray(input.receipts)) {
    blocked_by.push("receipts_must_be_array");
  }
}

export function planDemaStewardChain({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_STEWARD_CHAIN_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  validateInput(input, blocked_by);
  return Object.freeze({
    schema: DEMA_STEWARD_CHAIN_SCHEMA,
    truth_label: DEMA_STEWARD_CHAIN_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Normalize + re-verify every receipt through the STAND verifier. A chain is
// only as honest as its links; any invalid receipt fails the whole chain.
function classifyReceipts(receipts) {
  const entries = [];
  const invalid = [];
  receipts.forEach((receipt, index) => {
    const verdict = verifyDemaStand(receipt);
    if (verdict.ok !== true) {
      invalid.push({ index, reason_code: verdict.reason_code ?? "unknown" });
      return;
    }
    entries.push({
      date: receipt.observed_at_iso.slice(0, 10),
      content_hash: receipt.content_hash,
      drain: receipt.drain?.declared ?? null,
    });
  });
  return { entries, invalid };
}

function deriveChain(entries, todaySerial, requiredDays) {
  const byDay = new Map();
  const duplicate_days = [];
  for (const entry of entries) {
    if (byDay.has(entry.date)) duplicate_days.push(entry.date);
    else byDay.set(entry.date, entry);
  }
  const days = [...byDay.keys()].sort();
  const serials = days.map(daysFromCivilDate);

  const missing_days = [];
  for (let i = 1; i < serials.length; i += 1) {
    for (let s = serials[i - 1] + 1; s < serials[i]; s += 1) {
      missing_days.push(civilFromDays(s));
    }
  }
  const lastSerial = serials.length ? serials[serials.length - 1] : null;
  if (lastSerial !== null && todaySerial - lastSerial >= 2) {
    for (let s = lastSerial + 1; s < todaySerial; s += 1) {
      missing_days.push(civilFromDays(s));
    }
  }

  const chain = {
    days_present: days.length,
    days,
    duplicate_days,
    missing_days,
    drain_series: days.map((d) => ({ date: d, drain: byDay.get(d).drain })),
    receipt_hashes: days.map((d) => byDay.get(d).content_hash),
  };

  let verdict;
  if (days.length === 0) verdict = "NOT_STARTED";
  else if (missing_days.length > 0) verdict = "CHAIN_BROKEN";
  else if (days.length >= requiredDays) verdict = "COMPLETE";
  else verdict = "IN_PROGRESS";

  const next_required_day =
    verdict === "COMPLETE"
      ? null
      : lastSerial === todaySerial
        ? civilFromDays(todaySerial + 1)
        : civilFromDays(todaySerial);

  return { chain, verdict, next_required_day };
}

function drainSummary(series) {
  const counts = { less: 0, same: 0, more: 0, not_declared: 0 };
  for (const item of series) {
    if (item.drain === null) counts.not_declared += 1;
    else counts[item.drain] += 1;
  }
  return counts;
}

export function buildDemaStewardChainPayload(rawInput) {
  const blocked_by = [];
  validateInput(rawInput, blocked_by);
  if (blocked_by.length > 0) {
    return Object.freeze({
      schema: DEMA_STEWARD_CHAIN_SCHEMA,
      truth_label: DEMA_STEWARD_CHAIN_TRUTH_LABEL,
      rejected: true,
      blocked_by: Object.freeze(blocked_by),
      boundary: demaStewardChainBoundary(),
    });
  }
  const required_days =
    rawInput.required_days ?? DEMA_STEWARD_CHAIN_DEFAULT_REQUIRED_DAYS;
  const receipts = rawInput.receipts ?? [];
  const { entries, invalid } = classifyReceipts(receipts);
  const todaySerial = daysFromCivilDate(rawInput.today_utc_date);

  let verdict;
  let chain;
  let next_required_day;
  if (invalid.length > 0) {
    verdict = "RECEIPTS_INVALID";
    chain = null;
    next_required_day = null;
  } else {
    ({ chain, verdict, next_required_day } = deriveChain(
      entries,
      todaySerial,
      required_days,
    ));
  }

  const day_report =
    verdict === "COMPLETE"
      ? {
          title: `FIRST_USER steward test — ${required_days} consecutive daily receipts on disk`,
          days: chain.days,
          drain_series: chain.drain_series,
          drain_summary: drainSummary(chain.drain_series),
          receipt_hashes: chain.receipt_hashes,
        }
      : null;

  const body = {
    schema: DEMA_STEWARD_CHAIN_SCHEMA,
    truth_label: DEMA_STEWARD_CHAIN_TRUTH_LABEL,
    input: {
      today_utc_date: rawInput.today_utc_date,
      required_days,
      receipts,
    },
    receipts_seen: receipts.length,
    invalid_receipts: invalid,
    verdict,
    progress: chain
      ? `${Math.min(chain.days_present, required_days)}/${required_days}`
      : null,
    chain,
    next_required_day,
    day_report,
    what_this_proves: [
      "The standing-receipt chain state (consecutive UTC days, per-day drain, per-receipt hash validity) is derived deterministically and re-derivable by any verifier.",
      "A COMPLETE verdict can only arise from N distinct, consecutive, individually verified receipts already on disk — days cannot be fabricated by this kernel.",
    ],
    what_this_does_not_prove: [
      "It does not prove the receipts' evidence was truthful when captured — each receipt's gatherer reads were trusted inputs at write time.",
      "It does not prove reduced founder drain caused by Dema; drain values are operator declarations, summarized verbatim.",
      "It performs no runtime, network, model, mint, URP, or federation action.",
    ],
    boundary: demaStewardChainBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier: recompute hash over body minus hash,
// then rebuild the whole payload from the embedded raw input and require
// hash equality — hand-editing any derived field (verdict, chain, report)
// is caught even when the outer hash was recomputed. Known limit: tampering
// with the raw embedded receipts AND recomputing is internally consistent;
// the CLI re-reads receipts from disk on every run, which is the anchor.
export function verifyDemaStewardChain(payload) {
  const reject = (reason_code) =>
    Object.freeze({ ok: false, reason_code, schema: DEMA_STEWARD_CHAIN_SCHEMA });
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return reject("payload_not_object");
  }
  if (payload.rejected === true) return reject("payload_was_rejected");
  if (payload.schema !== DEMA_STEWARD_CHAIN_SCHEMA) return reject("schema_mismatch");
  if (payload.truth_label !== DEMA_STEWARD_CHAIN_TRUTH_LABEL) {
    return reject("truth_label_mismatch");
  }
  if (typeof payload.content_hash !== "string") return reject("content_hash_missing");
  const { content_hash, ...body } = payload;
  if (`sha256:${sha256(stableStringify(body))}` !== content_hash) {
    return reject("content_hash_mismatch");
  }
  for (const [key, value] of Object.entries(payload.boundary ?? {})) {
    if (value !== false) return reject(`boundary_not_false:${key}`);
  }
  const rebuilt = buildDemaStewardChainPayload(payload.input);
  if (rebuilt.rejected === true) return reject("embedded_input_invalid");
  if (rebuilt.content_hash !== content_hash) return reject("derived_fields_mismatch");
  if (!DEMA_STEWARD_CHAIN_VERDICTS.includes(payload.verdict)) {
    return reject("verdict_invalid");
  }
  if (payload.verdict === "COMPLETE" && !payload.day_report) {
    return reject("complete_requires_day_report");
  }
  if (payload.verdict !== "COMPLETE" && payload.day_report) {
    return reject("day_report_before_complete");
  }
  return Object.freeze({
    ok: true,
    reason_code: "dema_steward_chain_valid",
    schema: DEMA_STEWARD_CHAIN_SCHEMA,
    truth_label: DEMA_STEWARD_CHAIN_TRUTH_LABEL,
    content_hash,
  });
}

export function runDemaStewardChain({ consent, input } = {}) {
  const boundary = demaStewardChainBoundary();
  const plan = planDemaStewardChain({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: DEMA_STEWARD_CHAIN_SCHEMA,
      truth_label: DEMA_STEWARD_CHAIN_TRUTH_LABEL,
      blocked_by: plan.blocked_by,
      boundary,
    });
  }
  const payload = buildDemaStewardChainPayload(input);
  const verdict = verifyDemaStewardChain(payload);
  const blocked_by = [];
  if (verdict.ok !== true) blocked_by.push(`verify_failed:${verdict.reason_code}`);
  const tampered = verifyDemaStewardChain({ ...payload, truth_label: "FORGED" });
  if (tampered.ok !== false) blocked_by.push("tamper_check_failed");
  if (blocked_by.length > 0) {
    return Object.freeze({
      ok: false,
      schema: DEMA_STEWARD_CHAIN_SCHEMA,
      truth_label: DEMA_STEWARD_CHAIN_TRUTH_LABEL,
      blocked_by: Object.freeze(blocked_by),
      boundary,
    });
  }
  return Object.freeze({
    ok: true,
    schema: DEMA_STEWARD_CHAIN_SCHEMA,
    truth_label: DEMA_STEWARD_CHAIN_TRUTH_LABEL,
    content_hash: payload.content_hash,
    boundary,
    blocked_by: Object.freeze([]),
    payload,
  });
}
