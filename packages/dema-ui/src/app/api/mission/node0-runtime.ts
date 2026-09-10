import { createHash } from "node:crypto";
import { existsSync, linkSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  compileMissionProposal,
  verifyMissionProposal,
} from "@core/bizra-prompt-mission-bridge.js";
import {
  reduceAttentionAllocation,
  verifyAttentionAllocationReceipt,
} from "@core/constitutional-attention-allocator.js";
import {
  buildDemaIdentityRootCanon,
  DEFAULT_IDENTITY_ROOTS_DIR,
  IDENTITY_ROOT_PINS,
} from "@core/dema-identity-root-canon.js";

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const RUNTIME_ROUTES = new Set(["/api/consent-card", "/api/pat-card", "/api/pat-proposal", "/api/authorize"]);
const GOVERNED_RUNTIME_TIMEOUT_MS = 70_000;
export const MAX_INTENT_BYTES = 64 * 1024;

function sha256File(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function rootCanonContext() {
  const rootsDir = process.env.BIZRA_NODE0_ROOTS_DIR || process.env.DEMA_ROOTS_DIR || DEFAULT_IDENTITY_ROOTS_DIR;
  try {
    const root_files = IDENTITY_ROOT_PINS.map((pin) => ({
      file: pin.file,
      sha256: sha256File(join(rootsDir, pin.file)),
    }));
    const canon = buildDemaIdentityRootCanon({ root_files });
    if (canon.rejected !== true && typeof canon.canon_hash === "string") {
      return {
        status: "BOUND",
        hash: `sha256:${canon.canon_hash}`,
        source: "five_founding_roots_identity_canon",
      };
    }
    return { status: "UNKNOWN", source: "identity_root_canon_rejected" };
  } catch {
    return { status: "UNKNOWN", source: "identity_root_measurement_unavailable" };
  }
}

function profileStoryContext() {
  const home = process.env.BIZRA_FOUNDER_DEMA_HOME;
  if (!home || !home.startsWith("/")) return { status: "UNKNOWN", source: "founder_profile_root_unbound" };
  try {
    const profilePath = join(home, "profile.json");
    const parsed = JSON.parse(readFileSync(profilePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { status: "UNKNOWN", source: "founder_profile_malformed" };
    }
    return {
      status: "DECLARED",
      hash: `sha256:${sha256File(profilePath)}`,
      source: "founder_profile_json",
      user_confirmed: false,
    };
  } catch {
    return { status: "UNKNOWN", source: "founder_profile_unavailable" };
  }
}

/**
 * Read the minimum non-secret context for the real DEMA mission input path.
 * Root DNA is measured from the immutable five-file canon; the private profile
 * contributes only a commitment. Missing current life context stays UNKNOWN.
 */
export function loadNode0MissionContext() {
  return {
    root_dna: rootCanonContext(),
    node_story: profileStoryContext(),
    current_state: { status: "UNKNOWN", source: "current_human_state_not_bound" },
    human_identity: {
      display_name: {
        status: "DECLARED",
        value: process.env.BIZRA_NODE0_DISPLAY_NAME || "Momo",
        source: "node0_campaign_user_facing_name",
        user_confirmed: true,
      },
    },
    human_compass: {
      financial_freedom: "UNKNOWN",
      mind_clarity: "UNKNOWN",
      peace_of_heart: "UNKNOWN",
    },
  };
}

export function mergeNode0MissionContext(requested: unknown) {
  const candidate = requested && typeof requested === "object" && !Array.isArray(requested) ? requested as Record<string, any> : {};
  const trusted = loadNode0MissionContext();
  return {
    ...candidate,
    ...trusted,
    root_dna: trusted.root_dna,
    node_story: candidate.node_story ?? trusted.node_story,
    current_state: candidate.current_state ?? trusted.current_state,
    human_identity: trusted.human_identity,
    human_compass: {
      ...trusted.human_compass,
      ...(candidate.human_compass && typeof candidate.human_compass === "object" ? candidate.human_compass : {}),
    },
  };
}

export function persistAttentionAllocation(proposal: any) {
  const reduced = reduceAttentionAllocation(proposal?.attention ?? proposal);
  if (!reduced.ok) return reduced;
  const root = process.env.BIZRA_GENESIS_CAMPAIGN_ROOT;
  if (!root || !root.startsWith("/") || root === "/") {
    return { ok: false, blocked_by: ["campaign_root_unbound"] };
  }

  const directory = join(root, "receipts", "attention");
  const filename = `${reduced.receipt.allocation_id}.json`;
  const target = join(directory, filename);
  const content = `${JSON.stringify(reduced.receipt, null, 2)}\n`;
  const existing = () => {
    if (!existsSync(target)) return null;
    try {
      const raw = readFileSync(target, "utf8");
      const parsed = JSON.parse(raw);
      const verified = verifyAttentionAllocationReceipt(parsed);
      if (!verified.ok || raw !== content) return { ok: false, blocked_by: ["allocation_receipt_collision"] };
      return { ok: true, blocked_by: [], receipt: parsed, reused: true };
    } catch {
      return { ok: false, blocked_by: ["allocation_receipt_existing_invalid"] };
    }
  };

  const prior = existing();
  if (prior) return prior;
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const temp = join(directory, `.${filename}.${process.pid}.${Date.now()}.tmp`);
    writeFileSync(temp, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
    try {
      linkSync(temp, target);
      unlinkSync(temp);
    } catch (error) {
      try { unlinkSync(temp); } catch { /* best effort cleanup */ }
      const raced = existing();
      if (raced) return raced;
      return { ok: false, blocked_by: [`allocation_receipt_persist_failed:${String((error as Error)?.message ?? error)}`] };
    }
    return { ok: true, blocked_by: [], receipt: reduced.receipt, reused: false };
  } catch (error) {
    return { ok: false, blocked_by: [`allocation_receipt_persist_failed:${String((error as Error)?.message ?? error)}`] };
  }
}

export function requireCompilerCodeHash() {
  const value = process.env.BIZRA_PROMPT_COMPILER_CODE_HASH;
  if (!value || !HASH_RE.test(value)) throw new Error("compiler_code_hash_unbound");
  return value;
}

export function configuredMissionRoot() {
  const value = process.env.BIZRA_NODE0_MISSION_ROOT;
  if (!value || !value.startsWith("/")) return null;
  return value;
}

function runtimeUrl() {
  const raw = process.env.BIZRA_NODE0_GOVERNED_RUNTIME_URL ?? "http://127.0.0.1:4301";
  const url = new URL(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(host) || url.pathname !== "/") {
    throw new Error("governed_runtime_must_be_loopback_http");
  }
  return url;
}

export function proposalBinding(proposal: any) {
  const binding = {
    bridge_hash: proposal?.bridge_hash,
    source_intent_hash: proposal?.source_intent_hash,
    compiler_identity_hash: proposal?.compiler?.identity_hash,
    compiled_contract_hash: proposal?.mission_contract?.contract_hash,
    context_hash: proposal?.context_hash,
  };
  if (!Object.values(binding).every((value) => typeof value === "string" && HASH_RE.test(value))) {
    throw new Error("proposal_binding_invalid");
  }
  return binding;
}

export function verifySubmittedProposal(proposal: any) {
  const compilerCodeHash = requireCompilerCodeHash();
  const verification = verifyMissionProposal(proposal, {
    expected_compiler_code_hash: compilerCodeHash,
    expected_context: proposal?.context_snapshot,
  });
  return { compilerCodeHash, verification };
}

export async function callGovernedRuntime(path: string, body: unknown) {
  if (!RUNTIME_ROUTES.has(path)) throw new Error("governed_runtime_route_not_allowed");
  const url = new URL(path, runtimeUrl());
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(GOVERNED_RUNTIME_TIMEOUT_MS),
    cache: "no-store",
  });
  let data: any;
  try {
    data = await response.json();
  } catch {
    data = { ok: false, blocked_by: ["governed_runtime_invalid_json"] };
  }
  return { status: response.status, data };
}

export function readIntent(body: any) {
  const text = typeof body?.text === "string" ? body.text : "";
  if (Buffer.byteLength(text, "utf8") > MAX_INTENT_BYTES) throw new Error("intent_too_large");
  return text;
}
