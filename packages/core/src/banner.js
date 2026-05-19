// Active-kernel startup banner for `dema` (no-args invocation).
// Composes operator profile + node stage + gateway status + receipt count
// into a terse human-readable greeting that ends with a single safe-task
// suggestion. Pure functions over pre-fetched data — I/O lives in
// gatherBannerInputs().

import { readMemoryEntry } from "../../memory/src/memory-store.js";
import { listReceipts } from "../../receipts/src/receipt-store.js";

const GATEWAY_DEFAULT_URL = "http://127.0.0.1:7421";
const GATEWAY_PROBE_TIMEOUT_MS = 1500;
const GATEWAY_DOMAIN = "bizra-cognition-gateway-v1";

export async function probeGateway(baseUrl = GATEWAY_DEFAULT_URL, { timeoutMs = GATEWAY_PROBE_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    if (!response.ok) return { reachable: false, baseUrl, error: `HTTP ${response.status}` };
    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return { reachable: false, baseUrl, error: `non-JSON (${ct})` };
    }
    const json = await response.json();
    const domainOk = json?.domain === GATEWAY_DOMAIN;
    return { reachable: domainOk, baseUrl, domain: json?.domain ?? null, status: json?.status ?? null };
  } catch (err) {
    return { reachable: false, baseUrl, error: err?.message ?? String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function gatherBannerInputs({ home, gatewayUrl } = {}) {
  let profile = null;
  try {
    profile = await readMemoryEntry("profile", home);
  } catch {
    // first-run: profile not yet populated
  }

  let bizraContext = null;
  try {
    bizraContext = await readMemoryEntry("bizra-context", home);
  } catch {
    // memory not yet populated
  }

  let receiptCount = 0;
  let receiptHighlights = [];
  try {
    const receipts = await listReceipts(home);
    receiptCount = receipts.length;
    receiptHighlights = receipts
      .filter((r) => r.artifact_id || r.action)
      .slice(0, 3)
      .map((r) => ({ artifact_id: r.artifact_id ?? null, action: r.action ?? null }));
  } catch {
    // no receipts dir yet
  }

  const gateway = await probeGateway(gatewayUrl);

  return {
    schema: "bizra.dema.banner_inputs.v0.1",
    profile,
    bizraContext,
    receiptCount,
    receiptHighlights,
    gateway
  };
}

function suggestNextSafeTask(inputs) {
  const { profile, bizraContext, receiptCount, gateway } = inputs;
  if (!profile) {
    return {
      command: "dema setup",
      why: "First run — Dema needs ~/.dema/ initialized before anything else."
    };
  }
  if (!bizraContext) {
    return {
      command: "dema memory show profile",
      why: "Profile present but project memory not populated — confirm Dema can read its own memory."
    };
  }
  if (gateway.reachable && receiptCount > 0) {
    return {
      command: "dema task downloads.audit.preview",
      why: "Gateway live, receipts present. Try the first read-only task — scans ~/Downloads, writes a receipt, mutates nothing."
    };
  }
  if (gateway.reachable) {
    return {
      command: "dema status",
      why: "Gateway live. Inspect live runtime state."
    };
  }
  return {
    command: "dema doctor",
    why: "Gateway unreachable. Confirm readiness boundaries."
  };
}

export function formatBanner(inputs) {
  const { profile, bizraContext, receiptCount, receiptHighlights, gateway } = inputs;
  const name = profile?.preferred_name ?? "operator";
  const stage = bizraContext?.stage?.current ?? "unknown";
  const nextStage = bizraContext?.stage?.next ?? null;
  const gatewayLine = gateway.reachable
    ? `connected at ${gateway.baseUrl}`
    : `unreachable (${gateway.error ?? "no response"})`;
  const next = suggestNextSafeTask(inputs);

  const receiptsLine = `${receiptCount}${receiptHighlights.length > 0 ? ` (latest: ${receiptHighlights.map((r) => r.artifact_id ?? r.action).filter(Boolean).join(", ")})` : ""}`;
  const lines = [
    "Dema — Sovereign AI Node Companion",
    "============================================================",
    "Local-first cockpit for BIZRA Node0",
    "",
    "Operator",
    `  name     : ${name}`,
    `  node     : Node0`,
    `  stage    : ${stage}${nextStage ? ` -> ${nextStage}` : ""}`,
    "",
    "Signals",
    `  gateway  : ${gatewayLine}`,
    `  receipts : ${receiptsLine}`,
    "",
    "Next safe task:",
    `  $ ${next.command}`,
    `  why: ${next.why}`,
    "",
    "Guided path:",
    "  $ dema onboard",
    "  $ dema status",
    "  $ dema diagnostics plan",
    "",
    "Type `dema help` for the full command list.",
    "Boundary: no action without explicit consent."
  ];
  return lines.join("\n");
}

export function bannerSummary(inputs) {
  // Compact JSON form for tests / scripted consumers.
  const next = suggestNextSafeTask(inputs);
  return {
    schema: "bizra.dema.banner.v0.1",
    operator: inputs.profile?.preferred_name ?? null,
    node: "Node0",
    stage: inputs.bizraContext?.stage?.current ?? null,
    gateway_reachable: inputs.gateway.reachable,
    gateway_url: inputs.gateway.baseUrl,
    receipt_count: inputs.receiptCount,
    next_safe_task: next
  };
}
