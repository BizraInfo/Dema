import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { buildPreviewBoundary } from "./preview-boundary.js";
import { GREETING_TEMPLATES } from "./homebase-language-picker.js";
import { humanizeNextAction } from "./next-action-humanizer.js";

const SCHEMA = "bizra.dema.homebase_v0_1.v0.1";
const TRUTH_LABEL = "NODE0_LOCAL_SEED";
const MODE = "preview_only";

const PKG_VERSION = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(here, "..", "..", "..", "package.json");
    const raw = readFileSync(pkgPath, "utf8");
    return JSON.parse(raw).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

const WEEKDAYS_GST = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_GST = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const AFFORDANCES = Object.freeze([
  Object.freeze({ key: "m", label: "Mission",  command: "dema mission draft",  boundary_level: "L2_propose"  }),
  Object.freeze({ key: "j", label: "Journal",  command: "dema today",          boundary_level: "L1_remember" }),
  Object.freeze({ key: "r", label: "Receipts", command: "dema receipts",       boundary_level: "L0_observe"  }),
  Object.freeze({ key: "b", label: "Browse",   command: "<sub_screen:memory>", boundary_level: "L0_observe"  }),
  Object.freeze({ key: "?", label: "Help",     command: "dema help",           boundary_level: "L0_observe"  }),
  Object.freeze({ key: "q", label: "Quit",     command: "<exit>",              boundary_level: "L0_observe"  }),
]);

function assertGatherShape(g) {
  if (!g || typeof g !== "object") throw new TypeError("gather missing or not an object");
  if (!(g.ts instanceof Date) || Number.isNaN(g.ts.getTime())) {
    throw new TypeError("gather.ts not a valid Date");
  }
  if (!g.profile || typeof g.profile !== "object") throw new TypeError("gather.profile missing");
  if (!Array.isArray(g.memory_recent)) throw new TypeError("gather.memory_recent must be Array");
  if (!Array.isArray(g.warnings)) throw new TypeError("gather.warnings must be Array");
  if (typeof g.partial !== "boolean") throw new TypeError("gather.partial must be boolean");
  if (!g.env_flags || typeof g.env_flags !== "object") throw new TypeError("gather.env_flags missing");
  if (!g.memory_size || typeof g.memory_size !== "object") throw new TypeError("gather.memory_size missing");
}

function formatGstDate(d) {
  const gst = new Date(d.getTime() + 4 * 60 * 60 * 1000);
  const wd = WEEKDAYS_GST[gst.getUTCDay()];
  const day = String(gst.getUTCDate()).padStart(2, "0");
  const mo = MONTHS_GST[gst.getUTCMonth()];
  const yr = gst.getUTCFullYear();
  return `${wd} ${day} ${mo} ${yr}`;
}

function formatGstTime(d) {
  const gst = new Date(d.getTime() + 4 * 60 * 60 * 1000);
  const hh = String(gst.getUTCHours()).padStart(2, "0");
  const mm = String(gst.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} GST`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function bar10(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(clamped * 10);
  return "▓".repeat(filled) + "░".repeat(10 - filled);
}

function computeRingRatio(g) {
  const status = g.process_mining?.ring_advancement_status;
  if (typeof status !== "string") return 0.2;
  if (status.includes("Ring 1 earned")) return 0.4;
  if (status.includes("Ring 1 candidate")) return 0.3;
  return 0.2;
}

function classifyNextActionKind(text) {
  if (typeof text !== "string") return "preview";
  const lower = text.toLowerCase();
  if (lower.includes("observable")) return "preview";
  if (lower.startsWith("review ") || lower.startsWith("send ") || lower.startsWith("respond")) return "operator_act";
  return "preview";
}

function buildHeader(g) {
  return Object.freeze({
    node_name: typeof g.profile.node === "string" && g.profile.node.length > 0 ? g.profile.node : "Node0",
    date_human_gst: formatGstDate(g.ts),
    time_human_gst: formatGstTime(g.ts),
    dema_version: PKG_VERSION,
  });
}

function buildGreeting(g) {
  const langCode = typeof g.profile.language_code === "string" ? g.profile.language_code : null;
  const tmpl = (langCode && GREETING_TEMPLATES[langCode]) ? GREETING_TEMPLATES[langCode] : GREETING_TEMPLATES.en;

  if (!g.profile.source_present || typeof g.profile.name !== "string" || g.profile.name.length === 0) {
    return Object.freeze({
      text: tmpl.welcome_new,
      has_name: false,
      name_source: "absent",
      language_code: langCode,
    });
  }
  return Object.freeze({
    text: tmpl.welcome_back.replace("{name}", g.profile.name),
    has_name: true,
    name_source: "profile_json",
    language_code: langCode,
  });
}

function buildMemory3(g) {
  if (!Array.isArray(g.memory_recent) || g.memory_recent.length === 0) {
    return Object.freeze({ entries: Object.freeze([]), fallback_text: "no prior sessions" });
  }
  const entries = g.memory_recent.slice(0, 3).map((m) =>
    Object.freeze({
      name: typeof m?.name === "string" ? m.name : "",
      summary: typeof m?.summary === "string" ? m.summary : null,
    }),
  );
  return Object.freeze({
    entries: Object.freeze(entries),
    fallback_text: null,
  });
}

function buildStatus(g) {
  const ringRatio = computeRingRatio(g);
  const missionActive = Boolean(g.state?.mission_centered);
  const entries = Number.isFinite(g.memory_size?.entries) ? g.memory_size.entries : 0;
  const bytes = Number.isFinite(g.memory_size?.bytes) ? g.memory_size.bytes : 0;
  const memRatio = Math.min(1, entries / 24);
  return Object.freeze({
    ring: Object.freeze({
      label:
        typeof g.process_mining?.ring_advancement_status === "string"
          ? g.process_mining.ring_advancement_status
          : "Ring 0 verified",
      bar: bar10(ringRatio),
      ratio: ringRatio,
    }),
    mission: Object.freeze({
      label: missionActive ? "active" : "clear",
      icon: missionActive ? "●" : "◉",
      active_count: Number.isFinite(g.state?.active_mission_count) ? g.state.active_mission_count : 0,
    }),
    gateway: Object.freeze({
      label: "unreachable (by design · no runtime here)",
      icon: "○",
      reachable: false,
      by_design: true,
    }),
    memory_bar: Object.freeze({
      label: `${entries} entries · ${formatBytes(bytes)}`,
      bar: bar10(memRatio),
      ratio: memRatio,
      bytes,
      entries,
    }),
  });
}

function buildNextAction(g) {
  const observable = g.process_mining?.next_step_observable;
  if (typeof observable === "string" && observable.length > 0) {
    return Object.freeze({
      text: humanizeNextAction(observable),
      observation_code: observable,
      kind: classifyNextActionKind(observable),
      source: "process_mining_preview",
      command: null,
    });
  }
  return Object.freeze({
    text: "press ? to see available actions",
    observation_code: null,
    kind: "preview",
    source: "fallback",
    command: null,
  });
}

function buildAffordances() {
  return AFFORDANCES;
}

export function buildHomebasePreview({ gather }) {
  assertGatherShape(gather);

  const out = {
    schema: SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: MODE,
    rendered_at: gather.ts.toISOString(),
    partial: gather.partial,
    warnings: Object.freeze([...gather.warnings]),
    viewport: Object.freeze({ cols_target: 76, rows_target: 22 }),
    header: buildHeader(gather),
    greeting: buildGreeting(gather),
    memory3: buildMemory3(gather),
    status: buildStatus(gather),
    next_action: buildNextAction(gather),
    affordances: buildAffordances(),
    boundary: buildPreviewBoundary(),
  };
  return Object.freeze(out);
}

export const HOMEBASE_PREVIEW_SCHEMA = SCHEMA;
export const HOMEBASE_PREVIEW_TRUTH_LABEL = TRUTH_LABEL;
