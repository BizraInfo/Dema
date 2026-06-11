#!/usr/bin/env node
/**
 * DEMA REALM — Node0 Cockpit v0.1  (W6 seed)
 * ============================================================
 * The first experience layer of BIZRA: your proof spine,
 * rendered as a living world. Pure Node stdlib. Read-only.
 * Local-only. No network. No writes. Constitutional.
 *
 *   Character  = Node0 (you, the sovereign node)
 *   Companion  = Dema (thinks with you, remembers)
 *   Quest Log  = the G/W ladder (real gates, real states)
 *   Inventory  = receipts & attestations (real hashes)
 *   World Map  = the four proof axes
 *
 * Run:    node dema-realm.js              (interactive, q to quit)
 *         node dema-realm.js --snapshot   (render once, exit)
 *         node dema-realm.js --state path/to/state.json
 * State:  optional JSON to wire real NODE0 data; sane defaults
 *         embedded reflect the true 2026-06-11 session.
 * ============================================================
 */
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");

/* ---------- ANSI ---------- */
const ESC = "\x1b[";
const C = {
  reset: ESC + "0m",
  bold: ESC + "1m",
  dim: ESC + "2m",
  gold: ESC + "38;5;220m",
  green: ESC + "38;5;114m",
  red: ESC + "38;5;203m",
  cyan: ESC + "38;5;80m",
  violet: ESC + "38;5;141m",
  grey: ESC + "38;5;245m",
  white: ESC + "38;5;255m",
  seed: ESC + "38;5;108m",
};
const clear = () => process.stdout.write(ESC + "2J" + ESC + "H");

/* ---------- default state (real session data, 2026-06-11) ---------- */
const DEFAULT_STATE = {
  character: {
    name: "Node0",
    title: "Sovereign Node · First Architect",
    realm: "BIZRA Genesis",
    since: "Ramadan 2023",
  },
  companion: {
    name: "Dema",
    mood: "steady",
    memory: "constitution + receipts + G-ladder (deterministic, on disk)",
  },
  axes: {
    Formal: true,
    Cryptographic: true,
    Empirical: true,
    Economic: "awaiting first witness",
  },
  quests: [
    {
      id: "W1",
      name: "Register the Unwritten Tests",
      state: "done",
      loot: "4,451/4,451 green",
    },
    {
      id: "W2",
      name: "Cleanse the Drifted Tree",
      state: "done",
      loot: "RID d664c453",
    },
    {
      id: "W-C",
      name: "Seal the Topology Canon",
      state: "done",
      loot: "sha256 8e4ce5e8",
    },
    {
      id: "W3",
      name: "Forge the Witness Reproducer",
      state: "done",
      loot: "published 66b7bf8e",
    },
    {
      id: "W4",
      name: "Purge the Eleven High Blights",
      state: "done",
      loot: "banner: 0 crit / 0 high",
    },
    {
      id: "Z1",
      name: "Summon the First External Witness",
      state: "active",
      loot: "one envelope away",
    },
    {
      id: "W5",
      name: "Mend the Python Wards",
      state: "open",
      loot: "pip-audit · pytest · version-sync",
    },
    {
      id: "W6",
      name: "Raise the Realm (this cockpit)",
      state: "active",
      loot: "you are inside it",
    },
  ],
  inventory: [
    {
      kind: "attestation",
      name: "Witness Proof I (pre-bump)",
      hash: "f6d8e2780c587de8…7289e",
    },
    {
      kind: "attestation",
      name: "Witness Proof II (post-bump)",
      hash: "de139115eb16b25b…1def",
    },
    {
      kind: "receipt",
      name: "Clean Main (Dema W2)",
      hash: "d664c4531d6bfbd5…9734",
    },
    { kind: "receipt", name: "Z1 Gate W0", hash: "0a6ba3b5…" },
    {
      kind: "relic",
      name: "TOPOLOGY pollution patch (preserved)",
      hash: "logs/…-20260611.patch",
    },
  ],
  horizon: [
    "Send Invitation No.1 — the Economic axis awaits a human",
    "W5: three small wards (daylight work)",
    "Wave review: 66 stashed scrolls (realm council sleeps inside)",
    'The one-page declaration: "I have done my part as Node0"',
  ],
};

/* ---------- disk receipt reading (v0.2 — the inventory reads real artifacts) ---------- */
function receiptRoots() {
  const dema = process.env.DEMA_HOME || path.join(os.homedir(), ".dema");
  return [path.join(dema, "receipts"), "/data/bizra/logs/z1-w0-receipts"];
}
function shortHash(h) {
  h = String(h || "");
  return h.length > 22 ? h.slice(0, 16) + "…" + h.slice(-4) : h;
}
function kindOf(s) {
  s = String(s).toLowerCase();
  if (/attest|witness/.test(s)) return "attestation";
  if (/patch|pollution|relic/.test(s)) return "relic";
  return "receipt";
}
function readInventoryFromDisk() {
  const items = [];
  const sources = [];
  for (const root of receiptRoots()) {
    let files;
    try {
      files = fs.readdirSync(root).filter((f) => f.endsWith(".json"));
    } catch (e) {
      continue; // root absent on this machine — fine
    }
    if (files.length) sources.push(root);
    for (const f of files.sort()) {
      let d;
      try {
        d = JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
      } catch (e) {
        continue; // unparseable — skip, never invent
      }
      // nested attestations (e.g. the Z1 closure receipt) become their own loot
      if (d.attestations && typeof d.attestations === "object") {
        for (const [k, v] of Object.entries(d.attestations))
          if (typeof v === "string")
            items.push({
              kind: "attestation",
              name: "Witness Attestation (" + k + ")",
              hash: shortHash(v),
            });
      }
      const hash =
        d.receipt_id || d.witness_hash || d.sha256 || d.hash || d.headSha || "";
      const name =
        d.claim ||
        d.label ||
        d.truth_label ||
        d.action ||
        d.workflowName ||
        d.schema ||
        f.replace(/\.json$/, "");
      if (hash || name)
        items.push({
          kind: kindOf(name + " " + f),
          name: String(name).slice(0, 44),
          hash: shortHash(hash),
        });
    }
  }
  return { items, sources };
}

/* ---------- witness ledger reading (v0.3 — the loop's payoff appears as loot) ---------- */
function readWitnessLedger() {
  const ledger =
    process.env.BIZRA_WITNESS_LEDGER ||
    "/data/bizra/repos/bizra-data-lake/.canon/WITNESS_LEDGER.jsonl";
  let lines;
  try {
    lines = fs
      .readFileSync(ledger, "utf8")
      .split("\n")
      .filter((l) => l.trim());
  } catch (e) {
    return [];
  }
  const items = [];
  for (const l of lines) {
    let e;
    try {
      e = JSON.parse(l);
    } catch (x) {
      continue;
    }
    const a = e.attestation || {};
    const id = String(a.witness_identity || "anonymous").slice(0, 28);
    items.push({
      kind: "attestation",
      name: "External Witness #" + (e.witness_number || "?") + " · " + id,
      hash: shortHash(e.entry_hash) + " [" + (e.binding_check || "?") + "]",
    });
  }
  return items;
}

/* ---------- state loading ---------- */
function loadState() {
  let state = DEFAULT_STATE;
  const i = process.argv.indexOf("--state");
  if (i !== -1 && process.argv[i + 1]) {
    try {
      const p = path.resolve(process.argv[i + 1]);
      state = { ...DEFAULT_STATE, ...JSON.parse(fs.readFileSync(p, "utf8")) };
    } catch (e) {
      console.error(
        C.red +
          "[realm] state load failed, using defaults: " +
          e.message +
          C.reset,
      );
    }
  }
  // v0.2: inventory reads REAL receipts; v0.3: external witnesses lead the loot
  const disk = readInventoryFromDisk();
  const witnesses = readWitnessLedger();
  const inv = [...witnesses, ...disk.items];
  if (inv.length) {
    return {
      ...state,
      inventory: inv,
      _invLive: true,
      _invSources: [
        ...(witnesses.length ? ["witness-ledger"] : []),
        ...disk.sources,
      ],
      _witnessCount: witnesses.length,
    };
  }
  return { ...state, _invLive: false };
}

/* ---------- layout helpers ---------- */
const W = Math.min(process.stdout.columns || 100, 100);
function line(ch = "─") {
  return C.grey + ch.repeat(W) + C.reset;
}
function pad(s, n) {
  const raw = s.replace(/\x1b\[[0-9;]*m/g, "");
  return s + " ".repeat(Math.max(0, n - raw.length));
}
function box(title, rows, color = C.gold) {
  const out = [];
  out.push(
    color +
      "┌─ " +
      C.bold +
      title +
      C.reset +
      color +
      " " +
      "─".repeat(Math.max(0, W - title.length - 5)) +
      "┐" +
      C.reset,
  );
  for (const r of rows)
    out.push(color + "│ " + C.reset + pad(r, W - 4) + color + " │" + C.reset);
  out.push(color + "└" + "─".repeat(W - 2) + "┘" + C.reset);
  return out.join("\n");
}

/* ---------- panels ---------- */
function header(s) {
  const t = " B I Z R A   ·   T H E   R E A L M   ·   N O D E 0 ";
  const padL = Math.max(0, Math.floor((W - t.length) / 2));
  return [
    line("═"),
    " ".repeat(padL) + C.gold + C.bold + t + C.reset,
    " ".repeat(Math.max(0, Math.floor((W - 46) / 2))) +
      C.seed +
      "one seed → one tree → and when seeds gather, a forest" +
      C.reset,
    line("═"),
  ].join("\n");
}
function panelCharacter(s) {
  const a = s.axes;
  const ax = Object.entries(a).map(([k, v]) =>
    v === true
      ? C.green + "✓ " + k + C.reset
      : C.violet + "◌ " + k + C.grey + " — " + v + C.reset,
  );
  return box(
    "CHARACTER & COMPANION",
    [
      C.white +
        C.bold +
        s.character.name +
        C.reset +
        C.grey +
        "  ·  " +
        s.character.title +
        "  ·  walking since " +
        s.character.since +
        C.reset,
      C.cyan +
        s.companion.name +
        C.reset +
        C.grey +
        "  ·  mood: " +
        s.companion.mood +
        "  ·  remembers: " +
        s.companion.memory +
        C.reset,
      "",
      C.bold + "Proof-of-Truth Convergence:" + C.reset + "  " + ax.join("   "),
    ],
    C.cyan,
  );
}
function panelQuests(s) {
  const rows = s.quests.map((q) => {
    const mark =
      q.state === "done"
        ? C.green + "✅"
        : q.state === "active"
          ? C.gold + "▶ "
          : C.grey + "▷ ";
    const name = (q.state === "done" ? C.grey : C.white) + q.name + C.reset;
    return (
      mark +
      C.reset +
      " " +
      pad(C.bold + q.id + C.reset, 14) +
      pad(name, 44) +
      C.dim +
      q.loot +
      C.reset
    );
  });
  const done = s.quests.filter((q) => q.state === "done").length;
  rows.push("");
  rows.push(
    C.grey +
      `quest log: ${done}/${s.quests.length} complete · the active quest is an envelope, not a command` +
      C.reset,
  );
  return box("QUEST LOG  (the G/W ladder)", rows, C.gold);
}
function panelInventory(s) {
  const icon = {
    attestation: C.gold + "◆",
    receipt: C.green + "▣",
    relic: C.violet + "✦",
  };
  const rows = s.inventory.map(
    (it) =>
      (icon[it.kind] || "·") +
      C.reset +
      " " +
      pad(C.white + it.name + C.reset, 46) +
      C.dim +
      it.hash +
      C.reset,
  );
  rows.push("");
  rows.push(
    s._invLive
      ? C.green +
          "● " +
          s.inventory.length +
          " items read live from disk — real artifacts, nothing invented" +
          C.reset
      : C.grey +
          "demo data — no receipts found on disk (set DEMA_HOME or run where ~/.dema/receipts exists)" +
          C.reset,
  );
  if (s._invLive)
    rows.push(
      C.dim + "  source: " + (s._invSources || []).join("  ·  ") + C.reset,
    );
  return box("INVENTORY  (receipts & attestations)", rows, C.green);
}
function panelHorizon(s) {
  return box(
    "HORIZON  (what the world asks next)",
    s.horizon.map((h, i) => C.gold + (i + 1) + ". " + C.white + h + C.reset),
    C.violet,
  );
}
function footer(interactive) {
  return (
    line() +
    "\n" +
    C.grey +
    (interactive
      ? "  [q] leave the realm   ·   read-only · local-only · no network · still-blocked honored"
      : "  snapshot mode · read-only · local-only · no network · still-blocked honored") +
    C.reset +
    "\n"
  );
}

/* ---------- render ---------- */
function render(s, interactive) {
  clear();
  console.log(header(s));
  console.log(panelCharacter(s));
  console.log(panelQuests(s));
  console.log(panelInventory(s));
  console.log(panelHorizon(s));
  console.log(footer(interactive));
}

/* ---------- main ---------- */
const state = loadState();
const snapshot = process.argv.includes("--snapshot") || !process.stdout.isTTY;
if (snapshot) {
  render(state, false);
  process.exit(0);
}
render(state, true);
const rl = require("readline");
rl.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on("keypress", (str, key) => {
  if (!key) return;
  if (key.name === "q" || (key.ctrl && key.name === "c")) {
    clear();
    console.log(
      C.seed + "  The realm holds its state. كل شيء محفوظ. 🌱" + C.reset + "\n",
    );
    process.exit(0);
  }
  render(state, true); // any key re-renders (live resize-friendly)
});
