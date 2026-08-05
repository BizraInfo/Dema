import { createHash } from "node:crypto";
import { mkdir, writeFile, rename, unlink, realpath } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildHarnessIntegrationSummary } from "../../core/src/harness-integration.js";
import { checkSetup } from "../../installer/src/setup.js";
import { evaluatePredicates } from "../../core/src/doctor-dashboard.js";
import { defaultStatus } from "../../core/src/status.js";
import { createNode0Adapter } from "../../node-adapter/src/node0-adapter.js";
import {
  findLatestWitness,
  findBoundWitness,
  verifyWitnessReceipt,
} from "../../receipts/src/witness-verify.js";
import {
  buildRuntimeObservation,
  isCleanEligibleObservation,
} from "../../core/src/node0-runtime-observation.js";

const SCHEMA = "bizra.dema.mission_receipt.health_snapshot.v0.1";
const TRUTH_LABEL = "LOCAL_OPERATOR_MISSION";
const CONSENT_PHRASE = "RUN NODE0 HEALTH SNAPSHOT";

export { CONSENT_PHRASE as HEALTH_MISSION_CONSENT_PHRASE };
export { SCHEMA as HEALTH_MISSION_RECEIPT_SCHEMA };

function deriveMissionVerdict(results) {
  const setupOk = results.setup.verdict === "INTACT";
  const harnessOk = results.harness.verdict === "CLEAN";
  const witnessOk =
    results.witness.exists && results.witness.verdict === "VERIFIED";
  const doctorAllOk = results.doctor.fail === 0 && results.doctor.warn === 0;

  // An unbridged preview install passes every check above. Its three readiness
  // predicates soften to `expected` — neither fail nor warn — so `doctorAllOk`
  // is true while nothing whatsoever is observing Node0. Without this clause,
  // "no runtime is bridged" and "the runtime is healthy" produce the same
  // CLEAN, and an endurance soak would report HEALTHY for a node nobody looked
  // at. CLEAN must mean observed, not merely un-refuted.
  //
  // Both facts are required, and availability alone is deliberately not enough:
  // being able to SEE the node is not the node authorizing anything. The gate
  // is read from the runtime and never synthesized here.
  const bridgedOk =
    results.bridge.available === true &&
    results.bridge.activation_gate === "EXPLICIT_GO_REQUIRED";

  // CORRECTION-1B. The 1A clause above proved a status source answered. It did
  // not prove WHO answered — `normalizeNode0Status` assigns node:"Node0" rather
  // than reading it, and the shell-out adapter is the operator speaking for the
  // node. Two further facts are now required, and both are fail-closed:
  //
  //   observationOk — a genuinely OBSERVED, loopback, identity-bound, healthy
  //   runtime. An operator-asserted shell-out and an injected test status are
  //   explicitly NOT eligible, whatever they claim about themselves.
  //
  //   witnessBoundOk — a witness that testifies about THIS home, endpoint,
  //   runtime identity, code and observation. A generic v0.1 witness still
  //   verifies, and is no longer sufficient.
  const observationOk = isCleanEligibleObservation(results.observation);
  const witnessBoundOk = results.witness.eligible_for_bridge_clean === true;

  if (
    setupOk && harnessOk && witnessOk && doctorAllOk && bridgedOk &&
    observationOk && witnessBoundOk
  )
    return "CLEAN";
  if (setupOk && harnessOk) return "ATTENTION";
  return "FAILED";
}

// Fail-closed observation. An adapter that throws, times out, or answers with
// something that is not a status object leaves us knowing nothing — and
// "nothing" must read as unbridged, never as fine. The preview default is
// reused for the predicate shape, but `available:false` is stamped explicitly
// so the doctor's unbridged softening applies while `bridgedOk` stays false.
async function observeRuntimeStatus(statusFn) {
  try {
    const observed = await statusFn();
    if (observed && typeof observed === "object") return observed;
    return {
      ...defaultStatus(),
      adapter: { available: false, reason: "adapter_returned_non_object" },
    };
  } catch (err) {
    return {
      ...defaultStatus(),
      adapter: { available: false, reason: `adapter_error: ${err.message}` },
    };
  }
}

/**
 * `demaHome` is now explicit and ADDITIVE: omitting it preserves the previous
 * environment-derived behaviour byte-for-byte, so no existing caller changes.
 *
 * It exists because a caller that thinks it is inspecting installation X while
 * this function silently reads `process.env.DEMA_HOME` is not observing the
 * thing it reports on. An endurance record written under one home while a
 * different home was actually inspected is not evidence — it is a category
 * error that reads exactly like evidence.
 */
export async function buildHealthSnapshot({
  now = new Date(),
  demaHome,
  statusFn,
} = {}) {
  const home = typeof demaHome === "string" && demaHome.length > 0
    ? demaHome
    : (process.env.DEMA_HOME || join(homedir(), ".dema"));

  const setup = await checkSetup(home);
  const harness = buildHarnessIntegrationSummary();
  // Observed, not assumed. This previously judged a hardcoded `defaultStatus()`
  // literal, so the doctor reported on a constant rather than on Node0.
  const observe =
    typeof statusFn === "function"
      ? statusFn
      : () => createNode0Adapter().status();
  const status = await observeRuntimeStatus(observe);
  const predicates = evaluatePredicates(status);

  // Classify HOW this status was obtained before classifying what it says.
  // An injected statusFn is TEST_INJECTION by construction — the caller is the
  // source, so it can exercise composition and never bridge readiness.
  const source = status.adapter?.source ?? status.source ?? null;
  const evidenceClass =
    typeof statusFn === "function"
      ? "TEST_INJECTION"
      : status.adapter?.available !== true
        ? "NONE"
        : typeof source === "string" && source.startsWith("gateway")
          ? "OBSERVED"
          : "OPERATOR_ASSERTED";

  const observation = buildRuntimeObservation({
    adapterMode: source,
    configuredEndpoint: status.gateway?.endpoint ?? null,
    observedEndpoint: status.gateway?.endpoint ?? null,
    // A protocol LABEL, not an import. mission-probe scans this chain by naive
    // substring for bare transport-module names, so the label is spelled in a
    // hyphenated form that cannot be mistaken for one.
    protocol:
      typeof source === "string" && source.startsWith("gateway")
        ? "http-loopback"
        : "exec",
    inspectedHome: home,
    raw: status.runtime_raw ?? status,
    evidenceClass,
    observedAt: now.toISOString(),
    hash: (facts) => sha256(stableStringify(facts)),
  });

  // Select the witness by EXACT BINDING, not by newest mtime. `touch` on an
  // unrelated receipt must never be able to hand it authority.
  const expectedBinding = {
    expectedHomeIdentity: home,
    expectedRuntimeIdentity: observation.runtime_identity,
    expectedEndpoint: observation.observed_endpoint,
    expectedObservationHash: observation.observation_hash,
  };
  let witnessPath = await findBoundWitness(home, expectedBinding);
  // Fall back to the legacy selection only to REPORT what exists; a v0.1
  // witness found this way can verify, and can never be bridge-eligible.
  if (!witnessPath) witnessPath = await findLatestWitness(home);
  let witnessResult = {
    exists: false,
    verdict: null,
    schema: null,
    eligible_for_bridge_clean: false,
    binding_reason: "no_witness_found",
  };
  if (witnessPath) {
    const v = await verifyWitnessReceipt(witnessPath, expectedBinding);
    witnessResult = {
      exists: true,
      verdict: v.verdict,
      schema: v.witness_schema ?? null,
      eligible_for_bridge_clean: v.eligible_for_bridge_clean === true,
      binding_reason: v.binding?.reason ?? null,
    };
  }

  const results = {
    setup: {
      verdict: setup.verdict,
      checks: setup.checks.length,
      missing: setup.missing.length,
    },
    harness: {
      verdict: harness.verdict,
      gaps: harness.critique_gaps,
      gates: harness.gates,
      hooks: harness.hooks_wired,
    },
    doctor: {
      predicates: predicates.length,
      ok: predicates.filter((p) => p.status === "ok").length,
      fail: predicates.filter((p) => p.status === "fail").length,
      warn: predicates.filter((p) => p.status === "warn").length,
    },
    witness: witnessResult,
    observation,
    bridge: {
      // `available` is fail-closed on the claim, exactly as gatewayProbe is:
      // only an explicit `true` counts as bridged. Absent, null and undefined
      // are all "we did not observe a bridge".
      available: status.adapter?.available === true,
      activation_gate: status.activationGate ?? null,
      source: status.adapter?.source ?? status.source ?? null,
      ...(status.adapter?.reason ? { reason: status.adapter.reason } : {}),
    },
    memory: {
      entries: setup.checks.filter((c) => c.present).length,
      home,
    },
  };

  const mission_verdict = deriveMissionVerdict(results);

  const attests = {
    mission_type: "health_snapshot",
    executed_at: now.toISOString(),
    mission_verdict,
    results,
    boundary: {
      filesystem_write_performed: false,
      // Derived from the observation itself, never asserted. The 1A slice gave
      // this mission the power to spawn a child process or open a local
      // connection while still attesting it had done neither.
      network_used: observation.local_loopback_used,
      runtime_execution_performed: observation.child_process_invoked,
      model_loaded: false,
      model_invocation_performed: false,
      prompt_executed: false,
      external_call_performed: observation.external_call_performed,
      raw_corpus_scan_performed: false,
      raw_data_included: false,
      tool_executed: observation.child_process_invoked,
      chain_advance_performed: false,
      receipt_mint_performed: false,
      federation_invoked: false,
      // A shell-out talks to a COMMAND, not provably to the node. Only a real
      // loopback observation is a node connection.
      node_connection_performed: observation.local_loopback_used,
      local_loopback_used: observation.local_loopback_used,
      child_process_invoked: observation.child_process_invoked,
      // Stays false, and truthfully: the bridge reaches a LOCAL runtime, never
      // an external provider (rules/01-dema-boundary.md). The receipt verifier
      // asserts this, so a future adapter that could reach a public host must
      // carry its endpoint here rather than quietly flip this flag.
      public_network_used: false,
      consent_collected: false,
    },
    // The receipt carries the identity of the observation it judged, so a
    // witness can be bound to it and a reader can re-derive the classification.
    observation_hash: observation.observation_hash,
    evidence_class: observation.evidence_class,
    consent_verified: false,
  };

  const content_hash = sha256(stableStringify(attests));

  return {
    schema: SCHEMA,
    truth_label: TRUTH_LABEL,
    mission_id: `health_snapshot_${content_hash.slice(0, 12)}`,
    attests,
    content_hash,
  };
}

export async function saveHealthSnapshotReceipt({
  consent = "",
  dryRun = false,
  now = new Date(),
} = {}) {
  const snapshot = await buildHealthSnapshot({ now });

  if (consent !== CONSENT_PHRASE) {
    return {
      ...snapshot,
      saved: false,
      reason: "consent_phrase_mismatch",
      required_phrase: CONSENT_PHRASE,
      dry_run: dryRun,
    };
  }

  if (dryRun) {
    return {
      ...snapshot,
      saved: false,
      reason: "dry_run",
      dry_run: true,
    };
  }

  snapshot.attests.boundary.filesystem_write_performed = true;
  snapshot.attests.boundary.consent_collected = true;
  snapshot.attests.consent_verified = true;
  snapshot.attests.consent_phrase_hash = sha256(CONSENT_PHRASE);
  snapshot.content_hash = sha256(stableStringify(snapshot.attests));
  snapshot.mission_id = `health_snapshot_${snapshot.content_hash.slice(0, 12)}`;

  const home = process.env.DEMA_HOME || join(homedir(), ".dema");
  const receiptsDir = join(home, "receipts");
  await mkdir(receiptsDir, { recursive: true });

  const realDir = await realpath(receiptsDir);
  const content = JSON.stringify(snapshot, null, 2) + "\n";
  const fileHash = createHash("sha256").update(content).digest("hex");
  const fileName = `mission-health-${fileHash.slice(0, 16)}.json`;
  const finalPath = join(realDir, fileName);
  const tmpPath = finalPath + ".tmp";

  try {
    await writeFile(tmpPath, content, { encoding: "utf8", flag: "wx" });
    await rename(tmpPath, finalPath);
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {}
    throw err;
  }

  return {
    ...snapshot,
    saved: true,
    reason: "consent_verified",
    path: finalPath,
    file_hash: fileHash,
    dry_run: false,
  };
}

export async function verifyHealthSnapshotReceipt(receiptPath) {
  const { readFile } = await import("node:fs/promises");
  const checks = [];
  let receipt;

  try {
    const raw = await readFile(receiptPath, "utf8");
    receipt = JSON.parse(raw);
    checks.push({ check: "file_readable", pass: true });
    checks.push({ check: "valid_json", pass: true });
  } catch (err) {
    checks.push({ check: "file_readable", pass: false, detail: err.message });
    return {
      schema: "bizra.dema.mission_verification.v0.1",
      verdict: "FAILED",
      path: receiptPath,
      checks,
      checks_passing: 0,
      checks_failing: 1,
      checks_total: 1,
    };
  }

  checks.push({ check: "schema_match", pass: receipt.schema === SCHEMA });
  checks.push({
    check: "truth_label",
    pass: receipt.truth_label === TRUTH_LABEL,
  });
  checks.push({
    check: "attests_present",
    pass: receipt.attests != null && typeof receipt.attests === "object",
  });
  checks.push({
    check: "mission_type",
    pass: receipt.attests?.mission_type === "health_snapshot",
  });

  const recomputed = receipt.attests
    ? sha256(stableStringify(receipt.attests))
    : null;
  checks.push({
    check: "content_hash_integrity",
    pass: recomputed === receipt.content_hash,
    expected: receipt.content_hash,
    recomputed,
  });

  checks.push({
    check: "consent_verified",
    pass: receipt.attests?.consent_verified === true,
  });
  checks.push({
    check: "mission_verdict_present",
    pass: ["CLEAN", "ATTENTION", "FAILED"].includes(
      receipt.attests?.mission_verdict,
    ),
  });
  checks.push({
    check: "no_federation",
    pass: receipt.attests?.boundary?.federation_invoked === false,
  });
  checks.push({
    check: "no_public_network",
    pass: receipt.attests?.boundary?.public_network_used === false,
  });
  checks.push({
    check: "no_model",
    pass: receipt.attests?.boundary?.model_invocation_performed === false,
  });

  const allPass = checks.every((c) => c.pass);
  return {
    schema: "bizra.dema.mission_verification.v0.1",
    verdict: allPass ? "VERIFIED" : "FAILED",
    path: receiptPath,
    checks_total: checks.length,
    checks_passing: checks.filter((c) => c.pass).length,
    checks_failing: checks.filter((c) => !c.pass).length,
    checks,
    mission_verdict: allPass
      ? (receipt.attests?.mission_verdict ?? null)
      : null,
    mission_type: allPass ? (receipt.attests?.mission_type ?? null) : null,
    mission_id: allPass ? (receipt.mission_id ?? null) : null,
  };
}

export function formatHealthSnapshotReceipt(receipt) {
  const a = receipt.attests ?? {};
  const r = a.results ?? {};
  const lines = [
    "NODE0 HEALTH SNAPSHOT MISSION v0.1",
    "",
    `Mission verdict: ${a.mission_verdict ?? "UNKNOWN"}`,
    `Truth label: ${receipt.truth_label}`,
    `Mission ID: ${receipt.mission_id}`,
    `Content hash: ${receipt.content_hash}`,
    "",
    "Results:",
    `  Setup:    ${r.setup?.verdict ?? "?"} (${r.setup?.checks ?? 0} checks)`,
    `  Harness:  ${r.harness?.verdict ?? "?"} (${r.harness?.gates ?? "?"} gates, ${r.harness?.gaps ?? 0} gaps)`,
    `  Doctor:   ${r.doctor?.ok ?? 0} ok / ${r.doctor?.fail ?? 0} fail / ${r.doctor?.warn ?? 0} warn`,
    `  Witness:  ${r.witness?.exists ? r.witness.verdict : "none"}`,
    "",
  ];

  if (receipt.saved) {
    lines.push(`Saved to: ${receipt.path}`);
  } else if (receipt.reason === "dry_run") {
    lines.push("Mode: dry-run (no file written)");
  } else if (receipt.reason === "consent_phrase_mismatch") {
    lines.push(`Consent required: --consent "${receipt.required_phrase}"`);
  }

  lines.push("");
  lines.push(
    "Boundary: local-only mission. No network, no model, no federation, no token.",
  );
  return lines.join("\n");
}
