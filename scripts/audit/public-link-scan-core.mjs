import { createHash } from "node:crypto";

export const PUBLIC_LINK_SCAN_SCHEMA =
  "bizra.dema.public_link_scan.v0.2";
export const FIXED_SURFACE_COUNT = 62;
export const DEFAULT_TIMEOUT_MS = 5_000;
export const USER_AGENT = "BIZRA-Public-Link-Scan/2.0";
export const KNOWN_FORBIDDEN_PHRASES = Object.freeze([
  "Live Receipt Chain",
  "Live Network Data",
  "Machine-enforced. No exceptions.",
  "Live URP",
  "SEED minted",
  "12,680 tests",
]);

function canonicalValue(value) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("canonical_json_non_finite_number");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalValue(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  throw new TypeError("canonical_json_unsupported_value");
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function decodeHtmlEntities(value) {
  const named = new Map([
    ["amp", "&"],
    ["apos", "'"],
    ["gt", ">"],
    ["lt", "<"],
    ["nbsp", " "],
    ["quot", '"'],
  ]);
  return value.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi,
    (entity, decimal, hexadecimal, name) => {
      if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
      if (hexadecimal) {
        return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      }
      return named.get(name.toLowerCase()) ?? entity;
    },
  );
}

function trimUrlPunctuation(value) {
  let result = value.trim();
  while (/[),.;\]}]$/.test(result)) result = result.slice(0, -1);
  return result;
}

function normalizeLinkTarget(value, baseUrl, { hostDirective = false } = {}) {
  let candidate = trimUrlPunctuation(decodeHtmlEntities(value));
  if (hostDirective && !/^[a-z][a-z\d+.-]*:/i.test(candidate)) {
    const base = new URL(baseUrl);
    candidate = `${base.protocol}//${candidate}`;
  }

  let target;
  try {
    target = new URL(candidate, baseUrl);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(target.protocol)) return null;

  target.username = "";
  target.password = "";
  target.search = "";
  target.hash = "";
  return target.href;
}

export function extractLinkTargets(
  body,
  { baseUrl, contentType: _contentType = null },
) {
  const text = Buffer.isBuffer(body)
    ? body.toString("utf8")
    : Buffer.from(body).toString("utf8");
  const candidates = [];

  const attributePattern =
    /\b(?:href|src|action)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  for (const match of text.matchAll(attributePattern)) {
    candidates.push({ value: match[1] ?? match[2] ?? match[3] });
  }

  const xmlLocationPattern = /<loc\b[^>]*>([\s\S]*?)<\/loc>/gi;
  for (const match of text.matchAll(xmlLocationPattern)) {
    candidates.push({ value: match[1].replace(/<[^>]*>/g, "").trim() });
  }

  const robotsPattern = /^\s*(sitemap|host)\s*:\s*(\S+)/gim;
  for (const match of text.matchAll(robotsPattern)) {
    candidates.push({
      value: match[2],
      hostDirective: match[1].toLowerCase() === "host",
    });
  }

  const absoluteUrlPattern = /https?:\/\/[^\s"'<>\\]+/gi;
  for (const match of text.matchAll(absoluteUrlPattern)) {
    candidates.push({ value: match[0] });
  }

  return [
    ...new Set(
      candidates
        .map(({ value, hostDirective }) =>
          normalizeLinkTarget(value, baseUrl, { hostDirective }),
        )
        .filter(Boolean),
    ),
  ].sort();
}

function decodedPathname(value) {
  try {
    const pathname = new URL(value).pathname;
    try {
      return decodeURIComponent(pathname).toLowerCase();
    } catch {
      return pathname.toLowerCase();
    }
  } catch {
    return "";
  }
}

export function classifyLinkTargets(targets) {
  const publicReceiptLinkMatches = [];
  const revokedKeyLinkMatches = [];
  const receiptPattern = /(?:^|[/_-])receipts?(?:[/_.-]|$)/;
  const revokedKeyPattern =
    /(?:^|[/_-])(?:revoked|revocation)(?:[/_.-]|$)|(?:^|[/_-])retired[-_/]?key(?:[/_.-]|$)/;

  for (const target of [...new Set(targets)].sort()) {
    const pathname = decodedPathname(target);
    if (receiptPattern.test(pathname)) {
      publicReceiptLinkMatches.push(target);
    }
    if (revokedKeyPattern.test(pathname)) {
      revokedKeyLinkMatches.push(target);
    }
  }
  return { publicReceiptLinkMatches, revokedKeyLinkMatches };
}

export function findKnownForbiddenPhrases(
  body,
  phrases = KNOWN_FORBIDDEN_PHRASES,
) {
  const text = Buffer.isBuffer(body)
    ? body.toString("utf8")
    : Buffer.from(body).toString("utf8");
  return [...new Set(phrases)].filter((phrase) => text.includes(phrase)).sort();
}

function sortRouteResults(routeResults) {
  return [...routeResults].sort(
    (left, right) =>
      left.id.localeCompare(right.id) ||
      left.request_path.localeCompare(right.request_path),
  );
}

export function projectResponseDigestRecords(routeResults) {
  return sortRouteResults(routeResults).map((result) => ({
    id: result.id,
    request_path: result.request_path,
    status: result.status,
    body_byte_length: result.body_byte_length,
    body_sha256: result.body_sha256,
    request_error: result.request_error,
  }));
}

export function projectRouteDigestRecords(routeResults) {
  return sortRouteResults(routeResults).map((result) => ({
    ...result,
    extracted_links: [...result.extracted_links].sort(),
    public_receipt_link_matches: [
      ...result.public_receipt_link_matches,
    ].sort(),
    revoked_key_link_matches: [...result.revoked_key_link_matches].sort(),
    known_forbidden_phrase_matches: [
      ...result.known_forbidden_phrase_matches,
    ].sort(),
  }));
}

export function buildAggregateDigests(routeResults) {
  return {
    responseDigestSetSha256: sha256Hex(
      canonicalJson(projectResponseDigestRecords(routeResults)),
    ),
    routeResultSetSha256: sha256Hex(
      canonicalJson(projectRouteDigestRecords(routeResults)),
    ),
  };
}

function safeLocation(value, requestUrl) {
  if (!value) return null;
  return normalizeLinkTarget(value, requestUrl) ?? "[invalid-location]";
}

async function scanRoute({
  route,
  origin,
  fetchImpl,
  timeoutMs,
  knownForbiddenPhrases,
}) {
  const requestUrl = new URL(route.requestPath, `${origin}/`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(requestUrl, {
      method: "GET",
      credentials: "omit",
      redirect: "manual",
      headers: {
        Accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.1",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });
    const body = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type");
    const extractedLinks = extractLinkTargets(body, {
      baseUrl: requestUrl.href,
      contentType,
    });
    const matches = classifyLinkTargets(extractedLinks);

    return {
      id: route.id,
      kind: route.kind,
      request_path: route.requestPath,
      source_path: route.sourcePath,
      inventory_disposition: route.inventoryDisposition,
      status: response.status,
      body_byte_length: body.byteLength,
      body_sha256: sha256Hex(body),
      content_type: contentType,
      location: safeLocation(response.headers.get("location"), requestUrl),
      extracted_links: extractedLinks,
      public_receipt_link_matches: matches.publicReceiptLinkMatches,
      revoked_key_link_matches: matches.revokedKeyLinkMatches,
      known_forbidden_phrase_matches: findKnownForbiddenPhrases(
        body,
        knownForbiddenPhrases,
      ),
      request_error: null,
    };
  } catch (error) {
    return {
      id: route.id,
      kind: route.kind,
      request_path: route.requestPath,
      source_path: route.sourcePath,
      inventory_disposition: route.inventoryDisposition,
      status: null,
      body_byte_length: null,
      body_sha256: null,
      content_type: null,
      location: null,
      extracted_links: [],
      public_receipt_link_matches: [],
      revoked_key_link_matches: [],
      known_forbidden_phrase_matches: [],
      request_error:
        controller.signal.aborted || error?.name === "AbortError"
          ? "request_timeout"
          : "request_failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function readClock(now, code) {
  const value = now();
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(code);
  }
  return value;
}

function uniqueRouteValues(routeResults, key) {
  return [
    ...new Set(routeResults.flatMap((result) => result[key])),
  ].sort();
}

export async function scanPublicLinkInventory({
  origin,
  declaredSiteCommit,
  routes,
  expectedSurfaceCount = FIXED_SURFACE_COUNT,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  knownForbiddenPhrases = KNOWN_FORBIDDEN_PHRASES,
}) {
  if (!Array.isArray(routes) || routes.length !== expectedSurfaceCount) {
    throw new Error("fixed_inventory_count_mismatch_at_scan");
  }
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 60_000
  ) {
    throw new Error("invalid_request_timeout");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch_unavailable");
  }

  const started = readClock(now, "invalid_scan_start_clock");
  const routeResults = await Promise.all(
    routes.map((route) =>
      scanRoute({
        route,
        origin,
        fetchImpl,
        timeoutMs,
        knownForbiddenPhrases,
      }),
    ),
  );
  const completed = readClock(now, "invalid_scan_completion_clock");
  if (completed.getTime() < started.getTime()) {
    throw new Error("scan_clock_moved_backwards");
  }

  const statusCounts = Object.fromEntries(
    [...new Set(routeResults.map((result) => result.status).filter(Boolean))]
      .sort((left, right) => left - right)
      .map((status) => [
        String(status),
        routeResults.filter((result) => result.status === status).length,
      ]),
  );
  const digests = buildAggregateDigests(routeResults);
  const extractedLinkTargets = uniqueRouteValues(
    routeResults,
    "extracted_links",
  );
  const publicReceiptLinkMatches = uniqueRouteValues(
    routeResults,
    "public_receipt_link_matches",
  );
  const revokedKeyLinkMatches = uniqueRouteValues(
    routeResults,
    "revoked_key_link_matches",
  );

  return {
    schema: PUBLIC_LINK_SCAN_SCHEMA,
    scan_started_at: started.toISOString(),
    scan_completed_at: completed.toISOString(),
    observed_at: completed.toISOString(),
    duration_ms: completed.getTime() - started.getTime(),
    origin,
    declared_site_commit: declaredSiteCommit,
    request_policy: {
      method: "GET",
      credentials: "omit",
      redirects: "manual",
      timeout_ms: timeoutMs,
      user_agent: USER_AGENT,
    },
    scan_policy: {
      scope: `fixed ${expectedSurfaceCount}-route public-claim inventory`,
      raw_bodies_scanned_in_memory: true,
      raw_bodies_retained: false,
      request_paths_counted_as_extracted_links: false,
      normalized_link_query_values_retained: false,
      known_forbidden_phrases: [...knownForbiddenPhrases],
    },
    digest_policy: {
      algorithm: "SHA-256",
      canonicalization:
        "UTF-8 JSON with lexicographically sorted object keys",
      record_order: "lexicographic id then request_path",
      response_digest_projection: [
        "id",
        "request_path",
        "status",
        "body_byte_length",
        "body_sha256",
        "request_error",
      ],
      route_result_digest_projection: "all route_results fields",
    },
    surface_count: routeResults.length,
    status_counts: statusCounts,
    request_error_count: routeResults.filter(
      (result) => result.request_error !== null,
    ).length,
    response_digest_set_sha256: digests.responseDigestSetSha256,
    route_result_set_sha256: digests.routeResultSetSha256,
    extracted_link_targets: extractedLinkTargets,
    public_receipt_link_matches: publicReceiptLinkMatches,
    public_receipt_link_match_count: publicReceiptLinkMatches.length,
    revoked_key_link_matches: revokedKeyLinkMatches,
    revoked_key_link_match_count: revokedKeyLinkMatches.length,
    known_forbidden_phrase_hit_count: routeResults.reduce(
      (sum, result) =>
        sum + result.known_forbidden_phrase_matches.length,
      0,
    ),
    route_results: routeResults,
    boundary: {
      read_only_get_requests: true,
      credentials_included: false,
      raw_bodies_retained: false,
      filesystem_write_performed: false,
      runtime_mutation_performed: false,
    },
    boundary_note:
      "A dated credential-free web observation. It does not prove deployment alias provenance, Node0 runtime, signer trust, federation, persistence, token state, or receipt issuance.",
  };
}
