// REALM0-WORLD-OBSERVER-1A — Dema's first sense organ.
//
// PURPOSE. Produce one honest, deterministic, provenance-labeled observation of
// the LOCAL MODEL ESTATE that 0B can bind as a real world anchor. Before this
// module, an anchored season save required a human- or fixture-supplied
// `observed` payload; after it, the chain is:
//
//   REAL LOCAL WORLD → OBSERVER → 0B anchor → receipt v0.2 → HEAD
//
// with exactly ONE anchoring implementation (0B's) — this module only observes.
//
// PRODUCTION CLASS: local models only.
//
// IDENTITY LAW (v0.1). A model identity is the tuple
//   { provider, model_id, file_type, size_bytes }
// and NOTHING else. Excluded from identity by contract: path, modified_at,
// generated_at, provider reachability, CPU/RAM/disk, process state, usable_for,
// latency. Identities are canonically sorted and exact-deduplicated, so the
// same estate enumerated in any order yields the same observation digest.
//
// QUALITY LAW. Blindness never becomes "zero models":
//   scanner/probe ERROR          → OBSERVATION_UNAVAILABLE
//   truncated filesystem scan    → OBSERVATION_UNAVAILABLE
//   malformed model record       → OBSERVATION_UNAVAILABLE
//   provider cleanly not-running → observed ABSENCE, disclosed in
//                                  source_quality (its DISK estate still
//                                  appears via the filesystem sources)
// The distinction is the estate's own law: an error is blindness; a service
// that is simply not running is a fact about the world.
//
// STATED GAP (not "solved" with mtime): a same-name, same-size replacement is
// NOT detectable in v0.1 — the scanner exposes no content/revision digest (the
// Hugging Face cache can even report size_bytes: 0). What IS detectable:
// model added/removed, provider/model tuple moved, and file-size changes.
//
// Pure kernel: the scan arrives injected; no fs, no network, no clock, no
// authority. Building the eye is ordinary engineering; USING it to baseline
// the real season is a separate, consequential, operator-explicit act.

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const REALM0_WORLD_OBSERVER_SCHEMA = "bizra.dema.realm0_world_observation.v0.1";
export const REALM0_WORLD_OBSERVER_CONTRACT =
  "bizra.dema.realm0_world_observation.local_models.v0.1";
export const WORLD_OBSERVATION_STATUSES = Object.freeze([
  "OBSERVED",
  "OBSERVATION_UNAVAILABLE",
]);

export const WORLD_OBSERVER_KNOWN_LIMITS = Object.freeze([
  "same_name_same_size_replacement_not_proven",
  "provider_api_cleanly_not_running_is_disclosed_absence_not_blindness",
]);

const unavailable = (reason, blind_sources = []) =>
  Object.freeze({
    schema: REALM0_WORLD_OBSERVER_SCHEMA,
    observer_contract: REALM0_WORLD_OBSERVER_CONTRACT,
    status: "OBSERVATION_UNAVAILABLE",
    reason,
    blind_sources: Object.freeze([...blind_sources]),
    observed: null,
    observation_digest: null,
    source_quality: null,
    authority_delta: 0,
  });

function identityFrom(record, source) {
  if (!record || typeof record !== "object") return { error: `${source}:record_malformed` };
  // The scanner normalizes any unparseable record to the "unknown" sentinel
  // rather than dropping it. An unidentifiable model must not silently become
  // a fake identity that a world anchor then binds — treat the sentinel as
  // blindness, not as a model named "unknown".
  const provider = typeof record.provider === "string" && record.provider.length > 0
    && record.provider !== "unknown" ? record.provider : null;
  const model_id = typeof record.model_id === "string" && record.model_id.length > 0
    && record.model_id !== "unknown" ? record.model_id : null;
  const file_type = typeof record.file_type === "string" && record.file_type.length > 0
    ? record.file_type : null;
  const size_bytes = Number.isInteger(record.size_bytes) && record.size_bytes >= 0
    ? record.size_bytes : null;
  if (provider === null || model_id === null || file_type === null || size_bytes === null) {
    return { error: `${source}:record_malformed` };
  }
  return { identity: { provider, model_id, file_type, size_bytes } };
}

const compareIdentities = (a, b) =>
  a.provider.localeCompare(b.provider) ||
  a.model_id.localeCompare(b.model_id) ||
  a.file_type.localeCompare(b.file_type) ||
  a.size_bytes - b.size_bytes;

/**
 * Build the observation from an injected scan (the shape produced by
 * buildLocalModelInventoryScan / wrapInventoryAsLocalScan). Deterministic:
 * identical estates in any enumeration order produce the identical digest.
 */
export function buildLocalModelWorldObservation({ scan } = {}) {
  if (!scan || typeof scan !== "object" || !scan.providers || typeof scan.providers !== "object") {
    return unavailable("scan_missing_or_malformed");
  }
  const p = scan.providers;
  const blind = [];

  // Probe ERRORS are blindness — never zero models.
  for (const name of ["ollama", "lm_studio"]) {
    const src = p[name];
    if (!src || typeof src !== "object") { blind.push(`${name}:source_missing`); continue; }
    if (src.error != null) blind.push(`${name}:${String(src.error)}`);
  }
  const hf = p.huggingface_cache;
  if (hf && typeof hf === "object" && hf.error != null) blind.push(`huggingface_cache:${String(hf.error)}`);
  const secondaries = Array.isArray(p.secondary_filesystem_scans) ? p.secondary_filesystem_scans : [];
  for (let i = 0; i < secondaries.length; i += 1) {
    const s = secondaries[i];
    if (!s || typeof s !== "object") { blind.push(`secondary_${i}:scan_malformed`); continue; }
    if (s.error != null) blind.push(`secondary_${i}:${String(s.error)}`);
    if (s.truncated_at_max_files === true) blind.push(`secondary_${i}:truncated_at_max_files`);
  }
  if (blind.length > 0) return unavailable("blind_source", blind);

  // Collect identities from every source; a malformed record is blindness too.
  const identities = [];
  const collect = (models, source) => {
    for (const record of Array.isArray(models) ? models : []) {
      const out = identityFrom(record, source);
      if (out.error) return out.error;
      identities.push(out.identity);
    }
    return null;
  };
  const sources = [
    [p.ollama?.models, "ollama"],
    [p.lm_studio?.models, "lm_studio"],
    [p.downloads?.models, "downloads"],
    [hf?.models, "huggingface_cache"],
    ...secondaries.map((s, i) => [s?.models, `secondary_${i}`]),
  ];
  for (const [models, source] of sources) {
    const err = collect(models, source);
    if (err) return unavailable("record_malformed", [err]);
  }

  // Canonical order + exact dedupe: identity excludes path, so the same model
  // present at two paths is ONE fact about the world.
  identities.sort(compareIdentities);
  const deduped = [];
  for (const id of identities) {
    const last = deduped[deduped.length - 1];
    if (!last || compareIdentities(last, id) !== 0) deduped.push(Object.freeze(id));
  }

  // The ANCHORED payload: identity only. Reachability, clocks, and paths are
  // evidence about observation quality, never part of world identity.
  const observed = Object.freeze({
    observer_contract: REALM0_WORLD_OBSERVER_CONTRACT,
    production_class: "local_models",
    identity_count: deduped.length,
    model_identities: Object.freeze(deduped),
    known_limits: WORLD_OBSERVER_KNOWN_LIMITS,
  });

  const source_quality = Object.freeze({
    ollama: Object.freeze({
      api_reachable: p.ollama?.reachable === true,
      disclosed: p.ollama?.reachable === true ? null : "provider_api_not_running_observed_absence",
    }),
    lm_studio: Object.freeze({
      api_reachable: p.lm_studio?.reachable === true,
      disclosed: p.lm_studio?.reachable === true ? null : "provider_api_not_running_observed_absence",
    }),
    downloads_root_present: p.downloads?.root_present !== false,
    huggingface_root_present: hf?.root_present === true,
    secondary_scan_count: secondaries.length,
  });

  return Object.freeze({
    schema: REALM0_WORLD_OBSERVER_SCHEMA,
    observer_contract: REALM0_WORLD_OBSERVER_CONTRACT,
    status: "OBSERVED",
    reason: null,
    blind_sources: Object.freeze([]),
    observed,
    observation_digest: `sha256:${sha256CanonicalJsonV1(observed).replace(/^sha256:/, "")}`,
    source_quality,
    authority_delta: 0,
  });
}
