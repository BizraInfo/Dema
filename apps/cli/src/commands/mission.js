import { createNode0Adapter } from "../../../../packages/node-adapter/src/node0-adapter.js";
import {
  buildHealthSnapshot,
  saveHealthSnapshotReceipt,
  verifyHealthSnapshotReceipt,
  formatHealthSnapshotReceipt,
} from "../../../../packages/mission/src/health-snapshot.js";
import {
  buildMissionDraftPreview,
  formatMissionDraftPreview,
} from "../../../../packages/mission/src/mission-draft.js";
import {
  buildMissionManifest,
  formatMissionManifest,
} from "../../../../packages/mission/src/mission-manifest.js";
import {
  runMissionProbe,
  renderProbeText,
} from "../../../../packages/mission/src/mission-probe.js";
import {
  resolveMissionReceipt,
  buildCloseoutReport,
  renderCloseoutText,
} from "../../../../packages/mission/src/mission-closeout.js";
import { previewBoundedDiagnostic } from "../../../../packages/core/src/mission.js";
import { buildPainGoalInterview } from "../../../../packages/core/src/pain-goal-interview.js";
import { buildClosedDualLoopDryRun } from "../../../../packages/core/src/closed-dual-loop-dry-run.js";
import { buildMissionReplayReport } from "../../../../packages/core/src/node0-mission-replay-preview.js";
import {
  wantsJson,
  humanHintLine,
} from "../../../../packages/core/src/output-mode.js";
import { statusWithLocalIdentity } from "../lib/status-identity.js";

// NODE0-LOCAL-MISSION-HARNESS-PREVIEW-1A — `dema mission pulse <file>` effect layer.
import { mkdir, readFile as readFileFs, readdir, realpath, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, isAbsolute, resolve } from "node:path";
import { createHash } from "node:crypto";
import { generateEd25519Keypair } from "../../../../packages/receipts/src/authorship-signature.js";
import { buildNode0ProofChainLinkPayload } from "../../../../packages/core/src/node0-proof-chain-link.js";
import { signChainHead, NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE } from "../../../../packages/core/src/node0-signed-chain-head.js";
import {
  buildNode0UrpGenesisRootActivationPreviewPayload,
  exampleGenesisRootInput,
} from "../../../../packages/core/src/node0-urp-genesis-root-activation-preview.js";
import {
  buildNode0UrpGenesisRootCompositionGatePreviewPayload,
  exampleCompositionInput,
} from "../../../../packages/core/src/node0-urp-genesis-root-composition-gate-preview.js";
import {
  runNode0LocalMissionHarnessPreview,
  buildNode0LocalMissionHarnessPreviewPayload,
  NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE,
} from "../../../../packages/core/src/node0-local-mission-harness-preview.js";
import {
  runNode0LocalMissionArtifactEmissionPreview,
  buildNode0LocalMissionArtifactEmissionPreviewPayload,
  ARTIFACT_NAMES,
  NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_GO_PHRASE,
} from "../../../../packages/core/src/node0-local-mission-artifact-emission-preview.js";
import {
  runNode0MissionPilotCockpitPreview,
  NODE0_MISSION_PILOT_COCKPIT_PREVIEW_GO_PHRASE,
} from "../../../../packages/core/src/node0-mission-pilot-cockpit-preview.js";
import {
  runNode0MissionHarnessReturnReviewPreview,
  NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_GO_PHRASE,
} from "../../../../packages/core/src/node0-mission-harness-return-review-preview.js";
import {
  runNode0LocalUrpShelfIndexPreview,
  buildNode0LocalUrpShelfIndexPreviewPayload,
  NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_GO_PHRASE,
} from "../../../../packages/core/src/node0-local-urp-shelf-index-preview.js";
import {
  runNode0ReceiptShelfCompactionStatePreview,
  NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_GO_PHRASE,
} from "../../../../packages/core/src/node0-receipt-shelf-compaction-state-preview.js";
import { createHash as createHashE2e } from "node:crypto";
import {
  runNode0MaterializationPulseE2ePreview,
  NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_GO_PHRASE,
} from "../../../../packages/core/src/node0-materialization-pulse-e2e-preview.js";

// A benign built-in demo mission for `dema mission run <file>`: the file's real text is the sanitize
// input; the structured parts (one plan branch, a testimony claim, a PERMIT verdict) are a fixed demo.
function buildDemoMission(fileText, fileSource) {
  const niyyahHash = `sha256:${createHashE2e("sha256").update(`niyyah:${fileSource}`, "utf8").digest("hex")}`;
  return {
    mission_id: "dema-mission-run-demo",
    pulse_id: "dema-pulse-run-demo",
    niyyah_hash: niyyahHash,
    file_text: fileText,
    file_source: fileSource,
    plan: {
      mission_id: "dema-mission-run-demo",
      niyyah_hash: niyyahHash,
      chosen_branch_id: "read-only-preview",
      branches: [{ id: "read-only-preview", title: "Preview-only", summary: "Bind evidence, no execution.", risk_score: 0.1, ihsan_score: 0.95, estimated_cost: 1, consent_required: false, authority_delta: 0, evidence_refs: [] }],
      rejected_branches: [],
    },
    fate: { verdict: "PERMIT", authority_delta: 0, grants_action: false, mint_allowed: false },
    claims: { claims: [{ id: "testimony", text: "founder work", metric: "founder_hours", asserted_value: 3, kind: "testimony" }], evidence: {} },
  };
}

// Testable I/O core for `dema mission run <file>`: reads one file read-only, runs it end-to-end through
// the assembled Materialization Pulse stations. No model, no network, no write.
export async function runMissionRun({ filePath } = {}) {
  const abs = filePath && isAbsolute(filePath) ? resolve(filePath) : filePath;
  let text;
  try {
    text = await readFileFs(abs, "utf8");
  } catch (err) {
    return { ok: false, reason_code: err?.code === "ENOENT" ? "file_not_found" : "read_failed", file: abs, result: null };
  }
  const result = runNode0MaterializationPulseE2ePreview({
    consent: NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_GO_PHRASE,
    input: { mission: buildDemoMission(text, abs) },
  });
  return { ok: result.ok, result, file: abs };
}

export const MISSION_EXCERPT_GO_PHRASE = "GO: include local excerpt in mission packet";

// Shared read-only receipt reader — used by `dema mission shelf` and `dema mission compact`.
async function readMissionReceipts(demaHome) {
  const home = demaHome || process.env.DEMA_HOME || join(homedir(), ".dema");
  const dir = join(home, "mission", "receipts");
  let names;
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith(".json"));
  } catch {
    names = []; // no dir yet = empty shelf, not an error
  }
  const receipts = [];
  for (const name of names.sort()) {
    try {
      receipts.push(JSON.parse(await readFileFs(join(dir, name), "utf8")));
    } catch {
      // a corrupt file is skipped (it is not a valid receipt)
    }
  }
  return { receipts, dir, files_seen: names.length };
}

// Testable I/O core for `dema mission shelf`. Reads the receipts dir and composes the shelf index.
export async function runMissionShelf({ demaHome } = {}) {
  const { receipts, dir, files_seen } = await readMissionReceipts(demaHome);
  const result = runNode0LocalUrpShelfIndexPreview({
    consent: NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_GO_PHRASE,
    input: { receipts },
  });
  return { ok: result.ok, result, receipts_dir: dir, files_seen };
}

// Testable I/O core for `dema mission compact`. Reads receipts → shelf payload → compacted state.
export async function runMissionCompact({ demaHome } = {}) {
  const { receipts, dir, files_seen } = await readMissionReceipts(demaHome);
  const shelf = buildNode0LocalUrpShelfIndexPreviewPayload({ receipts });
  const result = runNode0ReceiptShelfCompactionStatePreview({
    consent: NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_GO_PHRASE,
    input: { shelf },
  });
  return { ok: result.ok, result, receipts_dir: dir, files_seen };
}
const EXCERPT_MAX_CHARS = 280;

// Testable I/O core for `dema mission review`. Reads one receipt JSON file (read-only) and runs the
// pure return-review kernel. Never touches process/console.
export async function runMissionReturnReview({ receiptPath }) {
  if (!receiptPath || typeof receiptPath !== "string" || receiptPath.startsWith("--")) {
    return { ok: false, error: "missing_receipt_path" };
  }
  let raw;
  try {
    raw = await readFileFs(await realpath(receiptPath), "utf8");
  } catch {
    return { ok: false, error: "receipt_file_not_found_or_unreadable" };
  }
  let receipt;
  try {
    receipt = JSON.parse(raw);
  } catch {
    return { ok: false, error: "receipt_not_valid_json" };
  }
  const result = runNode0MissionHarnessReturnReviewPreview({
    consent: NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_GO_PHRASE,
    input: { receipt },
  });
  return { ok: result.ok, result };
}

const adapter = createNode0Adapter();

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

// Build an ephemeral composition reference (preview): a fresh signed genesis anchor composed with the
// example URP resource-family surfaces. Keys are ephemeral — no live Node0 identity is bound.
// Exported so a caller (or test) can build ONE ref and inject it for a deterministic run id.
export function buildEphemeralCompositionRef() {
  const keys = generateEd25519Keypair();
  const chain = buildNode0ProofChainLinkPayload([`sha256:${"1".repeat(64)}`, `sha256:${"2".repeat(64)}`]);
  const signedChainHead = signChainHead({
    chain,
    consent: NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE,
    privateKeyPem: keys.private_key_pem,
    publicKeyPem: keys.public_key_pem,
    publicKeyFingerprint: keys.public_key_fingerprint,
  });
  const genesis = buildNode0UrpGenesisRootActivationPreviewPayload(exampleGenesisRootInput(signedChainHead));
  return buildNode0UrpGenesisRootCompositionGatePreviewPayload(exampleCompositionInput(genesis));
}

async function writeMissionReceipt(artifact, demaHome) {
  const home = demaHome || process.env.DEMA_HOME || join(homedir(), ".dema");
  const dir = join(home, "mission", "receipts");
  await mkdir(dir, { recursive: true });
  const realDir = await realpath(dir);
  const finalPath = join(realDir, `${artifact.mission_id}.json`);
  const tmpPath = `${finalPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(artifact, null, 2), { encoding: "utf8", mode: 0o600, flag: "w" });
  await rename(tmpPath, finalPath);
  return finalPath;
}

// Testable I/O core for `dema mission pulse`. Reads one file (read-only), runs the PURE harness kernel,
// optionally writes the receipt. Never touches process/console. demaHome + nowIso are injectable.
export async function runMissionPulseHarness({
  file,
  consent,
  wantReceipt = false,
  excerptConsent,
  claim,
  task,
  boundary,
  demaHome,
  nowIso,
}) {
  if (!file || typeof file !== "string" || file.startsWith("--")) {
    return { ok: false, error: "missing_file_argument" };
  }
  let st;
  try {
    st = await stat(file);
  } catch {
    return { ok: false, error: "file_not_found_or_unreadable" };
  }
  if (st.isDirectory()) return { ok: false, error: "path_is_directory" };

  const real = await realpath(file);
  const bytes = await readFileFs(real); // read-only, to compute the hash
  const content_hash = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const contentReadPerformed = excerptConsent === MISSION_EXCERPT_GO_PHRASE;
  const excerpt = contentReadPerformed ? bytes.toString("utf8").slice(0, EXCERPT_MAX_CHARS) : undefined;

  const file_ref = {
    path: real,
    size_bytes: st.size,
    mtime_iso: st.mtime.toISOString(),
    content_hash,
    content_read_performed: contentReadPerformed,
    raw_content_leaves_node0: false,
    ...(excerpt !== undefined ? { excerpt } : {}),
  };

  const result = runNode0LocalMissionHarnessPreview({
    consent: consent ?? "",
    input: {
      file_ref,
      composition_ref: buildEphemeralCompositionRef(),
      candidate_extraction: { claim, task, boundary },
      now_iso: nowIso ?? null,
    },
  });

  let receiptPath = null;
  if (wantReceipt) {
    if (consent !== NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE) {
      return { ok: false, error: "receipt_requires_consent", result };
    }
    if (result.ok) receiptPath = await writeMissionReceipt(result.receipt_artifact_preview, demaHome);
  }

  return { ok: result.ok, result, receiptPath, source_basename: basename(real) };
}

// NODE0-LOCAL-MISSION-EMIT-CLI-ADAPTER-1A — `dema mission emit <file>` effect layer.
// The OPERATOR's exact write-consent phrase. Distinct from the emission kernel's internal build phrase:
// building the in-memory preview is a pure step; THIS phrase gates the actual disk write.
export const NODE0_LOCAL_MISSION_EMIT_GO_PHRASE = "GO: node0 local mission emit";

// A clearly-labeled generic preview candidate used when the operator supplies no --claim/--task/--boundary.
// The harness performs NO semantic extraction; these are declared placeholders, not Dema's understanding.
const DEFAULT_EMIT_CANDIDATE = Object.freeze({
  claim:
    "PREVIEW (operator did not supply --claim): the operator declares this local file as one preview-mission source; Dema extracted nothing from its content.",
  task: "PREVIEW (operator did not supply --task): record the operator-supplied claim, task, and boundary against this file's content hash.",
  boundary: "No live URP, no mint, no daemon, no model, no network, no source-file mutation.",
});

// The verification ENVELOPE schema + filename. emission.json is the 4th file — a verification envelope,
// NOT a 4th artifact. The operator framing is "three preview artifacts plus one verification envelope".
export const NODE0_LOCAL_MISSION_EMIT_ENVELOPE_SCHEMA = "bizra.dema.node0_local_mission_emit_envelope.v0.1";
export const EMISSION_ENVELOPE_FILENAME = "emission";

// Derive the pulse ladder + reached stations the SAME way the cockpit kernel does (from the harness's
// embedded pulse_verdict.stage_results) — these are a read-only projection of the content-addressed
// emission, not new intelligence.
function deriveEnvelopePulseLadder(emissionPayload) {
  const stages = emissionPayload?.harness_result?.pulse_verdict?.stage_results;
  const ladder = Array.isArray(stages)
    ? stages.map((s) => ({ stage: s?.stage ?? null, ok: s?.ok === true }))
    : [];
  let reached_station = null;
  for (const rung of ladder) {
    if (rung.ok) reached_station = rung.stage;
    else break;
  }
  const reached_stations = ladder.filter((r) => r.ok).map((r) => r.stage);
  return { ladder, reached_station, reached_stations };
}

// Build the verification envelope (emission.json). It WRAPS the untouched, content-addressed emission
// payload under `emission` — the EXACT object the mission-pilot cockpit kernel re-verifies as its
// `input.emission` (harness_result intact) — and mirrors the run id, source-file/emission/harness content
// hashes, per-artifact hashes, artifact relpaths, and the pulse ladder as convenience fields OUTSIDE that
// content-addressed body, so they never alter the emission's own content hash. This is the single file the
// future cockpit reader loads to re-verify the full chain and render the gates panel from disk alone.
export function buildEmissionEnvelope({ emissionPayload, writeConsentAccepted }) {
  const { ladder, reached_station, reached_stations } = deriveEnvelopePulseLadder(emissionPayload);
  const artifacts = emissionPayload?.artifacts ?? {};
  const fileRef = emissionPayload?.harness_result?.receipt_artifact_preview?.file_ref ?? null;
  return {
    schema: NODE0_LOCAL_MISSION_EMIT_ENVELOPE_SCHEMA,
    truth_label: emissionPayload?.truth_label ?? null,
    run_id: emissionPayload?.run_id ?? null,
    source_file_content_hash: fileRef?.content_hash ?? null,
    emission_content_hash: emissionPayload?.content_hash ?? null,
    harness_content_hash: emissionPayload?.harness_result?.content_hash ?? null,
    artifact_hashes: Object.fromEntries(
      ARTIFACT_NAMES.map((n) => [n, artifacts?.[n]?.content_hash ?? null]),
    ),
    artifact_relative_paths: emissionPayload?.artifact_paths ?? [],
    pulse_ladder: ladder,
    reached_station,
    reached_stations,
    consent_status: writeConsentAccepted
      ? "operator write-consent phrase accepted"
      : "operator write-consent phrase NOT accepted",
    boundary: emissionPayload?.boundary ?? null,
    committed_live: false,
    authority_delta: 0,
    mint_allowed: false,
    what_this_proves:
      "A verification envelope for one `dema mission emit` run: it wraps the untouched, content-addressed emission payload (with harness_result intact — the exact object the mission-pilot cockpit kernel re-verifies as its input.emission) under `emission`, and mirrors the run id, source-file / emission / harness content hashes, per-artifact hashes, artifact relative paths, and the pulse ladder as convenience fields OUTSIDE that content-addressed body. It lets the cockpit reader re-verify the full chain (emission -> harness -> pulse -> composition -> signature-backed genesis anchor) and render the gates panel from disk alone.",
    what_this_does_not_prove:
      "The envelope adds no new intelligence and records nothing live: its convenience fields are a read-only projection of the nested content-addressed emission (the source of truth). It carries only metadata, content hashes, a PUBLIC key, and all-false boundary attestations — no raw source content, no private key, no DID secret, no wallet. Writing an envelope is not executing a mission; committed_live false, authority_delta 0, mint_allowed false.",
    emission: emissionPayload ?? null,
  };
}

// Atomic write of the three emission artifacts + the verification envelope under
// $DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/. Per file: writeFile(tmp, …, {mode:0o600})
// then rename(tmp, final). Writes NOTHING outside the run_id dir. The three artifacts come from the SAME
// content-addressed emission payload embedded in the envelope, so on-disk artifacts and envelope agree.
async function writeEmissionArtifacts(emissionPayload, envelope, demaHome) {
  const home = demaHome || process.env.DEMA_HOME || join(homedir(), ".dema");
  const dir = join(home, "artifacts", "proofs", "node0-local-mission", emissionPayload.run_id);
  await mkdir(dir, { recursive: true });
  const realDir = await realpath(dir);
  const writeOne = async (name, obj) => {
    const finalPath = join(realDir, `${name}.json`);
    const tmpPath = `${finalPath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(obj, null, 2), { encoding: "utf8", mode: 0o600, flag: "w" });
    await rename(tmpPath, finalPath);
    return finalPath;
  };
  const written = [];
  for (const name of ARTIFACT_NAMES) {
    written.push(await writeOne(name, emissionPayload.artifacts[name]));
  }
  const envelopePath = await writeOne(EMISSION_ENVELOPE_FILENAME, envelope);
  return { dir: realDir, written, envelopePath };
}

// Testable I/O core for `dema mission emit <file>`. Reads one explicit, absolute local file (read-only),
// computes a REAL file_ref, composes the shipped harness → emission preview path, and — ONLY under the
// exact operator write-consent phrase AND a verified emission — atomically writes the three artifacts.
// Never touches process/console. demaHome, nowIso, and compositionRef are injectable (the ref defaults to
// a fresh ephemeral one; injecting a fixed ref makes the run id deterministic for the same input).
export async function runMissionEmit({
  file,
  consent,
  claim,
  task,
  boundary,
  excerptConsent,
  demaHome,
  nowIso,
  compositionRef,
} = {}) {
  if (!file || typeof file !== "string" || file.startsWith("--")) {
    return { ok: false, error: "missing_file_argument" };
  }
  if (!isAbsolute(file)) {
    return { ok: false, error: "path_must_be_absolute" };
  }
  let st;
  try {
    st = await stat(file);
  } catch {
    return { ok: false, error: "file_not_found_or_unreadable" };
  }
  if (st.isDirectory()) return { ok: false, error: "path_is_directory" };

  const real = await realpath(file);
  const bytes = await readFileFs(real); // read-only, to compute the hash
  const content_hash = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const contentReadPerformed = excerptConsent === MISSION_EXCERPT_GO_PHRASE;
  const excerpt = contentReadPerformed ? bytes.toString("utf8").slice(0, EXCERPT_MAX_CHARS) : undefined;

  const file_ref = {
    path: real,
    size_bytes: st.size,
    mtime_iso: st.mtime.toISOString(),
    content_hash,
    content_read_performed: contentReadPerformed,
    raw_content_leaves_node0: false,
    ...(excerpt !== undefined ? { excerpt } : {}),
  };

  const candidate_extraction = {
    claim: claim ?? DEFAULT_EMIT_CANDIDATE.claim,
    task: task ?? DEFAULT_EMIT_CANDIDATE.task,
    boundary: boundary ?? DEFAULT_EMIT_CANDIDATE.boundary,
  };

  // Compose the shipped harness → emission path. The emission kernel's own GO phrase gates only the
  // in-memory PREVIEW build (no side effect); the operator's write-consent gates the disk write below.
  const harness_result = buildNode0LocalMissionHarnessPreviewPayload({
    file_ref,
    composition_ref: compositionRef ?? buildEphemeralCompositionRef(),
    candidate_extraction,
    now_iso: nowIso ?? null,
  });
  const emissionInput = { harness_result, now_iso: nowIso ?? null };
  const emission = runNode0LocalMissionArtifactEmissionPreview({
    consent: NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_GO_PHRASE,
    input: emissionInput,
  });
  // The content-addressed emission PAYLOAD (deterministic for the same input; content_hash equals the
  // run result's). This is the exact object the cockpit kernel re-verifies; the envelope embeds it.
  const emissionPayload = buildNode0LocalMissionArtifactEmissionPreviewPayload(emissionInput);

  // Fail-closed write gate: the exact operator phrase AND a verified emission are both required to write.
  const writeConsentOk = consent === NODE0_LOCAL_MISSION_EMIT_GO_PHRASE;
  const envelope = buildEmissionEnvelope({ emissionPayload, writeConsentAccepted: writeConsentOk });
  let wrote = false;
  let run_dir = null;
  let artifact_paths_written = [];
  let envelope_path_written = null;
  if (writeConsentOk && emission.ok) {
    const w = await writeEmissionArtifacts(emissionPayload, envelope, demaHome);
    wrote = true;
    run_dir = w.dir;
    artifact_paths_written = w.written; // the THREE artifacts
    envelope_path_written = w.envelopePath; // the verification envelope (emission.json)
  }

  return {
    ok: emission.ok,
    wrote,
    write_refused_reason: writeConsentOk ? null : "write_consent_required",
    run_id: emission.run_id,
    content_hash: emission.content_hash,
    emission,
    envelope,
    run_dir,
    artifact_paths_written,
    envelope_path_written,
    source_basename: basename(real),
  };
}

// NODE0-MISSION-PILOT-COCKPIT-CLI-ADAPTER-1A — `dema mission cockpit <run-id>` READ-ONLY reader.
// The exact run-id shape the emit kernel derives (first 16 hex of the harness content hash). Anything
// else — `..`, `../x`, a non-hex string — is rejected BEFORE any path is built (path-traversal guard).
export const NODE0_MISSION_PILOT_COCKPIT_RUN_ID_RE = /^[0-9a-f]{16}$/;

// Independent canonical digest — a byte-for-byte copy of the emission/cockpit kernels' stableStringify +
// sha256, kept LOCAL so the cockpit reader re-derives each on-disk artifact's content hash itself rather
// than trusting the envelope's self-report. Re-implementing the tiny canonical form here IS the point:
// it is an independent second witness against a tampered artifact file.
function cockpitStableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(cockpitStableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${cockpitStableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function cockpitSha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

// Testable I/O core for `dema mission cockpit <run-id>`. READ-ONLY: it reads exactly the four files the
// emit writer produced in the run_id dir (emission.json + the three artifact files) and NOTHING else — no
// directory crawl, no source-file read, no write, no mutation. It (1) strict-validates the run id BEFORE
// building any path, (2) loads emission.json and feeds its nested content-addressed emission to the shipped
// cockpit kernel (which re-verifies emission → harness → pulse → composition → signature-backed genesis
// anchor and renders the cockpit_view), and (3) INDEPENDENTLY re-derives each on-disk artifact FILE's
// content hash and refuses any mismatch (artifact_hash_mismatch:<name>) or missing file. Fails closed.
export async function runMissionCockpit({ runId, demaHome } = {}) {
  // 1) Strict run-id validation BEFORE any path is built (path-traversal guard: `..`, `../x`, non-hex).
  if (!runId || typeof runId !== "string" || runId.startsWith("--")) {
    return { ok: false, error: "missing_run_id", run_id: null, run_dir: null, cockpit: null };
  }
  if (!NODE0_MISSION_PILOT_COCKPIT_RUN_ID_RE.test(runId)) {
    return { ok: false, error: "invalid_run_id", run_id: runId, run_dir: null, cockpit: null };
  }

  const home = demaHome || process.env.DEMA_HOME || join(homedir(), ".dema");
  const dir = join(home, "artifacts", "proofs", "node0-local-mission", runId);

  // 2) Load emission.json (the verification envelope). Read-only.
  let rawEnv;
  try {
    rawEnv = await readFileFs(join(dir, `${EMISSION_ENVELOPE_FILENAME}.json`), "utf8");
  } catch {
    return { ok: false, error: "emission_envelope_not_found", run_id: runId, run_dir: dir, cockpit: null };
  }
  let envelope;
  try {
    envelope = JSON.parse(rawEnv);
  } catch {
    return { ok: false, error: "emission_envelope_not_valid_json", run_id: runId, run_dir: dir, cockpit: null };
  }
  const emission = envelope?.emission;
  if (!emission || typeof emission !== "object") {
    return { ok: false, error: "emission_envelope_missing_nested_emission", run_id: runId, run_dir: dir, cockpit: null };
  }

  // 3) Compose the shipped cockpit kernel over the nested emission. It transitively re-verifies the whole
  //    chain and renders the cockpit_view (with the gates ladder). Tampering the nested emission fails here.
  const cockpit = runNode0MissionPilotCockpitPreview({
    consent: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_GO_PHRASE,
    input: { emission },
  });

  // 4) INDEPENDENT per-artifact FILE re-check. Read each artifact file on disk, re-derive its content hash,
  //    and compare to the file's own embedded hash AND the envelope's recorded artifact_hashes. A tampered
  //    artifact file (bytes changed) or a missing file is refused here — even though the copy embedded in
  //    emission.json (which the kernel checks) is untouched.
  const recordedHashes = envelope?.artifact_hashes ?? {};
  const artifact_file_checks = [];
  const blocked_by = [];
  for (const name of ARTIFACT_NAMES) {
    const p = join(dir, `${name}.json`);
    let raw;
    try {
      raw = await readFileFs(p, "utf8");
    } catch {
      blocked_by.push(`missing_artifact_file:${name}`);
      artifact_file_checks.push({ name, path: p, ok: false, reason: "missing", recorded_hash: recordedHashes[name] ?? null, embedded_hash: null, rederived_hash: null });
      continue;
    }
    let artObj;
    try {
      artObj = JSON.parse(raw);
    } catch {
      blocked_by.push(`artifact_not_valid_json:${name}`);
      artifact_file_checks.push({ name, path: p, ok: false, reason: "invalid_json", recorded_hash: recordedHashes[name] ?? null, embedded_hash: null, rederived_hash: null });
      continue;
    }
    const { content_hash: embedded, ...artBody } = artObj;
    const rederived = `sha256:${cockpitSha256(cockpitStableStringify(artBody))}`;
    const recorded = recordedHashes[name] ?? null;
    const matchesEmbedded = embedded === rederived;
    const matchesRecorded = recorded === null ? true : recorded === rederived;
    const ok = matchesEmbedded && matchesRecorded;
    if (!ok) blocked_by.push(`artifact_hash_mismatch:${name}`);
    artifact_file_checks.push({ name, path: p, ok, recorded_hash: recorded, embedded_hash: embedded ?? null, rederived_hash: rederived });
  }

  // 5) Combined verdict — the kernel anchor AND every independent artifact-file re-check must pass.
  if (!cockpit.ok) for (const c of cockpit.blocked_by || []) blocked_by.push(`cockpit:${c}`);
  const ok = cockpit.ok && artifact_file_checks.every((c) => c.ok);

  return {
    ok,
    error: null,
    run_id: runId,
    run_dir: dir,
    cockpit,
    cockpit_view: cockpit.cockpit_view ?? null,
    // committed_live surfaced from the (verified) source emission, not asserted by the reader.
    committed_live: emission.committed_live === false ? false : emission.committed_live ?? null,
    envelope_meta: {
      schema: envelope?.schema ?? null,
      emission_content_hash: envelope?.emission_content_hash ?? null,
      source_file_content_hash: envelope?.source_file_content_hash ?? null,
    },
    artifact_file_checks,
    blocked_by: [...new Set(blocked_by)],
  };
}

const DEFAULT_REPLAY_MISSION = Object.freeze({
  mission_id: "node0-replay-demo",
  goal: "preserve a human mission across a model/context reset",
  steps: Object.freeze([
    { id: "sanitize", description: "sanitize corpus (Layer -1 gate)" },
    { id: "plan", description: "niyyah -> FATE plan" },
    { id: "run", description: "run mission loop through stations" },
    { id: "seal", description: "seal content-addressed receipt" },
  ]),
});

export async function cmd_mission(ctx) {
  const { argv, subcommand } = ctx;
  if (subcommand === "replay") {
    // NODE0-MISSION-STATE-REPLAY-HARNESS-0A — "the mission survives the model", measured.
    // Runs a deterministic agent loop (Think->Act->Observe) over a built-in fixture mission,
    // persists a content-addressed receipt chain, reconstructs the final state from receipts
    // ALONE (no model, no original state), and MEASURES reconstruction_accuracy. Pure and
    // deterministic: no fs, network, model, daemon, mint, or federation; boundary all-false.
    const report = buildMissionReplayReport({ mission: DEFAULT_REPLAY_MISSION });
    if (wantsJson(argv)) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      const m = report.measurement;
      console.log("DEMA · mission-state replay (the mission survives the model)");
      console.log(`  mission: ${report.mission_id} · turns: ${report.turns_run} · receipts: ${report.receipt_count}`);
      console.log(`  reconstruction_accuracy: ${m.reconstruction_accuracy} · critical_state_loss: ${m.critical_state_loss}`);
      console.log(`  mission_survives_model: ${report.mission_survives_model} (no model, no original state used)`);
      console.log(`  measurement_class: ${m.measurement_class}`);
      console.log("  does NOT prove: real-session/semantic continuity, model correctness, live PoI/mint.");
    }
    return;
  }
  if (subcommand === "cockpit") {
    // NODE0-MISSION-PILOT-COCKPIT-CLI-ADAPTER-1A — read-only operator truth cockpit. Loads the on-disk
    // emission.json verification envelope for <run-id>, re-verifies the full chain via the shipped cockpit
    // kernel (emission → harness → pulse → composition → signature-backed genesis anchor), INDEPENDENTLY
    // re-derives each on-disk artifact file's content hash, refuses any mismatch, and renders one operator
    // cockpit view. READ-ONLY: writes nothing, mutates nothing; no model, network, daemon, mint, or
    // federation. committed_live:false, authority_delta:0, mint_allowed:false, boundary all-false.
    const wantJsonCK = wantsJson(argv);
    const out = await runMissionCockpit({
      runId: argv[2],
      demaHome: argValue(argv, "--dema-home"),
    });
    if (out.error) {
      const usage = "dema mission cockpit <run-id> [--dema-home <path>] [--json]";
      if (wantJsonCK) {
        console.log(JSON.stringify({ preview_only: true, ok: false, error: out.error, run_id: out.run_id, usage }, null, 2));
      } else {
        console.error(`Dema error: ${out.error}. Usage: ${usage}`);
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const view = out.cockpit_view ?? {};
    const gates = view.gates ?? {};
    const wsd = view.world_state_delta_preview ?? {};
    const boundary = out.cockpit?.boundary ?? {};
    if (wantJsonCK) {
      console.log(
        JSON.stringify(
          {
            preview_only: true,
            schema: view.schema ?? out.cockpit?.schema ?? null,
            status: out.cockpit?.status ?? null,
            ok: out.ok,
            run_id: out.run_id,
            run_dir: out.run_dir,
            mission_status: view.mission_status ?? null,
            receipt_hash: view.receipt_hash ?? null,
            gates,
            world_state_delta_preview: wsd,
            dema_report: view.dema_report ?? null,
            what_happened: view.what_happened ?? null,
            what_did_not_happen: view.what_did_not_happen ?? null,
            next_safe_action: view.next_safe_action ?? null,
            artifact_file_checks: out.artifact_file_checks,
            content_hash: out.cockpit?.content_hash ?? null,
            committed_live: out.committed_live,
            boundary,
            mint_allowed: out.cockpit?.mint_allowed ?? null,
            authority_delta: out.cockpit?.authority_delta ?? null,
            blocked_by: out.blocked_by,
          },
          null,
          2,
        ),
      );
    } else {
      const lines = [
        "DEMA · MISSION COCKPIT — PREVIEW_ONLY (read-only operator truth cockpit · writes nothing · no model/network/daemon/mint)",
        `  run_id: ${out.run_id}`,
        `  mission_status: ${view.mission_status ?? "-"}`,
        `  receipt_hash: ${view.receipt_hash ?? "-"}`,
        `  gates (furthest reached: ${gates.reached_station ?? "-"}):`,
      ];
      for (const rung of gates.ladder || []) lines.push(`    ${rung.ok ? "✓" : "✗"} ${rung.stage}`);
      lines.push(`  world_state_delta: ${wsd.operation ?? "-"} → ${wsd.target ?? "-"} · applied:${wsd.applied}`);
      lines.push(`  dema: ${view.dema_report?.status ?? "-"} — ${view.dema_report?.next_safe_action ?? "-"}`);
      lines.push(`  what happened:       ${view.what_happened ?? "-"}`);
      lines.push(`  what did NOT happen: ${view.what_did_not_happen ?? "-"}`);
      lines.push(`  next safe action:    ${view.next_safe_action ?? "-"}`);
      lines.push("  artifact file re-check (independent of the envelope):");
      for (const c of out.artifact_file_checks) {
        lines.push(`    ${c.ok ? "✓" : "✗"} ${c.name}${c.ok ? "" : " · " + (c.reason || "hash_mismatch")}`);
      }
      lines.push(`  boundary: all-false · committed_live:${out.committed_live} · mint_allowed:${out.cockpit?.mint_allowed} · authority_delta:${out.cockpit?.authority_delta}`);
      if (!out.ok) for (const c of out.blocked_by || []) lines.push(`    ${c}`);
      lines.push(humanHintLine("mission cockpit"));
      console.log(lines.join("\n"));
    }
    if (!out.ok) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "run") {
    // NODE0-MATERIALIZATION-PULSE-E2E-PREVIEW-1A — run one real local file END-TO-END through the
    // assembled Pulse stations (sanitize → plan-branch → FATE → claim-gate → pulse-receipt). The train
    // runs. PREVIEW_ONLY: no model, no network, no write, no mint. Composes existing pure kernels.
    const wantJsonMR = wantsJson(argv);
    const filePath = argv[2];
    if (!filePath) {
      process.stderr.write('dema mission run <abs_or_rel_file> [--json] — a file argument is required\n');
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const out = await runMissionRun({ filePath });
    if (!out.result) {
      if (wantJsonMR) console.log(JSON.stringify({ refused: true, reason_code: out.reason_code, file: out.file }, null, 2));
      else process.stderr.write(`dema mission run: ${out.reason_code}: ${out.file}\n`);
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const r = out.result;
    if (wantJsonMR) {
      console.log(
        JSON.stringify(
          {
            preview_only: true,
            schema: r.schema,
            status: r.status,
            file: out.file,
            pulse_status: r.pulse_status,
            reached_station: r.reached_station,
            station_count: r.station_count,
            claims_public_safe: r.claims_public_safe,
            ladder: r.ladder,
            content_hash: r.content_hash,
            boundary: r.boundary,
            mint_allowed: r.mint_allowed,
            authority_delta: r.authority_delta,
            blocked_by: r.blocked_by,
          },
          null,
          2,
        ),
      );
    } else {
      const lines = [
        "DEMA · MISSION RUN — PREVIEW_ONLY (the assembled Pulse, end to end · no model/network/mint)",
        `  ${out.file}`,
        `  PULSE: ${r.pulse_status} · reached ${r.reached_station}/${r.station_count} · claims_public_safe:${r.claims_public_safe}`,
      ];
      for (const rung of r.ladder || []) {
        lines.push(`    ${rung.ok ? "✓" : "✗"} ${String(rung.station).padEnd(13)} ${rung.verdict}${rung.blocked_by.length ? " · " + rung.blocked_by.join(",") : ""}`);
      }
      lines.push(`  content_hash: ${r.content_hash}`);
      lines.push(`  boundary: all-false · authority_delta:${r.authority_delta} · mint_allowed:${r.mint_allowed}`);
      lines.push(humanHintLine("mission run"));
      console.log(lines.join("\n"));
    }
    if (!r.ok || r.pulse_status !== "sealed") process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "compact") {
    // NODE0-RECEIPT-SHELF-COMPACTION-STATE-PREVIEW-1A — read receipts → shelf → compacted, hash-bound
    // mission state (keep/drop/no-longer-claim/one-next-action). PREVIEW_ONLY. No RL, model, network,
    // daemon; commits nothing live; publishes nothing to a shared/federated URP.
    const wantJsonMC = wantsJson(argv);
    const out = await runMissionCompact({});
    const r = out.result;
    if (wantJsonMC) {
      console.log(
        JSON.stringify(
          {
            preview_only: true,
            schema: r.schema,
            status: r.status,
            ok: out.ok,
            content_hash: r.content_hash,
            shelf_ok: r.shelf_ok,
            source_receipt_count: r.source_receipt_count,
            valid_receipt_count: r.valid_receipt_count,
            invalid_receipt_count: r.invalid_receipt_count,
            live_leak_count: r.live_leak_count,
            retained_signals: r.retained_signals,
            dropped_content: r.dropped_content,
            what_can_no_longer_be_claimed: r.what_can_no_longer_be_claimed,
            one_next_safe_action: r.one_next_safe_action,
            boundary: r.boundary,
            mint_allowed: r.mint_allowed,
            authority_delta: r.authority_delta,
            committed_live: r.committed_live,
            blocked_by: r.blocked_by,
          },
          null,
          2,
        ),
      );
    } else {
      const lines = [
        "DEMA · RECEIPT-SHELF COMPACTION — PREVIEW_ONLY (compacts PROOF, not meaning · nothing live)",
        `  ${r.source_receipt_count} receipt(s) → ${r.valid_receipt_count} valid · ${r.invalid_receipt_count} invalid · ${r.live_leak_count} live-leak (shelf_ok:${r.shelf_ok})`,
        `  RETAINED (${r.retained_signals.length}): ${r.retained_signals.join(", ")}`,
        "  DROPPED:",
        ...r.dropped_content.map((s) => `    − ${s}`),
        "  CAN NO LONGER CLAIM:",
        ...r.what_can_no_longer_be_claimed.map((s) => `    ✗ ${s}`),
        `  ONE next safe action: ${r.one_next_safe_action}`,
        `  boundary: all-false · mint_allowed:${r.mint_allowed} · committed_live:${r.committed_live}`,
      ];
      if (!out.ok) for (const c of r.blocked_by || []) lines.push(`    ${c}`);
      lines.push(humanHintLine("mission compact"));
      console.log(lines.join("\n"));
    }
    if (!out.ok) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "shelf") {
    // NODE0-LOCAL-URP-SHELF-INDEX-PREVIEW-1A — read every receipt under $DEMA_HOME/mission/receipts
    // and compose the local URP shelf index (queryable catalog). PREVIEW_ONLY. Reads only; commits
    // no live world-state; publishes nothing to any shared/federated URP.
    const wantJsonMS = wantsJson(argv);
    const out = await runMissionShelf({});
    const r = out.result;
    if (wantJsonMS) {
      console.log(
        JSON.stringify(
          {
            preview_only: true,
            schema: r.schema,
            status: r.status,
            ok: out.ok,
            content_hash: r.content_hash,
            receipts_dir: out.receipts_dir,
            files_seen: out.files_seen,
            entry_count: r.entry_count,
            valid_count: r.valid_count,
            invalid_count: r.invalid_count,
            live_leak_count: r.live_leak_count,
            all_preview: r.all_preview,
            entries: r.entries,
            boundary: r.boundary,
            mint_allowed: r.mint_allowed,
            authority_delta: r.authority_delta,
            blocked_by: r.blocked_by,
          },
          null,
          2,
        ),
      );
    } else {
      const lines = [
        "DEMA · LOCAL URP SHELF — PREVIEW_ONLY (read-only · local · not published/federated)",
        `  ${out.receipts_dir}`,
        `  ${r.entry_count} mission receipt(s) on the shelf · ${r.valid_count} valid · ${r.invalid_count} invalid · ${r.live_leak_count} live-leak · all_preview:${r.all_preview}`,
      ];
      for (const e of r.entries || []) {
        lines.push(`    ${e.receipt_ok ? "✓" : "✗"} ${e.mission_id ?? "(no id)"} · file ${String(e.file_content_hash).slice(0, 22)}… · pulse ${String(e.pulse_content_hash).slice(0, 22)}…`);
      }
      lines.push(`  boundary: all-false · mint_allowed:${r.mint_allowed} · authority_delta:${r.authority_delta}`);
      if (!out.ok) for (const c of r.blocked_by || []) lines.push(`    ${c}`);
      lines.push(humanHintLine("mission shelf"));
      console.log(lines.join("\n"));
    }
    if (!out.ok) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "review") {
    // NODE0-MISSION-HARNESS-RETURN-REVIEW-PREVIEW-1A — read one `dema mission pulse` receipt file,
    // review it (structure/invariants), state proven / not-proven + one next safe action.
    // PREVIEW_ONLY. No model, no network, no daemon, no mutation. Receipt read-only.
    const wantJsonMR = wantsJson(argv);
    const out = await runMissionReturnReview({ receiptPath: argv[2] });
    if (out.error) {
      const usage = "dema mission review <receipt-path> [--json]";
      if (wantJsonMR) {
        console.log(JSON.stringify({ preview_only: true, ok: false, error: out.error, usage }, null, 2));
      } else {
        console.error(`Dema error: ${out.error}. Usage: ${usage}`);
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const r = out.result;
    if (wantJsonMR) {
      console.log(
        JSON.stringify(
          {
            preview_only: true,
            schema: r.schema,
            status: r.status,
            ok: out.ok,
            receipt_ok: r.receipt_ok,
            content_hash: r.content_hash,
            what_was_proven: r.what_was_proven,
            what_was_not_proven: r.what_was_not_proven,
            one_next_safe_action: r.one_next_safe_action,
            boundary: r.boundary,
            mint_allowed: r.mint_allowed,
            authority_delta: r.authority_delta,
            blocked_by: r.blocked_by,
          },
          null,
          2,
        ),
      );
    } else {
      const lines = [
        "DEMA · MISSION RETURN REVIEW — PREVIEW_ONLY (read-only receipt · no model · no execution)",
        `  receipt_ok: ${r.receipt_ok} · status: ${r.status}`,
        "  what was PROVEN:",
        ...(r.what_was_proven.length ? r.what_was_proven.map((s) => `    ✓ ${s}`) : ["    (nothing — receipt did not pass review)"]),
        "  what was NOT proven:",
        ...r.what_was_not_proven.map((s) => `    · ${s}`),
        `  ONE next safe action: ${r.one_next_safe_action}`,
        `  boundary: all-false · mint_allowed:${r.mint_allowed} · authority_delta:${r.authority_delta}`,
      ];
      if (!out.ok) for (const c of r.blocked_by || []) lines.push(`    ${c}`);
      lines.push(humanHintLine("mission review"));
      console.log(lines.join("\n"));
    }
    if (!out.ok) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "pulse") {
    // NODE0-LOCAL-MISSION-HARNESS-PREVIEW-1A — read one named file, run the pure mission pulse,
    // shape a preview receipt. PREVIEW_ONLY. No daemon, no network, no model, no source mutation.
    const wantJsonMP = wantsJson(argv);
    const out = await runMissionPulseHarness({
      file: argv[2],
      consent: argValue(argv, "--consent"),
      wantReceipt: argv.includes("--receipt"),
      excerptConsent: argValue(argv, "--excerpt-consent"),
      claim: argValue(argv, "--claim"),
      task: argValue(argv, "--task"),
      boundary: argValue(argv, "--boundary"),
      nowIso: new Date().toISOString(),
    });
    if (out.error && !out.result) {
      const usage = `dema mission pulse <file> --consent "${NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE}" --claim "…" --task "…" --boundary "…" [--receipt] [--excerpt-consent "${MISSION_EXCERPT_GO_PHRASE}"]`;
      if (wantJsonMP) {
        console.log(JSON.stringify({ preview_only: true, ok: false, error: out.error, usage }, null, 2));
      } else {
        console.error(`Dema error: ${out.error}. Usage: ${usage}`);
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const r = out.result;
    if (wantJsonMP) {
      console.log(
        JSON.stringify(
          {
            preview_only: true,
            schema: r.schema,
            status: r.status,
            ok: out.ok,
            harness_ready: r.harness_ready,
            content_hash: r.content_hash,
            receipt_target_relpath: r.receipt_target_relpath,
            receipt_written: out.receiptPath,
            receipt_committed_live: r.receipt_artifact_preview?.committed_live,
            boundary: r.boundary,
            mint_allowed: r.mint_allowed,
            authority_delta: r.authority_delta,
            dema_report: r.dema_report,
            blocked_by: r.blocked_by,
            error: out.error ?? null,
          },
          null,
          2,
        ),
      );
    } else {
      const lines = [
        "DEMA · LOCAL MISSION PULSE — PREVIEW_ONLY (no model · no daemon · read-only source)",
        `  status: ${r.status}`,
        `  content_hash: ${r.content_hash}`,
        `  receipt: ${out.receiptPath ?? `not written (add --receipt --consent "${NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE}")`}`,
        `  boundary: all-false · mint_allowed:${r.mint_allowed} · authority_delta:${r.authority_delta}`,
      ];
      if (r.dema_report) lines.push(`  dema: ${r.dema_report.status} — ${r.dema_report.next_safe_action}`);
      if (out.error) lines.push(`  ${out.error}`);
      if (!out.ok) for (const c of r.blocked_by || []) lines.push(`    ${c}`);
      lines.push(humanHintLine("mission pulse"));
      console.log(lines.join("\n"));
    }
    if (!out.ok) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "emit") {
    // NODE0-LOCAL-MISSION-EMIT-CLI-ADAPTER-1A — read one explicit absolute file (read-only), run the
    // SHIPPED harness → emission preview path, and (only under the exact operator write-consent phrase)
    // ATOMICALLY WRITE three preview artifacts plus one verification envelope (emission.json) under
    // $DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/. The envelope wraps the content-addressed
    // emission so the cockpit reader can re-verify the full chain + render gates from disk. PREVIEW_ONLY.
    // No model, network, daemon, mint, federation, live URP, or source mutation. committed_live:false,
    // authority_delta:0.
    const wantJsonME = wantsJson(argv);
    const out = await runMissionEmit({
      file: argv[2],
      consent: argValue(argv, "--consent"),
      claim: argValue(argv, "--claim"),
      task: argValue(argv, "--task"),
      boundary: argValue(argv, "--boundary"),
      excerptConsent: argValue(argv, "--excerpt-consent"),
      nowIso: new Date().toISOString(),
    });
    if (out.error) {
      const usage = `dema mission emit <abs-file> --consent "${NODE0_LOCAL_MISSION_EMIT_GO_PHRASE}" [--claim "…" --task "…" --boundary "…"] [--excerpt-consent "${MISSION_EXCERPT_GO_PHRASE}"] [--json]`;
      if (wantJsonME) {
        console.log(JSON.stringify({ preview_only: true, ok: false, error: out.error, usage }, null, 2));
      } else {
        console.error(`Dema error: ${out.error}. Usage: ${usage}`);
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const r = out.emission;
    if (wantJsonME) {
      console.log(
        JSON.stringify(
          {
            preview_only: true,
            schema: r.schema,
            status: r.status,
            ok: out.ok,
            wrote: out.wrote,
            write_refused_reason: out.write_refused_reason,
            run_id: r.run_id,
            content_hash: r.content_hash,
            run_dir: out.run_dir,
            artifact_paths_written: out.artifact_paths_written,
            envelope_path_written: out.envelope_path_written,
            artifact_target_relpaths: r.artifact_paths,
            envelope_target_relpath: `artifacts/proofs/node0-local-mission/${r.run_id}/${EMISSION_ENVELOPE_FILENAME}.json`,
            artifact_hashes: ARTIFACT_NAMES.map((n) => `${n}=${r.artifacts?.[n]?.content_hash ?? "-"}`),
            emission_content_hash: out.envelope?.emission_content_hash ?? null,
            source_file_content_hash: out.envelope?.source_file_content_hash ?? null,
            boundary: r.boundary,
            mint_allowed: r.mint_allowed,
            authority_delta: r.authority_delta,
            blocked_by: r.blocked_by,
          },
          null,
          2,
        ),
      );
    } else {
      const lines = [
        "DEMA · LOCAL MISSION EMIT — PREVIEW_ONLY (read-only source · atomic write under DEMA_HOME · no model/daemon/network/mint)",
        `  source: ${out.source_basename}`,
        `  status: ${r.status}`,
        `  run_id: ${r.run_id}`,
        `  content_hash: ${r.content_hash}`,
      ];
      if (out.wrote) {
        lines.push("  three preview artifacts + one verification envelope written:");
        for (const p of out.artifact_paths_written) lines.push(`    ${p}`);
        lines.push(`    ${out.envelope_path_written}  (verification envelope — cockpit re-verifies the full chain from disk)`);
      } else {
        lines.push(
          `  artifacts: NOT written (${out.write_refused_reason ?? "emission not ok"}) — add --consent "${NODE0_LOCAL_MISSION_EMIT_GO_PHRASE}"`,
        );
        for (const rel of r.artifact_paths || []) lines.push(`    would write: ${rel}`);
        lines.push(`    would write: artifacts/proofs/node0-local-mission/${r.run_id}/${EMISSION_ENVELOPE_FILENAME}.json  (verification envelope)`);
      }
      lines.push(`  boundary: all-false · mint_allowed:${r.mint_allowed} · authority_delta:${r.authority_delta}`);
      if (!out.ok) for (const c of r.blocked_by || []) lines.push(`    ${c}`);
      lines.push(humanHintLine("mission emit"));
      console.log(lines.join("\n"));
    }
    if (!out.ok) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "interview") {
    // PAIN-GOAL-INTERVIEW-1A — local only, no model. Capture stated pain/goal,
    // propose (only propose) a first mission. Writes nothing.
    const interview = buildPainGoalInterview({
      pain: argValue(argv, "--pain"),
      goal: argValue(argv, "--goal"),
      urgency: argValue(argv, "--urgency"),
      help_style: argValue(argv, "--style"),
    });
    if (wantsJson(argv)) {
      console.log(JSON.stringify(interview, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    const lines = ["DEMA · PAIN / GOAL INTERVIEW (local only · no model called)"];
    if (interview.interview_status !== "ready_for_first_mission_preview") {
      if (interview.interview_status === "partial") {
        lines.push(
          `  So far — pain: ${interview.pain_point ?? "(none)"} · goal: ${interview.desired_goal ?? "(none)"}`,
        );
        lines.push(`  Still needed: ${interview.missing_fields.join(", ")}`);
        lines.push("");
      }
      lines.push("  Tell me (use --pain, --goal, --urgency, --style):");
      for (const q of interview.interview_questions) lines.push(`    • ${q}`);
    } else {
      lines.push(`  Pain: ${interview.pain_point}`);
      lines.push(`  Goal: ${interview.desired_goal}`);
      lines.push(
        `  Urgency: ${interview.urgency_level} · help style: ${interview.preferred_help_style ?? "(unspecified)"}`,
      );
      lines.push("");
      lines.push("  First mission — PROPOSAL ONLY (not started):");
      lines.push(`    ${interview.first_mission_candidate.statement}`);
    }
    // Honesty guard — the captured-not-understood disclaimer fires whenever
    // anything was STATED (partial OR ready), not only when a mission is
    // proposed. The partial branch echoes the user's pain back, so it is the
    // surface most exposed to reading capture as comprehension.
    if (interview.pain_point || interview.desired_goal) {
      lines.push("");
      lines.push(
        "  I captured what you STATED — I have not understood you fully, run any model, or saved anything.",
      );
    }
    lines.push(humanHintLine("mission interview"));
    console.log(lines.join("\n"));
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "plan") {
    // CLOSED-DUAL-LOOP-DRY-RUN-1A — local only, no model, no execution. Takes
    // the captured pain/goal, runs a DRY-RUN PAT-propose -> SAT-verify loop, and
    // presents a consent-ready plan. The loops are DESIGNED_NOT_LIVE scaffolds.
    // Optional --baseline attaches a measured eval-route preview (talk_env_hint)
    // for operator reference — PREVIEW only, no talk invocation.
    let routing_preview = null;
    const baselinePath = argValue(argv, "--baseline");
    if (baselinePath) {
      const { isAbsolute, resolve } = await import("node:path");
      const { readFile } = await import("node:fs/promises");
      if (!isAbsolute(baselinePath)) {
        throw new Error("`dema mission plan --baseline` requires an absolute path to the baseline JSON file.");
      }
      const { buildModelRoutingPreview } = await import(
        "../../../../packages/core/src/model-routing-preview.js"
      );
      let baseline;
      try {
        baseline = JSON.parse(await readFile(resolve(baselinePath), "utf8"));
      } catch (readErr) {
        throw new Error(
          `Failed to read or parse baseline file: ${readErr && readErr.message ? readErr.message : readErr}`,
        );
      }
      routing_preview = buildModelRoutingPreview({
        baseline,
        generated_at_iso: new Date().toISOString(),
      });
    }
    const dryRun = buildClosedDualLoopDryRun({
      pain: argValue(argv, "--pain"),
      goal: argValue(argv, "--goal"),
      urgency: argValue(argv, "--urgency"),
      help_style: argValue(argv, "--style"),
      routing_preview,
    });
    if (wantsJson(argv)) {
      console.log(JSON.stringify(dryRun, null, 2));
      process.exit(process.exitCode ?? 0);
    }
    const lines = [
      "DEMA · CLOSED DUAL-LOOP DRY-RUN (local only · no model · nothing runs)",
    ];
    if (dryRun.dry_run_status !== "consent_ready") {
      lines.push(`  Not ready — still needed: ${dryRun.missing_fields.join(", ")}`);
      lines.push('  Run `dema mission interview` first to capture your pain + goal.');
    } else {
      const plan = dryRun.consent_ready_plan;
      lines.push(`  Mission: ${plan.mission}`);
      lines.push("");
      lines.push("  PAT proposed (a deterministic scaffold — NOT model reasoning):");
      for (const step of dryRun.pat_proposal.proposed_steps) lines.push(`    • ${step}`);
      lines.push("");
      lines.push(`  SAT verdict: ${dryRun.sat_verdict.gate_verdict}`);
      for (const c of dryRun.sat_verdict.checks) {
        lines.push(`    ${c.passed ? "✓" : "✗"} ${c.check}`);
      }
      lines.push("");
      lines.push("  Consent-ready plan — NOTHING has run.");
      lines.push(
        `  To ever execute it you would type the exact phrase: "${plan.execution_consent_required}"`,
      );
      lines.push("  (Execution is a separate, later, consented step — not built yet.)");
      const ctx = dryRun.measured_routing_context;
      if (ctx?.talk_env_hint?.env) {
        lines.push("");
        lines.push("  Measured routing context (PREVIEW — does not invoke talk):");
        lines.push(`    export DEMA_TALK_PROVIDER=${ctx.talk_env_hint.env.DEMA_TALK_PROVIDER}`);
        lines.push(`    export DEMA_TALK_MODEL=${ctx.talk_env_hint.env.DEMA_TALK_MODEL}`);
        lines.push(`    dema talk … --consent "${ctx.talk_env_hint.consent_phrase}"`);
      }
    }
    lines.push("");
    lines.push(
      "  Both loops are DESIGNED_NOT_LIVE — no model reasoned, no agent ran, nothing executed.",
    );
    lines.push(humanHintLine("mission plan"));
    console.log(lines.join("\n"));
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "run" && argv[2] === "health") {
    const consent = argValue(argv, "--consent") ?? "";
    const dryRun = argv.includes("--dry-run");
    const wantJsonM = argv.includes("--json") || !process.stdout.isTTY;
    if (dryRun && !consent) {
      const snap = await buildHealthSnapshot();
      if (wantJsonM) {
        console.log(
          JSON.stringify(
            { ...snap, saved: false, reason: "dry_run", dry_run: true },
            null,
            2,
          ),
        );
      } else {
        console.log(
          formatHealthSnapshotReceipt({
            ...snap,
            saved: false,
            reason: "dry_run",
          }),
        );
      }
      process.exit(process.exitCode ?? 0);
    }
    const result = await saveHealthSnapshotReceipt({ consent, dryRun });
    if (wantJsonM) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatHealthSnapshotReceipt(result));
    }
    if (!result.saved && result.reason !== "dry_run") process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "verify" && argv[2]) {
    const mPath = argv[2];
    const wantJsonMV = argv.includes("--json") || !process.stdout.isTTY;
    const mv = await verifyHealthSnapshotReceipt(mPath);
    console.log(
      wantJsonMV ? JSON.stringify(mv, null, 2) : JSON.stringify(mv, null, 2),
    );
    if (mv.verdict !== "VERIFIED") process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "draft") {
    const json = argv.includes("--json");
    const intent = argv
      .slice(2)
      .filter((arg) => arg !== "--json")
      .join(" ")
      .trim();
    if (!intent)
      throw new Error('Usage: dema mission draft [--json] "<intent>"');
    const draft = buildMissionDraftPreview({ intent });
    draft.pre_execution_manifest = buildMissionManifest("health_snapshot", {
      now: new Date(),
    });
    console.log(
      json ? JSON.stringify(draft, null, 2) : formatMissionDraftPreview(draft),
    );
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "manifest") {
    const missionType =
      argv[2] && !argv[2].startsWith("-") ? argv[2] : undefined;
    const wantJsonMF = wantsJson(argv);
    const manifest = buildMissionManifest(missionType);
    if (manifest.error) {
      if (wantJsonMF) {
        console.log(
          JSON.stringify(
            {
              schema: "bizra.dema.mission_manifest.v0.1",
              error: manifest.error,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(manifest.error);
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    if (wantJsonMF) {
      console.log(JSON.stringify(manifest, null, 2));
    } else {
      console.log(formatMissionManifest(manifest));
    }
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "probe") {
    const wantJsonPR = wantsJson(argv);
    try {
      const { fileURLToPath: probeURL } = await import("node:url");
      const { dirname: probeDirname, join: probeJoin } =
        await import("node:path");
      // commands/ is one level deeper — need 4 levels to reach repo root
      const repoRoot = probeJoin(
        probeDirname(probeURL(import.meta.url)),
        "..",
        "..",
        "..",
        "..",
      );
      const report = await runMissionProbe(repoRoot);
      if (wantJsonPR) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderProbeText(report));
      }
      if (report.verdict === "FAILED") process.exitCode = 1;
    } catch (err) {
      if (wantJsonPR) {
        console.log(
          JSON.stringify(
            {
              schema: "bizra.dema.mission_probe.v0.1",
              error: err.message,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(`Probe error: ${err.message}`);
      }
      process.exitCode = 2;
    }
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "closeout") {
    const missionId = argv[2] && !argv[2].startsWith("-") ? argv[2] : undefined;
    const wantJsonCO = wantsJson(argv);
    const resolved = await resolveMissionReceipt(missionId);
    if (resolved.error) {
      if (wantJsonCO) {
        console.log(
          JSON.stringify(
            {
              schema: "bizra.dema.mission_closeout.v0.1",
              error: resolved.error,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(resolved.error);
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const report = buildCloseoutReport(
      resolved.receipt,
      resolved.path,
      resolved.filename,
    );
    if (report.error) {
      if (wantJsonCO) {
        console.log(
          JSON.stringify(
            {
              schema: "bizra.dema.mission_closeout.v0.1",
              error: report.error,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(report.error);
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    if (wantJsonCO) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(renderCloseoutText(report));
    }
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand !== "propose") {
    throw new Error(
      'Unknown mission command. Use `dema mission draft "<intent>"` or `dema mission propose`.',
    );
  }
  const status = await statusWithLocalIdentity(adapter);
  const consent = argValue(argv, "--consent") ?? "";
  const proposePreview = previewBoundedDiagnostic(status, consent);
  if (wantsJson(argv)) {
    console.log(JSON.stringify(proposePreview, null, 2));
    process.exit(process.exitCode ?? 0);
  }
  console.log(
    [
      "Dema mission propose",
      `  Action: ${proposePreview.action}`,
      `  Executes: ${proposePreview.executes}`,
      `  Proposal allowed: ${proposePreview.proposal.allowed}`,
      `  Consent accepted: ${proposePreview.consent.accepted}`,
      `  Next: ${proposePreview.next}`,
      humanHintLine("mission propose"),
    ].join("\n"),
  );
  process.exit(process.exitCode ?? 0);
}
