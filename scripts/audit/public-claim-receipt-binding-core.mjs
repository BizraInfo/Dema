export const PUBLIC_CLAIM_RECEIPT_BINDING_SCHEMA =
  "bizra.dema.public_claim_receipt_binding_evidence.v0.1";

export const PUBLIC_CLAIM_DISPOSITIONS = Object.freeze([
  "BOUND",
  "REMOVED",
  "RECEIPT_UNBOUND",
]);

export const PUBLIC_CLAIM_BLOCKERS = Object.freeze([
  "GOVERNED_RECEIPT_NOT_ISSUED",
  "PUBLICATION_AUTHORIZATION_REQUIRED",
  "TRUSTED_SIGNER_ROTATION_PENDING",
]);

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const CLAIM_ID = /^BIZRA-PUBLIC-\d{3}$/;

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function addViolation(violations, code, claimId = null) {
  violations.push({ code, claim_id: claimId });
}

function validateStringArray({
  value,
  code,
  claimId,
  violations,
  pattern = null,
  validate = null,
}) {
  if (!Array.isArray(value)) {
    addViolation(violations, code, claimId);
    return [];
  }

  const seen = new Set();
  for (const entry of value) {
    if (
      typeof entry !== "string" ||
      entry.length === 0 ||
      (pattern && !pattern.test(entry)) ||
      (validate && !validate(entry))
    ) {
      addViolation(violations, code, claimId);
      continue;
    }
    if (seen.has(entry)) addViolation(violations, `${code}_duplicate`, claimId);
    seen.add(entry);
  }
  return value;
}

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

function validateClaim(entry, seenClaimIds, violations) {
  if (!isPlainObject(entry)) {
    addViolation(violations, "invalid_claim_record");
    return null;
  }

  const claimId = entry.claim_id;
  if (typeof claimId !== "string" || !CLAIM_ID.test(claimId)) {
    addViolation(violations, "invalid_claim_id");
    return null;
  }
  if (seenClaimIds.has(claimId)) {
    addViolation(violations, "duplicate_claim_id", claimId);
  }
  seenClaimIds.add(claimId);

  const routes = validateStringArray({
    value: entry.routes,
    code: "invalid_routes",
    claimId,
    violations,
    validate: (route) => route.startsWith("/") && !route.startsWith("//"),
  });
  const evidenceCommits = validateStringArray({
    value: entry.evidence_commits,
    code: "invalid_evidence_commit",
    claimId,
    violations,
    pattern: SHA40,
  });
  const receiptHashes = validateStringArray({
    value: entry.receipt_hashes,
    code: "invalid_receipt_hash",
    claimId,
    violations,
    pattern: SHA256,
  });
  const receiptLinks = validateStringArray({
    value: entry.receipt_links,
    code: "invalid_receipt_link",
    claimId,
    violations,
    validate: isHttpsUrl,
  });

  if (!PUBLIC_CLAIM_DISPOSITIONS.includes(entry.disposition)) {
    addViolation(violations, "invalid_disposition", claimId);
    return null;
  }
  if (
    entry.blocker !== null &&
    !PUBLIC_CLAIM_BLOCKERS.includes(entry.blocker)
  ) {
    addViolation(violations, "invalid_blocker", claimId);
  }

  if (entry.disposition === "BOUND") {
    if (routes.length === 0) {
      addViolation(violations, "bound_live_route_required", claimId);
    }
    if (evidenceCommits.length === 0) {
      addViolation(violations, "bound_evidence_commit_required", claimId);
    }
    if (receiptHashes.length === 0) {
      addViolation(violations, "bound_receipt_hash_required", claimId);
    }
    if (receiptLinks.length === 0) {
      addViolation(violations, "bound_receipt_link_required", claimId);
    }
    if (entry.blocker !== null) {
      addViolation(violations, "bound_blocker_forbidden", claimId);
    }
  }

  if (entry.disposition === "REMOVED") {
    if (routes.length !== 0) {
      addViolation(violations, "removed_live_route_forbidden", claimId);
    }
    if (evidenceCommits.length === 0) {
      addViolation(violations, "removed_evidence_commit_required", claimId);
    }
    if (receiptHashes.length !== 0 || receiptLinks.length !== 0) {
      addViolation(violations, "removed_receipt_evidence_forbidden", claimId);
    }
    if (entry.blocker !== null) {
      addViolation(violations, "removed_blocker_forbidden", claimId);
    }
  }

  if (entry.disposition === "RECEIPT_UNBOUND") {
    if (routes.length === 0) {
      addViolation(violations, "unbound_live_route_required", claimId);
    }
    if (evidenceCommits.length === 0) {
      addViolation(violations, "unbound_evidence_commit_required", claimId);
    }
    if (receiptHashes.length !== 0 || receiptLinks.length !== 0) {
      addViolation(violations, "unbound_receipt_evidence_forbidden", claimId);
    }
    if (!PUBLIC_CLAIM_BLOCKERS.includes(entry.blocker)) {
      addViolation(violations, "unbound_blocker_required", claimId);
    }
  }

  return {
    claimId,
    disposition: entry.disposition,
    routes,
  };
}

function expectedSummary(claims) {
  const boundCount = claims.filter(
    (entry) => entry?.disposition === "BOUND",
  ).length;
  const removedCount = claims.filter(
    (entry) => entry?.disposition === "REMOVED",
  ).length;
  const unboundCount = claims.filter(
    (entry) => entry?.disposition === "RECEIPT_UNBOUND",
  ).length;
  return {
    claim_count: claims.length,
    bound_count: boundCount,
    removed_count: removedCount,
    unbound_count: unboundCount,
    closure_status:
      unboundCount === 0
        ? "CLOSED"
        : "BLOCKED_PENDING_RECEIPT_BINDING",
  };
}

function sameSummary(actual, expected) {
  return (
    isPlainObject(actual) &&
    Object.entries(expected).every(([key, value]) => actual[key] === value)
  );
}

function sameStrings(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function validateRouteObservations(routeObservations, violations) {
  if (!Array.isArray(routeObservations)) {
    addViolation(violations, "invalid_route_observations");
    return new Map();
  }

  const seenRoutes = new Set();
  const observedRoutesByClaim = new Map();
  for (const observation of routeObservations) {
    if (!isPlainObject(observation)) {
      addViolation(violations, "invalid_route_observation");
      continue;
    }
    const route = observation.route;
    if (
      typeof route !== "string" ||
      !route.startsWith("/") ||
      route.startsWith("//")
    ) {
      addViolation(violations, "invalid_observed_route");
      continue;
    }
    if (seenRoutes.has(route)) {
      addViolation(violations, "duplicate_observed_route");
    }
    seenRoutes.add(route);
    if (
      !Number.isInteger(observation.status) ||
      observation.status < 100 ||
      observation.status > 599
    ) {
      addViolation(violations, "invalid_observed_status");
    }
    if (
      typeof observation.body_sha256 !== "string" ||
      !SHA256.test(observation.body_sha256)
    ) {
      addViolation(violations, "invalid_observed_body_hash");
    }

    const claimIds = validateStringArray({
      value: observation.claim_ids,
      code: "invalid_observed_claim_id",
      claimId: null,
      violations,
      pattern: CLAIM_ID,
    });
    for (const claimId of claimIds) {
      const routes = observedRoutesByClaim.get(claimId) ?? [];
      routes.push(route);
      observedRoutesByClaim.set(claimId, routes);
    }
  }

  for (const routes of observedRoutesByClaim.values()) routes.sort();
  return observedRoutesByClaim;
}

export function validatePublicClaimReceiptBindingEvidence(
  evidence,
  { now = null, maxObservationAgeMs = null } = {},
) {
  const violations = [];
  if (!isPlainObject(evidence)) {
    return {
      ok: false,
      closure_ready: false,
      unbound_claim_ids: [],
      violations: [{ code: "invalid_evidence_shape", claim_id: null }],
    };
  }

  if (evidence.schema !== PUBLIC_CLAIM_RECEIPT_BINDING_SCHEMA) {
    addViolation(violations, "invalid_schema");
  }
  if (
    typeof evidence.observed_at !== "string" ||
    Number.isNaN(Date.parse(evidence.observed_at))
  ) {
    addViolation(violations, "invalid_observed_at");
  }
  if (!isHttpsUrl(evidence.origin)) {
    addViolation(violations, "invalid_origin");
  }

  // A manifest records the live surface at one past instant. Its content never
  // expires on its own, so a verdict derived from an observation of any age
  // reads exactly like a current one. `now` is injected, never read here, so
  // this stays a pure function.
  let observationAgeMs = null;
  const observedMs = Date.parse(evidence.observed_at);
  const nowMs = now instanceof Date ? now.getTime() : now;
  if (Number.isFinite(observedMs) && Number.isFinite(nowMs)) {
    observationAgeMs = nowMs - observedMs;
  }
  if (maxObservationAgeMs !== null && maxObservationAgeMs !== undefined) {
    if (
      observationAgeMs === null ||
      !Number.isFinite(maxObservationAgeMs) ||
      maxObservationAgeMs < 0 ||
      observationAgeMs < 0 ||
      observationAgeMs > maxObservationAgeMs
    ) {
      addViolation(violations, "stale_observation");
    }
  }

  const scan = evidence.scan;
  if (
    !isPlainObject(scan) ||
    typeof scan.schema !== "string" ||
    !Number.isInteger(scan.surface_count) ||
    scan.surface_count < 1 ||
    !Number.isInteger(scan.request_error_count) ||
    scan.request_error_count < 0 ||
    typeof scan.response_digest_set_sha256 !== "string" ||
    !SHA256.test(scan.response_digest_set_sha256) ||
    typeof scan.route_result_set_sha256 !== "string" ||
    !SHA256.test(scan.route_result_set_sha256)
  ) {
    addViolation(violations, "invalid_scan_evidence");
  }

  const observedRoutesByClaim = validateRouteObservations(
    evidence.route_observations,
    violations,
  );
  const claims = evidence.claims;
  const seenClaimIds = new Set();
  const validatedClaims = [];
  if (!Array.isArray(claims) || claims.length === 0) {
    addViolation(violations, "claims_required");
  } else {
    for (const entry of claims) {
      const validated = validateClaim(entry, seenClaimIds, violations);
      if (validated) validatedClaims.push(validated);
    }
  }

  for (const claim of validatedClaims) {
    const observedRoutes = observedRoutesByClaim.get(claim.claimId) ?? [];
    if (!sameStrings([...claim.routes].sort(), observedRoutes)) {
      addViolation(
        violations,
        "claim_route_observation_mismatch",
        claim.claimId,
      );
    }
  }
  for (const claimId of observedRoutesByClaim.keys()) {
    if (!seenClaimIds.has(claimId)) {
      addViolation(violations, "observed_claim_missing_record", claimId);
    }
  }

  const summary = expectedSummary(Array.isArray(claims) ? claims : []);
  if (!sameSummary(evidence.summary, summary)) {
    addViolation(violations, "summary_mismatch");
  }

  const boundary = evidence.boundary;
  if (
    !isPlainObject(boundary) ||
    boundary.read_only_scan !== true ||
    boundary.credentials_included !== false ||
    boundary.raw_bodies_retained !== false ||
    boundary.runtime_mutation_performed !== false ||
    boundary.receipt_issued !== false
  ) {
    addViolation(violations, "invalid_boundary");
  }

  const unboundClaimIds = Array.isArray(claims)
    ? claims
        .filter((entry) => entry?.disposition === "RECEIPT_UNBOUND")
        .map((entry) => entry.claim_id)
        .filter((claimId) => typeof claimId === "string")
        .sort()
    : [];

  return {
    ok: violations.length === 0,
    closure_ready:
      violations.length === 0 && summary.closure_status === "CLOSED",
    unbound_claim_ids: unboundClaimIds,
    observation_age_ms: observationAgeMs,
    summary,
    violations,
  };
}
