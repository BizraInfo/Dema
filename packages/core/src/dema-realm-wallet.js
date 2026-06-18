// UX-2C · Dema Realm Resource Wallet (read-only intent ledger v0).
//
// Answers: "What economic intent exists locally — and what is honestly blocked?"
//
// Read-only. Optional operator override at `$DEMA_HOME/realm/wallet-intents.json`.
// Built-in default reflects Genesis/Test mode boundaries from ADR/receipt canon.
//
// NO token logic. NO mint. NO wallet mutation. NO network. NO Shariah claim.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { ANSI } from "./theme.js";

export const DEMA_REALM_WALLET_SCHEMA = "bizra.dema.realm_wallet.v0.1";

const BUILT_IN_INTENTS = Object.freeze([
  Object.freeze({
    id: "impact-receipt-review",
    label: "Impact receipt review (local)",
    status: "DESIGNED_NOT_LIVE",
    truth_label: "GENESIS_TEST_MODE",
  }),
  Object.freeze({
    id: "dual-token-ledger-preview",
    label: "Dual-token ledger preview",
    status: "MECHANISM_VERIFIED_SYNTHETIC",
    truth_label: "SIMULATION_ONLY",
  }),
  Object.freeze({
    id: "reward-eligibility",
    label: "Reward eligibility surfaces",
    status: "BLOCKED",
    truth_label: "NOT_LIVE",
  }),
  Object.freeze({
    id: "token-mint",
    label: "Token / mint surfaces",
    status: "BLOCKED",
    truth_label: "NOT_LIVE",
  }),
  Object.freeze({
    id: "marketplace-proof",
    label: "Marketplace proof objects",
    status: "BLOCKED",
    truth_label: "NOT_LIVE",
  }),
  Object.freeze({
    id: "public-urp-bridge",
    label: "Public URP bridge",
    status: "BLOCKED",
    truth_label: "NOT_LIVE",
  }),
]);

const CONSTITUTIONAL_PRINCIPLES = Object.freeze([
  "Riba-zero — no yield on idle time",
  "Adl — bounded inequality in design",
  "Asset-backed intent before any public instrument",
]);

const WALLET_DISCLAIMER =
  "Genesis/Test mode only · no Shariah certification · no return promise · no mint";

function color(s, code, useColor) {
  return useColor ? `${code}${s}${ANSI.reset}` : s;
}

async function readJsonOrNull(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function isIntentShape(obj) {
  return Boolean(
    obj &&
    typeof obj === "object" &&
    typeof obj.id === "string" &&
    obj.id.length > 0 &&
    typeof obj.label === "string" &&
    obj.label.length > 0,
  );
}

function normalizeIntent(raw) {
  return Object.freeze({
    id: raw.id,
    label: raw.label,
    status: typeof raw.status === "string" ? raw.status : "DECLARED",
    truth_label:
      typeof raw.truth_label === "string" ? raw.truth_label : "DECLARED",
  });
}

export async function gatherDemaRealmWallet({
  demaHome,
  now = new Date(),
} = {}) {
  const home = demaHome || process.env.DEMA_HOME || join(homedir(), ".dema");
  const intentsPath = join(home, "realm", "wallet-intents.json");
  const raw = await readJsonOrNull(intentsPath);

  let source = "BUILT_IN_GENESIS_LEDGER";
  let truthLabel = "LOCAL_INTENT_LEDGER_DECLARED";
  let intents = BUILT_IN_INTENTS;

  if (
    raw &&
    typeof raw === "object" &&
    Array.isArray(raw.intents) &&
    raw.intents.length > 0 &&
    raw.intents.every(isIntentShape)
  ) {
    source = "OPERATOR_LOCAL_FILE";
    truthLabel = "LOCAL_OPERATOR_INTENT_LEDGER";
    intents = Object.freeze(raw.intents.map(normalizeIntent));
  }

  return Object.freeze({
    schema: DEMA_REALM_WALLET_SCHEMA,
    truth_label: truthLabel,
    source,
    rendered_at_iso: now.toISOString(),
    dema_home: home,
    intents_path: intentsPath,
    intents,
    principles: CONSTITUTIONAL_PRINCIPLES,
    disclaimer: WALLET_DISCLAIMER,
    boundary: Object.freeze({
      file_write_performed: false,
      network_used: false,
      federation_used: false,
      share_decision_made: false,
      poi_score_calculated: false,
      token_minted: false,
      economic_claim_made: false,
      private_key_loaded: false,
      raw_artifact_included: false,
      mutation_performed: false,
    }),
  });
}

function statusColor(status, useColor) {
  if (status === "BLOCKED") return color(status, ANSI.proofFailed, useColor);
  if (status === "MECHANISM_VERIFIED_SYNTHETIC") {
    return color(status, ANSI.proofPending, useColor);
  }
  if (status === "DESIGNED_NOT_LIVE") {
    return color(status, ANSI.gold, useColor);
  }
  return color(status, ANSI.neutral, useColor);
}

export function renderDemaRealmWallet(state, { useColor = true } = {}) {
  const lines = [
    color("DEMA REALM · RESOURCE WALLET", ANSI.gold + ANSI.bold, useColor),
    color("Intent ledger (read-only)", ANSI.dim + ANSI.neutral, useColor),
    "",
    color("Constitutional principles:", ANSI.gold, useColor),
  ];

  for (const p of state.principles) {
    lines.push(`  · ${p}`);
  }

  lines.push("", color("Intent surfaces:", ANSI.gold, useColor));
  for (const intent of state.intents) {
    lines.push(
      `  ${color("■", ANSI.gold, useColor)} ${intent.label}`,
      `      ${color("status:", ANSI.neutral, useColor)} ${statusColor(intent.status, useColor)}`,
      `      ${color("truth:", ANSI.neutral, useColor)} ${color(intent.truth_label, ANSI.teal, useColor)}`,
    );
  }

  lines.push(
    "",
    color("Disclaimer:", ANSI.gold, useColor),
    color(`  ${state.disclaimer}`, ANSI.neutral, useColor),
    "",
    `${color("Truth:", ANSI.neutral, useColor)} ${color(state.truth_label, ANSI.teal, useColor)}`,
    `${color("Source:", ANSI.neutral, useColor)} ${state.source}`,
    "",
  );

  return lines.join("\n");
}
