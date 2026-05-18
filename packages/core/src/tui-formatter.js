// TUI Formatter — v0.1
//
// ANSI-based pretty-print formatter for the preview surfaces. Renders the
// schema-tagged JSON Dema emits into terminal-friendly visual hierarchy —
// without adding any new dependency. Pure stdlib. Honors NO_COLOR and
// TERM=dumb. Maps to the homebase-tui-v0.1 spec at
// `docs/02-architecture/homebase-tui-v0.1.md`.
//
// Design discipline:
//   - Pure function · no env reads inside the formatter
//   - Env (NO_COLOR / TERM) is passed in via opts at the CLI boundary
//   - 76-column default width · honors 80×24 terminal target
//   - Box-drawing chars (Unicode) for borders · plain ASCII fallback
//   - Bold/dim/color for hierarchy · all suppressible
//   - No animations · no progress spinners · calm aesthetics
//   - World-class doesn't mean ornate · it means readable, honest, and small
//
// Operating law: a screen the operator can read in 5 seconds, scan in 30,
// and audit in 5 minutes. Recognition before configuration. Refusal-as-
// product visible: every "by design" absence is annotated.

// ─── ANSI primitives ───────────────────────────────────────────────────────

const ESC = "\x1b[";
const RESET = ESC + "0m";

function bold(s, noColor)   { return noColor ? s : ESC + "1m" + s + ESC + "22m"; }
function dim(s, noColor)    { return noColor ? s : ESC + "2m" + s + ESC + "22m"; }
function cyan(s, noColor)   { return noColor ? s : ESC + "36m" + s + ESC + "39m"; }
function green(s, noColor)  { return noColor ? s : ESC + "32m" + s + ESC + "39m"; }
function yellow(s, noColor) { return noColor ? s : ESC + "33m" + s + ESC + "39m"; }
function red(s, noColor)    { return noColor ? s : ESC + "31m" + s + ESC + "39m"; }

// ─── Box-drawing primitives ────────────────────────────────────────────────

function chars(termDumb) {
  if (termDumb) {
    return {
      tl: "+", tr: "+", bl: "+", br: "+",
      h: "-", v: "|", divh: "-",
      bar_full: "#", bar_empty: ".",
      bullet: "*", arrow: "->",
      circle_on: "(*)", circle_off: "( )"
    };
  }
  return {
    tl: "┌", tr: "┐", bl: "└", br: "┘",
    h: "─", v: "│", divh: "─",
    bar_full: "▓", bar_empty: "░",
    bullet: "·", arrow: "→",
    circle_on: "◉", circle_off: "○"
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// String visible width — strips ANSI escape sequences before measuring.
// Used to align right-padded content honestly when color is on.
function visibleWidth(s) {
  if (typeof s !== "string") return 0;
  // Strip ANSI escape sequences (best-effort · covers SGR sequences)
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function padRight(s, width, padChar = " ") {
  const w = visibleWidth(s);
  if (w >= width) return s;
  return s + padChar.repeat(width - w);
}

// Truncate a string (with awareness of ANSI escapes) to fit a visible width.
// If the string already fits, returns it unchanged. If it exceeds, strips
// ANSI and slices the raw text, appending "…" when truncation occurred.
// This is the fit-or-truncate helper used by lineBox to enforce box width.
function fit(s, width) {
  const w = visibleWidth(s);
  if (w <= width) return s;
  // eslint-disable-next-line no-control-regex
  const plain = s.replace(/\x1b\[[0-9;]*m/g, "");
  if (width <= 1) return plain.slice(0, width);
  return plain.slice(0, width - 1) + "…";
}

// Word-wrap a plain string to fit width. Returns an array of lines.
// Used for prose blocks that may exceed the box. ANSI-aware: ANSI codes
// in the input are stripped before wrapping (wrapped output is plain text).
function wrap(s, width) {
  // eslint-disable-next-line no-control-regex
  const plain = s.replace(/\x1b\[[0-9;]*m/g, "");
  if (plain.length <= width) return [plain];
  const words = plain.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const word of words) {
    if (cur.length === 0) {
      cur = word;
    } else if (cur.length + 1 + word.length <= width) {
      cur += " " + word;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

function lineBox(content, opts) {
  const { width, c } = opts;
  const inner = width - 4;
  const fitted = fit(content, inner);
  const padded = padRight(fitted, inner);
  return `${c.v} ${padded} ${c.v}`;
}

// Emit possibly-multi-line content into a sequence of lineBox-formatted
// lines, wrapping long content to fit the inner width.
function wrappedLineBoxes(content, opts, indent = "") {
  const { width } = opts;
  const inner = width - 4 - indent.length;
  // Strip ANSI for measurement; if it fits, single line
  const w = visibleWidth(content);
  if (w <= width - 4) return [lineBox(content, opts)];
  // Wrap the plain text (ANSI is dropped on wrap)
  const wrapped = wrap(content.replace(/^\s+/, ""), inner);
  return wrapped.map((line) => lineBox(indent + line, opts));
}

function dividerBox(width, c) {
  return `${c.v} ${c.divh.repeat(width - 4)} ${c.v}`;
}

function topBorder(width, c) {
  return `${c.tl}${c.h.repeat(width - 2)}${c.tr}`;
}

function bottomBorder(width, c) {
  return `${c.bl}${c.h.repeat(width - 2)}${c.br}`;
}

function bar(ratio, width, c) {
  const filled = Math.max(0, Math.min(width, Math.round(ratio * width)));
  return c.bar_full.repeat(filled) + c.bar_empty.repeat(width - filled);
}

// ─── Public formatters ─────────────────────────────────────────────────────

export function formatOnboardingLifecyclePreview(preview, {
  noColor = false,
  termDumb = false,
  width = 76
} = {}) {
  if (!preview || preview.schema !== "bizra.dema.onboarding_lifecycle.v0.1") {
    return formatError("Expected bizra.dema.onboarding_lifecycle.v0.1 input", { noColor, termDumb, width });
  }
  const c = chars(termDumb);
  const lines = [];
  const candidate = preview.candidate || {};
  const candidateLabel = candidate.name
    ? `${candidate.name} · ${candidate.node_label ?? "Node?"}`
    : `(unnamed candidate · ${candidate.node_label ?? "Node?"})`;

  lines.push(topBorder(width, c));
  lines.push(lineBox(`${bold("DEMA · ONBOARDING", noColor)} · ${candidateLabel}`, { width, c }));
  lines.push(dividerBox(width, c));
  lines.push(lineBox("", { width, c }));

  // Operating law (one-line distilled)
  lines.push(lineBox(
    `${dim("Operating law:", noColor)} ${cyan("comprehension before consent", noColor)}`,
    { width, c }
  ));
  lines.push(lineBox(
    `               ${cyan("language before capability · dignity before configuration", noColor)}`,
    { width, c }
  ));
  lines.push(lineBox("", { width, c }));

  // Progress bar
  const ratio = preview.progress?.completion_ratio ?? 0;
  const completed = preview.progress?.completed ?? [];
  const total = preview.stage_count ?? 7;
  const progressBar = bar(ratio, 20, c);
  const pct = Math.round(ratio * 100);
  lines.push(lineBox(
    `${bold("Progress:", noColor)}  ${green(progressBar, noColor)}  ${pct.toString().padStart(3)}%  (${completed.length}/${total})`,
    { width, c }
  ));
  lines.push(lineBox("", { width, c }));

  // Stage list with current marker
  lines.push(lineBox(bold("Stages:", noColor), { width, c }));
  for (const stage of preview.stages || []) {
    const isCompleted = completed.includes(stage.id);
    const isCurrent = preview.current_stage?.id === stage.id;
    const marker = isCompleted ? green(c.circle_on, noColor) : isCurrent ? yellow(c.circle_on, noColor) : dim(c.circle_off, noColor);
    const ordTag = `[${stage.order}]`;
    const idText = isCurrent
      ? bold(`${stage.id} · current`, noColor)
      : isCompleted ? dim(`${stage.id} · done`, noColor) : stage.id;
    lines.push(lineBox(`  ${marker} ${dim(ordTag, noColor)} ${idText}`, { width, c }));
  }
  lines.push(lineBox("", { width, c }));

  // Current stage title (if any)
  if (preview.current_stage?.id) {
    const cur = preview.stages.find((s) => s.id === preview.current_stage.id);
    if (cur) {
      for (const l of wrappedLineBoxes(`${bold("Now:", noColor)} ${cur.title}`, { width, c }, "      ")) {
        lines.push(l);
      }
      if (cur.boundary_note) {
        for (const l of wrappedLineBoxes(dim(cur.boundary_note, noColor), { width, c }, "      ")) {
          lines.push(l);
        }
      }
      lines.push(lineBox("", { width, c }));
    }
  } else if (preview.progress?.lifecycle_complete) {
    lines.push(lineBox(`${bold("Lifecycle complete.", noColor)} ${green("All 7 stages done.", noColor)}`, { width, c }));
    lines.push(lineBox("", { width, c }));
  }

  // Boundary footer
  lines.push(dividerBox(width, c));
  lines.push(lineBox(dim("Boundary: no network · no federation · no runtime · no mint · preview only.", noColor), { width, c }));
  lines.push(bottomBorder(width, c));
  return lines.join("\n");
}

export function formatNodeRegistryPreview(preview, {
  noColor = false,
  termDumb = false,
  width = 76
} = {}) {
  if (!preview || preview.schema !== "bizra.dema.node_registry_preview.v0.1") {
    return formatError("Expected bizra.dema.node_registry_preview.v0.1 input", { noColor, termDumb, width });
  }
  const c = chars(termDumb);
  const lines = [];
  const rs = preview.registry_state || {};
  const urp = preview.urp_shared_pool_inventory || {};
  const totals = urp.current_totals_if_each_node_were_to_activate || {};

  lines.push(topBorder(width, c));
  lines.push(lineBox(`${bold("DEMA · NODE REGISTRY", noColor)}  ${dim("preview · no federation", noColor)}`, { width, c }));
  lines.push(dividerBox(width, c));
  lines.push(lineBox("", { width, c }));

  // Big number: connected_node_count
  const connectedStr = `${rs.connected_node_count ?? 0}`;
  lines.push(lineBox(`${bold("Connected nodes:", noColor)}  ${green(bold(connectedStr, noColor), noColor)}`, { width, c }));
  lines.push(lineBox(`${dim("Ghost pending  :", noColor)}  ${(rs.ghost_pending_count ?? 0).toString()}`, { width, c }));
  lines.push(lineBox(`${dim("Companion devs :", noColor)}  ${(rs.companion_device_count ?? 0).toString()}`, { width, c }));
  lines.push(lineBox("", { width, c }));

  // URP shared pool inventory
  lines.push(lineBox(bold("URP shared pool · planned totals per Scaling table:", noColor), { width, c }));
  lines.push(lineBox(`  ${cyan("PAT agents (local on each node)", noColor)}  : ${(totals.pat_agents ?? 0).toString().padStart(5)}`, { width, c }));
  lines.push(lineBox(`  ${cyan("SAT agents (into shared URP)   ", noColor)}  : ${(totals.sat_agents ?? 0).toString().padStart(5)}`, { width, c }));
  lines.push(lineBox(`  ${dim("Total agents                   ", noColor)}  : ${(totals.total_agents ?? 0).toString().padStart(5)}`, { width, c }));
  lines.push(lineBox("", { width, c }));

  // Federation status
  const fedActive = urp.federation_active ?? false;
  const fedIcon = fedActive ? green(c.circle_on, noColor) : dim(c.circle_off, noColor);
  const fedLabel = fedActive ? "active" : "unreachable (by design · runtime lives upstream)";
  lines.push(lineBox(`${dim("Federation     :", noColor)}  ${fedIcon} ${fedLabel}`, { width, c }));
  lines.push(lineBox("", { width, c }));

  // Accepted nodes (list)
  if (Array.isArray(rs.accepted) && rs.accepted.length > 0) {
    lines.push(lineBox(bold("Accepted:", noColor), { width, c }));
    for (const node of rs.accepted) {
      const candidate = node.candidate_name ? ` · ${node.candidate_name}` : "";
      const companion = node.companion_of ? ` ${dim("(companion)", noColor)}` : "";
      lines.push(lineBox(`  ${green(c.circle_on, noColor)} ${node.node_label}${candidate}${companion}`, { width, c }));
    }
    lines.push(lineBox("", { width, c }));
  }

  // Ghost nodes (list)
  if (Array.isArray(rs.ghost) && rs.ghost.length > 0) {
    lines.push(lineBox(bold("Ghost (pending acceptance):", noColor), { width, c }));
    for (const node of rs.ghost) {
      const candidate = node.candidate_name ? ` · ${node.candidate_name}` : "";
      lines.push(lineBox(`  ${yellow(c.circle_on, noColor)} ${node.node_label}${candidate}`, { width, c }));
      if (node.ordinal_claim_phrase) {
        lines.push(lineBox(`     ${dim("type to accept:", noColor)} ${cyan(`"${node.ordinal_claim_phrase}"`, noColor)}`, { width, c }));
      }
    }
    lines.push(lineBox("", { width, c }));
  }

  // Forbidden ordinals
  if (Array.isArray(rs.forbidden_ordinals) && rs.forbidden_ordinals.length > 0) {
    lines.push(lineBox(`${dim("Forbidden ordinals:", noColor)} [${rs.forbidden_ordinals.join(", ")}] ${dim("(canon-registry · amend to lift)", noColor)}`, { width, c }));
    lines.push(lineBox("", { width, c }));
  }

  lines.push(dividerBox(width, c));
  lines.push(lineBox(dim("Boundary: all 16 canonical keys pinned false. Preview only.", noColor), { width, c }));
  lines.push(bottomBorder(width, c));
  return lines.join("\n");
}

// ─── Error fallback ────────────────────────────────────────────────────────

function formatError(msg, { noColor, termDumb, width }) {
  const c = chars(termDumb);
  const lines = [];
  lines.push(topBorder(width, c));
  lines.push(lineBox(red(bold("formatter error:", noColor), noColor), { width, c }));
  lines.push(lineBox(`  ${msg}`, { width, c }));
  lines.push(bottomBorder(width, c));
  return lines.join("\n");
}

// ─── Env-based opt resolution (CLI boundary helper) ────────────────────────

// CLI dispatch reads env at the boundary and forwards into the pure formatter.
// This helper is NOT pure (reads process.env) but it's the only impure shim,
// kept tiny and obvious so the formatter itself remains pure.
export function resolveFormatterOptsFromEnv(env = process.env) {
  return {
    noColor: Boolean(env.NO_COLOR),
    termDumb: env.TERM === "dumb",
    width: Number.isFinite(Number(env.DEMA_TUI_WIDTH)) ? Number(env.DEMA_TUI_WIDTH) : 76
  };
}

// ─── Public constants ──────────────────────────────────────────────────────

export const TUI_FORMATTER_DEFAULT_WIDTH = 76;
