// HTTP adapter for the bizra-cognition-gateway (per ADR-003).
//
// Reads-only: the adapter calls four gateway endpoints in parallel
// (/health, /chain, /poi/summary, /resources/list) and composes a
// schema-tagged status envelope. NEVER calls POST. NEVER fabricates
// fields that the gateway does not expose — those land in `unknown[]`
// or carry a `_truth: "NOT_EXPOSED_BY_GATEWAY"` marker.
//
// Composed schema: bizra.dema.node0_status.v0.2 — superset of the
// shellout adapter's bizra.dema.status.v0.1 (preserves the fields
// formatStatus + isReadyForBoundedDiagnostic consume), additively
// extended with `gateway`, `chain`, `poi`, `resources`, `unknown`,
// `truth_label`, and `source` for honest gateway-derived state.
//
// `ready` is false until a real mission/receipt exists (chain.length > 0
// alone is not sufficient — ARTIFACT-011's first issuance is what
// flips Node0 into the SPROUT readiness state, and that lives upstream
// of this adapter).

const DEFAULT_GATEWAY_URL = "http://127.0.0.1:7421";
const DEFAULT_TIMEOUT_MS = 5000;
const GATEWAY_DOMAIN = "bizra-cognition-gateway-v1";

async function fetchEndpoint(url, label, signal) {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      return { ok: false, label, url, error: `HTTP ${response.status}` };
    }
    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return {
        ok: false,
        label,
        url,
        error: `non-JSON response (content-type: ${ct})`,
      };
    }
    return { ok: true, label, url, json: await response.json() };
  } catch (err) {
    return { ok: false, label, url, error: err?.message ?? String(err) };
  }
}

export async function fetchGatewayState(
  baseUrl = DEFAULT_GATEWAY_URL,
  { timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const [health, chain, poi, resources] = await Promise.all([
      fetchEndpoint(`${baseUrl}/health`, "health", controller.signal),
      fetchEndpoint(`${baseUrl}/chain`, "chain", controller.signal),
      fetchEndpoint(`${baseUrl}/poi/summary`, "poi", controller.signal),
      fetchEndpoint(
        `${baseUrl}/resources/list`,
        "resources",
        controller.signal,
      ),
    ]);
    return { baseUrl, health, chain, poi, resources };
  } finally {
    clearTimeout(timer);
  }
}

export function composeNode0StatusFromGateway(state) {
  const { baseUrl, health, chain, poi, resources } = state;
  const findings = [];

  const gatewayReachable =
    health.ok &&
    health.json?.status === "ok" &&
    health.json?.domain === GATEWAY_DOMAIN;

  if (!health.ok) {
    findings.push(`Gateway /health unreachable: ${health.error}`);
  } else if (!gatewayReachable) {
    findings.push(
      `Gateway /health responded but domain mismatch (got '${health.json?.domain}', expected '${GATEWAY_DOMAIN}')`,
    );
  }

  const chainHead = chain.ok ? (chain.json?.head ?? null) : null;
  const chainLength = chain.ok ? Number(chain.json?.length ?? 0) : 0;
  const latestTimestamp = chain.ok
    ? (chain.json?.latestTimestamp ?? null)
    : null;
  if (!chain.ok) findings.push(`Gateway /chain failed: ${chain.error}`);

  const poiTotalEntries = poi.ok ? Number(poi.json?.totalEntries ?? 0) : 0;
  const poiTotalImpact = poi.ok ? Number(poi.json?.totalImpact ?? 0) : 0;
  const poiAvgImpact = poi.ok ? Number(poi.json?.avgImpact ?? 0) : 0;
  if (!poi.ok) findings.push(`Gateway /poi/summary failed: ${poi.error}`);

  const resourcesCount = resources.ok
    ? (resources.json?.resources?.length ?? 0)
    : 0;
  if (!resources.ok)
    findings.push(`Gateway /resources/list failed: ${resources.error}`);

  if (gatewayReachable && chainLength === 0) {
    findings.push("Gateway live, first mission/receipt has not been issued.");
  }

  const truthLabel = gatewayReachable ? "MEASURED_PARTIAL" : "DEGRADED";
  // `ready` remains false until ARTIFACT-011 is issued by the governed
  // bounded-diagnostic runtime path — the gateway being live is necessary
  // but not sufficient.
  const ready = false;

  return {
    schema: "bizra.dema.node0_status.v0.2",
    source: "gateway-http-composed",
    truth_label: truthLabel,
    node: "Node0",
    human: null,
    ready,
    consoleReady: gatewayReachable,
    activationGate: "EXPLICIT_GO_REQUIRED",
    daemonStatus: "n/a-via-gateway",
    missionExecuted: chainLength > 0,
    runtimePulse: { fired: false },
    findings,
    model: {
      connected: false,
      loadedModelIds: [],
      tokenPresent: false,
      _truth: "NOT_EXPOSED_BY_GATEWAY",
    },
    rustBus: { ready: gatewayReachable },
    proof: {
      latestChainHash: chainHead,
      nextArtifact: "ARTIFACT-011",
    },
    nextAdmissibleAction: "bounded_diagnostic_activation",
    gateway: {
      reachable: gatewayReachable,
      base_url: baseUrl,
      domain: health.ok ? (health.json?.domain ?? null) : null,
      health: health.ok ? (health.json?.status ?? null) : null,
    },
    chain: {
      head: chainHead,
      length: chainLength,
      latestTimestamp,
    },
    poi: {
      totalEntries: poiTotalEntries,
      totalImpact: poiTotalImpact,
      avgImpact: poiAvgImpact,
    },
    resources: {
      count: resourcesCount,
    },
    unknown: [
      "lm_studio_status_not_exposed_by_gateway",
      "pyO3_bridge_status_not_exposed_by_gateway",
      "preferred_name_not_exposed_by_gateway",
      "rust_bus_health_inferred_from_gateway_uptime",
    ],
  };
}

export function createGatewayHttpAdapter({ baseUrl, timeoutMs } = {}) {
  const resolvedBaseUrl =
    baseUrl ?? process.env.DEMA_GATEWAY_URL ?? DEFAULT_GATEWAY_URL;

  return {
    async status() {
      const state = await fetchGatewayState(resolvedBaseUrl, { timeoutMs });
      return composeNode0StatusFromGateway(state);
    },
    async listReceipts() {
      return [];
    },
    async proposeBoundedDiagnostic() {
      const status = await this.status();
      return {
        status,
        requiredConsentPhrase: "GO: Node0 bounded diagnostic activation only",
      };
    },
  };
}
