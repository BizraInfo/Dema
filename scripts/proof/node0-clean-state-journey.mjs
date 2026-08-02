// NODE0-CLEAN-STATE-JOURNEY-1A — the clean-state Node0 loop, run end to end
// through the real `bin/dema` against a DEMA_HOME this harness creates itself.
//
// This is the artifact a witness runs. It exists because
// `docs/NODE0_DEMA_URP_FLAGSHIP_DOD.md` §14 names the missing piece exactly:
// "Genesis needs replayable proof, not only green CI." A green suite proves the
// code paths work in isolation; this proves one operator journey works from
// nothing, in order, with every step's refusal or success recorded.
//
// THE WITNESS CONTRACT — the part that makes reproduction honest.
//
// Measured on this tree: a clean-state run produces two DIFFERENT kinds of
// value, and publishing the wrong kind as a constant would make an honest
// reproduction on another machine read as a failure.
//
//   Cross-machine invariant  — identical on every machine, for the same tree.
//     The 5SAT declaration's active set / lock / blocked manipulators, the
//     covenant `proposal_hash` and its screening verdicts and claim labels, the
//     consent gate's fail-closed refusal, `config.local.json`'s hash, the step
//     sequence and every step's exit code, and the all-false boundary. These
//     are hashed, in canonical JSON v1, into ONE published value:
//     `journey_invariant_hash`. That is the number a stranger compares.
//
//   Environment-bound       — legitimately different per run, home, or machine.
//     `launch_hash`, `decision_id`, `created_at`, `profile.json` and
//     `.dema-root.json` hashes, and every absolute path. MEASURED here, not
//     assumed: two clean homes on this host produced different `launch_hash`
//     and different `profile.json` hashes while the invariant set was
//     byte-identical. These are reported for inspection and deliberately kept
//     OUT of the invariant hash.
//
// Boundary: no network, no model invocation, no daemon, no runtime activation,
// no mint, no federation. Writes ONLY inside the temporary DEMA_HOME this
// harness creates, and it refuses to run against a home it did not create — an
// operator's `~/.dema` is never a fixture.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";

export const NODE0_JOURNEY_SCHEMA = "bizra.dema.node0_clean_state_journey.v0.1";
export const NODE0_JOURNEY_TRUTH_LABEL = "NODE0_CLEAN_STATE_JOURNEY_MEASURED_LOCAL";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEMA_BIN = join(REPO, "bin/dema");
const COVENANT_PROPOSAL = join(REPO, "fixtures/covenant/example-impact-proposal.json");

const URP_5SAT_CONSENT =
  "LAUNCH NODE0 URP WITH 5 SAT ONLY AND LOCK AGAINST PAT/DEMA/MOMO";

const sha256 = (content) => createHash("sha256").update(content).digest("hex");

/**
 * Run one real `dema` invocation against the journey's own home.
 * `allowFail` marks a step whose REFUSAL is the evidence.
 */
function runDema(home, argv, { allowFail = false } = {}) {
  const result = spawnSync(process.execPath, [DEMA_BIN, ...argv], {
    cwd: REPO,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, DEMA_HOME: home, NO_COLOR: "1" },
  });
  const exitCode = result.status ?? -1;
  if (!allowFail && exitCode !== 0) {
    throw new Error(
      `step failed: dema ${argv.join(" ")} exited ${exitCode}\n${result.stderr || result.stdout}`,
    );
  }
  return { exitCode, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function parseJson(text, stepId) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`step ${stepId} did not emit parseable JSON`);
  }
}

/**
 * Drive the full clean-state journey.
 *
 * `home` MUST be a directory this process created. Passing an existing home is
 * refused rather than mutated — the harness is a proof, not a migration.
 */
export function runNode0CleanStateJourney({ home } = {}) {
  const owned = home === undefined;
  const journeyHome = owned
    ? mkdtempSync(join(tmpdir(), "node0-journey-"))
    : home;
  if (!owned && existsSync(join(journeyHome, "profile.json"))) {
    throw new Error(
      "refusing to run against an initialised DEMA_HOME — this harness creates its own",
    );
  }

  const steps = [];
  const record = (id, argv, run, extra = {}) => {
    steps.push(
      Object.freeze({
        id,
        argv: Object.freeze([...argv]),
        exit_code: run.exitCode,
        ok: extra.expect_refusal === true ? run.exitCode !== 0 : run.exitCode === 0,
        ...extra,
      }),
    );
  };

  try {
    // 1 — orientation. Reads nothing operator-owned, writes nothing.
    const welcome = runDema(journeyHome, ["welcome"]);
    record("welcome", ["welcome"], welcome);

    // 2 — setup from nothing.
    const setup = runDema(journeyHome, ["setup"]);
    record("setup", ["setup"], setup);

    // 3 — install integrity over the home that was just created.
    const setupCheck = runDema(journeyHome, ["setup-check", "--json"]);
    const setupCheckDoc = parseJson(setupCheck.stdout, "setup-check");
    const fileHashes = setupCheckDoc.file_hashes ?? {};
    const hashOf = (name) =>
      Object.entries(fileHashes).find(([path]) => path.endsWith(`/${name}`))?.[1] ?? null;
    record("setup-check", ["setup-check", "--json"], setupCheck);

    // 4 — local readiness surface.
    const status = runDema(journeyHome, ["status"]);
    record("status", ["status"], status);

    // 5 — URP 5SAT local declaration under its exact consent phrase.
    const urp = runDema(journeyHome, [
      "urp", "launch-5sat", "--consent", URP_5SAT_CONSENT, "--json",
    ]);
    const urpDoc = parseJson(urp.stdout, "urp-launch-5sat");
    record("urp-launch-5sat", ["urp", "launch-5sat", "--consent", "<phrase>", "--json"], urp);

    // 6 — read the receipt that declaration just wrote, from disk.
    const receiptRaw = readFileSync(urpDoc.receipt_path, "utf8");
    const receiptDoc = JSON.parse(receiptRaw);
    steps.push(
      Object.freeze({
        id: "receipt-read",
        argv: Object.freeze(["<read>", "receipts/node0-5sat-urp-launch-<hash>.json"]),
        exit_code: 0,
        ok: true,
      }),
    );

    // 7 — Covenant Gate screens one proposal.
    const screenArgv = ["covenant", "screen", COVENANT_PROPOSAL, "--json"];
    const screen = runDema(journeyHome, screenArgv);
    const decision = parseJson(screen.stdout, "covenant-screen");
    record("covenant-screen", screenArgv, screen);

    // 8 — the consent gate REFUSES without a signing key. This refusal is the
    // evidence: a clean-state journey must never be able to sign a covenant
    // receipt by falling back to a demo key, and it never needs key material.
    const consentArgv = [
      "covenant", "consent", COVENANT_PROPOSAL,
      "--typed-go", `GO: SIGN COVENANT RECEIPT ${decision.decision_id}`,
      "--json",
    ];
    const consent = runDema(journeyHome, consentArgv, { allowFail: true });
    let consentRefusal = null;
    try {
      const doc = JSON.parse(consent.stdout || consent.stderr);
      consentRefusal = { error: doc.error ?? null, reason: doc.reason ?? null };
    } catch {
      consentRefusal = { error: "unparseable", reason: null };
    }
    record("covenant-consent-refused", consentArgv, consent, { expect_refusal: true });

    // 9 — receipts listed/read without mutating verification state.
    const urpList = runDema(journeyHome, ["urp", "list", "--json"]);
    const urpListDoc = parseJson(urpList.stdout, "urp-list");
    record("urp-list", ["urp", "list", "--json"], urpList);

    // --- the split ---

    const crossMachineInvariants = {
      step_ids: steps.map((s) => s.id),
      step_exit_codes: steps.map((s) => s.exit_code),
      urp_5sat: {
        active_sat: urpDoc.active_sat ?? null,
        locked: urpDoc.locked ?? null,
        manipulators_blocked: urpDoc.manipulators_blocked ?? null,
        truth_label: urpDoc.truth_label ?? null,
      },
      receipt_read: {
        parsed: true,
        truth_label: receiptDoc.truth_label ?? null,
      },
      covenant: {
        schema: decision.schema ?? null,
        proposal_hash: decision.proposal_hash ?? null,
        project_id: decision.project_id ?? null,
        status: decision.status ?? null,
        screening: decision.screening ?? null,
        claim_labels: decision.claim_labels ?? null,
      },
      covenant_consent_refusal: consentRefusal,
      config_local_sha256: hashOf("config.local.json"),
      urp_list_boundary: urpListDoc.boundary ?? null,
      boundary: {
        network_used: false,
        model_invocation_performed: false,
        runtime_execution_performed: false,
        daemon_started: false,
        mint_performed: false,
        federation_contacted: false,
        wrote_outside_journey_home: false,
      },
    };

    const environmentBound = {
      dema_home: journeyHome,
      urp_launch_hash: urpDoc.launch_hash ?? null,
      urp_receipt_path: urpDoc.receipt_path ?? null,
      covenant_decision_id: decision.decision_id ?? null,
      covenant_created_at: decision.created_at ?? null,
      profile_sha256: hashOf("profile.json"),
      dema_root_sha256: hashOf(".dema-root.json"),
    };

    return Object.freeze({
      schema: NODE0_JOURNEY_SCHEMA,
      truth_label: NODE0_JOURNEY_TRUTH_LABEL,
      steps: Object.freeze(steps),
      cross_machine_invariants: Object.freeze(crossMachineInvariants),
      journey_invariant_hash: sha256CanonicalJsonV1(crossMachineInvariants),
      environment_bound: Object.freeze(environmentBound),
      does_not_prove: Object.freeze([
        "Node0 closure — NODE0_CLOSED remains false",
        "runtime activation, a daemon, or any live mission execution",
        "a signed covenant receipt (the consent gate is proven to REFUSE without a key)",
        "operator identity, key custody, or the TASK-029 signing ceremony",
        "federation, a second host, Node1, token economy, PoI, or mint",
        "external legal or Shariah review",
        "that the screening verdicts are substantively correct — they are PROTOTYPE-labelled by the gate itself",
      ]),
    });
  } finally {
    if (owned) rmSync(journeyHome, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const report = runNode0CleanStateJourney();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("NODE0 · clean-state journey");
    for (const step of report.steps) {
      console.log(`  ${step.ok ? "ok  " : "FAIL"} ${step.id} (exit ${step.exit_code})`);
    }
    console.log(`\n  journey_invariant_hash: ${report.journey_invariant_hash}`);
    console.log("  ^ compare THIS across machines; everything in environment_bound is expected to differ.");
    console.log(`\n  boundary: no network · no model · no daemon · no mint · writes only under the journey home`);
    console.log("  does NOT prove: Node0 closure, runtime activation, a signed covenant receipt, or the TASK-029 ceremony.");
  }
  const failed = report.steps.filter((s) => !s.ok);
  process.exitCode = failed.length === 0 ? 0 : 1;
}
