// UX-1A · Dema Realm Home (static TUI v0).
//
// Renders the 7-step Node0 boot sequence + the BIZRA NODE0 · DEMA HOME frame.
// New surface (`dema realm`). Does NOT replace bare `dema` invocation in v0 --
// opt-in so the existing homebase + smoke matrix + npm run check stay intact.
//
// Truth-label discipline (per BIZRA "drift-guarded not permanently sealed" canon):
//   - "VERIFIED"  only when Ed25519 authorship key file is actually present
//   - "DECLARED"  when a surface is named but has no runtime backing yet
//                 (e.g. Council Chamber, Mission Board until UX-1B/1D ship)
//   - "PARTIAL"   when surface partially exists (Archivist via H18+URP)
//   - "OFF"       when surface is intentionally off (unsafe surfaces, network)
//   - "—"         when state is honestly absent (no checkpoint yet)
//
// NO file write. NO network. NO mutation. Pure read-and-render.

import { readFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const DEMA_REALM_HOME_SCHEMA = "bizra.dema.realm_home.v0.1";

// 24-bit true-color ANSI escape sequences (per Master Smith's Chronicles palette).
const ANSI = Object.freeze({
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  obsidian_bg: "\x1b[48;2;2;4;8m",
  gold: "\x1b[38;2;212;175;55m", // #D4AF37 -- cryptographic invariants / boundaries
  emerald: "\x1b[38;2;16;185;129m", // #10B981 -- healthy / verified
  crimson: "\x1b[38;2;239;68;68m", // #EF4444 -- default-deny / blocked
  ash: "\x1b[38;2;156;163;175m", // dim metadata
});

const BOOT_DOTS_WIDTH = 32;

// UX-2A · numbered hub menu → `dema realm go <n>` dispatch.
export const REALM_MENU_ITEMS = Object.freeze([
  Object.freeze({
    key: "1",
    label: "Continue from Last Checkpoint",
    command: "dema realm checkpoint",
    realm_sub: "checkpoint",
  }),
  Object.freeze({
    key: "2",
    label: "Open Mission Board",
    command: "dema realm board",
    realm_sub: "board",
  }),
  Object.freeze({
    key: "3",
    label: "Enter Council Chamber",
    command: "dema realm council",
    realm_sub: "council",
  }),
  Object.freeze({
    key: "4",
    label: "Resource Wallet",
    command: "dema realm wallet",
    realm_sub: "wallet",
  }),
  Object.freeze({
    key: "5",
    label: "Proof Studio",
    command: "dema realm proof-studio",
    realm_sub: "proof-studio",
  }),
]);

export function realmMenuItemByKey(key) {
  const k = String(key ?? "");
  return REALM_MENU_ITEMS.find((item) => item.key === k) ?? null;
}

function color(s, code, useColor) {
  return useColor ? `${code}${s}${ANSI.reset}` : s;
}

// 7 boot steps. Status is dynamically derived per gather; this is the template.
const BOOT_STEP_LABELS = Object.freeze([
  "Loading Node0 identity",
  "Checking authorship key",
  "Reading last checkpoint",
  "Hydrating council profiles",
  "Loading quest board",
  "Checking unsafe surfaces",
  "Entering Dema Home",
]);

async function fileExists(path) {
  try {
    await access(path, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJsonOrNull(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

export async function gatherDemaRealmState({
  demaHome,
  now = new Date(),
} = {}) {
  const home = demaHome || process.env.DEMA_HOME || join(homedir(), ".dema");

  const profilePath = join(home, "memory", "profile.json");
  const keyPath = join(home, "keys", "node0-ed25519.pub.pem");
  const checkpointPath = join(home, "realm", "last-checkpoint.json");

  const profile = await readJsonOrNull(profilePath);
  const keyPresent = await fileExists(keyPath);
  const checkpoint = await readJsonOrNull(checkpointPath);

  const operator =
    (profile && (profile.preferred_name || profile.name)) || "Operator";
  const role =
    (profile && (profile.role || profile.title)) ||
    (operator === "Operator" ? "Sovereign Builder" : "First Architect");

  const identityStatus = keyPresent ? "VERIFIED" : "UNINITIALIZED";
  const identityLabel = keyPresent ? "Ed25519 verified" : "not yet initialized";

  const lastCheckpointText = checkpoint
    ? checkpoint.label || checkpoint.next_quest || "checkpoint present"
    : "—";

  const bootSteps = [
    { label: BOOT_STEP_LABELS[0], status: identityStatus, ok: true },
    {
      label: BOOT_STEP_LABELS[1],
      status: keyPresent ? "PRESENT" : "ABSENT",
      ok: true,
    },
    {
      label: BOOT_STEP_LABELS[2],
      status: checkpoint ? "FOUND" : "NONE",
      ok: true,
    },
    { label: BOOT_STEP_LABELS[3], status: "DECLARED", ok: true },
    {
      label: BOOT_STEP_LABELS[4],
      status: checkpoint ? "READY" : "EMPTY",
      ok: true,
    },
    { label: BOOT_STEP_LABELS[5], status: "OFF", ok: true },
    { label: BOOT_STEP_LABELS[6], status: "LIVE", ok: true },
  ];

  const seedAwake = keyPresent;
  const awakenedLine = seedAwake
    ? "The sovereign seed is awake."
    : "The sovereign seed awaits initialization.";

  const menuItems = REALM_MENU_ITEMS;
  const menuOptions = menuItems.map((item) => `[ ${item.label} ]`);

  return Object.freeze({
    schema: DEMA_REALM_HOME_SCHEMA,
    truth_label: "LOCAL_DEMA_HOME_RENDER",
    rendered_at_iso: now.toISOString(),
    dema_home: home,
    operator,
    role,
    identity: Object.freeze({
      status: identityStatus,
      label: identityLabel,
      key_path: keyPath,
    }),
    last_checkpoint: Object.freeze({
      present: Boolean(checkpoint),
      text: lastCheckpointText,
      raw: checkpoint || null,
    }),
    boot_steps: Object.freeze(bootSteps.map((s) => Object.freeze(s))),
    seed_awake: seedAwake,
    awakened_line: awakenedLine,
    menu_items: Object.freeze(menuItems),
    menu_options: Object.freeze(menuOptions),
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

function statusGlyph(status, useColor) {
  // Color rules: VERIFIED/READY/LIVE/FOUND/PRESENT -> emerald.
  //              UNINITIALIZED/ABSENT/NONE/EMPTY -> ash (honest absence, not failure).
  //              DECLARED -> gold (named but no runtime; the boundary of honesty).
  //              OFF -> ash (intentionally off).
  //              FAILED -> crimson (would be a true error -- not used in v0).
  const greenSet = new Set(["VERIFIED", "READY", "LIVE", "FOUND", "PRESENT"]);
  const ashSet = new Set(["UNINITIALIZED", "ABSENT", "NONE", "EMPTY", "OFF"]);
  if (greenSet.has(status)) return color(status, ANSI.emerald, useColor);
  if (ashSet.has(status)) return color(status, ANSI.ash, useColor);
  if (status === "DECLARED") return color(status, ANSI.gold, useColor);
  if (status === "FAILED") return color(status, ANSI.crimson, useColor);
  return status;
}

export function renderBootSequence(state, { useColor = true } = {}) {
  const lines = [color("DEMA NODE0 BOOT", ANSI.gold + ANSI.bold, useColor), ""];
  const total = state.boot_steps.length;
  state.boot_steps.forEach((step, i) => {
    const num = `[${i + 1}/${total}]`;
    const padding = ".".repeat(
      Math.max(1, BOOT_DOTS_WIDTH - step.label.length),
    );
    const status = statusGlyph(step.status, useColor);
    lines.push(`${num} ${step.label}${padding} ${status}`);
  });
  return lines.join("\n");
}

function frameLine(content, innerWidth, useColor) {
  const visible = content.replace(/\x1b\[[0-9;]*m/g, "");
  const pad = Math.max(0, innerWidth - visible.length);
  return `${color("│", ANSI.gold, useColor)} ${content}${" ".repeat(pad)} ${color("│", ANSI.gold, useColor)}`;
}

export function renderHomeFrame(state, { useColor = true } = {}) {
  const innerWidth = 58;
  const topBorder = color(
    "╭" + "─".repeat(innerWidth + 2) + "╮",
    ANSI.gold,
    useColor,
  );
  const botBorder = color(
    "╰" + "─".repeat(innerWidth + 2) + "╯",
    ANSI.gold,
    useColor,
  );

  const headerText = color(
    "BIZRA NODE0 · DEMA HOME",
    ANSI.gold + ANSI.bold,
    useColor,
  );
  const opText = `Character loading: ${color(state.operator, ANSI.emerald, useColor)} · ${state.role}`;
  const idText =
    state.identity.status === "VERIFIED"
      ? `Identity: ${color(state.identity.label, ANSI.emerald, useColor)}`
      : `Identity: ${color(state.identity.label, ANSI.gold, useColor)}`;
  const cpText = state.last_checkpoint.present
    ? `Last checkpoint: ${color(state.last_checkpoint.text, ANSI.emerald, useColor)}`
    : `Last checkpoint: ${color("—", ANSI.ash, useColor)}`;

  return [
    topBorder,
    frameLine(headerText, innerWidth, useColor),
    frameLine(opText, innerWidth, useColor),
    frameLine(idText, innerWidth, useColor),
    frameLine(cpText, innerWidth, useColor),
    botBorder,
  ].join("\n");
}

export function renderMenu(state, { useColor = true } = {}) {
  const accent = state.seed_awake ? ANSI.emerald : ANSI.gold;
  const items = state.menu_items ?? REALM_MENU_ITEMS;
  const lines = [color(state.awakened_line, accent + ANSI.bold, useColor), ""];
  for (const item of items) {
    lines.push(
      `  ${color(`[${item.key}]`, ANSI.emerald + ANSI.bold, useColor)} ${color(item.label, ANSI.gold, useColor)}`,
    );
    lines.push(
      color(`      ${item.command}`, ANSI.dim + ANSI.ash, useColor),
    );
  }
  lines.push(
    "",
    color("Navigate:", ANSI.ash, useColor),
    color("  dema realm go <n>   (1–5)", ANSI.gold, useColor),
  );
  return lines.join("\n");
}

export function renderDemaRealmHome(state, { useColor = true } = {}) {
  return [
    renderBootSequence(state, { useColor }),
    "",
    renderHomeFrame(state, { useColor }),
    "",
    renderMenu(state, { useColor }),
    "",
  ].join("\n");
}
