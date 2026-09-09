import {
  compileMissionProposal,
  verifyMissionProposal,
} from "@core/bizra-prompt-mission-bridge.js";

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const RUNTIME_ROUTES = new Set(["/api/consent-card", "/api/authorize"]);
export const MAX_INTENT_BYTES = 64 * 1024;

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
    signal: AbortSignal.timeout(10_000),
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
