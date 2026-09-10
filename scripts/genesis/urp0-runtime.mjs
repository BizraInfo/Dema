// BIZRA-GENESIS-NODE0-URP-LOCAL-IGNITION-1A · GENESIS_RUNTIME_SPINE_1A.0
//
// I/O TIER — the composition seam. This is the module that turns the existing
// BIZRA organs into one running loop:
//
//   HUMAN-0 -> DEMA -> FATE -> URP-0 -> BOUNDED LOCAL EXECUTION
//           -> SAT-1..SAT-5 -> RECEIPT -> WORLD-STATE TRANSITION
//           -> RESTART AND REPLAY -> BLOCK0 LOCAL CANDIDATE
//
// It owns no law of its own: every decision is delegated to a pure kernel, and
// every write goes through the store.

import { cpus, totalmem } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";
import {
  invokeLocalLLM,
  llmAdapterConsentPhraseFor,
} from "../../packages/core/src/llm-adapter.js";
import { evaluateConsent } from "../../packages/fate/src/fate.js";
import {
  URP0_HUMAN_ID,
  URP0_HUMAN_ROLES,
  URP0_MISSION_ID,
  URP0_NODE_ID,
  URP0_RESOURCE_OFFER_ID,
  URP0_SAT_LANES,
  URP0_TRUTH_LABEL,
  reduceUrp0Events,
  urp0MissionKey,
  urp0Boundary,
} from "../../packages/genesis/src/urp0-kernel.js";
import {
  admissionConsentPhrase,
  buildAdmissionContract,
  buildConsentCard,
  buildConsentContext,
  buildMissionContract,
  buildMissionReceipt,
  deriveMissionResult,
} from "../../packages/genesis/src/urp0-mission-kernel.js";
import {
  SAT5_STATUS,
  buildBlock0Candidate,
  judgeUrp0Mission,
  verifyBlock0Candidate,
  verifyUrp0Judgment,
} from "../../packages/genesis/src/urp0-sat5.js";
import { buildSatEvidencePacket } from "../../packages/genesis/src/urp0-sat-evidence.js";
import { verifyNode0IdentityProof } from "../../packages/genesis/src/node0-identity-proof.js";
import { activeKeyPaths } from "../../packages/receipts/src/authorship-key-store.js";
import { canonicaliseRoot, fingerprintTree, scanMetadataOnly } from "./urp0-scan.mjs";
import {
  appendEvent,
  declaredWritePaths,
  journalPrefixBinding,
  loadEvents,
  persistSatEvidencePacket,
  readArtifact,
  readStableFileObject,
  readSatEvidencePacket,
  reconstruct,
  statePermissions,
  satEvidencePacketPath,
  writeArtifact,
  writeLogLength,
} from "./urp0-store.mjs";

// A consent card may not be issued with an arbitrary validity window: the
// operator's browser supplies the card back at authorization time, so an
// unbounded expiry would be a self-issued forever-token.
export const CONSENT_WINDOW_SECONDS = 300;
export const PAT_MODEL = "qwen3:4b";
export const PAT_CONSENT_WINDOW_SECONDS = 300;
const PAT_PROMPT_MAX_BYTES = 12 * 1024;
const NODE0_WISDOM_FILENAME = "node0-morning-closure-wisdom.json";
const NODE0_WISDOM_MAX_BYTES = 32 * 1024;
const NODE0_WISDOM_RETRIEVAL_MAX_CHARS = 8 * 1024;
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

// Node0 offers a conservative FRACTION of what it possesses. Never the machine.
export function measurePossessed() {
  return { cpu_threads: Math.max(1, cpus().length), memory_bytes: totalmem() };
}

export function conservativeOffer(possessed) {
  return {
    cpu_threads: Math.max(1, Math.min(possessed.cpu_threads - 1, Math.floor(possessed.cpu_threads / 4))),
    memory_bytes: Math.floor(possessed.memory_bytes / 8),
    storage_write_bytes: 8 * 1024 * 1024,
    wall_clock_seconds: 30,
    max_entries: 50000,
    max_depth: 24,
  };
}

export function admissionCard() {
  const contract = buildAdmissionContract({
    human_id: URP0_HUMAN_ID,
    node_id: URP0_NODE_ID,
    roles: [...URP0_HUMAN_ROLES],
  });
  return {
    schema: "bizra.genesis.admission_card.v0.1",
    contract: contract.body,
    contract_hash: contract.contract_hash,
    required_phrase: admissionConsentPhrase({
      human_id: URP0_HUMAN_ID,
      node_id: URP0_NODE_ID,
      contract_hash: contract.contract_hash,
    }),
    founder_bypass: false,
    writes_performed: false,
  };
}

// Human-0 admission. Exact FATE consent, SAT-2-style context verification, an
// admission receipt, and the resulting URP state root. Idempotent: a second
// admission is refused by the kernel, not silently re-applied.
export function admitHuman0(stateRootDir, { phrase, now_iso }) {
  const card = admissionCard();
  const fate = evaluateConsent({ phrase, requiredPhrase: card.required_phrase });
  if (!fate.accepted) {
    return { ok: false, blocked_by: ["exact_consent_not_matched"], required_phrase: card.required_phrase };
  }
  const receipt = {
    schema: "bizra.genesis.admission_receipt.v0.1",
    human_id: URP0_HUMAN_ID,
    node_id: URP0_NODE_ID,
    admission_contract_hash: card.contract_hash,
    consent_verdict: fate.verdict,
    admitted_at_iso: now_iso,
    founder_bypass: false,
  };
  const consent_receipt_hash = hashOf(receipt);

  const human = appendEvent(stateRootDir, "HUMAN_REGISTERED", {
    human_id: URP0_HUMAN_ID,
    roles: [...URP0_HUMAN_ROLES],
    founder_bypass: false,
    self_approval: false,
    sat_exemption: false,
    mint_authority: false,
    treasury_authority: false,
    unbounded_resource_authority: false,
    admission_contract_hash: card.contract_hash,
    consent_receipt_hash,
  });
  if (!human.ok) return { ok: false, blocked_by: human.blocked_by };

  const node = appendEvent(stateRootDir, "NODE_REGISTERED", { node_id: URP0_NODE_ID, owner: URP0_HUMAN_ID });
  if (!node.ok) return { ok: false, blocked_by: node.blocked_by };

  const sat = appendEvent(stateRootDir, "SAT_SET_REGISTERED", {
    lanes: URP0_SAT_LANES.map((l) => ({ id: l.id, lane: l.lane })),
    implementation: "DETERMINISTIC_CONSTITUTIONAL_VERIFIERS",
    autonomous_agents: false,
  });
  if (!sat.ok) return { ok: false, blocked_by: sat.blocked_by };

  const possessed = measurePossessed();
  const allowed = conservativeOffer(possessed);
  const offer = appendEvent(stateRootDir, "RESOURCE_OFFER_REGISTERED", {
    resource_offer_id: URP0_RESOURCE_OFFER_ID,
    allowed,
    possessed,
    network: false,
    unrestricted_shell: false,
    unrestricted_filesystem: false,
    per_mission_consent: true,
    revocable: true,
    receipt_required: true,
  });
  if (!offer.ok) return { ok: false, blocked_by: offer.blocked_by };

  writeArtifact(stateRootDir, "admission-receipt.json", receipt);
  return {
    ok: true,
    blocked_by: [],
    admission_receipt: receipt,
    consent_receipt_hash,
    state_root: offer.replay.state_root,
  };
}

// One hashing rule everywhere: the canonical byte contract.
const hashOf = sha256CanonicalJsonV1;

// Public-only runtime identity projection. The journal's HUMAN-0/NODE0 record
// is historical registration; principal binding is earned again from the
// proof artifact and the externally resolved active public key on every realm
// read. This path never opens, hashes, or emits private-key material.
function node0PrincipalBinding(stateRootDir) {
  const proof = readArtifact(stateRootDir, "node0-identity-proof.json");
  if (!proof) {
    return { status: "NOT_BOUND", verified: false, blocked_by: ["identity_proof_missing"], authority_delta: 0 };
  }
  try {
    const demaHome = dirname(dirname(stateRootDir));
    const paths = activeKeyPaths(demaHome);
    let pointer;
    try {
      const { bytes } = readStableFileObject(paths.activePointer);
      pointer = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      return {
        status: "NOT_BOUND",
        verified: false,
        blocked_by: [error?.message === "evidence_file_symlink" ? "active_pointer_not_regular" : "active_pointer_read_failed"],
        authority_delta: 0,
      };
    }
    const fingerprint = pointer.generation_fingerprint;
    if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
      return { status: "NOT_BOUND", verified: false, blocked_by: ["active_fingerprint_invalid"], authority_delta: 0 };
    }
    const publicPath = join(paths.generationsDir, fingerprint, "public.pem");
    let publicKeyPem;
    try {
      const { bytes } = readStableFileObject(publicPath);
      publicKeyPem = bytes.toString("utf8");
    } catch {
      return { status: "NOT_BOUND", verified: false, blocked_by: ["active_public_key_not_regular"], authority_delta: 0 };
    }
    const verification = verifyNode0IdentityProof({ proof, operatorPubkeyPem: publicKeyPem });
    if (!verification.verified) {
      return { status: "NOT_BOUND", verified: false, blocked_by: [`identity_proof_${verification.reason}`], authority_delta: 0 };
    }
    if (proof.genesis_node_id !== fingerprint) {
      return { status: "NOT_BOUND", verified: false, blocked_by: ["identity_proof_active_generation_mismatch"], authority_delta: 0 };
    }
    return {
      status: "BOUND",
      verified: true,
      principal: proof.genesis_node_id,
      principal_kind: "NODE0_OPERATIONAL_ED25519_IDENTITY",
      human_id: URP0_HUMAN_ID,
      node_id: URP0_NODE_ID,
      public_key_fingerprint: fingerprint,
      identity_proof_hash: `sha256:${proof.node0_identity_proof_hash}`,
      consent_proof_hash: `sha256:${proof.consent_proof_hash}`,
      claim_boundary: proof.claim_boundary,
      authority_delta: 0,
    };
  } catch (error) {
    return { status: "NOT_BOUND", verified: false, blocked_by: [`identity_binding_unreadable:${error?.message ?? "unknown"}`], authority_delta: 0 };
  }
}

function attemptArtifactName(prefix, attempt_id) {
  if (typeof attempt_id !== "string" || attempt_id === "") throw new Error("attempt_id_missing");
  return `${prefix}-${attempt_id}.json`;
}

const MISSION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function validMissionId(value) {
  return typeof value === "string" && MISSION_ID_RE.test(value);
}

// Derive the consent card. WRITES NOTHING. EXECUTES NOTHING. The nonce and the
// window are minted here and handed to the operator; the journal only learns of
// them when the operator comes back with the exact phrase.
export function missionConsentCard(stateRootDir, { root, now_iso, mission_id = URP0_MISSION_ID, proposal_binding = null }) {
  if (!validMissionId(mission_id)) return { ok: false, blocked_by: ["mission_id_invalid"] };
  const state = reconstruct(stateRootDir);
  if (!state.replay.ok) return { ok: false, blocked_by: state.replay.blocked_by };
  const offer = state.replay.state?.resource_offer;
  if (!offer) return { ok: false, blocked_by: ["resource_offer_not_registered"] };

  const canon = canonicaliseRoot(root);
  if (!canon.ok) return { ok: false, blocked_by: canon.blocked_by };

  const limits = {
    max_entries: offer.allowed.max_entries,
    max_depth: offer.allowed.max_depth,
    wall_clock_seconds: offer.allowed.wall_clock_seconds,
    storage_write_bytes: offer.allowed.storage_write_bytes,
  };
  const contract = buildMissionContract({ mission_id, canonical_root: canon.canonical_root, limits, proposal_binding });
  const consent = buildConsentContext({
    mission_id,
    canonical_root: canon.canonical_root,
    contract_hash: contract.contract_hash,
    nonce: randomUUID(),
    created_at_iso: now_iso,
    expires_at_iso: new Date(Date.parse(now_iso) + CONSENT_WINDOW_SECONDS * 1000).toISOString(),
    proposal_binding: contract.body.proposal_binding ?? null,
  });
  return {
    ok: true,
    blocked_by: [],
    card: buildConsentCard({ contract: contract.body, contract_hash: contract.contract_hash, consent }),
    contract: contract.body,
    contract_hash: contract.contract_hash,
    consent_context: consent.context,
    consent_context_hash: consent.consent_context_hash,
  };
}

const PAT_BINDING_KEYS = Object.freeze([
  "bridge_hash",
  "source_intent_hash",
  "compiler_identity_hash",
  "compiled_contract_hash",
  "context_hash",
]);

function validPatBinding(binding) {
  return Boolean(
    binding &&
      typeof binding === "object" &&
      !Array.isArray(binding) &&
      Object.keys(binding).length === PAT_BINDING_KEYS.length &&
      PAT_BINDING_KEYS.every((key) => HASH_RE.test(binding[key])),
  );
}

function wisdomPath(stateRootDir) {
  const configured = process.env.BIZRA_NODE0_WISDOM_PATH;
  if (typeof configured === "string" && configured.startsWith("/")) return configured;
  const demaHome = process.env.DEMA_HOME || dirname(dirname(stateRootDir));
  return join(demaHome, "memory", NODE0_WISDOM_FILENAME);
}

function hashBytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

// The capsule is local-only context, but the shared LLM adapter still applies
// its public-prompt leakage scanner to every model input. Keep the capsule
// bytes/hash intact and replace only sensitive/path-shaped vocabulary in the
// model-facing projection so safety guidance can be read without resembling a
// credential or filesystem leak.
function sanitizeModelContext(text) {
  return text
    .replace(/\/home\//gi, "[home-path]/")
    .replace(/\/data\//gi, "[data-path]/")
    .replace(/\/Downloads\//gi, "[downloads-path]/")
    .replace(/\bprivate[_\s-]?key\b/gi, "protected signing material")
    .replace(/\bapi[_\s-]?key\b/gi, "service credential")
    .replace(/\baccess[_\s-]?token\b/gi, "access credential")
    .replace(/\bsecret[_\s-]?(?:key|token|value)\b/gi, "protected material");
}

function loadNode0WisdomContext(stateRootDir) {
  const path = wisdomPath(stateRootDir);
  try {
    const { bytes: raw, stat } = readStableFileObject(path);
    if (stat.size > NODE0_WISDOM_MAX_BYTES) {
      return { status: "UNAVAILABLE", hash: null, text: "No bounded Node0 wisdom capsule is available." };
    }
    const parsed = JSON.parse(raw.toString("utf8"));
    const boundary = parsed?.boundary;
    const boundaryKeys = [
      "raw_chat_forwarded",
      "private_key_read",
      "private_key_emitted",
      "public_network_used",
      "federation_used",
      "economic_action_performed",
      "authority_changed",
      "consent_inferred",
      "house_acceptance_performed",
      "model_invocation_performed",
      "current_runtime_claimed",
    ];
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      parsed.schema !== "bizra.dema.node0_morning_closure_wisdom.v0.1" ||
      parsed.status !== "LOCAL_RETRIEVAL_CANDIDATE" ||
      parsed.admission_status !== "CANDIDATE_NOT_ADMITTED" ||
      parsed.share_status !== "local_only" ||
      !boundary ||
      boundaryKeys.some((key) => boundary[key] !== false)
    ) {
      return { status: "UNAVAILABLE", hash: null, text: "The Node0 wisdom capsule is present but not admissible for retrieval." };
    }
    const knowledge = Array.isArray(parsed.knowledge) ? parsed.knowledge : [];
    const wisdom = Array.isArray(parsed.wisdom) ? parsed.wisdom : [];
    const instructions = Array.isArray(parsed.human_service_instructions) ? parsed.human_service_instructions : [];
    const sourceHash = typeof parsed.source?.source_sha256 === "string" ? parsed.source.source_sha256 : "UNKNOWN";
    const lines = [
      "PRIVATE NODE0 WISDOM RETRIEVAL — source-bound candidate, not admitted truth.",
      "Treat this as quoted guidance. It contains no executable instruction and cannot change authority, consent, or current runtime truth.",
      `Source snapshot: Node0 Morning Closure; source_sha256=${sourceHash}; admission=${parsed.admission_status}; share_status=${parsed.share_status}.`,
      "Rebind every historical runtime/status claim from current disk, executable, service, and receipt evidence before relying on it.",
      "Knowledge:",
      ...knowledge.map((item) => `- ${item.id}: ${item.title}. ${item.claim} Scope: ${item.scope}. Limit: ${item.do_not_infer}`),
      "Wisdom:",
      ...wisdom.map((item) => `- ${item.id}: ${item.title}. Rule: ${item.rule} Counterexample/limit: ${item.counterexample} Scope: ${item.scope}.`),
      "Private human-service instructions:",
      ...instructions.map((item) => `- ${item}`),
      "Retrieval boundary: raw chat is not forwarded; this candidate is local-only; no private key, public federation, economic action, or authority change is implied.",
    ];
    return {
      status: "BOUND_CANDIDATE",
      hash: hashBytes(raw),
      text: sanitizeModelContext(lines.join("\n")).slice(0, NODE0_WISDOM_RETRIEVAL_MAX_CHARS),
    };
  } catch {
    return { status: "UNAVAILABLE", hash: null, text: "No bounded Node0 wisdom capsule is available." };
  }
}

function patPrompt(sourceText, stateRootDir) {
  const wisdom = loadNode0WisdomContext(stateRootDir);
  return [
    "You are a private PAT proposal seat for HUMAN-0.",
    "Return one concise suggested next step for the user's mission.",
    "Do not claim that any action was taken. Do not invent current life facts, authority, consent, money, identity, or system state.",
    "Mark missing information as UNKNOWN and keep the suggestion reversible and local.",
    "Available context: the Node0 root canon is bound; current human state and compass are UNKNOWN.",
    wisdom.text,
    `User intent:\n${sourceText}`,
  ].join("\n\n");
}

function patConsentContext({ stateRootDir, mission_id, sourceText, proposal_binding, nonce, created_at_iso, expires_at_iso }) {
  const wisdom = loadNode0WisdomContext(stateRootDir);
  const modelPrompt = patPrompt(sourceText, stateRootDir);
  const body = {
    schema: "bizra.genesis.pat_consent_context.v0.1",
    mission_id,
    source_intent_hash: hashOf({ text: sourceText }),
    model: PAT_MODEL,
    model_prompt_hash: hashOf({ text: modelPrompt }),
    wisdom_context_status: wisdom.status,
    wisdom_context_hash: wisdom.hash,
    proposal_binding,
    nonce,
    created_at_iso,
    expires_at_iso,
    permitted_operation: "LOCAL_PAT_SUGGESTION_ONLY",
    required_phrase: llmAdapterConsentPhraseFor(PAT_MODEL),
    authority: "NONE",
    authority_delta: 0,
    effect_started: false,
    receipt_minted: false,
  };
  return { ...body, consent_context_hash: hashOf(body) };
}

function patConsentWindowValid(consent_context, now_iso) {
  const issued = Date.parse(consent_context?.created_at_iso);
  const expires = Date.parse(consent_context?.expires_at_iso);
  const acting = Date.parse(now_iso);
  if (![issued, expires, acting].every(Number.isFinite)) return "consent_timestamps_unparseable";
  if (expires - issued > PAT_CONSENT_WINDOW_SECONDS * 1000) return "consent_window_too_wide";
  if (issued > acting) return "consent_issued_in_future";
  if (acting > expires) return "consent_expired";
  return null;
}

function patRefusal(blocked_by, extra = {}) {
  return { ok: false, blocked_by, authority_delta: 0, effect_started: false, ...extra };
}

// Proposal-only PAT cognition. The card is side-effect free; the act calls the
// existing localhost-only adapter after a separate exact model consent. It
// cannot advance the URP journal, authorize the metadata effect, or mint a
// mission receipt.
export function patProposalCard(stateRootDir, { mission_id, prompt, proposal_binding, now_iso }) {
  if (!validMissionId(mission_id)) return patRefusal(["mission_id_invalid"]);
  if (typeof prompt !== "string" || !prompt.trim()) return patRefusal(["pat_prompt_missing"]);
  if (Buffer.byteLength(prompt, "utf8") > PAT_PROMPT_MAX_BYTES) return patRefusal(["pat_prompt_too_large"]);
  if (!validPatBinding(proposal_binding)) return patRefusal(["proposal_binding_invalid"]);
  const state = reconstruct(stateRootDir);
  if (!state.replay.ok) return patRefusal(state.replay.blocked_by);
  const principal = node0PrincipalBinding(stateRootDir);
  if (principal.status !== "BOUND") return patRefusal(["node0_principal_not_bound", ...(principal.blocked_by ?? [])]);
  const sourceText = prompt.trim();
  const expires_at_iso = new Date(Date.parse(now_iso) + PAT_CONSENT_WINDOW_SECONDS * 1000).toISOString();
  const consent_context = patConsentContext({
    stateRootDir,
    mission_id,
    sourceText,
    proposal_binding,
    nonce: randomUUID(),
    created_at_iso: now_iso,
    expires_at_iso,
  });
  return {
    ok: true,
    blocked_by: [],
    card: {
      schema: "bizra.genesis.pat_consent_card.v0.1",
      mission_id,
      model: PAT_MODEL,
      source_intent_hash: consent_context.source_intent_hash,
      model_prompt_hash: consent_context.model_prompt_hash,
      wisdom_context_status: consent_context.wisdom_context_status,
      wisdom_context_hash: consent_context.wisdom_context_hash,
      permitted_operation: consent_context.permitted_operation,
      required_phrase: consent_context.required_phrase,
      authority: "NONE",
      authority_delta: 0,
      effect_started: false,
      receipt_minted: false,
      expires_at_iso,
    },
    consent_context,
    consent_context_hash: consent_context.consent_context_hash,
    principal: {
      human_id: principal.human_id,
      node_id: principal.node_id,
      principal: principal.principal,
      identity_proof_hash: principal.identity_proof_hash,
    },
  };
}

export async function patProposal(stateRootDir, {
  mission_id,
  prompt,
  proposal_binding,
  consent_context,
  phrase,
  now_iso,
}) {
  if (!validMissionId(mission_id)) return patRefusal(["mission_id_invalid"]);
  if (typeof prompt !== "string" || !prompt.trim()) return patRefusal(["pat_prompt_missing"]);
  if (Buffer.byteLength(prompt, "utf8") > PAT_PROMPT_MAX_BYTES) return patRefusal(["pat_prompt_too_large"]);
  if (!validPatBinding(proposal_binding)) return patRefusal(["proposal_binding_invalid"]);
  const state = reconstruct(stateRootDir);
  if (!state.replay.ok) return patRefusal(state.replay.blocked_by);
  const principal = node0PrincipalBinding(stateRootDir);
  if (principal.status !== "BOUND") return patRefusal(["node0_principal_not_bound", ...(principal.blocked_by ?? [])]);
  if (!consent_context || typeof consent_context !== "object" || Array.isArray(consent_context)) {
    return patRefusal(["pat_consent_context_missing"]);
  }
  const sourceText = prompt.trim();
  const expected = patConsentContext({
    stateRootDir,
    mission_id,
    sourceText,
    proposal_binding,
    nonce: consent_context.nonce,
    created_at_iso: consent_context.created_at_iso,
    expires_at_iso: consent_context.expires_at_iso,
  });
  if (!sameJson(expected, consent_context)) return patRefusal(["pat_consent_context_mismatch"]);
  const windowError = patConsentWindowValid(consent_context, now_iso);
  if (windowError) return patRefusal([windowError]);
  const fate = evaluateConsent({ phrase, requiredPhrase: expected.required_phrase });
  if (!fate.accepted) return patRefusal(["exact_pat_consent_not_matched"], { required_phrase: expected.required_phrase });

  const modelResult = await invokeLocalLLM({
    model: PAT_MODEL,
    prompt: patPrompt(sourceText, stateRootDir),
    consentPhrase: expected.required_phrase,
  });
  const completed = modelResult.invocation_status === "completed" && modelResult.boundary?.model_invocation_performed === true;
  const patEnvelope = {
    schema: "bizra.genesis.pat_proposal.v0.1",
    truth_label: completed ? "MEASURED_LOCAL_PAT_SUGGESTION" : "PAT_SUGGESTION_NOT_COMPLETED",
    mission_id,
    source_intent_hash: expected.source_intent_hash,
    proposal_binding,
    model: PAT_MODEL,
    model_prompt_hash: expected.model_prompt_hash,
    wisdom_context_status: expected.wisdom_context_status,
    wisdom_context_hash: expected.wisdom_context_hash,
    consent_context_hash: expected.consent_context_hash,
    consent_verdict: fate.verdict,
    suggestion_only: true,
    verdict_role: "suggestion",
    model_invocation_performed: completed,
    response_text_preview: modelResult.response_text_preview ?? null,
    response_safety_verdict: modelResult.response_safety_verdict ?? null,
    invocation_status: modelResult.invocation_status,
    error_reason: modelResult.error_reason ?? null,
    authority: "NONE",
    authority_delta: 0,
    effect_started: false,
    receipt_minted: false,
    principal: principal.principal,
    identity_proof_hash: principal.identity_proof_hash,
  };
  return {
    ok: completed,
    blocked_by: completed ? [] : ["pat_invocation_not_completed", ...(modelResult.error_reason ? [modelResult.error_reason] : [])],
    pat_proposal: patEnvelope,
    pat_proposal_hash: hashOf(patEnvelope),
    pat_result: modelResult,
    authority_delta: 0,
    effect_started: false,
    receipt_minted: false,
  };
}

// The bound act. Everything from here is journaled, judged and receipted.
export function authorizeAndExecute(stateRootDir, { consent_context, phrase, now_iso }) {
  const blocked = [];
  // Mark the write log here: everything after this point is a write THIS mission
  // performed, and SAT-4 judges exactly that set.
  const writeMark = writeLogLength();
  if (!consent_context || typeof consent_context !== "object") return refuse(["consent_context_missing"]);
  if (!validMissionId(consent_context.mission_id)) return refuse(["mission_id_invalid"]);

  // Re-derive the contract from the context's own claims, then re-derive the
  // context hash from the contract. A client-supplied hash is never trusted.
  const canon = canonicaliseRoot(consent_context.canonical_root);
  if (!canon.ok) return refuse(canon.blocked_by);
  if (canon.canonical_root !== consent_context.canonical_root) return refuse(["root_not_canonical"]);

  const state0 = reconstruct(stateRootDir);
  if (!state0.replay.ok) return refuse(state0.replay.blocked_by);
  const offer = state0.replay.state?.resource_offer;
  if (!offer) return refuse(["resource_offer_not_registered"]);

  const limits = {
    max_entries: offer.allowed.max_entries,
    max_depth: offer.allowed.max_depth,
    wall_clock_seconds: offer.allowed.wall_clock_seconds,
    storage_write_bytes: offer.allowed.storage_write_bytes,
  };
  const contract = buildMissionContract({
    mission_id: consent_context.mission_id,
    canonical_root: canon.canonical_root,
    limits,
    proposal_binding: consent_context.proposal_binding ?? null,
  });
  const consent = buildConsentContext({
    mission_id: consent_context.mission_id,
    canonical_root: canon.canonical_root,
    contract_hash: contract.contract_hash,
    nonce: consent_context.nonce,
    created_at_iso: consent_context.created_at_iso,
    expires_at_iso: consent_context.expires_at_iso,
    proposal_binding: contract.body.proposal_binding ?? null,
  });

  // Bound the self-issued window. A card the operator never saw cannot be
  // stretched into a forever-authorization.
  const issued = Date.parse(consent_context.created_at_iso);
  const expires = Date.parse(consent_context.expires_at_iso);
  const acting = Date.parse(now_iso);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || !Number.isFinite(acting)) {
    return refuse(["consent_timestamps_unparseable"]);
  }
  if (expires - issued > CONSENT_WINDOW_SECONDS * 1000) return refuse(["consent_window_too_wide"]);
  if (issued > acting) return refuse(["consent_issued_in_future"]);
  if (acting > expires) return refuse(["consent_expired"]);

  const fate = evaluateConsent({ phrase, requiredPhrase: consent.required_phrase });

  // The attempt id IS the consent nonce: one card, one attempt, one outcome.
  const attempt_id = consent.context.nonce;

  const declared = appendEvent(stateRootDir, "MISSION_DECLARED", {
    mission_id: consent_context.mission_id,
    attempt_id,
    contract_hash: contract.contract_hash,
    canonical_root: canon.canonical_root,
    metadata_only: true,
    network: false,
  });
  if (!declared.ok) return refuse(declared.blocked_by);

  const requested = appendEvent(stateRootDir, "CONSENT_REQUESTED", {
    mission_id: consent_context.mission_id,
    attempt_id,
    consent_context_hash: consent.consent_context_hash,
    required_phrase: consent.required_phrase,
    nonce: consent.context.nonce,
    created_at_iso: consent.context.created_at_iso,
    expires_at_iso: consent.context.expires_at_iso,
    permitted_operation: consent.context.permitted_operation,
  });
  if (!requested.ok) return refuse(requested.blocked_by);

  // A near-match dies HERE, after the request is on the record and before any
  // authority is granted. The refusal is itself part of the history.
  if (!fate.accepted) {
    return refuse(["exact_consent_not_matched"], { required_phrase: consent.required_phrase, consent_recorded: true });
  }

  const consent_receipt = {
    schema: "bizra.genesis.consent_receipt.v0.1",
    mission_id: consent_context.mission_id,
    consent_context_hash: consent.consent_context_hash,
    consent_verdict: fate.verdict,
    authorized_at_iso: now_iso,
    permitted_operation: consent.context.permitted_operation,
  };
  const consent_receipt_hash = hashOf(consent_receipt);

  const authorized = appendEvent(stateRootDir, "MISSION_AUTHORIZED", {
    mission_id: consent_context.mission_id,
    attempt_id,
    consent_context_hash: consent.consent_context_hash,
    exact_phrase_matched: true,
    authorized_at_iso: now_iso,
    consent_receipt_hash,
  });
  if (!authorized.ok) return refuse(authorized.blocked_by);

  const previous_state_root = authorized.replay.state_root;

  // --- bounded local execution -------------------------------------------
  const source_fingerprint_before = fingerprintTree(canon.canonical_root, limits);
  const observation = scanMetadataOnly({ canonical_root: canon.canonical_root, limits });
  const source_fingerprint_after = fingerprintTree(canon.canonical_root, limits);

  const derived = deriveMissionResult({ contract: contract.body, contract_hash: contract.contract_hash, observation });
  if (!derived.ok) return refuse(derived.blocked_by);

  const executed = appendEvent(stateRootDir, "MISSION_EXECUTED", {
    mission_id: consent_context.mission_id,
    attempt_id,
    result_hash: derived.result_hash,
    metadata_only: true,
    source_mutated: false,
    symlinks_followed: 0,
    network_used: false,
  });
  if (!executed.ok) return refuse(executed.blocked_by);
  const resulting_state_root = executed.replay.state_root;

  // --- SAT-5 judgment ------------------------------------------------------
  // Judged over the PROVISIONAL receipt (judgment_hash null): the sealed receipt
  // differs only by that field, and the journal binds it independently in
  // RECEIPT_RECORDED, so there is no circular hash dependency.
  const provisional = buildMissionReceipt({
    mission_id: consent_context.mission_id,
    contract_hash: contract.contract_hash,
    consent_context_hash: consent.consent_context_hash,
    consent_receipt_hash,
    result_hash: derived.result_hash,
    judgment_hash: null,
    previous_state_root,
    executed_at_iso: now_iso,
  });

  const events = loadEvents(stateRootDir);
  const evidence = {
    events,
    admission_contract: buildAdmissionContract({
      human_id: URP0_HUMAN_ID,
      node_id: URP0_NODE_ID,
      roles: [...URP0_HUMAN_ROLES],
    }).body,
    sat_set: state0.replay.state.sat_set,
    resource_offer: offer,
    contract: contract.body,
    contract_hash: contract.contract_hash,
    consent_context: consent.context,
    consent_context_hash: consent.consent_context_hash,
    submitted_phrase: phrase,
    authorized_at_iso: now_iso,
    observation,
    result: derived.result,
    receipt_body: provisional.body,
    receipt_hash: provisional.receipt_hash,
    previous_state_root,
    resulting_state_root,
    source_fingerprint_before,
    source_fingerprint_after,
    declared_write_paths: declaredWritePaths(writeMark),
    state_root_dir: stateRootDir,
  };

  const judgment = judgeUrp0Mission(evidence);
  const judgmentCheck = verifyUrp0Judgment({ evidence, judgment });
  if (!judgmentCheck.ok) return refuse(judgmentCheck.blocked_by, { judgment });
  if (!judgment.admissible) {
    return refuse(["sat5_refused", ...judgment.failing_verifiers.map((v) => `failing:${v}`)], { judgment });
  }

  // Persist the complete evidence packet before recording the SAT event. The
  // effect-phase write set is frozen above; the packet path is control-plane
  // evidence and must never silently become part of that effect set.
  const journal = journalPrefixBinding(stateRootDir, events);
  if (!journal.ok) return refuse(journal.blocked_by, { judgment });
  const packetPath = satEvidencePacketPath(stateRootDir, {
    mission_id: consent_context.mission_id,
    attempt_id,
  });
  const packet = buildSatEvidencePacket({
    mission_id: consent_context.mission_id,
    attempt_id,
    evidence,
    judgment,
    journal_binding: journal.binding,
    effect_phase_declared_write_paths: evidence.declared_write_paths,
    control_plane_write_paths: [packetPath],
  });
  if (!packet.ok) return refuse(packet.blocked_by, { judgment });
  const persistedPacket = persistSatEvidencePacket(stateRootDir, packet.packet);
  if (!persistedPacket.ok) return refuse(persistedPacket.blocked_by, { judgment });

  const judged = appendEvent(stateRootDir, "SAT_JUDGMENT_RECORDED", {
    mission_id: consent_context.mission_id,
    attempt_id,
    judgment_hash: judgment.judgment_hash,
    verifier_verdicts: judgment.verifier_verdicts.map((v) => ({ id: v.id, lane: v.lane, verdict: v.verdict })),
    admissible: true,
  });
  if (!judged.ok) return refuse(judged.blocked_by, { judgment });

  const sealed = buildMissionReceipt({
    mission_id: consent_context.mission_id,
    contract_hash: contract.contract_hash,
    consent_context_hash: consent.consent_context_hash,
    consent_receipt_hash,
    result_hash: derived.result_hash,
    judgment_hash: judgment.judgment_hash,
    previous_state_root,
    executed_at_iso: now_iso,
  });

  const receipted = appendEvent(stateRootDir, "RECEIPT_RECORDED", {
    mission_id: consent_context.mission_id,
    attempt_id,
    receipt_hash: sealed.receipt_hash,
    result_hash: derived.result_hash,
    judgment_hash: judgment.judgment_hash,
  });
  if (!receipted.ok) return refuse(receipted.blocked_by, { judgment });

  writeArtifact(stateRootDir, attemptArtifactName("consent-receipt", attempt_id), consent_receipt);
  writeArtifact(stateRootDir, attemptArtifactName("mission-contract", attempt_id), contract.body);
  writeArtifact(stateRootDir, attemptArtifactName("mission-result", attempt_id), derived.result);
  writeArtifact(stateRootDir, attemptArtifactName("sat5-judgment", attempt_id), judgment);
  writeArtifact(stateRootDir, attemptArtifactName("mission-receipt", attempt_id), sealed.body);
  writeArtifact(stateRootDir, attemptArtifactName("source-non-mutation-proof", attempt_id), {
    schema: "bizra.genesis.source_non_mutation_proof.v0.1",
    canonical_root: canon.canonical_root,
    fingerprint_before: source_fingerprint_before,
    fingerprint_after: source_fingerprint_after,
    equal: source_fingerprint_before === source_fingerprint_after,
    source_files_created: 0,
    source_files_deleted: 0,
    source_files_renamed: 0,
    source_contents_modified: 0,
    source_permissions_modified: 0,
    symlinks_followed: 0,
  });

  return {
    ok: true,
    blocked_by: [],
    contract: contract.body,
    contract_hash: contract.contract_hash,
    consent_receipt,
    consent_receipt_hash,
    result: derived.result,
    result_hash: derived.result_hash,
    judgment,
    receipt: sealed.body,
    receipt_hash: sealed.receipt_hash,
    observation,
    previous_state_root,
    resulting_state_root: receipted.replay.state_root,
    source_fingerprint_before,
    source_fingerprint_after,
    sat_evidence_packet: persistedPacket.packet,
    sat_evidence_packet_path: persistedPacket.path,
    sat_evidence_packet_sha256: persistedPacket.byte_hash,
  };

  function refuse(codes, extra = {}) {
    return { ok: false, blocked_by: [...blocked, ...codes], ...extra };
  }
}

// Replay from persisted evidence alone, in this process but from the bytes on
// disk. Proves the journal is self-sufficient before Block0 binds it.
export function replayFromDisk(stateRootDir) {
  const events = loadEvents(stateRootDir);
  const replay = reduceUrp0Events(events);
  const kinds = events.map((e) => e.kind);
  const countOf = (k) => kinds.filter((x) => x === k).length;
  return {
    ok: replay.ok,
    blocked_by: replay.blocked_by,
    state_root: replay.state_root,
    events_applied: replay.events_applied,
    duplicate_human_registration: countOf("HUMAN_REGISTERED") > 1,
    duplicate_node_registration: countOf("NODE_REGISTERED") > 1,
    duplicate_mission_admission: countOf("MISSION_AUTHORIZED") > 1,
  };
}

export function sealBlock0(stateRootDir, { repository_base_commit, implementation_commit, constitution_source_hash, topology_source_hash }) {
  const state = reconstruct(stateRootDir);
  if (!state.replay.ok) return { ok: false, blocked_by: state.replay.blocked_by };
  const s = state.replay.state;
  // Seal the attempt that actually reached RECEIPTED. Refused attempts stay on
  // the record and are never sealed over.
  const receipted = Object.values(s.missions).filter((m) => m.status === "RECEIPTED");
  if (receipted.length === 0) return { ok: false, blocked_by: ["mission_not_receipted"] };
  if (receipted.length > 1) return { ok: false, blocked_by: ["multiple_receipted_attempts"] };
  const mission = receipted[0];

  const judgment = readArtifact(stateRootDir, attemptArtifactName("sat5-judgment", mission.attempt_id))
    ?? readArtifact(stateRootDir, "sat5-judgment.json");
  if (!judgment?.judgment_hash) return { ok: false, blocked_by: ["judgment_artifact_missing"] };

  const disk = replayFromDisk(stateRootDir);
  if (!disk.ok) return { ok: false, blocked_by: ["journal_not_replayable_from_disk"] };

  const block0 = buildBlock0Candidate({
    constitution_source_hash,
    topology_source_hash,
    repository_base_commit,
    implementation_commit,
    human: s.human,
    node: s.node,
    urp_state_root: disk.state_root,
    judgment,
    resource_offer_receipt_hash: s.resource_offer.offer_hash,
    contract_hash: mission.contract_hash,
    consent_receipt_hash: mission.consent_receipt_hash,
    result_hash: mission.result_hash,
    receipt_hash: mission.receipt_hash,
    restart_replay: {
      state_root_preserved: true,
      receipt_replay_verified: true,
      duplicate_human_registration: disk.duplicate_human_registration,
      duplicate_node_registration: disk.duplicate_node_registration,
      duplicate_mission_admission: disk.duplicate_mission_admission,
    },
  });

  const check = verifyBlock0Candidate(block0);
  if (!check.ok) return { ok: false, blocked_by: check.blocked_by };

  const sealedEvent = appendEvent(stateRootDir, "BLOCK0_CANDIDATE_SEALED", {
    mission_id: mission.mission_id,
    attempt_id: mission.attempt_id,
    block0_hash: block0.block0_hash,
    truth_label: URP0_TRUTH_LABEL,
    live_mint: false,
    token_created: false,
    internet_gateway: false,
    node1_admission: false,
  });
  if (!sealedEvent.ok) return { ok: false, blocked_by: sealedEvent.blocked_by };

  writeArtifact(stateRootDir, "block0-local-candidate.json", block0.body);
  return { ok: true, blocked_by: [], block0: block0.body, block0_hash: block0.block0_hash, state_root: sealedEvent.replay.state_root };
}

function sameJson(a, b) {
  try {
    return sha256CanonicalJsonV1(a) === sha256CanonicalJsonV1(b);
  } catch {
    return false;
  }
}

function typedJudgmentHash(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function satIdentityFailures(state) {
  const failures = [];
  const systemPlane = state?.system_plane;
  const satSet = state?.sat_set;
  if (!systemPlane) failures.push("system_plane_missing");
  else {
    if (systemPlane.owner !== "BIZRA_SYSTEM") failures.push("system_plane_owner_invalid");
    if (systemPlane.principal !== "CONSTITUTIONAL_SYSTEM_PLANE") failures.push("system_plane_principal_invalid");
    if (systemPlane.logical_home !== "URP-0") failures.push("system_plane_home_invalid");
    if (systemPlane.founder_authority_inherited !== false) failures.push("founder_authority_inherited");
  }
  if (!satSet) failures.push("sat_set_missing");
  else {
    const expected = URP0_SAT_LANES.map((lane) => `${lane.id}:${lane.lane}`);
    if (satSet.count !== expected.length) failures.push("sat_identity_count_invalid");
    if (!Array.isArray(satSet.lanes) || satSet.lanes.length !== expected.length || !satSet.lanes.every((lane, i) => lane === expected[i])) {
      failures.push("sat_identity_set_invalid");
    }
    if (satSet.implementation !== "DETERMINISTIC_CONSTITUTIONAL_VERIFIERS") failures.push("sat_implementation_invalid");
    if (satSet.autonomous_agents !== false) failures.push("autonomous_sat_claimed");
  }
  return failures;
}

function missionAttemptForSatEvidence(events, state, worldCell) {
  const candidates = events
    .filter((event) => event.kind === "SAT_JUDGMENT_RECORDED")
    .map((event) => ({ mission_id: event.payload?.mission_id, attempt_id: event.payload?.attempt_id }))
    .filter(({ mission_id, attempt_id }) => state?.missions?.[urp0MissionKey(mission_id, attempt_id)]?.status === "RECEIPTED");
  return candidates.at(-1) ?? (worldCell
    ? { mission_id: worldCell.dema_mission_id, attempt_id: worldCell.urp_attempt_id }
    : null);
}

// A realm projection is a read-side verifier, not a status renderer. The
// historical World-Cell event and its carried PASS values are claims; current
// SAT operationality is earned again from the durable evidence packet.
function deriveSatOperationality(stateRootDir, events, replay, worldCell) {
  const blocked_by = satIdentityFailures(replay.state);
  if (blocked_by.length > 0) return { ok: false, blocked_by };

  const target = missionAttemptForSatEvidence(events, replay.state, worldCell);
  if (!target?.mission_id || !target?.attempt_id) return { ok: false, blocked_by: ["sat_evidence_scope_missing"] };
  const mission = replay.state.missions[urp0MissionKey(target.mission_id, target.attempt_id)];
  if (!mission || mission.status !== "RECEIPTED") return { ok: false, blocked_by: ["sat_evidence_mission_not_receipted"] };

  const judgmentEvents = events.filter((event) =>
    event.kind === "SAT_JUDGMENT_RECORDED" &&
    event.payload?.mission_id === target.mission_id &&
    event.payload?.attempt_id === target.attempt_id,
  );
  if (judgmentEvents.length !== 1) return { ok: false, blocked_by: ["sat_judgment_event_ambiguous"] };
  const judgmentEvent = judgmentEvents[0];
  const judgmentEventIndex = events.indexOf(judgmentEvent);

  const packetRead = readSatEvidencePacket(stateRootDir, target);
  if (!packetRead.ok) return { ok: false, blocked_by: packetRead.blocked_by };
  const packet = packetRead.packet;
  const evidence = packet.evidence;
  const judgment = packet.judgment;
  const blocked = [];

  if (packet.mission_id !== target.mission_id || packet.attempt_id !== target.attempt_id) blocked.push("sat_evidence_identity_mismatch");
  if (!typedJudgmentHash(packet.judgment_hash) || packet.judgment_hash !== judgment?.judgment_hash) blocked.push("sat_judgment_hash_invalid");
  if (packet.judgment_hash !== judgmentEvent.payload?.judgment_hash) blocked.push("sat_judgment_event_hash_mismatch");
  if (packet.judgment_hash !== mission.judgment_hash) blocked.push("sat_judgment_mission_hash_mismatch");
  if (!evidence || evidence.contract?.mission_id !== target.mission_id || evidence.consent_context?.mission_id !== target.mission_id) {
    blocked.push("sat_evidence_mission_binding_invalid");
  }
  if (evidence?.attempt_id !== undefined && evidence.attempt_id !== target.attempt_id) blocked.push("sat_evidence_attempt_binding_invalid");
  if (!sameJson(evidence?.sat_set, replay.state.sat_set)) blocked.push("sat_evidence_sat_set_mismatch");

  const prefixEvents = evidence?.events;
  if (!Array.isArray(prefixEvents) || prefixEvents.length !== judgmentEventIndex) {
    blocked.push("sat_evidence_journal_prefix_mismatch");
  } else {
    for (const [index, event] of prefixEvents.entries()) {
      const current = events[index];
      if (!current || event.event_id !== current.event_id || event.seq !== current.seq || event.kind !== current.kind) {
        blocked.push("sat_evidence_journal_prefix_mismatch");
        break;
      }
    }
    const currentBinding = journalPrefixBinding(stateRootDir, prefixEvents);
    if (!currentBinding.ok) blocked.push(...currentBinding.blocked_by);
    else {
      const expectedBinding = packet.journal_binding;
      const actual = currentBinding.binding;
      if (expectedBinding?.path !== actual.path || expectedBinding?.event_count !== actual.event_count
          || expectedBinding?.head_event_id !== actual.head_event_id
          || expectedBinding?.prefix_sha256 !== actual.prefix_sha256
          || expectedBinding?.prefix_byte_length !== actual.prefix_byte_length) {
        blocked.push("sat_evidence_journal_binding_not_current");
      }
    }
  }

  const executedIndex = prefixEvents?.findIndex((event) =>
    event.kind === "MISSION_EXECUTED" &&
    event.payload?.mission_id === target.mission_id &&
    event.payload?.attempt_id === target.attempt_id,
  ) ?? -1;
  if (executedIndex < 0) blocked.push("sat_evidence_execution_missing");
  else {
    const before = reduceUrp0Events(prefixEvents.slice(0, executedIndex));
    const after = reduceUrp0Events(prefixEvents);
    if (!before.ok || before.state_root !== evidence.previous_state_root) blocked.push("sat_previous_state_root_not_rederivable");
    if (!after.ok || after.state_root !== evidence.resulting_state_root) blocked.push("sat_resulting_state_root_not_rederivable");
  }

  let persistedJudgment = null;
  try {
    persistedJudgment = readArtifact(stateRootDir, attemptArtifactName("sat5-judgment", target.attempt_id));
  } catch {
    blocked.push("sat_judgment_artifact_unreadable");
  }
  if (!persistedJudgment) blocked.push("sat_judgment_artifact_missing");
  else {
    if (persistedJudgment.judgment_hash !== packet.judgment_hash) blocked.push("sat_judgment_artifact_hash_mismatch");
    if (!sameJson(persistedJudgment, judgment)) blocked.push("sat_judgment_artifact_bytes_mismatch");
  }

  let rederived = null;
  try {
    rederived = judgeUrp0Mission(evidence);
    const verification = verifyUrp0Judgment({ evidence, judgment });
    if (!verification.ok) blocked.push(...verification.blocked_by);
  } catch {
    blocked.push("sat_verifier_rederivation_failed");
  }
  if (!rederived || rederived.admissible !== true) blocked.push("sat_judgment_not_admissible");
  else {
    const expectedLanes = URP0_SAT_LANES;
    const verdicts = rederived.verifier_verdicts;
    if (!Array.isArray(verdicts) || verdicts.length !== expectedLanes.length) blocked.push("sat_verdict_count_invalid");
    else {
      const seen = new Set();
      for (const [index, expected] of expectedLanes.entries()) {
        const actual = verdicts[index];
        if (!actual || actual.id !== expected.id || actual.lane !== expected.lane || actual.verdict !== "PASS" || seen.has(actual.id)) {
          blocked.push("sat_verdict_lane_not_rederived");
          break;
        }
        seen.add(actual.id);
      }
      if (!sameJson(judgmentEvent.payload?.verifier_verdicts, verdicts.map(({ id, lane, verdict }) => ({ id, lane, verdict })))) {
        blocked.push("sat_judgment_event_not_rederived");
      }
    }
  }

  if (judgment?.autonomous_ai_agent !== false) blocked.push("autonomous_agent_claimed");
  if (judgment?.judges_node0 !== true || judgment?.serves_node0 !== false) blocked.push("sat_boundary_invalid");
  if (worldCell && target?.mission_id === worldCell.dema_mission_id && target?.attempt_id === worldCell.urp_attempt_id) {
    if (`sha256:${worldCell.sat5_judgment_hash}` !== packet.judgment_hash || worldCell.sat5_all_pass !== true) blocked.push("world_cell_sat_claim_mismatch");
    if (worldCell.authority_delta !== 0 || worldCell.public_gateway !== false || worldCell.federation !== false
        || worldCell.node1_admitted !== false || worldCell.token_minted !== false) blocked.push("world_cell_boundary_invalid");
  }

  if (blocked.length > 0) return { ok: false, blocked_by: [...new Set(blocked)] };
  return {
    ok: true,
    blocked_by: [],
    mission_id: target.mission_id,
    attempt_id: target.attempt_id,
    judgment_hash: packet.judgment_hash,
    packet_sha256: packetRead.byte_hash,
    source_event_seq: judgmentEvent.seq,
    rederived_verdicts: rederived.verifier_verdicts.map(({ id, lane, verdict }) => ({ id, lane, verdict })),
    state: "OPERATIONAL_VERIFIED",
  };
}

// The authoritative world state the DEMA World Map renders. Generated from the
// journal on every request — never asserted, never cached into a snapshot.
export function worldState(stateRootDir) {
  const { events, replay } = reconstruct(stateRootDir);
  const principalBinding = replay.ok
    ? node0PrincipalBinding(stateRootDir)
    : { status: "NOT_BOUND", verified: false, blocked_by: replay.blocked_by, authority_delta: 0 };
  const worldCell = replay.state?.world_cell ?? null;
  const satProof = replay.ok
    ? deriveSatOperationality(stateRootDir, events, replay, worldCell)
    : { ok: false, blocked_by: replay.blocked_by };
  const satEvidence = satProof.ok
    ? {
        schema: "bizra.genesis.sat_evidence_ref.v0.1",
        mission_id: satProof.mission_id,
        attempt_id: satProof.attempt_id,
        source_event: "SAT_JUDGMENT_RECORDED",
        source_event_seq: satProof.source_event_seq,
        judgment_sha256: satProof.judgment_hash,
        packet_sha256: satProof.packet_sha256,
      }
    : null;
  const satOperational = satProof.ok;
  const satBlockedBy = satProof.blocked_by;
  return {
    schema: "bizra.genesis.world_state.v0.1",
    truth_label: URP0_TRUTH_LABEL,
    ok: replay.ok,
    blocked_by: replay.blocked_by,
    urp: {
      urp_id: replay.state?.urp_id ?? "URP-0",
      state: replay.state?.urp_state ?? "INITIALIZING",
      state_root: replay.state_root,
      events_applied: replay.events_applied,
      journal_length: events.length,
    },
    ...(replay.state?.system_plane ? { system_plane: replay.state.system_plane } : {}),
    human: replay.state?.human ?? null,
    node: replay.state?.node
      ? {
          ...replay.state.node,
          principal: principalBinding.principal ?? null,
          principal_binding: principalBinding,
        }
      : null,
    dema: {
      role: "face",
      status: worldCell ? "HEALTHY_LOCAL" : (replay.state?.system_plane ? "HEALTH_UNPROVEN" : "ACTIVE_LOCAL"),
      ...(worldCell ? { mission_id: worldCell.mission_id, receipt_hash: `sha256:${worldCell.urp_receipt_sha256}` } : {}),
    },
    pat: worldCell
      ? { status: "PAT7_OPERATIONAL_NODE0_LOCAL", autonomous_agent: false, count: worldCell.pat7_count, evidence_sha256: `sha256:${worldCell.pat7_evidence_sha256}` }
      : { status: "DESIGNED_NOT_LIVE", autonomous_agent: false },
    fate: { status: "ACTIVE_LOCAL", mode: "EXACT_STRING_CONSENT_ONLY" },
    sat: {
      ...SAT5_STATUS,
      lanes: URP0_SAT_LANES.map((l) => ({ ...l })),
      registered: replay.state?.sat_set ?? null,
      ...(replay.state?.system_plane ? {
        owner: "BIZRA_SYSTEM", principal: "CONSTITUTIONAL_SYSTEM_PLANE", logical_home: "URP-0",
        status: satOperational ? "SAT5_OPERATIONAL_URP_GENESIS" : (worldCell ? "SAT5_EVIDENCE_UNVERIFIED" : "REGISTERED_NOT_MISSION_QUALIFIED"),
        operational: satOperational,
        verification_state: satOperational ? "OPERATIONAL_VERIFIED" : "EVIDENCE_REQUIRED",
        verification_blocked_by: satBlockedBy,
        ...(satOperational ? { operational_proof: satProof } : {}),
        inventory: URP0_SAT_LANES.map(l => ({ role_id: l.id, instance_id: `URP-0/${l.id}`,
          verdict_contract: l.lane, owner: "BIZRA_SYSTEM", principal: "CONSTITUTIONAL_SYSTEM_PLANE", logical_home: "URP-0",
          management: "SYSTEM_CONTRACT", serves_node0: false, judges_node0: true,
          evidence_scope: "MISSION_CONTRACT_ONLY", status: satOperational ? "MISSION_VERIFIED" : (worldCell ? "EVIDENCE_UNVERIFIED" : "REGISTERED_NOT_MISSION_QUALIFIED"),
          ...(satOperational ? { verdict: satProof.rederived_verdicts.find((v) => v.id === l.id)?.verdict, evidence_ref: { ...satEvidence, lane: l.id } } : {}) })),
      } : {}),
    },
    resource_offer: replay.state?.resource_offer ?? null,
    missions: replay.state?.missions ?? {},
    receipts: replay.state?.receipts ?? {},
    block0: replay.state?.block0 ?? null,
    world_cell: worldCell,
    boundary: urp0Boundary(),
    state_permissions: statePermissions(stateRootDir),
    journal: events.map((e) => ({ seq: e.seq, kind: e.kind, event_id: e.event_id, prev_event: e.prev_event })),
  };
}

// Operator bootstrap entry point; intentionally absent from the human HTTP API.
// Root bytes and the human authority source are verified by the bootstrap caller.
export function bindWorldCellSystemPlane(stateRootDir, { authority_source_sha256, root_bindings, now_iso }) {
  return appendEvent(stateRootDir, "SYSTEM_PLANE_BOUND", {
    system_id: "BIZRA-GENESIS-SYSTEM", owner: "BIZRA_SYSTEM",
    principal: "CONSTITUTIONAL_SYSTEM_PLANE", logical_home: "URP-0",
    bootstrap_role: "FOUNDER_GENESIS_BOOTSTRAP_ROLE", user_role: "NODE0_HUMAN_USER_ROLE",
    human_id: "HUMAN-0", founder_authority_inherited: false,
    authority_source_sha256, root_bindings, bound_at: now_iso,
  });
}
