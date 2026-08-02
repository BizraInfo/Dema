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
  buildMissionContract,
  appendCorridorEvent,
  deriveCorridorStatus,
  verifyCorridorJournal,
  buildCorridorConsentContext,
  evaluateCorridorWriteConsent,
  MISSION_ID_RE,
  CORRIDOR_TRANSITIONS,
  CORRIDOR_WRITE_ACTION_CLASS,
} from "../../../../packages/mission/src/mission-corridor.js";
import {
  runCorridorClosure,
  verifyCorridorClosure,
} from "../../../../packages/mission/src/mission-corridor-closure.js";
import {
  buildClaimBoundConsentRegistry,
  buildLedgerAppender,
  buildRenameEffectAdapter,
  resolveRenameEffectIntent,
  runTransactionalMechanicalClosure,
  appendClosureTransactionPhase,
  observeCanonicalLedger,
  readClosureAnchorLog,
  appendClosureAnchor,
  CORRIDOR_RENAME_RECOVERY_POLICY_HASH,
} from "../../../../packages/mission/src/corridor-closure-gatherer.js";
import {
  claimConsentNonce, inspectConsentNonce,
} from "../../../../packages/receipts/src/consent-nonce-claim.js";
import { replayClosureTransaction } from "../../../../packages/receipts/src/mission-closure-transaction.js";
import {
  loadCanonicalLedger, verifyCanonicalLedger,
} from "../../../../packages/receipts/src/canonical-ledger.js";
import { loadPublicKey } from "../../../../packages/receipts/src/authorship-key-store.js";
import { verifyAnchorLog } from "../../../../packages/core/src/chain-anchor.js";
import { sha256CanonicalJsonV1 } from "../../../../packages/canon/src/sha256-canonical-json-v1.js";
import { evaluateVerificationAdmission } from "../../../../packages/core/src/verification-admission.js";
import { buildPreviewBoundary } from "../../../../packages/core/src/boundary-schema.js";
import {
  wantsJson,
  humanHintLine,
} from "../../../../packages/core/src/output-mode.js";
import { statusWithLocalIdentity } from "../lib/status-identity.js";

// NODE0-LOCAL-MISSION-HARNESS-PREVIEW-1A — `dema mission pulse <file>` effect layer.
import {
  mkdir, open as openFile, readFile as readFileFs, readdir, realpath, rename, stat, writeFile,
} from "node:fs/promises";
import { unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, isAbsolute, resolve } from "node:path";
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
  if (subcommand === "corridor") {
    // DEMA-MISSION-CORRIDOR-0A — persistent mission control plane (PREVIEW_ONLY).
    // Contract + append-only hash-chained journal under $DEMA_HOME/missions/<id>/;
    // status/resume are pure derivations from disk alone ("the mission remembers
    // itself"). Control plane ONLY: no worker, no daemon, no execution, no model.
    return cmdMissionCorridor(argv);
  }
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

// --- DEMA-MISSION-CORRIDOR-0A — persistent mission control plane (CLI IO layer) ---
// Kernel is pure; this layer does disclosed disk IO only:
//   $DEMA_HOME/missions/<id>/contract.json   (written once, no clobber)
//   $DEMA_HOME/missions/<id>/journal.jsonl   (append-only)
// Writes require an exact consent phrase. status/resume are read-only.

function corridorFail(message) {
  console.error(`Dema error: ${message}`);
  process.exit(1);
}

function corridorHome(argv) {
  // Destination is disclosed, never silent: --dema-home > DEMA_HOME > ~/.dema.
  // Resolved to an absolute, lexically normalized path BEFORE consent
  // derivation, so the consented root and the filesystem root can never
  // lexically diverge (no symlink resolution — lexical normalization only).
  return resolve(argValue(argv, "--dema-home") || process.env.DEMA_HOME || join(homedir(), ".dema"));
}

// HONEST boundary for CLI IO paths (founder-impact precedent): the kernel is
// pure and all-false, but this layer really does read/write under consent —
// say so instead of printing false statements (SAT finding on 4407189).
function corridorIoBoundary({ read = false, wrote = false, consented = false } = {}) {
  return Object.freeze({
    ...buildPreviewBoundary(),
    content_read: read,
    filesystem_write_performed: wrote,
    consent_collected: consented,
  });
}

async function readCorridor(dir) {
  // Missing and corrupt are DIFFERENT truths: an absent corridor is a lookup
  // miss; unparseable state is damage and must never be reported as "not found".
  let rawContract;
  let rawJournal;
  try {
    rawContract = await readFileFs(join(dir, "contract.json"), "utf8");
    rawJournal = await readFileFs(join(dir, "journal.jsonl"), "utf8");
  } catch (err) {
    corridorFail(`no corridor found under ${dir} (${err?.code ?? "read_error"})`);
  }
  try {
    const contractDoc = JSON.parse(rawContract);
    const journal = rawJournal
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    return { contractDoc, journal };
  } catch {
    corridorFail(`corridor state under ${dir} is corrupt (unparseable JSON) — refusing to guess; nothing was written.`);
  }
}

// Two processes that each read a journal of length N both mint index N and both
// append — producing a FORKED chain that verifyCorridorJournal rejects, so the
// mission becomes unverifiable. Measured before this guard: 1 of 6 concurrent
// `corridor complete` runs left indices 0,1,2,3,4,5,6,7,7 on disk.
//
// The append is therefore gated by an exclusive create keyed to the exact index
// being written: the filesystem picks the winner, exactly as reserveNonce does
// for consent. A claimed-but-unwritten index fails closed — safer than a forked
// journal — and the refusal names the file so an operator can inspect it.
async function syncFileAndParent(path) {
  let fileHandle;
  let dirHandle;
  try {
    fileHandle = await openFile(path, "r");
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = null;
    dirHandle = await openFile(dirname(path), "r");
    await dirHandle.sync();
    await dirHandle.close();
    dirHandle = null;
  } finally {
    try { await fileHandle?.close(); } catch { /* primary error wins */ }
    try { await dirHandle?.close(); } catch { /* primary error wins */ }
  }
}

async function appendAndSync(path, bytes) {
  let handle;
  try {
    handle = await openFile(path, "a", 0o600);
    await handle.writeFile(bytes, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    const dirHandle = await openFile(dirname(path), "r");
    try { await dirHandle.sync(); } finally { await dirHandle.close(); }
  } finally {
    try { await handle?.close(); } catch { /* primary error wins */ }
  }
}

async function appendCorridorJournalEvent(dir, event) {
  const marker = join(dir, `.journal-index-${event.index}.claim`);
  const markerBody = Object.freeze({
    schema: "bizra.dema.mission_corridor_journal_claim.v1",
    index: event.index,
    event_hash: event.event_hash,
    state: event.state,
    event,
  });
  try {
    await writeFile(
      marker,
      `${JSON.stringify(markerBody)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    await syncFileAndParent(marker);
  } catch (err) {
    if (err && err.code === "EEXIST") {
      let stored;
      let journal;
      try {
        stored = JSON.parse(await readFileFs(marker, "utf8"));
        journal = (await readFileFs(join(dir, "journal.jsonl"), "utf8"))
          .split("\n").filter((line) => line.trim().length > 0).map((line) => JSON.parse(line));
      } catch {
        corridorFail(`journal index ${event.index} claim is unreadable (${marker}) — refusing to guess; nothing was written.`);
      }
      if (stored?.schema !== markerBody.schema
          || stored.event_hash !== event.event_hash
          || JSON.stringify(stored.event) !== JSON.stringify(event)) {
        corridorFail(
          `journal index ${event.index} was claimed with divergent semantics (${marker}) — refusing to fork the chain; nothing was written.`,
        );
      }
      const existing = journal[event.index];
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(event)) {
          corridorFail(`journal index ${event.index} already contains a different event — refusing to fork the chain; nothing was written.`);
        }
        return Object.freeze({ appended: false, idempotent: true, event: existing });
      }
      const previous = event.index === 0 ? null : journal[event.index - 1];
      if (journal.length !== event.index || (previous?.event_hash ?? null) !== event.prev_hash) {
        corridorFail(`journal index ${event.index} recovery does not extend the current head — refusing to fork the chain; nothing was written.`);
      }
      await appendAndSync(join(dir, "journal.jsonl"), `${JSON.stringify(stored.event)}\n`);
      return Object.freeze({ appended: true, recovered: true, event: stored.event });
    }
    corridorFail(`journal index reservation failed closed (${err?.code ?? "unknown_error"}) — nothing was written.`);
  }
  await appendAndSync(join(dir, "journal.jsonl"), `${JSON.stringify(event)}\n`);
  return Object.freeze({ appended: true, recovered: false, event });
}

async function claimCorridorWriteNonce(argv, {
  nonce, consent_context_hash, mission_id, kind, contract_hash, claimed_at_iso,
  checkpoint_event_hash, prepared_intent_hash, recovery_policy_hash,
  allow_resume = false,
}) {
  const transaction_id = `corridor-${sha256CanonicalJsonV1({
    domain: "BIZRA:CORRIDOR_WRITE_TRANSACTION:v1",
    mission_id,
    kind,
    contract_hash,
    consent_context_hash,
    prepared_intent_hash: prepared_intent_hash ?? null,
  }).slice("sha256:".length)}`;
  const result = await claimConsentNonce({
    nonce,
    actionClass: CORRIDOR_WRITE_ACTION_CLASS,
    actionKind: kind,
    missionId: mission_id,
    contractHash: contract_hash,
    consentContextHash: consent_context_hash,
    transactionId: transaction_id,
    checkpointEventHash: checkpoint_event_hash,
    preparedIntentHash: prepared_intent_hash,
    recoveryPolicyHash: recovery_policy_hash,
    claimedAtIso: claimed_at_iso,
    demaHome: corridorHome(argv),
  });
  if (result.claimed === true) return result.claim;
  if (allow_resume && result.resumable === true && result.existing_claim) {
    return result.existing_claim;
  }
  if (String(result.reason).includes("failed_closed")) {
    corridorFail(`consent nonce claim failed closed (${result.reason}) — nothing was written.`);
  }
  corridorFail(`root-bound consent BLOCKED: nonce_replayed (${result.reason}) — nothing was written.`);
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === "EPERM";
  }
}

async function acquireClosureLock({ dir, missionId, transactionId }) {
  const lock = join(dir, ".closure.lock");
  const body = Object.freeze({
    schema: "bizra.dema.corridor_closure_lock.v1",
    pid: process.pid,
    mission_id: missionId,
    transaction_id: transactionId,
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await writeFile(lock, `${JSON.stringify(body)}\n`, { flag: "wx", mode: 0o600 });
      process.on("exit", () => {
        try { unlinkSync(lock); } catch { /* already released */ }
      });
      return lock;
    } catch (err) {
      if (err?.code !== "EEXIST") {
        corridorFail(`closure lock failed closed (${err?.code ?? "unknown_error"}) — nothing was written.`);
      }
    }

    let raw;
    let held;
    try {
      raw = await readFileFs(lock, "utf8");
      held = JSON.parse(raw);
    } catch {
      corridorFail(`closure lock is unreadable (${lock}) — refusing to guess; nothing was written.`);
    }
    if (held.transaction_id !== transactionId) {
      corridorFail(
        `another closure is already running for ${missionId} (${lock}) — lock belongs to a different transaction; nothing was written.`,
      );
    }
    if (held.pid === process.pid) return lock;
    if (processIsAlive(held.pid)) {
      corridorFail(`another closure is already running for ${missionId} (${lock}) — nothing was written.`);
    }

    // Preserve the dead owner's bytes before releasing the stale mutex. The
    // same transaction may recover; a different transaction may never take it.
    const historyDir = join(dir, ".closure-lock-history");
    const historyPath = join(
      historyDir,
      `${sha256CanonicalJsonV1(held).slice("sha256:".length)}.json`,
    );
    await mkdir(historyDir, { recursive: true, mode: 0o700 });
    try {
      await writeFile(historyPath, raw, { flag: "wx", mode: 0o600 });
    } catch (err) {
      if (err?.code !== "EEXIST" || await readFileFs(historyPath, "utf8") !== raw) {
        corridorFail(`stale closure lock preservation failed closed (${err?.code ?? "conflict"}) — nothing was written.`);
      }
    }
    try {
      unlinkSync(lock);
    } catch (err) {
      if (err?.code !== "ENOENT") {
        corridorFail(`stale closure lock release failed closed (${err?.code ?? "unknown"}) — nothing was written.`);
      }
    }
  }
  corridorFail("closure lock acquisition did not converge — nothing was written.");
}

// C3 shares one canonical ledger and one anchor tail across every mission.
// Per-mission locks cannot prevent two different missions from reading the
// same ledger head and overwriting/reordering each other's evidence, so the
// entire closure is additionally serialized under one DEMA_HOME tail lock.
// A dead lock may be recovered only by its exact C1/C2 transaction; a different
// transaction must resume the owner first instead of skipping unfinished work.
async function acquireClosureTailLock({ home, missionId, transactionId }) {
  const lockDir = join(home, "receipts");
  const lock = join(lockDir, ".corridor-closure-tail.lock");
  const historyDir = join(lockDir, ".corridor-closure-tail-lock-history");
  await mkdir(lockDir, { recursive: true, mode: 0o700 });
  const body = Object.freeze({
    schema: "bizra.dema.corridor_closure_tail_lock.v1",
    pid: process.pid,
    mission_id: missionId,
    transaction_id: transactionId,
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await writeFile(lock, `${JSON.stringify(body)}\n`, { flag: "wx", mode: 0o600 });
      await syncFileAndParent(lock);
      process.on("exit", () => {
        try { unlinkSync(lock); } catch { /* already released */ }
      });
      return lock;
    } catch (err) {
      if (err?.code !== "EEXIST") {
        corridorFail(`closure tail lock failed closed (${err?.code ?? "unknown_error"}) — nothing was written.`);
      }
    }

    let raw;
    let held;
    try {
      raw = await readFileFs(lock, "utf8");
      held = JSON.parse(raw);
    } catch {
      corridorFail(`closure tail lock is unreadable (${lock}) — refusing to guess; nothing was written.`);
    }
    if (held.transaction_id !== transactionId) {
      corridorFail(
        `canonical closure tail is owned by another transaction (${lock}); resume that transaction first — nothing was written.`,
      );
    }
    if (held.pid === process.pid) return lock;
    if (processIsAlive(held.pid)) {
      corridorFail(`canonical closure tail is active in another process (${lock}) — nothing was written.`);
    }

    await mkdir(historyDir, { recursive: true, mode: 0o700 });
    const historyPath = join(
      historyDir,
      `${sha256CanonicalJsonV1(held).slice("sha256:".length)}.json`,
    );
    try {
      await writeFile(historyPath, raw, { flag: "wx", mode: 0o600 });
      await syncFileAndParent(historyPath);
    } catch (err) {
      if (err?.code !== "EEXIST" || await readFileFs(historyPath, "utf8") !== raw) {
        corridorFail(`stale closure tail preservation failed closed (${err?.code ?? "conflict"}) — nothing was written.`);
      }
    }
    try {
      unlinkSync(lock);
    } catch (err) {
      if (err?.code !== "ENOENT") {
        corridorFail(`stale closure tail release failed closed (${err?.code ?? "unknown"}) — nothing was written.`);
      }
    }
  }
  corridorFail("closure tail lock acquisition did not converge — nothing was written.");
}

async function verifyBoundClosureArtifacts({
  home, terminal, transactionState, requireResolved = false,
}) {
  const fail = (reason) => Object.freeze({ ok: false, reason });
  if (!transactionState?.ok || !transactionState.exists) return fail("c2_transaction_unverifiable");
  const phases = transactionState.events.map((event) => event.phase);
  const required = [
    "PREPARED", "EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED", "VERIFIED", "SEALED",
    "LEDGER_COMMITTED", "ANCHORED",
  ];
  if (!required.every((phase, index) => phases[index] === phase)) {
    return fail("c2_required_prefix_missing");
  }
  if (requireResolved) {
    const resolved = transactionState.events[required.length];
    const terminalRefs = resolved?.evidence_refs?.filter(
      (ref) => ref?.schema === "bizra.dema.corridor_terminal_evidence.v1",
    ) ?? [];
    if (phases.length !== required.length + 1
        || resolved?.phase !== "RESOLVED"
        || transactionState.phase !== "RESOLVED"
        || transactionState.terminal !== true
        || transactionState.terminal_outcome !== terminal.terminal_outcome
        || terminalRefs.length !== 1
        || terminalRefs[0].corridor_event_hash !== terminal.event_hash
        || terminalRefs[0].corridor_event_index !== terminal.index
        || terminalRefs[0].anchor_hash !== terminal.anchor_hash) {
      return fail("c2_terminal_resolution_missing");
    }
  }
  const sealedRef = transactionState.events
    .find((event) => event.phase === "SEALED")
    ?.evidence_refs?.find((ref) => ref?.schema === "bizra.dema.corridor_rename_seal_evidence.v1");
  if (!sealedRef?.omega0_card
      || sealedRef.seal_head !== terminal.seal_head
      || sealedRef.prepared_intent_hash !== terminal.prepared_intent_hash) {
    return fail("c2_seal_binding_mismatch");
  }

  let entries;
  let publicKey;
  try {
    entries = await loadCanonicalLedger({ demaHome: home });
    publicKey = await loadPublicKey(home);
  } catch {
    return fail("canonical_ledger_unreadable");
  }
  if (!publicKey) return fail("canonical_ledger_key_missing");
  let verifiedLedger;
  try {
    verifiedLedger = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: publicKey });
  } catch {
    return fail("canonical_ledger_unreadable");
  }
  if (!verifiedLedger.verified) return fail(`canonical_ledger_${verifiedLedger.reason ?? "invalid"}`);
  const matches = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry?.canonical_body?.closure_transaction_id === terminal.closure_transaction_id);
  if (matches.length !== 1) return fail("canonical_ledger_transaction_membership_invalid");
  const { entry, index: ledgerIndex } = matches[0];
  if (entry.receipt_id !== terminal.ledger_head
      || entry.canonical_body?.seal_head !== terminal.seal_head
      || entry.canonical_body?.consent_claim_hash !== terminal.consent_claim_hash
      || entry.canonical_body?.prepared_intent_hash !== terminal.prepared_intent_hash) {
    return fail("canonical_ledger_binding_mismatch");
  }

  let anchorLog;
  try {
    anchorLog = readClosureAnchorLog({ demaHome: home });
  } catch {
    return fail("closure_anchor_unreadable");
  }
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const anchorVerification = verifyAnchorLog(anchorLog, hash);
  if (!anchorVerification.intact) return fail(`closure_anchor_${anchorVerification.verdict.toLowerCase()}`);
  for (let i = 1; i < anchorLog.length; i += 1) {
    if (!Number.isInteger(anchorLog[i - 1].entries)
        || !Number.isInteger(anchorLog[i].entries)
        || anchorLog[i].entries <= anchorLog[i - 1].entries) {
      return fail("closure_anchor_prefix_not_monotonic");
    }
  }
  const anchors = anchorLog.filter((record) => record.anchor_hash === terminal.anchor_hash);
  if (anchors.length !== 1
      || anchors[0].head !== terminal.ledger_head
      || anchors[0].entries !== ledgerIndex + 1) {
    return fail("closure_anchor_binding_mismatch");
  }
  return Object.freeze({ ok: true, sealedRef, ledgerEntry: entry, anchorRecord: anchors[0] });
}

// Two-step root-bound consent for a corridor write
// (ROOT_BOUND_CONSENT_ENVELOPE_PREVIEW_REUSED — the envelope kernel is imported
// unmodified via the corridor kernel). Step 1 (no --consent): print the derived
// consent card (required phrase + consent_context_hash) and write NOTHING.
// Step 2: validate phrase + nonce + expiry + context commitment fail-closed,
// then the caller performs the disclosed write. A phrase alone is never enough.
async function corridorConsentGate(argv, {
  kind, mission_id, contract_hash, permitted_actions, mission_root, now_iso,
  wantJson, cardExtra = {}, rerunHint = "", requested_state, prepared_intent_hash,
}) {
  const nonce = argValue(argv, "--nonce") ?? "";
  const expires_at = argValue(argv, "--expires") ?? "";
  const phrase = argValue(argv, "--consent");
  const consent_context_hash = argValue(argv, "--consent-context") ?? "";
  if (nonce.length === 0 || expires_at.length === 0) {
    corridorFail(
      "root-bound consent requires --nonce <unique> and --expires <iso> (a phrase alone is not authority) — nothing was written.",
    );
  }
  const ctx = buildCorridorConsentContext({
    kind, mission_id, contract_hash, permitted_actions, mission_root, nonce,
    expires_at, requested_state, prepared_intent_hash,
  });
  if (!ctx.ok) corridorFail(`consent context blocked: ${ctx.blocked_by.join(", ")} — nothing was written.`);
  if (!phrase) {
    const rerun = `${rerunHint}--nonce ${nonce} --expires ${expires_at} --consent "${ctx.envelope.required_phrase}" --consent-context ${ctx.envelope.consent_context_hash}`;
    const card = {
      ok: true,
      step: "CONSENT_CARD",
      kind,
      mission_id,
      contract_hash,
      ...(prepared_intent_hash ? { prepared_intent_hash } : {}),
      ...cardExtra,
      required_phrase: ctx.envelope.required_phrase,
      consent_context_hash: ctx.envelope.consent_context_hash,
      action_class: ctx.envelope.action_class,
      mission_root,
      nonce,
      expires_at,
      rerun_with: rerun,
      boundary: corridorIoBoundary({}),
    };
    if (wantJson) console.log(JSON.stringify(card, null, 2));
    else {
      console.log("DEMA · mission corridor consent card (nothing written):");
      console.log(`  required phrase:      "${ctx.envelope.required_phrase}"`);
      console.log(`  consent_context_hash: ${ctx.envelope.consent_context_hash}`);
      console.log(`  binds: contract ${contract_hash}`);
      if (prepared_intent_hash) console.log(`         prepared intent ${prepared_intent_hash}`);
      console.log(`         root ${mission_root} · class ${ctx.envelope.action_class} · nonce ${nonce} · expires ${expires_at}`);
      console.log(`  authorize exactly this context by re-running with: ${rerun}`);
    }
    return null; // consent card printed; no write happens
  }
  // Persistent replay protection is the atomic create-only reservation the
  // caller performs AFTER this verdict and BEFORE any mutation — never a
  // read-back of prior state, which would fail open.
  const verdict = evaluateCorridorWriteConsent({
    kind, mission_id, contract_hash, permitted_actions, mission_root,
    phrase, nonce, expires_at, consent_context_hash,
    now: now_iso,
    requested_state,
    prepared_intent_hash,
  });
  if (!verdict.ok) {
    corridorFail(`root-bound consent BLOCKED: ${verdict.blocked_by.join(", ")} — nothing was written.`);
  }
  return Object.freeze({ ...verdict, nonce, expires_at });
}

function printCorridorStatus(status, wantJson) {
  if (wantJson) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  console.log("DEMA · mission corridor (control plane · PREVIEW_ONLY)");
  console.log(`  mission: ${status.mission_id} · state: ${status.state}${status.terminal ? " (terminal)" : ""}`);
  console.log(`  lease_expired: ${status.lease_expired} · repair_budget_remaining: ${status.repair_budget_remaining}`);
  console.log(`  requires_human: ${status.requires_human}${status.blocked_by.length ? ` · blocked_by: ${status.blocked_by.join(", ")}` : ""}`);
  const r = status.resume_point;
  console.log("  resume point (derived from disk alone — no chat, no model):");
  console.log(`    branch:       ${r.branch ?? "-"}`);
  console.log(`    head_sha:     ${r.head_sha ?? "-"}`);
  console.log(`    failing_gate: ${r.failing_gate ?? "-"}`);
  console.log(`    next_command: ${r.next_command ?? "-"}`);
  if (status.closure_verification) {
    console.log(
      `  closure artifacts: ${status.closure_verification.verified ? "VERIFIED" : "BLOCKED"}`
      + `${status.closure_verification.reason ? ` · ${status.closure_verification.reason}` : ""}`,
    );
  }
  console.log("  control plane only — no worker, no daemon, nothing runs.");
}

async function cmdMissionCorridor(argv) {
  const verb = argv[2];
  const wantJson = wantsJson(argv);

  if (verb === "start") {
    const id = argValue(argv, "--id") ?? "";
    const nowIso = argValue(argv, "--now") || new Date().toISOString();
    // The contract's creation timestamp is CONSENTED, never re-derived: the
    // consent-card phase fixes it once (from --created-at or this run's now),
    // and the authorizing phase must carry it back explicitly — otherwise a
    // later clock would silently change the contract hash the human approved.
    const createdAtArg = argValue(argv, "--created-at");
    if (argValue(argv, "--consent") && !createdAtArg) {
      corridorFail(
        "root-bound consent authorization requires --created-at <iso> exactly as printed on the consent card (the contract timestamp is part of the approved context; a phrase alone is not authority) — nothing was written.",
      );
    }
    const createdAt = createdAtArg || nowIso;
    const built = buildMissionContract({
      mission_id: id,
      objective: argValue(argv, "--objective") ?? "",
      base_sha: argValue(argv, "--base-sha") ?? "",
      permitted_actions: (argValue(argv, "--permitted") || "analyze,branch,edit,test,commit,push,open_draft_pr")
        .split(",").map((s) => s.trim()).filter(Boolean),
      merge_policy: "checkpoint_required",
      time_budget_hours: Number(argValue(argv, "--time-budget-hours") ?? 8),
      repair_budget_per_slice: Number(argValue(argv, "--repair-budget") ?? 2),
      stop_conditions: (argValue(argv, "--stop-conditions") || "historical_hash_change,gate_weakened,base_moved")
        .split(",").map((s) => s.trim()).filter(Boolean),
      created_at_iso: createdAt,
    });
    if (!built.ok) corridorFail(`corridor contract blocked: ${built.blocked_by.join(", ")} — nothing was written.`);
    const dir = join(corridorHome(argv), "missions", id);
    const verdict = await corridorConsentGate(argv, {
      kind: "START",
      mission_id: id,
      contract_hash: built.contract_hash,
      permitted_actions: [...built.contract.permitted_actions],
      mission_root: dir,
      now_iso: nowIso,
      wantJson,
      cardExtra: { created_at_iso: createdAt },
      rerunHint: `--created-at ${createdAt} `,
    });
    if (!verdict) return; // consent card printed; nothing written
    // C1 is the one atomic replay authority. Claim before any protected write.
    await claimCorridorWriteNonce(argv, {
      nonce: verdict.nonce,
      consent_context_hash: verdict.consent_context_hash,
      mission_id: id,
      kind: "START",
      contract_hash: built.contract_hash,
      claimed_at_iso: nowIso,
    });
    const first = appendCorridorEvent({
      contract_hash: built.contract_hash,
      journal: [],
      event: {
        state: "CREATED",
        at_iso: nowIso,
        note: `corridor created · consent_context: ${verdict.consent_context_hash}`,
        next_command: `dema mission corridor status ${id}`,
      },
    });
    if (!first.ok) corridorFail(`corridor journal blocked: ${first.blocked_by.join(", ")}`);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    try {
      await writeFile(
        join(dir, "contract.json"),
        `${JSON.stringify({ schema: built.schema, truth_label: built.truth_label, contract: built.contract, contract_hash: built.contract_hash }, null, 2)}\n`,
        { flag: "wx", mode: 0o600 },
      );
      await writeFile(join(dir, "journal.jsonl"), `${JSON.stringify(first.event)}\n`, { flag: "wx", mode: 0o600 });
    } catch (err) {
      // The nonce reservation above stays consumed on this failure path —
      // burning a nonce is safer than ever replaying authority.
      if (err.code === "EEXIST") corridorFail(`corridor "${id}" already exists at ${dir} — refusing to clobber.`);
      throw err;
    }
    const out = {
      ok: true,
      mission_id: id,
      contract_hash: built.contract_hash,
      consent_context_hash: verdict.consent_context_hash,
      truth_label: built.truth_label,
      boundary: corridorIoBoundary({ wrote: true, consented: true }),
      dir,
    };
    if (wantJson) console.log(JSON.stringify(out, null, 2));
    else {
      console.log(`DEMA · mission corridor started: ${id}`);
      console.log(`  contract_hash: ${built.contract_hash}`);
      console.log(`  state dir: ${dir}`);
      console.log("  control plane only — no worker, no daemon, nothing runs.");
    }
    return;
  }

  if (verb === "status" || verb === "resume") {
    const id = argv[3];
    if (!id || !MISSION_ID_RE.test(id)) corridorFail("mission corridor id required (lowercase kebab).");
    const dir = join(corridorHome(argv), "missions", id);
    const loaded = await readCorridor(dir);
    const status = deriveCorridorStatus({
      contract: loaded.contractDoc.contract,
      contract_hash: loaded.contractDoc.contract_hash,
      journal: loaded.journal,
      now_iso: argValue(argv, "--now") || new Date().toISOString(),
    });
    if (!status.ok) corridorFail(`corridor state invalid (tamper or corruption): ${status.blocked_by.join(", ")}`);
    const last = loaded.journal.at(-1);
    let closureVerification = null;
    if (last?.state === "COMPLETE" && last.closure_transaction_id) {
      const tx = await replayClosureTransaction({
        demaHome: corridorHome(argv),
        transactionId: last.closure_transaction_id,
      });
      const artifacts = await verifyBoundClosureArtifacts({
        home: corridorHome(argv),
        terminal: last,
        transactionState: tx,
        requireResolved: true,
      });
      closureVerification = Object.freeze({
        verified: artifacts.ok === true,
        reason: artifacts.ok ? null : artifacts.reason,
      });
    }
    const reported = Object.freeze({
      ...status,
      ...(closureVerification ? { closure_verification: closureVerification } : {}),
      boundary: corridorIoBoundary({ read: true }),
    });
    printCorridorStatus(reported, wantJson);
    if (closureVerification?.verified === false) process.exitCode = 1;
    return;
  }

  if (verb === "stop") {
    const id = argv[3];
    if (!id || !MISSION_ID_RE.test(id)) corridorFail("mission corridor id required (lowercase kebab).");
    const dir = join(corridorHome(argv), "missions", id);
    const loaded = await readCorridor(dir);
    const chain = verifyCorridorJournal({
      contract: loaded.contractDoc.contract,
      contract_hash: loaded.contractDoc.contract_hash,
      journal: loaded.journal,
    });
    if (!chain.ok) {
      corridorFail(`refusing to extend a tampered/corrupt journal: ${chain.blocked_by.join(", ")}`);
    }
    const nowIso = argValue(argv, "--now") || new Date().toISOString();
    const verdict = await corridorConsentGate(argv, {
      kind: "STOP",
      mission_id: id,
      contract_hash: loaded.contractDoc.contract_hash,
      permitted_actions: [...loaded.contractDoc.contract.permitted_actions],
      mission_root: dir,
      now_iso: nowIso,
      wantJson,
    });
    if (!verdict) return; // consent card printed; nothing written
    await claimCorridorWriteNonce(argv, {
      nonce: verdict.nonce,
      consent_context_hash: verdict.consent_context_hash,
      mission_id: id,
      kind: "STOP",
      contract_hash: loaded.contractDoc.contract_hash,
      checkpoint_event_hash: loaded.journal.at(-1)?.event_hash,
      claimed_at_iso: nowIso,
    });
    const r = appendCorridorEvent({
      contract_hash: loaded.contractDoc.contract_hash,
      journal: loaded.journal,
      event: {
        state: "STOPPED",
        at_iso: nowIso,
        requires_human: true,
        note: `${argValue(argv, "--note") || "operator stop"} · consent_context: ${verdict.consent_context_hash}`,
      },
    });
    if (!r.ok) corridorFail(`corridor stop blocked: ${r.blocked_by.join(", ")}`);
    await appendCorridorJournalEvent(dir, r.event);
    const out = { ok: true, mission_id: id, state: "STOPPED", event_hash: r.event.event_hash, consent_context_hash: verdict.consent_context_hash, boundary: corridorIoBoundary({ read: true, wrote: true, consented: true }) };
    if (wantJson) console.log(JSON.stringify(out, null, 2));
    else console.log(`DEMA · mission corridor stopped: ${id} (kill switch honored; journal sealed)`);
    return;
  }

  // Walk the corridor one consented state at a time. Every advance is a durable
  // journal event; the TARGET STATE is bound into the consent phrase, so an
  // approved advance can never be replayed against a different transition.
  if (verb === "advance") {
    const id = argv[3];
    if (!id || !MISSION_ID_RE.test(id)) corridorFail("mission corridor id required (lowercase kebab).");
    const to = (argValue(argv, "--to") ?? "").toUpperCase();
    if (!to) corridorFail("--to <STATE> required (the target state is part of the consent phrase).");
    const dir = join(corridorHome(argv), "missions", id);
    const loaded = await readCorridor(dir);
    const chain = verifyCorridorJournal({
      contract: loaded.contractDoc.contract,
      contract_hash: loaded.contractDoc.contract_hash,
      journal: loaded.journal,
    });
    if (!chain.ok) corridorFail(`refusing to extend a tampered/corrupt journal: ${chain.blocked_by.join(", ")}`);
    const last = loaded.journal[loaded.journal.length - 1];
    const allowed = CORRIDOR_TRANSITIONS[last.state] ?? [];
    if (!allowed.includes(to)) {
      corridorFail(
        `transition not allowed: ${last.state} → ${to}. Allowed from ${last.state}: ${allowed.join(", ") || "(terminal)"} — nothing was written.`,
      );
    }
    if (to === "COMPLETE") {
      corridorFail("COMPLETE is not reachable via advance — use `dema mission corridor complete <id>`, which runs the verified closure. Nothing was written.");
    }
    const nowIso = argValue(argv, "--now") || new Date().toISOString();
    const verdict = await corridorConsentGate(argv, {
      kind: "ADVANCE",
      mission_id: id,
      contract_hash: loaded.contractDoc.contract_hash,
      permitted_actions: [...loaded.contractDoc.contract.permitted_actions],
      mission_root: dir,
      now_iso: nowIso,
      wantJson,
      requested_state: to,
    });
    if (!verdict) return; // consent card printed; nothing written
    await claimCorridorWriteNonce(argv, {
      nonce: verdict.nonce,
      consent_context_hash: verdict.consent_context_hash,
      mission_id: id,
      kind: "ADVANCE",
      contract_hash: loaded.contractDoc.contract_hash,
      checkpoint_event_hash: loaded.journal.at(-1)?.event_hash,
      claimed_at_iso: nowIso,
    });
    const r = appendCorridorEvent({
      contract_hash: loaded.contractDoc.contract_hash,
      journal: loaded.journal,
      event: {
        state: to,
        at_iso: nowIso,
        note: `${argValue(argv, "--note") || `operator advance → ${to}`} · consent_context: ${verdict.consent_context_hash}`,
        next_command: to === "CHECKPOINT" ? `dema mission corridor complete ${id}` : `dema mission corridor status ${id}`,
      },
    });
    if (!r.ok) corridorFail(`corridor advance blocked: ${r.blocked_by.join(", ")}`);
    await appendCorridorJournalEvent(dir, r.event);
    const out = {
      ok: true, mission_id: id, state: to, event_hash: r.event.event_hash,
      consent_context_hash: verdict.consent_context_hash,
      boundary: corridorIoBoundary({ read: true, wrote: true, consented: true }),
    };
    if (wantJson) console.log(JSON.stringify(out, null, 2));
    else console.log(`DEMA · mission corridor advanced: ${id} → ${to}`);
    return;
  }

  // THE WELD, bound to disk. The corridor authorises; Omega0 performs one
  // bounded, anchored, reversible effect; an in-process judge-free verifier admits it;
  // the canonical ledger records it; only then may COMPLETE exist.
  if (verb === "complete") {
    const id = argv[3];
    if (!id || !MISSION_ID_RE.test(id)) corridorFail("mission corridor id required (lowercase kebab).");
    const home = corridorHome(argv);
    const dir = join(home, "missions", id);
    const loaded = await readCorridor(dir);
    const chain = verifyCorridorJournal({
      contract: loaded.contractDoc.contract,
      contract_hash: loaded.contractDoc.contract_hash,
      journal: loaded.journal,
    });
    if (!chain.ok) corridorFail(`refusing to complete a tampered/corrupt journal: ${chain.blocked_by.join(", ")}`);
    const last = loaded.journal[loaded.journal.length - 1];
    if (last.state === "COMPLETE") {
      const requestedNonce = argValue(argv, "--nonce");
      const priorCheckpoint = loaded.journal[loaded.journal.length - 2];
      const seen = requestedNonce
        ? await inspectConsentNonce({ nonce: requestedNonce, demaHome: home })
        : null;
      const claim = seen?.claim;
      const exactTerminalRecovery = seen?.claim_hash_valid === true
        && priorCheckpoint?.state === "CHECKPOINT"
        && claim?.claim_hash === last.consent_claim_hash
        && claim?.transaction_id === last.closure_transaction_id
        && claim?.prepared_intent_hash === last.prepared_intent_hash
        && claim?.checkpoint_event_hash === priorCheckpoint.event_hash
        && claim?.mission_id === id
        && claim?.contract_hash === loaded.contractDoc.contract_hash
        && claim?.recovery_policy_hash === CORRIDOR_RENAME_RECOVERY_POLICY_HASH;
      if (!exactTerminalRecovery) {
        corridorFail("corridor is already COMPLETE; terminal recovery requires the exact original C1 nonce and bindings.");
      }
      const verdict = await corridorConsentGate(argv, {
        kind: "COMPLETE",
        mission_id: id,
        contract_hash: loaded.contractDoc.contract_hash,
        permitted_actions: [...loaded.contractDoc.contract.permitted_actions],
        mission_root: dir,
        now_iso: claim.claimed_at_iso,
        wantJson,
        requested_state: "COMPLETE",
        prepared_intent_hash: claim.prepared_intent_hash,
      });
      if (!verdict) return;
      const resumedClaim = await claimCorridorWriteNonce(argv, {
        nonce: verdict.nonce,
        consent_context_hash: verdict.consent_context_hash,
        mission_id: id,
        kind: "COMPLETE",
        contract_hash: loaded.contractDoc.contract_hash,
        checkpoint_event_hash: priorCheckpoint.event_hash,
        prepared_intent_hash: claim.prepared_intent_hash,
        recovery_policy_hash: CORRIDOR_RENAME_RECOVERY_POLICY_HASH,
        claimed_at_iso: claim.claimed_at_iso,
        allow_resume: true,
      });
      await acquireClosureLock({
        dir,
        missionId: id,
        transactionId: resumedClaim.transaction_id,
      });
      await acquireClosureTailLock({
        home,
        missionId: id,
        transactionId: resumedClaim.transaction_id,
      });

      const tx = await replayClosureTransaction({
        demaHome: home,
        transactionId: resumedClaim.transaction_id,
      });
      if (!tx.ok) corridorFail(`terminal C2 recovery failed closed (${tx.reason}).`);
      const artifacts = await verifyBoundClosureArtifacts({
        home,
        terminal: last,
        transactionState: tx,
      });
      if (!artifacts.ok) {
        corridorFail(`terminal artifact recovery failed closed (${artifacts.reason}).`);
      }
      const sealedRef = artifacts.sealedRef;
      const resolved = await appendClosureTransactionPhase({
        demaHome: home,
        transactionId: resumedClaim.transaction_id,
        phase: "RESOLVED",
        terminalOutcome: "COMPLETED_VERIFIED",
        evidenceRefs: [{
          schema: "bizra.dema.corridor_terminal_evidence.v1",
          corridor_event_hash: last.event_hash,
          corridor_event_index: last.index,
          anchor_hash: last.anchor_hash,
        }],
        atIso: claim.claimed_at_iso,
      });
      if (!resolved.ok) corridorFail(`terminal C2 recovery failed closed (${resolved.reason}).`);
      const resolvedArtifacts = await verifyBoundClosureArtifacts({
        home,
        terminal: last,
        transactionState: resolved.state,
        requireResolved: true,
      });
      if (!resolvedArtifacts.ok) {
        corridorFail(`terminal C2 recovery verification failed closed (${resolvedArtifacts.reason}).`);
      }

      const closureRecord = {
        schema: "bizra.dema.mission_corridor_closure_record.v0.1",
        mission_id: id,
        contract_hash: loaded.contractDoc.contract_hash,
        state: "COMPLETE",
        terminal_outcome: "COMPLETED_VERIFIED",
        event_hash: last.event_hash,
        seal_head: last.seal_head,
        ledger_head: last.ledger_head,
        anchor_hash: last.anchor_hash,
        closure_transaction_id: last.closure_transaction_id,
        consent_claim_hash: last.consent_claim_hash,
        prepared_intent_hash: last.prepared_intent_hash,
        omega0_card: sealedRef.omega0_card,
        at_iso: last.at_iso,
        verify_with: `dema mission corridor status ${id}`,
      };
      const closureBytes = `${JSON.stringify(closureRecord, null, 2)}\n`;
      const closurePath = join(dir, "closure.json");
      try {
        await writeFile(closurePath, closureBytes, { flag: "wx", mode: 0o600 });
      } catch (err) {
        if (err?.code !== "EEXIST" || await readFileFs(closurePath, "utf8") !== closureBytes) {
          corridorFail(`closure record conflict (${err?.code ?? "semantic_drift"}) — C2 remains authoritative.`);
        }
      }
      try {
        await syncFileAndParent(closurePath);
      } catch (err) {
        corridorFail(`closure record durability uncertain (${err?.code ?? "unknown"}) — C2 remains authoritative.`);
      }
      const out = {
        ok: true,
        mission_id: id,
        state: "COMPLETE",
        terminal_outcome: "COMPLETED_VERIFIED",
        event_hash: last.event_hash,
        seal_head: last.seal_head,
        ledger_head: last.ledger_head,
        anchor_hash: last.anchor_hash,
        consent_context_hash: claim.consent_context_hash,
        recovered: true,
        boundary: corridorIoBoundary({ read: true, wrote: true, consented: true }),
      };
      if (wantJson) console.log(JSON.stringify(out, null, 2));
      else console.log(`DEMA · mission corridor COMPLETE (recovered): ${id}`);
      return;
    }
    if (last.state !== "CHECKPOINT") {
      corridorFail(
        `COMPLETE is reachable only from CHECKPOINT; corridor is at ${last.state}. Advance it first — nothing was written.`,
      );
    }

    // The leased scope is the mission's evidence estate. The bounded effect is a
    // single rename inside it: Omega0 verifies content conservation, so the act
    // must preserve the file count — a rename qualifies, a create does not.
    const estate = join(dir, "estate");
    const fromName = argValue(argv, "--from") || "closure-evidence.draft.json";
    const toName = argValue(argv, "--to") || "closure-evidence.sealed.json";
    const requestedNonce = argValue(argv, "--nonce");
    let recoveryClaim = null;
    if (requestedNonce) {
      const seen = await inspectConsentNonce({ nonce: requestedNonce, demaHome: home });
      if (seen.corrupt === true) {
        corridorFail(`consent nonce inspection failed closed (${seen.reason ?? "corrupt_claim"}) — nothing was written.`);
      }
      if (seen.used === true) {
        const candidate = seen.claim;
        const exactRecovery = candidate
          && seen.claim_hash_valid === true
          && candidate.action_class === CORRIDOR_WRITE_ACTION_CLASS
          && candidate.action_kind === "COMPLETE"
          && candidate.mission_id === id
          && candidate.contract_hash === loaded.contractDoc.contract_hash
          && candidate.checkpoint_event_hash === last.event_hash
          && candidate.recovery_policy_hash === CORRIDOR_RENAME_RECOVERY_POLICY_HASH;
        if (!exactRecovery) {
          corridorFail("root-bound consent BLOCKED: nonce_replayed (claim does not bind this exact closure) — nothing was written.");
        }
        recoveryClaim = candidate;
      }
    }
    const prepared = await resolveRenameEffectIntent({
      demaHome: home,
      claim: recoveryClaim,
      scopeRoot: estate,
      from: fromName,
      to: toName,
    });
    if (!prepared.ok) {
      corridorFail(`closure effect intent blocked: ${prepared.reason} — nothing was written.`);
    }

    let recoveryPhase = null;
    if (recoveryClaim) {
      const recoveryTx = await replayClosureTransaction({
        demaHome: home,
        transactionId: recoveryClaim.transaction_id,
      });
      if (!recoveryTx.ok && recoveryTx.exists !== false) {
        corridorFail(`closure transaction replay failed closed (${recoveryTx.reason}) — nothing was written.`);
      }
      recoveryPhase = recoveryTx.exists === true ? recoveryTx.phase : null;
    }
    const evidenceTailPhases = new Set([
      "EFFECT_APPLIED", "VERIFIED", "SEALED", "LEDGER_COMMITTED", "ANCHORED", "RESOLVED",
    ]);
    // Before EFFECT_APPLIED exists, retrying may still cross the world boundary,
    // so consent expiry is evaluated against the current/injected clock. Once
    // the effect is durably witnessed, recovery may finish its evidence tail
    // using the original claimed_at time so content-addressed receipts do not
    // drift. A post-state with only INTENT remains fail-closed after expiry.
    const nowIso = recoveryClaim && evidenceTailPhases.has(recoveryPhase)
      ? recoveryClaim.claimed_at_iso
      : argValue(argv, "--now") || new Date().toISOString();
    const verdict = await corridorConsentGate(argv, {
      kind: "COMPLETE",
      mission_id: id,
      contract_hash: loaded.contractDoc.contract_hash,
      permitted_actions: [...loaded.contractDoc.contract.permitted_actions],
      mission_root: dir,
      now_iso: nowIso,
      wantJson,
      requested_state: "COMPLETE",
      prepared_intent_hash: prepared.prepared_intent_hash,
    });
    if (!verdict) return; // consent card printed; nothing written

    // C1 is digest-addressed and never places the raw nonce in a path. The CLI
    // retains this narrower interoperable shape so older local markers remain
    // detectable; this is a compatibility restriction, not the C1 storage key.
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(verdict.nonce)) {
      corridorFail("--nonce must match [A-Za-z0-9][A-Za-z0-9_-]{0,127} (it addresses a single-use consent file) — nothing was written.");
    }
    const consentClaim = await claimCorridorWriteNonce(argv, {
      nonce: verdict.nonce,
      consent_context_hash: verdict.consent_context_hash,
      mission_id: id,
      kind: "COMPLETE",
      contract_hash: loaded.contractDoc.contract_hash,
      checkpoint_event_hash: last.event_hash,
      prepared_intent_hash: prepared.prepared_intent_hash,
      recovery_policy_hash: CORRIDOR_RENAME_RECOVERY_POLICY_HASH,
      claimed_at_iso: nowIso,
      allow_resume: true,
    });

    // Serialize the entire closure under the C1 transaction identity. A dead
    // lock may be recovered only by that same transaction; a different claim
    // never inherits prior authority.
    await acquireClosureLock({
      dir,
      missionId: id,
      transactionId: consentClaim.transaction_id,
    });
    await acquireClosureTailLock({
      home,
      missionId: id,
      transactionId: consentClaim.transaction_id,
    });

    // Anchor inputs are observed before this attempt. On recovery they may
    // already include this transaction's exact receipt/anchor; every downstream
    // writer below is transaction-idempotent and validates before reuse.
    const observed = await observeCanonicalLedger({ demaHome: home });
    const anchorLog = readClosureAnchorLog({ demaHome: home });
    const expiresMs = Date.parse(verdict.expires_at);
    const mission = { objective: loaded.contractDoc.contract.objective, root: estate };
    const lease = {
      lease_id: `corridor-${id}`,
      scope_root: estate,
      expires_at: expiresMs,
      budget_acts: 1,
    };
    const consent = {
      by: "operator",
      ref: verdict.consent_context_hash,
      nonce: verdict.nonce,
      plan_hash: prepared.intent.plan_hash,
    };
    const anchorDir = join(home, "anchors");
    const effect = buildRenameEffectAdapter({
      scopeRoot: estate, from: fromName, to: toName, anchorLog, observed,
    });

    const mechanical = await runTransactionalMechanicalClosure({
      demaHome: home,
      claim: consentClaim,
      prepared,
      mission,
      lease,
      consent,
      anchorDir,
      effect,
    });
    if (!mechanical.ok) {
      corridorFail(
        `closure transaction requires recovery at ${mechanical.transaction_state?.phase ?? "C1"}: ${mechanical.reason} — no corridor terminal was written; re-run this exact transaction after inspection.`,
      );
    }

    const result = await runCorridorClosure({
      contract: { mission_id: id },
      contract_hash: loaded.contractDoc.contract_hash,
      journal: loaded.journal,
      mission,
      lease,
      consent,
      anchorDir,
      effect,
      now: Date.parse(nowIso),
      omega0Card: mechanical.omega0_card,
      transactionBinding: {
        transaction_id: consentClaim.transaction_id,
        consent_claim_hash: consentClaim.claim_hash,
        prepared_intent_hash: prepared.prepared_intent_hash,
      },
      appendReceipt: buildLedgerAppender({
        demaHome: home,
        now: nowIso,
        transactionId: consentClaim.transaction_id,
      }),
      // Judge-free and STRUCTURALLY separated: the party that proposed the act is
      // not the party that certifies it (verification-admission F2). Both still run
      // in THIS process — this is not organisational or cryptographic independence.
      verifyAdmission: ({ card }) => {
        const a = evaluateVerificationAdmission({
          proposed_act: `corridor-closure:${id}`,
          verifier: "hash_equality",
          proposer: "corridor-closure-effect-adapter",
          certifier: "omega0-mechanical-closure-route",
          bindings: { expected_post_sha256: card.after_hash },
        });
        return { admitted: a.self_verifiable === true, reason: a.refusal_reason ?? null };
      },
      consentRegistry: buildClaimBoundConsentRegistry({ demaHome: home, claim: consentClaim }),
    });
    if (result.state !== "COMPLETE" || !result.ledger_head || !result.ledger_length) {
      corridorFail(
        `closure tail requires recovery: ${result.terminal_outcome}${result.error ? ` (${result.error})` : ""} — no corridor terminal was written; re-run this exact transaction.`,
      );
    }

    const ledgerPhase = await appendClosureTransactionPhase({
      demaHome: home,
      transactionId: consentClaim.transaction_id,
      phase: "LEDGER_COMMITTED",
      evidenceRefs: [{
        schema: "bizra.dema.corridor_ledger_commit_evidence.v1",
        receipt_id: result.ledger_head,
        ledger_prefix_length: result.ledger_length,
        seal_head: result.omega0_card.seal_head,
      }],
      atIso: nowIso,
    });
    if (!ledgerPhase.ok) {
      corridorFail(`C2 ledger witness failed closed (${ledgerPhase.reason}) — re-run this exact transaction.`);
    }

    let anchorRecord;
    try {
      anchorRecord = appendClosureAnchor({
        demaHome: home,
        entries: result.ledger_length,
        head: result.ledger_head,
      });
    } catch (err) {
      corridorFail(`closure anchor failed closed (${err?.message ?? "unknown"}) — re-run this exact transaction.`);
    }
    const anchorPhase = await appendClosureTransactionPhase({
      demaHome: home,
      transactionId: consentClaim.transaction_id,
      phase: "ANCHORED",
      evidenceRefs: [{
        schema: "bizra.dema.corridor_anchor_evidence.v1",
        anchor_hash: anchorRecord.anchor_hash,
        receipt_id: result.ledger_head,
        ledger_prefix_length: result.ledger_length,
      }],
      atIso: nowIso,
    });
    if (!anchorPhase.ok) {
      corridorFail(`C2 anchor witness failed closed (${anchorPhase.reason}) — re-run this exact transaction.`);
    }
    const boundArtifacts = await verifyBoundClosureArtifacts({
      home,
      terminal: {
        closure_transaction_id: consentClaim.transaction_id,
        consent_claim_hash: consentClaim.claim_hash,
        prepared_intent_hash: prepared.prepared_intent_hash,
        seal_head: result.omega0_card.seal_head,
        ledger_head: result.ledger_head,
        anchor_hash: anchorRecord.anchor_hash,
      },
      transactionState: anchorPhase.state,
    });
    if (!boundArtifacts.ok) {
      corridorFail(`closure artifact binding failed closed (${boundArtifacts.reason}) — no corridor terminal was written.`);
    }

    // The durable corridor event is minted by the corridor's own canonical
    // serializer — never by the weld, whose event shape is a different chain.
    const ev = appendCorridorEvent({
      contract_hash: loaded.contractDoc.contract_hash,
      journal: loaded.journal,
      event: {
        state: "COMPLETE",
        at_iso: nowIso,
        terminal_outcome: "COMPLETED_VERIFIED",
        requires_human: false,
        note: `corridor closure · outcome ${result.terminal_outcome}${result.omega0_card?.seal_head ? ` · seal ${result.omega0_card.seal_head}` : ""}${result.ledger_head ? ` · ledger ${result.ledger_head}` : ""} · consent_context: ${verdict.consent_context_hash}`,
        next_command: `dema mission corridor status ${id}`,
        closure_transaction_id: consentClaim.transaction_id,
        consent_claim_hash: consentClaim.claim_hash,
        prepared_intent_hash: prepared.prepared_intent_hash,
        seal_head: result.omega0_card.seal_head,
        ledger_head: result.ledger_head,
        anchor_hash: anchorRecord.anchor_hash,
      },
    });
    if (!ev.ok) corridorFail(`corridor closure event blocked: ${ev.blocked_by.join(", ")}`);
    // C2 resolves from ANCHORED before the corridor exposes COMPLETE. The
    // deterministic event is built first so RESOLVED can bind its exact hash;
    // if journal publication then fails, the same transaction replays this
    // exact event without a second effect, receipt, anchor, or C2 terminal.
    const resolvedPhase = await appendClosureTransactionPhase({
      demaHome: home,
      transactionId: consentClaim.transaction_id,
      phase: "RESOLVED",
      terminalOutcome: "COMPLETED_VERIFIED",
      evidenceRefs: [{
        schema: "bizra.dema.corridor_terminal_evidence.v1",
        corridor_event_hash: ev.event.event_hash,
        corridor_event_index: ev.event.index,
        anchor_hash: anchorRecord.anchor_hash,
      }],
      atIso: nowIso,
    });
    if (!resolvedPhase.ok) {
      corridorFail(`C2 terminal witness failed closed (${resolvedPhase.reason}) — re-run this exact transaction.`);
    }
    const resolvedArtifacts = await verifyBoundClosureArtifacts({
      home,
      terminal: ev.event,
      transactionState: resolvedPhase.state,
      requireResolved: true,
    });
    if (!resolvedArtifacts.ok) {
      corridorFail(`C2 terminal verification failed closed (${resolvedArtifacts.reason}) — no corridor terminal was written.`);
    }
    await appendCorridorJournalEvent(dir, ev.event);

    // Compact closure index. `verify_with` re-reads C2, the signed ledger and
    // anchor log; this JSON references those artifacts rather than embedding
    // them or claiming to be a self-contained offline proof.
    const closureRecord = {
        schema: "bizra.dema.mission_corridor_closure_record.v0.1",
        mission_id: id,
        contract_hash: loaded.contractDoc.contract_hash,
        state: ev.event.state,
        terminal_outcome: result.terminal_outcome,
        event_hash: ev.event.event_hash,
        seal_head: result.omega0_card?.seal_head ?? null,
        ledger_head: result.ledger_head ?? null,
        anchor_hash: anchorRecord?.anchor_hash ?? null,
        closure_transaction_id: consentClaim.transaction_id,
        consent_claim_hash: consentClaim.claim_hash,
        prepared_intent_hash: prepared.prepared_intent_hash,
        omega0_card: result.omega0_card ?? null,
        at_iso: nowIso,
        verify_with: `dema mission corridor status ${id}`,
    };
    const closureBytes = `${JSON.stringify(closureRecord, null, 2)}\n`;
    const closurePath = join(dir, "closure.json");
    try {
      await writeFile(closurePath, closureBytes, { flag: "wx", mode: 0o600 });
    } catch (err) {
      if (err?.code !== "EEXIST" || await readFileFs(closurePath, "utf8") !== closureBytes) {
        corridorFail(`closure record conflict (${err?.code ?? "semantic_drift"}) — C2 remains authoritative.`);
      }
    }
    try {
      await syncFileAndParent(closurePath);
    } catch (err) {
      corridorFail(`closure record durability uncertain (${err?.code ?? "unknown"}) — C2 remains authoritative.`);
    }

    const out = {
      ok: true,
      mission_id: id,
      state: ev.event.state,
      terminal_outcome: result.terminal_outcome,
      event_hash: ev.event.event_hash,
      seal_head: result.omega0_card?.seal_head ?? null,
      ledger_head: result.ledger_head ?? null,
      anchor_hash: anchorRecord?.anchor_hash ?? null,
      consent_context_hash: verdict.consent_context_hash,
      boundary: corridorIoBoundary({ read: true, wrote: true, consented: true }),
    };
    if (wantJson) console.log(JSON.stringify(out, null, 2));
    else {
      console.log(`DEMA · mission corridor COMPLETE: ${id}`);
      console.log(`  terminal_outcome: ${result.terminal_outcome}`);
      console.log(`  seal:   ${result.omega0_card?.seal_head}`);
      console.log(`  ledger: ${result.ledger_head}`);
      console.log(`  anchor: ${anchorRecord?.anchor_hash ?? "(none)"}`);
      console.log("  scope: LOCAL_ONLY candidate · runtime_activation=false · NODE0_CLOSED=false");
    }
    return;
  }

  corridorFail(
    "unknown mission corridor verb. Use `dema mission corridor start --id <id> … --nonce <n> --expires <iso>` (prints the consent card incl. created_at_iso and the exact rerun line), then re-run with `--created-at <iso> --consent \"GO: start mission corridor <id>\" --consent-context <hash>`; `dema mission corridor status <id>`; `dema mission corridor resume <id>`; `dema mission corridor advance <id> --to <STATE> --nonce <n> --expires <iso>` then `--consent \"GO: advance mission corridor <id> to <STATE>\" --consent-context <hash>`; `dema mission corridor complete <id> --nonce <n> --expires <iso>` then `--consent \"GO: complete mission corridor <id>\" --consent-context <hash>`; or `dema mission corridor stop <id> --nonce <n> --expires <iso>` then `--consent \"GO: stop mission corridor <id>\" --consent-context <hash>` — root-bound consent; no hidden worker/model/runtime; `complete` may perform only its disclosed bounded local file effect.",
  );
}
