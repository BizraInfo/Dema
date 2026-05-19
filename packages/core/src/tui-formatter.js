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

// Theme port — bizra-cli/src/theme.rs design language adapted to JS.
// See docs/06-adr/ADR-013-visual-language-isomorphism-bizra-cli-to-dema.md
import { Theme } from "./dema-theme.js";

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

export function formatSkillGrowthGovernorPreview(preview, {
  noColor = false,
  termDumb = false,
  width = 76
} = {}) {
  if (!preview || preview.schema !== "bizra.dema.skill_growth_governor.v0.1") {
    return formatError("Expected bizra.dema.skill_growth_governor.v0.1 input", { noColor, termDumb, width });
  }
  const c = chars(termDumb);
  const lines = [];

  lines.push(topBorder(width, c));
  lines.push(lineBox(`${bold("DEMA · SKILL GROWTH GOVERNOR", noColor)}  ${dim("preview · proof-governed", noColor)}`, { width, c }));
  lines.push(dividerBox(width, c));
  lines.push(lineBox("", { width, c }));

  // Four-line law front and center · the doctrinal anchor
  lines.push(lineBox(bold("Operating law:", noColor), { width, c }));
  for (const law of preview.four_line_law || []) {
    lines.push(lineBox(`  ${cyan(law, noColor)}`, { width, c }));
  }
  lines.push(lineBox("", { width, c }));

  // Counters at a glance · the Growth Dashboard
  const ct = preview.counters || {};
  lines.push(lineBox(bold("Growth dashboard:", noColor), { width, c }));
  lines.push(lineBox(`  Candidates total      : ${(ct.candidates_total ?? 0).toString().padStart(3)}`, { width, c }));
  lines.push(lineBox(`  ${green("Promotable", noColor)}             : ${(ct.candidates_promotable ?? 0).toString().padStart(3)}`, { width, c }));
  lines.push(lineBox(`  ${yellow("Proposed (gates pending)", noColor)} : ${(ct.candidates_proposed ?? 0).toString().padStart(3)}`, { width, c }));
  lines.push(lineBox(`  ${red("Halted (refused)", noColor)}      : ${(ct.candidates_halted ?? 0).toString().padStart(3)}`, { width, c }));
  lines.push(lineBox(`  Human-edited protected: ${(ct.human_edited_skills_protected ?? 0).toString().padStart(3)}  ${dim("(sacred)", noColor)}`, { width, c }));
  lines.push(lineBox(`  Pinned skills         : ${(ct.pinned_skills ?? 0).toString().padStart(3)}`, { width, c }));
  lines.push(lineBox(`  Total refusals        : ${(ct.refusals_total ?? 0).toString().padStart(3)}`, { width, c }));
  lines.push(lineBox("", { width, c }));

  // Five gates as a list
  lines.push(lineBox(bold("Five promotion gates:", noColor), { width, c }));
  for (const gate of preview.five_gates || []) {
    lines.push(lineBox(`  ${cyan(c.bullet, noColor)} ${gate}`, { width, c }));
  }
  lines.push(lineBox("", { width, c }));

  // Per-candidate detail · only show if any
  if (Array.isArray(preview.candidate_evaluations) && preview.candidate_evaluations.length > 0) {
    lines.push(lineBox(bold("Candidate evaluations:", noColor), { width, c }));
    for (const e of preview.candidate_evaluations) {
      const actionColor = e.next_action === "promote" ? green : e.next_action === "halt" ? red : yellow;
      const actionMark = e.next_action === "promote" ? c.circle_on : e.next_action === "halt" ? c.circle_off : c.circle_off;
      lines.push(lineBox(`  ${actionColor(actionMark, noColor)} ${e.skill_id} v${e.candidate_version}  ${dim("→", noColor)} ${actionColor(bold(e.next_action, noColor), noColor)}`, { width, c }));
      // Show per-gate results
      for (const [gName, gResult] of Object.entries(e.gates ?? {})) {
        const passSym = gResult.passed ? green(c.circle_on, noColor) : red(c.circle_off, noColor);
        const reason = gResult.passed ? "" : `  ${dim("· " + (gResult.reason ?? ""), noColor)}`;
        for (const l of wrappedLineBoxes(`      ${passSym} ${gName}${reason}`, { width, c }, "        ")) {
          lines.push(l);
        }
      }
      // Show refusals
      if (Array.isArray(e.refusals) && e.refusals.length > 0) {
        for (const r of e.refusals) {
          for (const l of wrappedLineBoxes(`      ${red("✗ refusal:", noColor)} ${r}`, { width, c }, "        ")) {
            lines.push(l);
          }
        }
      }
      // Show consent phrase required if not yet typed
      if (!e.gates?.human_consent_received?.passed) {
        for (const l of wrappedLineBoxes(`      ${dim("type to promote:", noColor)} ${cyan(`"${e.promotion_phrase_required}"`, noColor)}`, { width, c }, "        ")) {
          lines.push(l);
        }
      }
      lines.push(lineBox("", { width, c }));
    }
  }

  // Protected namespaces footer
  if (Array.isArray(preview.protected_namespaces) && preview.protected_namespaces.length > 0) {
    lines.push(lineBox(`${dim("Protected namespaces:", noColor)} ${preview.protected_namespaces.join(", ")} ${dim("(no skills here without override)", noColor)}`, { width, c }));
    lines.push(lineBox("", { width, c }));
  }

  lines.push(dividerBox(width, c));
  lines.push(lineBox(dim("Boundary: preview-only · no overwrite · no auto-promotion · refusal-as-product.", noColor), { width, c }));
  lines.push(bottomBorder(width, c));
  return lines.join("\n");
}

export function formatProjectStatusPreview(preview, {
  noColor = false,
  termDumb = false,
  width = 76
} = {}) {
  if (!preview || preview.schema !== "bizra.dema.project_status.v0.1") {
    return formatError("Expected bizra.dema.project_status.v0.1 input", { noColor, termDumb, width });
  }
  const c = chars(termDumb);
  const lines = [];
  const p = preview.project || {};
  const vs = preview.value_stream || {};
  const qp = preview.quality_posture || {};
  const ct = preview.counters || {};

  lines.push(topBorder(width, c));
  lines.push(lineBox(`${bold("BIZRA / DEMA · PROJECT STATUS", noColor)}  ${dim("PMBOK 7th-edition aligned", noColor)}`, { width, c }));
  lines.push(dividerBox(width, c));
  lines.push(lineBox("", { width, c }));

  // Vision (word-wrap if needed)
  lines.push(lineBox(bold("Vision:", noColor), { width, c }));
  for (const l of wrappedLineBoxes(`  ${cyan(p.vision ?? "", noColor)}`, { width, c }, "  ")) {
    lines.push(l);
  }
  lines.push(lineBox(`  ${dim("operator:", noColor)} ${p.operator ?? "?"} · ${dim("phase:", noColor)} ${p.current_phase ?? "?"}`, { width, c }));
  lines.push(lineBox("", { width, c }));

  // Value stream · the headline numbers
  lines.push(lineBox(bold("Value stream:", noColor), { width, c }));
  lines.push(lineBox(`  ${dim("Unit of value:", noColor)} ${cyan(vs.unit_of_value ?? "?", noColor)}`, { width, c }));
  if (vs.receipts_total !== null && vs.receipts_total !== undefined) {
    lines.push(lineBox(`  ${green("Receipts on chain", noColor)}    : ${(vs.receipts_total).toString().padStart(5)}  ${dim("IRONCLAD-class at head", noColor)}`, { width, c }));
  }
  if (vs.spine_surfaces !== null && vs.spine_surfaces !== undefined) {
    lines.push(lineBox(`  ${green("Canonical spine surfaces", noColor)} : ${(vs.spine_surfaces).toString().padStart(5)}`, { width, c }));
  }
  if (vs.structural_laws_canonized !== null && vs.structural_laws_canonized !== undefined) {
    lines.push(lineBox(`  ${green("Structural laws canonized", noColor)} : ${(vs.structural_laws_canonized).toString().padStart(5)}  ${dim("of 3 known", noColor)}`, { width, c }));
  }
  if (vs.tests_total !== null && vs.tests_total !== undefined) {
    lines.push(lineBox(`  ${green("Tests passing", noColor)}            : ${(vs.tests_total).toString().padStart(5)}  ${dim("/", noColor)} ${(vs.tests_failing ?? 0).toString().padStart(3)} ${dim("failing", noColor)}`, { width, c }));
  }
  if (vs.external_humans_in_canon !== null && vs.external_humans_in_canon !== undefined) {
    lines.push(lineBox(`  ${green("External humans in canon", noColor)} : ${(vs.external_humans_in_canon).toString().padStart(5)}`, { width, c }));
  }
  for (const l of wrappedLineBoxes(`  ${dim("Refusal: " + (vs.refusal_explicit ?? ""), noColor)}`, { width, c }, "  ")) {
    lines.push(l);
  }
  lines.push(lineBox("", { width, c }));

  // Stakeholder map (concise list)
  if (Array.isArray(preview.stakeholders) && preview.stakeholders.length > 0) {
    lines.push(lineBox(bold("Stakeholders (concentric rings):", noColor), { width, c }));
    for (const s of preview.stakeholders) {
      const ring = s.role === "founder" ? "Ring 0" :
                   s.role === "first_invited" ? "Ring 1" :
                   s.role === "candidate" ? "Ring 1.5" :
                   s.role.startsWith("future_ring_") ? `Ring ${s.role.match(/\d+/)?.[0] ?? "?"}` :
                   "—";
      const id = s.name ? s.name : (s.node_label ?? "?");
      lines.push(lineBox(`  ${dim(ring, noColor)} · ${id}  ${dim("·", noColor)} ${s.status}`, { width, c }));
    }
    lines.push(lineBox("", { width, c }));
  }

  // Risk register · top entries
  if (Array.isArray(preview.risk_register) && preview.risk_register.length > 0) {
    lines.push(lineBox(bold(`Risk register (${preview.risk_register.length}):`, noColor), { width, c }));
    for (const r of preview.risk_register.slice(0, 5)) {
      const sevColor = r.severity === "high" || r.severity === "critical" ? red : r.severity === "medium" ? yellow : green;
      lines.push(lineBox(`  ${sevColor(c.bullet, noColor)} ${r.risk_id} ${dim("[" + r.severity + "]", noColor)} ${r.title}`, { width, c }));
    }
    if (preview.risk_register.length > 5) {
      lines.push(lineBox(`  ${dim("... " + (preview.risk_register.length - 5) + " more · see project-status --json", noColor)}`, { width, c }));
    }
    if (ct.risks_refused_close_without_mitigation > 0) {
      lines.push(lineBox(`  ${red("✗ refused-close-without-mitigation:", noColor)} ${ct.risks_refused_close_without_mitigation}`, { width, c }));
    }
    lines.push(lineBox("", { width, c }));
  }

  // Quality posture
  lines.push(lineBox(bold("Quality posture:", noColor), { width, c }));
  const mcc = qp.master_craftsmanship_compliance ? green("yes", noColor) : red("no", noColor);
  lines.push(lineBox(`  Master Craftsmanship  : ${mcc}`, { width, c }));
  lines.push(lineBox(`  5-gate state           : ${qp.five_gate_state ?? "?"}`, { width, c }));
  lines.push(lineBox(`  Adversarial test floor: ${qp.adversarial_floor_per_component ?? "?"} per component`, { width, c }));
  lines.push(lineBox(`  Canonical boundary    : ${qp.canonical_boundary_keys ?? 16} keys all false`, { width, c }));
  lines.push(lineBox("", { width, c }));

  // PMBOK alignment (just count + invitation to inspect)
  lines.push(lineBox(`${dim("PMBOK 7th-edition · 12 principles surfaced (run --json for full mapping):", noColor)}`, { width, c }));
  const principleIds = preview.pmbok_principles.map((p) => p.id).join(", ");
  for (const l of wrappedLineBoxes(`  ${dim(principleIds, noColor)}`, { width, c }, "  ")) {
    lines.push(l);
  }
  lines.push(lineBox("", { width, c }));

  // Counters at a glance
  lines.push(lineBox(bold("At a glance:", noColor), { width, c }));
  lines.push(lineBox(`  Stakeholders : ${ct.stakeholders_total ?? 0} total · ${ct.stakeholders_active ?? 0} active`, { width, c }));
  lines.push(lineBox(`  Risks         : ${ct.risks_total ?? 0} total · ${ct.risks_open ?? 0} open/monitored`, { width, c }));
  lines.push(lineBox(`  Open typed-GOs: ${ct.open_typed_gos ?? 0}`, { width, c }));
  lines.push(lineBox(`  Deferred acts : ${ct.deferred_actions ?? 0}`, { width, c }));
  lines.push(lineBox("", { width, c }));

  lines.push(dividerBox(width, c));
  lines.push(lineBox(dim("Human-readable canon: docs/pm/PROJECT_CHARTER_AND_STATUS.md", noColor), { width, c }));
  lines.push(lineBox(dim("Boundary: preview-only · receipt-bound · refuse-as-product · canonical 16-key all-false.", noColor), { width, c }));
  lines.push(bottomBorder(width, c));
  return lines.join("\n");
}

// Homebase preview formatter — the 14th canonical spine surface render.
//
// Renders the schema-tagged bizra.dema.homebase_v0_1.v0.1 preview (from
// packages/core/src/homebase-preview.js) into the static ANSI homebase frame.
// This is the TTY render path for bare `dema` invocation per Homebase TUI v0.1
// phase-4 spec, ZERO new runtime deps · matches the established formatter
// convention (no Ink / no JSX / no React).
//
// v0.1 design discipline:
//   - Static frame only · NO interactive keypress · NO affordance dispatch.
//     Affordances are displayed as keyboard hints; the operator types
//     `dema receipts` (or any subcommand) themselves to act. Interactive
//     keypress + spawn dispatch deferred to v0.2 with an explicit ADR for
//     the dep decision (the spec phase_04 §4.5 work is heavy enough to
//     warrant its own slice).
//   - 76-column width discipline (matches preview.viewport.cols_target).
//   - NO_COLOR / TERM=dumb honored via opts (passed in by CLI boundary).
//   - Pure function · no I/O · no env reads · deterministic given input.
export function formatHomebasePreview(preview, {
  noColor = false,
  termDumb = false,
  palette = "24bit",
  width = 76
} = {}) {
  if (!preview || preview.schema !== "bizra.dema.homebase_v0_1.v0.1") {
    return formatError("Expected bizra.dema.homebase_v0_1.v0.1 input", { noColor, termDumb, width });
  }
  const c = chars(termDumb);
  const lines = [];
  const h = preview.header || {};
  const g = preview.greeting || {};
  const m3 = preview.memory3 || { entries: [], fallback_text: null };
  const st = preview.status || {};
  const na = preview.next_action || {};
  const affs = Array.isArray(preview.affordances) ? preview.affordances : [];

  // Top border + branded header line.
  // Header title uses Theme.title (Ihsān-gold from bizra-cli theme.rs port) —
  // proof-of-isomorphism for ADR-013. Palette resolved at CLI boundary per
  // resolvePaletteFromEnv (COLORTERM=truecolor → 24bit · *-256color → 256 ·
  // NO_COLOR / TERM=dumb → none). See dema-theme.js.
  lines.push(topBorder(width, c));
  const headerLeft = Theme.title(`DEMA · ${h.node_name ?? "Node0"}`, { noColor, palette });
  const headerRight = dim(`v${h.dema_version ?? "?"}`, noColor);
  const headerMid = `${dim(c.bullet, noColor)} ${h.date_human_gst ?? "?"} ${dim(c.bullet, noColor)} ${h.time_human_gst ?? "?"}`;
  lines.push(lineBox(`${headerLeft}  ${headerMid}  ${headerRight}`, { width, c }));
  lines.push(dividerBox(width, c));
  lines.push(lineBox("", { width, c }));

  // Greeting
  const greetingText = typeof g.text === "string" ? g.text : "Welcome.";
  lines.push(lineBox(bold(greetingText, noColor), { width, c }));
  lines.push(lineBox("", { width, c }));

  // Memory3 (three things I remember · or fallback)
  if (m3.fallback_text) {
    lines.push(lineBox(`${dim(m3.fallback_text, noColor)}`, { width, c }));
  } else {
    lines.push(lineBox(bold("Three things I remember:", noColor), { width, c }));
    const entries = Array.isArray(m3.entries) ? m3.entries : [];
    for (let i = 0; i < 3; i++) {
      const e = entries[i];
      if (e) {
        const label = (typeof e.summary === "string" && e.summary.length > 0) ? e.summary : (e.name ?? "?");
        lines.push(lineBox(`  ${dim((i + 1) + ".", noColor)} ${label}`, { width, c }));
      } else {
        lines.push(lineBox(`  ${dim((i + 1) + ". —", noColor)}`, { width, c }));
      }
    }
  }
  lines.push(lineBox("", { width, c }));

  // Status (4 rows: ring · mission · gateway · memory_bar)
  lines.push(lineBox(bold("Right now:", noColor), { width, c }));
  if (st.ring) {
    const barStr = typeof st.ring.bar === "string" ? st.ring.bar : "";
    lines.push(lineBox(`  ${dim("Node0  ", noColor)}${barStr}  ${st.ring.label ?? ""}`, { width, c }));
  }
  if (st.mission) {
    const icon = st.mission.icon ?? (st.mission.label === "active" ? c.circle_on : c.circle_off);
    const missionColor = st.mission.label === "active" ? green : dim;
    lines.push(lineBox(`  ${dim("Mission", noColor)} ${missionColor(icon, noColor)}  ${st.mission.label ?? "?"}`, { width, c }));
  }
  if (st.gateway) {
    const icon = st.gateway.icon ?? c.circle_off;
    lines.push(lineBox(`  ${dim("Gateway", noColor)} ${dim(icon, noColor)}  ${dim(st.gateway.label ?? "", noColor)}`, { width, c }));
  }
  if (st.memory_bar) {
    const barStr = typeof st.memory_bar.bar === "string" ? st.memory_bar.bar : "";
    lines.push(lineBox(`  ${dim("Memory ", noColor)}${barStr}  ${dim(st.memory_bar.label ?? "", noColor)}`, { width, c }));
  }
  lines.push(lineBox("", { width, c }));

  // Next safe action
  lines.push(lineBox(bold("Next safe action:", noColor), { width, c }));
  const actionText = typeof na.text === "string" ? na.text : "press ? to see available actions";
  for (const l of wrappedLineBoxes(`  ${c.arrow} ${cyan(actionText, noColor)}`, { width, c }, "    ")) {
    lines.push(l);
  }
  lines.push(lineBox("", { width, c }));

  // Affordances (keyboard hints · static · NOT interactive in v0.1)
  lines.push(dividerBox(width, c));
  if (affs.length > 0) {
    const hintParts = affs.map((a) => `${bold(`[${a.key}]`, noColor)} ${a.label}`);
    // Pack hints into lines respecting width budget
    const inner = width - 4 - 2;
    let row = "  ";
    for (const hint of hintParts) {
      const candidate = row.length > 2 ? `${row}  ${hint}` : `${row}${hint}`;
      if (visibleWidth(candidate) <= inner) {
        row = candidate;
      } else {
        lines.push(lineBox(row, { width, c }));
        row = `  ${hint}`;
      }
    }
    if (row.trim().length > 0) lines.push(lineBox(row, { width, c }));
  }

  // Partial-state warning
  if (preview.partial) {
    lines.push(lineBox(`${yellow(c.bullet, noColor)} ${dim("partial state · " + (preview.warnings?.length ?? 0) + " warning(s) · run with --json for detail", noColor)}`, { width, c }));
  }

  // Boundary footer · two-line embodiment per docs/canon/LAW_OF_ASSUMPTION.md.
  // First line is the consent boundary; second line is the Law of Assumption
  // citation. Together they make the persona DNA visible to the operator at
  // every render, not just textual in the docs tree.
  lines.push(dividerBox(width, c));
  lines.push(lineBox(dim("Boundary: preview-only · no action without explicit consent.", noColor), { width, c }));
  lines.push(lineBox(dim("Law of Assumption: declare boundary between evidence and uncertainty.", noColor), { width, c }));
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

// Compute the most-capable palette the operator's terminal supports.
// Order: explicit overrides → NO_COLOR / TERM=dumb → COLORTERM → TERM family.
// Public so dema-theme.js consumers can pass it directly to Theme.* helpers.
export function resolvePaletteFromEnv(env = process.env) {
  // Explicit overrides always win.
  if (env.DEMA_PALETTE === "24bit" || env.DEMA_PALETTE === "256" || env.DEMA_PALETTE === "none") {
    return env.DEMA_PALETTE;
  }
  // No-color contracts: NO_COLOR (any value · per https://no-color.org) and
  // TERM=dumb both mean "do not emit ANSI color sequences."
  if (env.NO_COLOR) return "none";
  if (env.TERM === "dumb") return "none";
  // 24-bit true-color hint: COLORTERM=truecolor or 24bit (xterm-256color,
  // Windows Terminal, iTerm2, kitty, alacritty, gnome-terminal all set this).
  const colorterm = String(env.COLORTERM || "").toLowerCase();
  if (colorterm === "truecolor" || colorterm === "24bit") return "24bit";
  // 256-color: TERM matching *-256color or screen.* with 256.
  const term = String(env.TERM || "").toLowerCase();
  if (term.includes("256color") || term.endsWith("-256")) return "256";
  // Conservative default: most modern terminals support 24-bit even without
  // declaring it; downgrade to 256 only for explicit legacy signals.
  if (term === "xterm" || term === "screen" || term === "linux" || term === "vt100") return "256";
  return "24bit";
}

export function resolveFormatterOptsFromEnv(env = process.env) {
  const palette = resolvePaletteFromEnv(env);
  return {
    noColor: Boolean(env.NO_COLOR) || palette === "none",
    termDumb: env.TERM === "dumb",
    palette,
    width: Number.isFinite(Number(env.DEMA_TUI_WIDTH)) ? Number(env.DEMA_TUI_WIDTH) : 76
  };
}

// ─── Public constants ──────────────────────────────────────────────────────

export const TUI_FORMATTER_DEFAULT_WIDTH = 76;
