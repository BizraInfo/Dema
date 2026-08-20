// SELF-EVAL-COLLECT-1A — CLI wrapper over the self-eval effect adapter.
//   dema self eval baseline --consent "GO: dema self eval baseline preview"
//     gathers REAL measured signals (full test suite with coverage · dema
//     monitors run · scripts/check.mjs gates · CLI boot timing, all invoked as
//     direct node children — no npm required) and — only under the exact phrase —
//     atomically writes the content-addressed baseline payload under
//     $DEMA_HOME/self-eval/ (tmp+rename, mode 0600).
//   dema self eval compare --baseline <abs> --candidate <abs>
//     read-only: re-derives improved / regressed / unchanged via the pure kernel.
// PREVIEW_ONLY measurement surface. No daemon, no network, no model, no mint.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import {
  DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE,
  planDemaSelfEvalBaselinePreview,
  buildDemaSelfEvalBaselinePreviewPayload,
  verifyDemaSelfEvalBaselinePreview,
  compareDemaSelfEvalBaselines,
} from "../../../../packages/core/src/dema-self-eval-baseline-preview.js";
import { gatherSelfEvalSignals } from "./self-eval-gatherer.js";

function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

export async function runSelfEvalBaseline({ label, consent, demaHome, gatherImpl = gatherSelfEvalSignals } = {}) {
  // Authority writes ahead: the exact phrase is checked before ANY effect runs.
  if (consent !== DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["consent_phrase_mismatch"]), receipt_path: null });
  }
  const effectiveLabel = typeof label === "string" && label.length > 0 ? label : "dema@local";
  const gathered = await gatherImpl({ label: effectiveLabel });
  if (!gathered.ok) {
    return Object.freeze({ ok: false, blocked_by: gathered.blocked_by, provenance: gathered.provenance ?? null, receipt_path: null });
  }
  const plan = planDemaSelfEvalBaselinePreview({ consent, input: gathered.input });
  if (!plan.eligible) {
    return Object.freeze({ ok: false, blocked_by: plan.blocked_by, receipt_path: null });
  }
  const payload = buildDemaSelfEvalBaselinePreviewPayload(gathered.input);
  const verified = verifyDemaSelfEvalBaselinePreview(payload);
  if (!verified.ok) {
    return Object.freeze({ ok: false, blocked_by: verified.blocked_by, receipt_path: null });
  }
  const home = demaHome || process.env.DEMA_HOME || join(homedir(), ".dema");
  const dir = join(home, "self-eval");
  await mkdir(dir, { recursive: true });
  const short = payload.content_hash.slice("sha256:".length).slice(0, 16);
  const finalPath = join(dir, `baseline-${short}.json`);
  const tmpPath = `${finalPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(payload, null, 2), { encoding: "utf8", mode: 0o600, flag: "w" });
  await rename(tmpPath, finalPath);
  return Object.freeze({
    ok: true,
    blocked_by: Object.freeze([]),
    receipt_path: finalPath,
    baseline_hash: payload.baseline_hash,
    healthy: payload.healthy,
    signals: gathered.input,
    provenance: gathered.provenance,
  });
}

export async function runSelfEvalCompare({ baselinePath, candidatePath } = {}) {
  for (const p of [baselinePath, candidatePath]) {
    if (typeof p !== "string" || !isAbsolute(p)) {
      return Object.freeze({ ok: false, blocked_by: Object.freeze(["path_not_absolute"]) });
    }
  }
  let base;
  let cand;
  try {
    base = JSON.parse(await readFile(baselinePath, "utf8"));
  } catch {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["baseline_unreadable"]) });
  }
  try {
    cand = JSON.parse(await readFile(candidatePath, "utf8"));
  } catch {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["candidate_unreadable"]) });
  }
  return compareDemaSelfEvalBaselines(base, cand);
}

function printHelp() {
  console.log(`dema self eval — measured self-baseline over the REAL repo signals (PREVIEW_ONLY)

  dema self eval baseline --consent "${DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE}" [--label <s>] [--dema-home <abs>] [--json]
                    Runs the full test suite with coverage · dema monitors run --json ·
                    scripts/check.mjs gates · CLI boot timing (direct node children,
                    no npm required), then seals a content-addressed baseline under
                    $DEMA_HOME/self-eval/. Fail-closed: an unmeasurable signal refuses;
                    nothing is fabricated. Heavy: executes the full suite + gates.
  dema self eval compare --baseline <abs.json> --candidate <abs.json> [--json]
                    Read-only verdict: improved / regressed / unchanged per dimension.

  Boundary: no daemon · no network · no model invocation · no mint · authority_delta 0.
  It never learns; it measures — a change to Dema is measured, not asserted.`);
}

export async function cmd_self_eval(ctx = {}) {
  // Dispatcher contract: ctx = { argv, command, subcommand } with argv[0] the
  // command token ("self") and argv[1] the noun ("eval") — ADR-012 says new
  // commands are space-subcommand, never kebab, so the mode is the token after
  // "eval". A bare token list (or a legacy single-token call) still works.
  const argv = Array.isArray(ctx) ? ctx : (ctx.argv ?? []);
  const tokens = Array.isArray(ctx) ? argv : argv.slice(1);
  const sub = tokens[0] === "eval" ? tokens[1] : tokens[0];
  const json = wantsJson(argv);
  if (sub === "baseline") {
    const out = await runSelfEvalBaseline({
      label: argValue(argv, "--label"),
      consent: argValue(argv, "--consent"),
      demaHome: argValue(argv, "--dema-home"),
    });
    if (json) console.log(JSON.stringify(out, null, 2));
    else if (out.ok) {
      console.log(`self-eval baseline SEALED (PREVIEW_ONLY · measured repo signals · no mint)`);
      console.log(`  baseline_hash: ${out.baseline_hash}`);
      console.log(`  healthy: ${out.healthy} · receipt: ${out.receipt_path}`);
    } else {
      console.log(`self-eval baseline REFUSED: ${out.blocked_by.join(", ")}`);
    }
    process.exitCode = out.ok ? 0 : 1;
    return;
  }
  if (sub === "compare") {
    const out = await runSelfEvalCompare({
      baselinePath: argValue(argv, "--baseline"),
      candidatePath: argValue(argv, "--candidate"),
    });
    if (json) console.log(JSON.stringify(out, null, 2));
    else if (out.ok) {
      console.log(`self-eval compare → ${out.overall.toUpperCase()} (PREVIEW_ONLY · re-derivable verdict)`);
      if (out.hard_regressions.length) console.log(`  hard regressions: ${out.hard_regressions.join(", ")}`);
      if (out.hard_improvements.length) console.log(`  hard improvements: ${out.hard_improvements.join(", ")}`);
    } else {
      console.log(`self-eval compare REFUSED: ${out.blocked_by.join(", ")}`);
    }
    process.exitCode = out.ok ? 0 : 1;
    return;
  }
  printHelp();
  // An unknown subcommand must not read as a clean pass.
  if (sub !== undefined && sub !== "help") process.exitCode = 1;
}
