// C10 · Bounded web access (per ADR-008 §C10).
//
// Outbound HTTP for PAT-2 only · per-URL allowlist · responses hashed
// and stored · receipt emitted per fetch. NEVER fetches without typed
// per-URL consent · NEVER stores outside ~/.dema.

import { createHash } from "node:crypto";
import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.web_access.v0.1";
const FETCH_REQUEST_SCHEMA = "bizra.dema.web_fetch_request.v0.1";

const REQUIRED_BLOCKED_EFFECTS = Object.freeze([
  "fetch_without_per_url_consent",
  "store_response_outside_dema_home",
  "fetch_from_non_allowlisted_host",
  "fetch_credentials_or_secrets",
  "modify_remote_resource",
  "execute_received_code",
  "federation_invocation"
]);

const ALLOWLIST_HOSTS_DEFAULT = Object.freeze([
  "localhost", "127.0.0.1",
  "github.com", "api.github.com", "raw.githubusercontent.com",
  "huggingface.co",
  "localfirst.fm", "www.localfirst.fm",
  "inkandswitch.com",
  "automerge.org", "yjs.dev",
  "crdt.tech",
  "kleppmann.com", "martin.kleppmann.com"
]);

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function isAllowedHost(url, allowlist) {
  try {
    const u = new URL(url);
    return allowlist.includes(u.hostname);
  } catch {
    return false;
  }
}

function sha256(input) {
  return createHash("sha256").update(String(input)).digest("hex");
}

export function buildWebAccessPreview({ allowlist_hosts = ALLOWLIST_HOSTS_DEFAULT } = {}) {
  const allowlist = Array.isArray(allowlist_hosts)
    ? Object.freeze(allowlist_hosts.filter((h) => typeof h === "string"))
    : ALLOWLIST_HOSTS_DEFAULT;
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    allowlist_hosts: allowlist,
    allowlist_host_count: allowlist.length,
    response_store_path: "~/.dema/web-cache/",
    response_store_policy: "sha256 keyed · operator review before consumption",
    method_allowlist: Object.freeze(["GET", "HEAD"]),
    blocked_effects: REQUIRED_BLOCKED_EFFECTS,
    refusal_invariants: Object.freeze([
      "Web access never fetches without typed per-URL consent",
      "Web access never stores outside ~/.dema/web-cache/",
      "Web access never fetches from non-allowlisted host",
      "Web access never executes received code",
      "Web access only uses GET/HEAD methods"
    ]),
    boundary: buildPreviewBoundary()
  });
}

export function buildWebFetchRequest({
  url = "",
  purpose = "",
  expected_content_type = null,
  allowlist_hosts = ALLOWLIST_HOSTS_DEFAULT
} = {}) {
  const urlSafe = safeString(url);
  const purposeSafe = safeString(purpose).trim();
  const allowlist = Array.isArray(allowlist_hosts) ? allowlist_hosts : ALLOWLIST_HOSTS_DEFAULT;

  const violations = [];
  let parsedUrl = null;
  try {
    parsedUrl = new URL(urlSafe);
  } catch {
    violations.push("invalid_url_format");
  }

  if (parsedUrl) {
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      violations.push(`disallowed_protocol · ${parsedUrl.protocol}`);
    }
    if (!isAllowedHost(urlSafe, allowlist)) {
      violations.push(`host_not_in_allowlist · ${parsedUrl.hostname}`);
    }
  }

  if (purposeSafe.length === 0) violations.push("no_purpose");

  const valid = violations.length === 0;
  const urlHash = parsedUrl ? sha256(urlSafe) : null;
  const consentPhrase = valid
    ? `GO: fetch '${urlSafe}' · '${purposeSafe.slice(0, 60)}'`
    : null;
  const cachePath = valid ? `~/.dema/web-cache/${urlHash}.json` : null;

  return Object.freeze({
    schema: FETCH_REQUEST_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "draft_only",
    drafted_at: new Date().toISOString(),
    url: urlSafe,
    url_hash: urlHash,
    host: parsedUrl?.hostname || null,
    purpose: purposeSafe,
    method: "GET",
    expected_content_type: typeof expected_content_type === "string" ? expected_content_type : null,
    cache_path: cachePath,
    valid,
    violations: Object.freeze(violations),
    consent_phrase: consentPhrase,
    fetch_performed: false,
    response_received: false,
    requires_typed_go: true,
    audit_trail_required: true,
    receipt_shape_ready: valid,
    boundary: buildPreviewBoundary()
  });
}

export function buildWebAccessSummary(options = {}) {
  const preview = buildWebAccessPreview(options);
  return Object.freeze({
    schema: "bizra.dema.web_access_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    allowlist_host_count: preview.allowlist_host_count,
    response_store_path: preview.response_store_path,
    method_allowlist: preview.method_allowlist,
    blocked_effect_count: preview.blocked_effects.length,
    boundary: preview.boundary
  });
}

export const WEB_ACCESS_SCHEMA_NAME = SCHEMA;
export const WEB_ACCESS_FETCH_REQUEST_SCHEMA_NAME = FETCH_REQUEST_SCHEMA;
export const WEB_ACCESS_ALLOWLIST_HOSTS_DEFAULT = ALLOWLIST_HOSTS_DEFAULT;
export const WEB_ACCESS_REQUIRED_BLOCKED_EFFECTS = REQUIRED_BLOCKED_EFFECTS;
