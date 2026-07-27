// `dema steward` — DEMA-REVERSIBLE-FILE-STEWARD-1C (CLI surface over proven kernels).
//
//   plan   — 1A pure planner preview; no mutation; exact preview phrase gates eligibility.
//   verify — 1B round-trip proof: execute-all → undo-all inside the job's sandbox_root;
//            restores genesis (user-file state-hash equality).
//   run    — 1B sequenced execution; emits receipts JSON on stdout (save them to undo later).
//   undo   — 1B reverse-order undo from a receipts file; each restoration proven
//            against its independent on-disk backup.
//
// The CLI adds no policy of its own: consent phrases, sandbox containment
// (realpath/symlink/no-clobber), backups, receipt logging and undo proofs all
// live in the shipped kernels and the reversible-execute gate they compose.
import nodeFs from "node:fs";
import {
  planDemaReversibleFileSteward,
  runDemaReversibleFileSteward,
  DEMA_REVERSIBLE_FILE_STEWARD_GO_PHRASE,
} from "../../../../packages/core/src/dema-reversible-file-steward.js";
import {
  sequenceExecuteStewardJob,
  sequenceUndoStewardJob,
  verifyStewardRoundTrip,
  demaReversibleFileStewardExecutionBoundary,
  DEMA_REVERSIBLE_FILE_STEWARD_EXECUTION_SCHEMA,
  DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE,
} from "../../../../packages/core/src/dema-reversible-file-steward-execution.js";

const USAGE = Object.freeze({
  schema: "bizra.dema.steward_cli.v0.1",
  subcommands: Object.freeze({
    plan: 'dema steward plan --job <job.json> [--consent "<preview phrase>"]',
    verify: 'dema steward verify --job <job.json> --consent "<execute phrase>"',
    run: 'dema steward run --job <job.json> --consent "<execute phrase>"',
    undo: "dema steward undo --receipts <receipts.json>",
  }),
  job_shape: '{ "sandbox_root": "<abs dir>", "max_atoms": 8, "atoms": [{ "from": "a.txt", "to": "b.txt" }] }',
  preview_phrase: DEMA_REVERSIBLE_FILE_STEWARD_GO_PHRASE,
  execute_phrase: DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE,
});

function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}

function emit(obj, code) {
  console.log(JSON.stringify(obj, null, 2));
  process.exitCode = code;
}

function readJsonFile(path) {
  try {
    const parsed = JSON.parse(nodeFs.readFileSync(path, "utf8"));
    return { parsed };
  } catch {
    return { error: "file_unreadable_or_not_json" };
  }
}

function readJob(argv) {
  const path = flagValue(argv, "--job");
  if (!path) return { error: "job_file_flag_missing" };
  const { parsed, error } = readJsonFile(path);
  if (error) return { error };
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "job_file_not_object" };
  }
  return { job: parsed };
}

// Every 1A plan block EXCEPT the missing preview phrase. run/verify consent is
// the (stronger) execute phrase, typed by the human; the preview phrase is never
// auto-supplied on their behalf — so shape/sanitizer/bounds blocks still gate.
function shapeBlocks(job) {
  const plan = planDemaReversibleFileSteward({ consent: null, input: job });
  return plan.blocked_by.filter((b) => b !== "consent_phrase_mismatch");
}

export async function cmd_steward(ctx) {
  const argv = ctx.argv.slice(1);
  const sub = argv[0] ?? null;
  const consent = flagValue(argv, "--consent");

  if (sub === "plan") {
    const { job, error } = readJob(argv);
    if (error) return emit({ ok: false, blocked_by: [error], ...USAGE }, 1);
    const result = runDemaReversibleFileSteward({ consent, input: job });
    return emit(
      { ...result, required_consent: DEMA_REVERSIBLE_FILE_STEWARD_GO_PHRASE },
      result.ok ? 0 : 1,
    );
  }

  if (sub === "verify" || sub === "run") {
    const { job, error } = readJob(argv);
    if (error) return emit({ ok: false, blocked_by: [error], ...USAGE }, 1);
    const blocks = shapeBlocks(job);
    if (blocks.length > 0) {
      return emit({ ok: false, executed_count: 0, blocked_by: blocks }, 1);
    }
    const args = { sandboxRoot: job.sandbox_root, atoms: job.atoms, consent, fs: nodeFs };
    if (sub === "verify") {
      const result = verifyStewardRoundTrip(args);
      return emit(
        result.round_trip_ok
          ? result
          : { ...result, required_consent: DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE },
        result.round_trip_ok ? 0 : 1,
      );
    }
    const result = sequenceExecuteStewardJob(args);
    const blocked = result.stopped_at?.blocked_by ?? [];
    return emit(
      {
        schema: DEMA_REVERSIBLE_FILE_STEWARD_EXECUTION_SCHEMA,
        boundary: demaReversibleFileStewardExecutionBoundary(),
        ...result,
        blocked_by: result.ok ? result.blocked_by : [...result.blocked_by, ...blocked],
        ...(result.ok ? {} : { required_consent: DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE }),
      },
      result.ok ? 0 : 1,
    );
  }

  if (sub === "undo") {
    // Undo mutates files (restores from backup), so it is gated by the same exact
    // execute phrase as run/verify — no unconsented filesystem mutation, even in
    // the reversible direction.
    if (consent !== DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE) {
      return emit(
        {
          ok: false,
          blocked_by: ["consent_phrase_mismatch"],
          required_consent: DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE,
        },
        1,
      );
    }
    const path = flagValue(argv, "--receipts");
    if (!path) return emit({ ok: false, blocked_by: ["receipts_flag_missing"], ...USAGE }, 1);
    const { parsed, error } = readJsonFile(path);
    if (error) return emit({ ok: false, blocked_by: [error] }, 1);
    const receipts = Array.isArray(parsed) ? parsed : parsed?.receipts;
    if (!Array.isArray(receipts)) {
      return emit({ ok: false, blocked_by: ["receipts_not_array"] }, 1);
    }
    const result = sequenceUndoStewardJob({ receipts, fs: nodeFs });
    return emit(result, result.ok ? 0 : 1);
  }

  return emit(USAGE, sub === null || sub === "help" ? 0 : 1);
}
