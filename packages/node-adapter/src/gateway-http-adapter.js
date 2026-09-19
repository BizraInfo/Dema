// HTTP adapter for the bizra-cognition-gateway (per ADR-003).
//
// Reads-only: the adapter calls five gateway endpoints in parallel
// (/health, /chain, /poi/summary, /resources/list, /principal/status) and composes a
// schema-tagged status envelope. NEVER calls POST. NEVER fabricates
// fields that the gateway does not expose — those land in `unknown[]`
// or carry a `_truth: "NOT_EXPOSED_BY_GATEWAY"` marker.
//
// Composed schema: bizra.dema.node0_status.v0.2 — superset of the
// shellout adapter's bizra.dema.status.v0.1 (preserves the fields
// formatStatus + isReadyForBoundedDiagnostic consume), additively
// extended with `gateway`, `chain`, `poi`, `resources`, `principal`, `unknown`,
// `truth_label`, and `source` for honest gateway-derived state.
//
// `ready` is false until a measured ARTIFACT-011 witness exists. The generic
// chain head/length is deliberately not that witness: the gateway chain also
// contains principal and other receipts. Before that witness, the adapter
// exposes `preactivationReady` for the bounded one-shot request path.

const DEFAULT_GATEWAY_URL = "http://127.0.0.1:7421";
const DEFAULT_TIMEOUT_MS = 5000;
const GATEWAY_DOMAIN = "bizra-cognition-gateway-v1";
const PRINCIPAL_STATUS_SCHEMA = "bizra.node0.principal_identity_status.v0.3";
const PRINCIPAL_VERDICTS = new Set([
  "ABSENT",
  "PROFILE_PRESENT_UNVERIFIED",
  "CHAIN_DURABLE_ONLY",
  "CHAIN_PAYLOAD_UNAVAILABLE",
  "CHAIN_BINDING_MISMATCH",
  "VERIFIED",
]);
const PRINCIPAL_EVIDENCE_FIELDS = Object.freeze([
  "profilePresent",
  "activeChainRecordFound",
  "durableReceiptMetadataFound",
  "canonicalPayloadAvailable",
  "chainContinuityVerified",
]);
const PRINCIPAL_OPERATION_EFFECT_FIELDS = Object.freeze([
  "mutationPerformed",
  "activationPerformed",
  "witnessIssued",
  "poiMinted",
  "soakStarted",
]);
const VERIFIED_PRINCIPAL_IDENTITY_FIELDS = Object.freeze([
  "principalId",
  "principalProfileHash",
  "subjectKind",
  "subjectId",
  "nodePubkey",
  "activationReceiptRef",
  "receiptId",
  "timestampNs",
  "prevChain",
]);
const ARTIFACT_011_ID = "ARTIFACT-011";
const GATEWAY_ENDPOINTS = Object.freeze([
  ["health", "/health"],
  ["chain", "/chain"],
  ["poi", "/poi/summary"],
  ["resources", "/resources/list"],
  ["principal", "/principal/status"],
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasBooleanFields(value, fields) {
  return (
    isRecord(value) && fields.every((field) => typeof value[field] === "boolean")
  );
}

function hasNonEmptyStringFields(value, fields) {
  return (
    isRecord(value) &&
    fields.every(
      (field) => typeof value[field] === "string" && value[field].length > 0,
    )
  );
}

function inspectPrincipalStatus(principal) {
  if (!principal?.ok) {
    return {
      observation: "UNAVAILABLE",
      contractValid: false,
      schema: null,
      runtimeDomain: null,
      verdict: null,
      identityVerified: null,
      bridgeEligible: null,
      verifiedIdentity: null,
      evidenceState: null,
      authorityDelta: null,
      operationEffects: null,
      reasonCodes: [],
      contractIssues: [principal?.error ?? "principal_status_not_requested"],
      _truth: "NOT_EXPOSED_BY_GATEWAY",
    };
  }

  const payload = principal.json;
  const issues = [];
  if (!isRecord(payload)) {
    issues.push("payload_not_object");
  }
  if (payload?.schema !== PRINCIPAL_STATUS_SCHEMA) {
    issues.push("schema_mismatch");
  }
  if (payload?.runtimeDomain !== GATEWAY_DOMAIN) {
    issues.push("runtime_domain_mismatch");
  }
  if (!PRINCIPAL_VERDICTS.has(payload?.verdict)) {
    issues.push("verdict_invalid");
  }
  if (
    typeof payload?.identityVerified !== "boolean" ||
    typeof payload?.bridgeEligible !== "boolean"
  ) {
    issues.push("identity_flags_invalid");
  }
  if (!hasBooleanFields(payload?.evidenceState, PRINCIPAL_EVIDENCE_FIELDS)) {
    issues.push("evidence_state_invalid");
  }
  if (
    typeof payload?.chainHead !== "string" ||
    payload.chainHead.length === 0 ||
    !Number.isSafeInteger(payload?.chainLength) ||
    payload.chainLength < 0
  ) {
    issues.push("chain_observation_invalid");
  }
  if (
    !isRecord(payload?.authorityPolicy) ||
    payload.authorityPolicy.activationRequires !== "EXPLICIT_GO" ||
    payload.authorityPolicy.authorityDelta !== 0
  ) {
    issues.push("authority_policy_not_read_only");
  }
  if (
    !hasBooleanFields(
      payload?.operationEffects,
      PRINCIPAL_OPERATION_EFFECT_FIELDS,
    ) ||
    PRINCIPAL_OPERATION_EFFECT_FIELDS.some(
      (field) => payload.operationEffects[field] !== false,
    )
  ) {
    issues.push("operation_effects_not_read_only");
  }
  if (
    !Array.isArray(payload?.reasonCodes) ||
    !payload.reasonCodes.every((code) => typeof code === "string")
  ) {
    issues.push("reason_codes_invalid");
  }

  if (payload?.verdict === "VERIFIED") {
    if (payload.identityVerified !== true || payload.bridgeEligible !== true) {
      issues.push("verified_flags_inconsistent");
    }
    if (
      !hasNonEmptyStringFields(
        payload.verifiedIdentity,
        VERIFIED_PRINCIPAL_IDENTITY_FIELDS,
      )
    ) {
      issues.push("verified_identity_incomplete");
    }
    if (
      !PRINCIPAL_EVIDENCE_FIELDS.every(
        (field) => payload.evidenceState?.[field] === true,
      )
    ) {
      issues.push("verified_evidence_incomplete");
    }
  } else if (
    payload?.identityVerified !== false ||
    payload?.bridgeEligible !== false ||
    payload?.verifiedIdentity !== null
  ) {
    issues.push("unverified_verdict_inconsistent");
  }

  if (issues.length > 0) {
    return {
      observation: "INVALID",
      contractValid: false,
      schema: null,
      runtimeDomain: null,
      verdict: null,
      identityVerified: null,
      bridgeEligible: null,
      verifiedIdentity: null,
      evidenceState: null,
      authorityDelta: null,
      operationEffects: null,
      reasonCodes: [],
      contractIssues: issues,
      _truth: "INVALID_GATEWAY_CONTRACT",
    };
  }

  return {
    observation: "MEASURED",
    contractValid: true,
    schema: payload.schema,
    runtimeDomain: payload.runtimeDomain,
    verdict: payload.verdict,
    identityVerified: payload.identityVerified,
    bridgeEligible: payload.bridgeEligible,
    verifiedIdentity: payload.verifiedIdentity,
    evidenceState: payload.evidenceState,
    authorityDelta: payload.authorityPolicy.authorityDelta,
    operationEffects: payload.operationEffects,
    reasonCodes: payload.reasonCodes,
    contractIssues: [],
    _truth: "MEASURED_PARTIAL",
  };
}

function inspectArtifact011Evidence(artifact011) {
  if (artifact011 === undefined) {
    return {
      issued: "UNKNOWN",
      observation: "NOT_EXPOSED_BY_GATEWAY",
      contractValid: false,
      contractIssues: ["artifact011_discriminator_not_exposed_by_gateway"],
      _truth: "NOT_EXPOSED_BY_GATEWAY",
    };
  }

  if (
    !isRecord(artifact011) ||
    artifact011.artifactId !== ARTIFACT_011_ID ||
    typeof artifact011.issued !== "boolean" ||
    artifact011.verified !== true
  ) {
    return {
      issued: "UNKNOWN",
      observation: "INVALID",
      contractValid: false,
      contractIssues: ["artifact011_evidence_invalid_or_unverified"],
      _truth: "INVALID_ARTIFACT011_EVIDENCE",
    };
  }

  return {
    issued: artifact011.issued,
    observation: "MEASURED",
    contractValid: true,
    contractIssues: [],
    _truth: "MEASURED",
  };
}

function isLocalGatewayUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(host)
    );
  } catch {
    return false;
  }
}

function refusedEndpoint(baseUrl, label, path) {
  return {
    ok: false,
    label,
    url: `${baseUrl}${path}`,
    error: "non-localhost_gateway_url_refused",
  };
}

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
  if (!isLocalGatewayUrl(baseUrl)) {
    return {
      baseUrl,
      ...Object.fromEntries(
        GATEWAY_ENDPOINTS.map(([label, path]) => [
          label,
          refusedEndpoint(baseUrl, label, path),
        ]),
      ),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const [health, chain, poi, resources, principal] = await Promise.all([
      fetchEndpoint(`${baseUrl}/health`, "health", controller.signal),
      fetchEndpoint(`${baseUrl}/chain`, "chain", controller.signal),
      fetchEndpoint(`${baseUrl}/poi/summary`, "poi", controller.signal),
      fetchEndpoint(`${baseUrl}/resources/list`, "resources", controller.signal),
      fetchEndpoint(
        `${baseUrl}/principal/status`,
        "principal",
        controller.signal,
      ),
    ]);
    return { baseUrl, health, chain, poi, resources, principal };
  } finally {
    clearTimeout(timer);
  }
}

export function composeNode0StatusFromGateway(state) {
  const { baseUrl, health, chain, poi, resources } = state;
  const principal = state.principal ?? {
    ok: false,
    label: "principal",
    error: "principal_status_not_requested",
  };
  const artifact011 =
    state.artifact011 ??
    (principal.ok && isRecord(principal.json)
      ? principal.json.artifact011
      : undefined);
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

  const principalStatus = inspectPrincipalStatus(principal);
  if (principalStatus.observation === "UNAVAILABLE") {
    findings.push(
      `Gateway /principal/status unavailable: ${principalStatus.contractIssues[0]}`,
    );
  } else if (principalStatus.observation === "INVALID") {
    findings.push(
      `Gateway /principal/status rejected: ${principalStatus.contractIssues.join(", ")}`,
    );
  } else if (!principalStatus.identityVerified) {
    findings.push(
      `Gateway principal identity is not verified (${principalStatus.verdict}).`,
    );
  }

  if (gatewayReachable && chainLength === 0) {
    findings.push("Gateway live, first mission/receipt has not been issued.");
  }

  const artifact011Status = inspectArtifact011Evidence(artifact011);
  if (gatewayReachable && artifact011Status.observation === "NOT_EXPOSED_BY_GATEWAY") {
    findings.push(
      "Gateway does not expose a canonical ARTIFACT-011 discriminator.",
    );
  } else if (gatewayReachable && artifact011Status.observation === "INVALID") {
    findings.push(
      `Gateway ARTIFACT-011 evidence rejected: ${artifact011Status.contractIssues.join(", ")}`,
    );
  }

  const artifact011Issued = artifact011Status.issued;
  const principalReady =
    principalStatus.observation === "MEASURED" &&
    principalStatus.identityVerified === true &&
    principalStatus.bridgeEligible === true;
  const consoleReady = gatewayReachable;
  const activationGate = "EXPLICIT_GO_REQUIRED";
  const daemonStatus = "n/a-via-gateway";
  const runtimePulse = { fired: false };
  const preactivationReady = Boolean(
    consoleReady &&
      principalReady &&
      activationGate === "EXPLICIT_GO_REQUIRED" &&
      daemonStatus !== "running" &&
      artifact011Issued !== true &&
      artifact011Status.observation !== "INVALID" &&
      runtimePulse.fired !== true,
  );

  const truthLabel =
    gatewayReachable && principalStatus.observation !== "INVALID"
      ? "MEASURED_PARTIAL"
      : "DEGRADED";
  // The generic chain is not an ARTIFACT-011 witness. `ready` and
  // `missionExecuted` remain conservative until the gateway exposes and
  // verifies the explicit artifact evidence.
  const ready = artifact011Issued === true;
  const missionExecuted = artifact011Issued === true;

  return {
    schema: "bizra.dema.node0_status.v0.2",
    source: "gateway-http-composed",
    truth_label: truthLabel,
    node: "Node0",
    human: null,
    ready,
    preactivationReady,
    artifact011Issued,
    artifact011Observation: artifact011Status.observation,
    missionExecuted,
    missionExecutedTruth:
      artifact011Issued === "UNKNOWN" ? "UNKNOWN" : "MEASURED",
    consoleReady,
    activationGate,
    daemonStatus,
    runtimePulse,
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
    artifact011: {
      id: ARTIFACT_011_ID,
      issued: artifact011Issued,
      observation: artifact011Status.observation,
      contractValid: artifact011Status.contractValid,
      contractIssues: artifact011Status.contractIssues,
      _truth: artifact011Status._truth,
    },
    poi: {
      totalEntries: poiTotalEntries,
      totalImpact: poiTotalImpact,
      avgImpact: poiAvgImpact,
    },
    resources: {
      count: resourcesCount,
    },
    principal: principalStatus,
    unknown: [
      "lm_studio_status_not_exposed_by_gateway",
      "pyO3_bridge_status_not_exposed_by_gateway",
      "preferred_name_not_exposed_by_gateway",
      "rust_bus_health_inferred_from_gateway_uptime",
      ...(artifact011Status.observation === "NOT_EXPOSED_BY_GATEWAY"
        ? ["artifact011_discriminator_not_exposed_by_gateway"]
        : []),
      ...(artifact011Status.observation === "INVALID"
        ? ["artifact011_evidence_invalid_or_unverified"]
        : []),
      ...(principalStatus.observation === "UNAVAILABLE"
        ? ["principal_identity_not_exposed_by_gateway"]
        : []),
      ...(principalStatus.observation === "INVALID"
        ? ["principal_identity_contract_invalid"]
        : []),
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
