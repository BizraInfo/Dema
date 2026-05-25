import { Theme } from "./dema-theme.js";

const ESC = "\x1b[";
const RESET = ESC + "0m";
const CLEAR_SCREEN = ESC + "2J" + ESC + "H";
const HIDE_CURSOR = ESC + "?25l";
const SHOW_CURSOR = ESC + "?25h";
const SAVE_CURSOR = ESC + "s";
const RESTORE_CURSOR = ESC + "u";

function bold(s, nc) {
  return nc ? s : ESC + "1m" + s + ESC + "22m";
}
function dim(s, nc) {
  return nc ? s : ESC + "2m" + s + ESC + "22m";
}
function cyan(s, nc) {
  return nc ? s : ESC + "36m" + s + ESC + "39m";
}
function green(s, nc) {
  return nc ? s : ESC + "32m" + s + ESC + "39m";
}
function yellow(s, nc) {
  return nc ? s : ESC + "33m" + s + ESC + "39m";
}
function red(s, nc) {
  return nc ? s : ESC + "31m" + s + ESC + "39m";
}

function chars(dumb) {
  if (dumb)
    return {
      tl: "+",
      tr: "+",
      bl: "+",
      br: "+",
      h: "-",
      v: "|",
      bar_full: "#",
      bar_empty: ".",
      bullet: "*",
      arrow: "->",
      dot_on: "(*)",
      dot_off: "( )",
    };
  return {
    tl: "┌",
    tr: "┐",
    bl: "└",
    br: "┘",
    h: "─",
    v: "│",
    bar_full: "▓",
    bar_empty: "░",
    bullet: "·",
    arrow: "→",
    dot_on: "●",
    dot_off: "○",
  };
}

function visibleWidth(s) {
  if (typeof s !== "string") return 0;
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function padRight(s, w) {
  const vw = visibleWidth(s);
  return vw >= w ? s : s + " ".repeat(w - vw);
}

function fit(s, w) {
  const vw = visibleWidth(s);
  if (vw <= w) return s;
  const plain = s.replace(/\x1b\[[0-9;]*m/g, "");
  return w <= 1 ? plain.slice(0, w) : plain.slice(0, w - 1) + "…";
}

function bar(ratio, w, c) {
  const filled = Math.max(0, Math.min(w, Math.round(ratio * w)));
  return c.bar_full.repeat(filled) + c.bar_empty.repeat(w - filled);
}

function line(content, width, c) {
  const inner = width - 4;
  return `${c.v} ${padRight(fit(content, inner), inner)} ${c.v}`;
}

function divider(width, c) {
  return `${c.v} ${c.h.repeat(width - 4)} ${c.v}`;
}

function top(width, c) {
  return `${c.tl}${c.h.repeat(width - 2)}${c.tr}`;
}

function bottom(width, c) {
  return `${c.bl}${c.h.repeat(width - 2)}${c.br}`;
}

const PHASE_KEYS = {
  first_run: [
    { key: "s", label: "Setup", cmd: ["setup"] },
    { key: "d", label: "Doctor", cmd: ["doctor"] },
    { key: "?", label: "Help", cmd: ["help"] },
  ],
  setup_done: [
    { key: "s", label: "Status", cmd: ["status"] },
    { key: "d", label: "Doctor", cmd: ["doctor"] },
    { key: "c", label: "Consent", cmd: ["consent", "plan", "Check my node"] },
    { key: "r", label: "Receipts", cmd: ["receipts"] },
    { key: "?", label: "Help", cmd: ["help"] },
  ],
  active: [
    { key: "s", label: "Status", cmd: ["status"] },
    { key: "d", label: "Doctor", cmd: ["doctor"] },
    { key: "m", label: "Mission", cmd: ["mission", "propose"] },
    { key: "c", label: "Consent", cmd: ["consent", "plan", "Check my node"] },
    { key: "r", label: "Receipts", cmd: ["receipts"] },
    { key: "j", label: "Journal", cmd: ["today"] },
    { key: "h", label: "Harness", cmd: ["harness"] },
    { key: "?", label: "Help", cmd: ["help"] },
  ],
};

export function derivePhase(preview) {
  const status = preview?.status ?? {};
  const ring = status?.ring ?? {};
  const memory = status?.memory_bar ?? {};
  const ratio = typeof ring.ratio === "number" ? ring.ratio : 0;
  if (
    ratio <= 0.2 &&
    (memory.entries ?? 0) <= 1 &&
    !preview?.greeting?.has_name
  ) {
    return "first_run";
  }
  if (ratio <= 0.2) return "setup_done";
  return "active";
}

export function keysForPhase(phase) {
  return PHASE_KEYS[phase] || PHASE_KEYS.active;
}

export function renderLiveHomebase(preview, opts = {}) {
  const nc = opts.noColor ?? false;
  const dumb = opts.termDumb ?? false;
  const width = opts.width ?? 76;
  const c = chars(dumb);
  const phase = derivePhase(preview);
  const keys = keysForPhase(phase);

  const header = preview?.header ?? {};
  const greeting = preview?.greeting ?? {};
  const status = preview?.status ?? {};
  const ring = status?.ring ?? {};
  const mission = status?.mission ?? {};
  const gateway = status?.gateway ?? {};
  const memory = status?.memory_bar ?? {};
  const nextAction = preview?.next_action ?? {};
  const warnings = preview?.warnings ?? [];

  const lines = [];

  lines.push(top(width, c));

  const titleLeft = `${bold("DEMA", nc)} ${dim(c.bullet, nc)} ${header.node_name ?? "Node0"}`;
  const titleRight = `${header.date_human_gst ?? ""} ${dim(c.bullet, nc)} v${header.dema_version ?? "?"}`;
  const titleContent = `${titleLeft}  ${dim(titleRight, nc)}`;
  lines.push(line(titleContent, width, c));

  lines.push(divider(width, c));
  lines.push(line("", width, c));

  const name = greeting.has_name ? greeting.text : dim("Welcome to Dema.", nc);
  lines.push(line(name, width, c));
  lines.push(line("", width, c));

  const ringBar = bar(ring.ratio ?? 0.2, 10, c);
  const missionIcon =
    (mission.active_count ?? 0) > 0 ? green(c.dot_on, nc) : dim(c.dot_off, nc);
  const gwIcon = gateway.reachable ? green(c.dot_on, nc) : dim(c.dot_off, nc);
  const memBar = bar(memory.ratio ?? 0, 10, c);

  lines.push(
    line(
      `  ${bold("Ring", nc)}     ${green(ringBar, nc)}  ${dim(ring.label ?? "", nc)}`,
      width,
      c,
    ),
  );
  lines.push(
    line(
      `  ${bold("Mission", nc)}  ${missionIcon}  ${mission.label ?? "idle"}`,
      width,
      c,
    ),
  );
  lines.push(
    line(
      `  ${bold("Gateway", nc)}  ${gwIcon}  ${dim(gateway.label ?? "unreachable", nc)}`,
      width,
      c,
    ),
  );
  lines.push(
    line(
      `  ${bold("Memory", nc)}   ${cyan(memBar, nc)}  ${dim(memory.label ?? "", nc)}`,
      width,
      c,
    ),
  );

  const harness = status?.harness;
  if (harness && harness.verdict !== "UNAVAILABLE") {
    const hIcon =
      harness.verdict === "CLEAN"
        ? green(c.dot_on, nc)
        : harness.blockers > 0
          ? yellow(c.dot_on, nc)
          : dim(c.dot_on, nc);
    const hLabel =
      harness.verdict === "CLEAN"
        ? `${green("CLEAN", nc)} ${dim(c.bullet, nc)} ${harness.gates} ${dim(c.bullet, nc)} ${harness.hooks} hooks`
        : `${yellow(harness.verdict, nc)} ${dim(c.bullet, nc)} ${harness.gates} ${dim(c.bullet, nc)} ${harness.gaps} gap${harness.gaps === 1 ? "" : "s"}`;
    lines.push(line(`  ${bold("Harness", nc)}  ${hIcon}  ${hLabel}`, width, c));
  }

  const seed = status?.seed;
  if (seed) {
    const localLabel =
      seed.local_urp === "active_local_only"
        ? green("active", nc)
        : dim(seed.local_urp, nc);
    const sharedLabel =
      seed.shared_urp === "locked_preview_only"
        ? dim("locked", nc)
        : cyan(seed.shared_urp, nc);
    lines.push(
      line(
        `  ${bold("Seed", nc)}     ${cyan(`${seed.pat_count}`, nc)} PAT local ${dim(c.bullet, nc)} ${cyan(`${seed.sat_count}`, nc)} SAT shared ${dim(c.bullet, nc)} URP ${localLabel}/${sharedLabel} ${dim(c.bullet, nc)} N=${seed.connected_nodes}`,
        width,
        c,
      ),
    );
    if (seed.epistemic_ground) {
      const eg = seed.epistemic_ground;
      lines.push(
        line(
          `    ${dim(`ground: ${eg.topology} ${c.bullet} runtime: ${eg.runtime} ${c.bullet} ${eg.assumption}`, nc)}`,
          width,
          c,
        ),
      );
    }
  }

  lines.push(line("", width, c));

  if (nextAction.text) {
    lines.push(line(`  ${yellow(c.arrow, nc)} ${nextAction.text}`, width, c));
    if (nextAction.command) {
      lines.push(
        line(
          `    ${dim("run:", nc)} ${cyan(nextAction.command, nc)}`,
          width,
          c,
        ),
      );
    }
    lines.push(line("", width, c));
  }

  for (const w of warnings) {
    lines.push(line(`  ${yellow("!", nc)} ${dim(w, nc)}`, width, c));
  }
  if (warnings.length > 0) lines.push(line("", width, c));

  lines.push(divider(width, c));

  const keyItems = keys.map(
    (k) => `${dim("[", nc)}${bold(k.key, nc)}${dim("]", nc)} ${k.label}`,
  );
  keyItems.push(`${dim("[", nc)}${bold("q", nc)}${dim("]", nc)} Quit`);
  const innerWidth = width - 4;
  const keyRows = [];
  let row = "";
  for (const item of keyItems) {
    const test = row ? row + "  " + item : item;
    if (visibleWidth(test) > innerWidth && row) {
      keyRows.push(row);
      row = item;
    } else {
      row = test;
    }
  }
  if (row) keyRows.push(row);
  for (const r of keyRows) {
    lines.push(line(r, width, c));
  }

  lines.push(divider(width, c));
  lines.push(
    line(
      dim(
        "Boundary: preview-only " +
          c.bullet +
          " no action without explicit consent.",
        nc,
      ),
      width,
      c,
    ),
  );
  lines.push(bottom(width, c));

  return lines.join("\n");
}

const QUIT_KEYS = new Set(["q", "\x1b", "\x03", "\r", "\n"]);

function readOneKey(stdin, stdout, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    let rawModeSet = false;
    let timeout = null;
    let onData = null;
    let onError = null;

    function cleanup() {
      if (rawModeSet) {
        try {
          stdin.setRawMode(false);
        } catch {}
        rawModeSet = false;
      }
      if (onData) stdin.removeListener("data", onData);
      if (onError) stdin.removeListener("error", onError);
      if (timeout) clearTimeout(timeout);
      try {
        stdin.pause();
      } catch {}
    }

    try {
      stdin.setRawMode(true);
      rawModeSet = true;
    } catch {
      resolve(null);
      return;
    }
    stdin.resume();

    timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    onError = () => {
      cleanup();
      resolve(null);
    };

    onData = (buf) => {
      const ch = buf.toString("utf8")[0] ?? "";
      cleanup();
      resolve(ch);
    };

    stdin.on("data", onData);
    stdin.on("error", onError);
  });
}

export async function runLiveHomebase({
  gatherFn,
  buildPreviewFn,
  dispatchFn,
  stdin = process.stdin,
  stdout = process.stdout,
  opts = {},
  maxIterations = 100,
} = {}) {
  if (!stdin.isTTY || !stdout.isTTY) return 0;

  function sigHandler() {
    stdout.write(SHOW_CURSOR + RESET);
    process.exit(0);
  }
  process.once("SIGINT", sigHandler);
  process.once("SIGTERM", sigHandler);

  let dispatches = 0;

  try {
    for (let i = 0; i < maxIterations; i++) {
      const gathered = await gatherFn();
      const preview = buildPreviewFn({ gather: gathered });
      const phase = derivePhase(preview);
      const keys = keysForPhase(phase);
      const keyMap = Object.fromEntries(keys.map((k) => [k.key, k.cmd]));

      const frame = renderLiveHomebase(preview, opts);
      stdout.write(CLEAR_SCREEN + HIDE_CURSOR + frame + "\n");

      const ch = await readOneKey(stdin, stdout);
      stdout.write(SHOW_CURSOR);

      if (!ch || QUIT_KEYS.has(ch)) break;

      if (keyMap[ch]) {
        stdout.write(CLEAR_SCREEN);
        await dispatchFn(keyMap[ch]);
        stdout.write(
          `\n${dim("Press any key to return to homebase...", opts.noColor ?? false)}\n`,
        );
        await readOneKey(stdin, stdout, 300_000);
        dispatches++;
      }
    }
  } finally {
    stdout.write(SHOW_CURSOR + RESET);
    process.removeListener("SIGINT", sigHandler);
    process.removeListener("SIGTERM", sigHandler);
  }

  return dispatches;
}
