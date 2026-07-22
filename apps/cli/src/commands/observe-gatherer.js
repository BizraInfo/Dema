// NODE0-ACTIVATION-OBSERVE-1A — read-only observation gatherer (Issue #243).
//
// Lives in apps/cli (outside the kernel-purity scan, which covers only
// packages/*/src). It performs ONLY bounded, localhost-gated, GET-only,
// read-only probing and feeds a plain `observations` object to the pure kernel
// (packages/core/src/node0-activation-observe.js). It NEVER mutates anything:
// no POST/PUT/DELETE, no daemon control, no readFile of any key (presence via
// existsSync only). fetchImpl / fsImpl / env / homedir are injectable so CI
// runs with zero real network and zero real disk (mirrors dema-talk-loop-live).

import { existsSync as nodeExistsSync } from "node:fs";
import { homedir as osHomedir } from "node:os";
import { join } from "node:path";

// Self-contained localhost guard — only 127.0.0.1 / ::1 / localhost may be
// probed. A non-local URL is refused, never fetched (no egress off-box).
export function isLocalUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
    return host === "127.0.0.1" || host === "::1" || host === "localhost";
  } catch {
    return false;
  }
}

async function getJson(fetcher, url, timeoutMs) {
  if (!isLocalUrl(url)) return { ok: false, status: null, json: null, error_class: "non_local_url_refused" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // redirect:"manual" — isLocalUrl validates only the INITIAL url, so refusing
    // to follow 3xx closes off-box egress via a loopback process that answers a
    // probe with `302 Location: http://off-box`. A redirect is treated as refused.
    const res = await fetcher(url, { method: "GET", redirect: "manual", signal: ctrl.signal });
    const isRedirect = typeof res.status === "number" && res.status >= 300 && res.status < 400;
    let json = null;
    if (!isRedirect) {
      try {
        json = await res.json();
      } catch {
        json = null;
      }
    }
    const ok = res.ok === true && !isRedirect;
    return { ok, status: res.status ?? null, json, error_class: ok ? null : isRedirect ? "redirect_refused" : `http_${res.status ?? "error"}` };
  } catch {
    return { ok: false, status: null, json: null, error_class: "provider_unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

function liveFromProbe(p) {
  if (p.ok) return true;
  if (p.error_class === "provider_unreachable") return null; // can't determine
  return false; // reachable but not OK (e.g. auth-gated / error)
}

export async function gatherNode0ActivationObservations({
  fetchImpl,
  fsImpl,
  env = process.env,
  homedir,
  timeoutMs = 2000,
} = {}) {
  const fetcher = fetchImpl || globalThis.fetch;
  const exists = (p) => (fsImpl && fsImpl.existsSync ? fsImpl.existsSync(p) : nodeExistsSync(p));
  const home = homedir || osHomedir();
  const demaHome = env.DEMA_HOME || join(home, ".dema");

  // Sovereign runtime — PUBLIC liveness/readiness probes only.
  const sovBase = env.DEMA_SOVEREIGN_URL || "http://127.0.0.1:8000";
  const live = await getJson(fetcher, `${sovBase}/v1/health/live`, timeoutMs);
  const ready = await getJson(fetcher, `${sovBase}/v1/health/ready`, timeoutMs);
  const sovereign = {
    probed: true,
    base_url: sovBase,
    live: liveFromProbe(live),
    ready: liveFromProbe(ready),
    http_status: live.status,
    error_class: live.ok ? null : live.error_class,
  };

  // Local model providers — model id lists only (no file paths, no content).
  const lmBase = env.LMSTUDIO_URL || "http://127.0.0.1:1234";
  const lm = await getJson(fetcher, `${lmBase}/v1/models`, timeoutMs);
  const lm_studio = {
    probed: true,
    reachable: lm.ok,
    model_ids: lm.ok && Array.isArray(lm.json?.data) ? lm.json.data.map((m) => m?.id).filter(Boolean) : [],
  };
  const olBase = env.OLLAMA_URL || "http://127.0.0.1:11434";
  const ol = await getJson(fetcher, `${olBase}/api/tags`, timeoutMs);
  const ollama = {
    probed: true,
    reachable: ol.ok,
    model_ids: ol.ok && Array.isArray(ol.json?.models) ? ol.json.models.map((m) => m?.name).filter(Boolean) : [],
  };

  // Cognition liveness — is Node0 actually THINKING, or just listening? This is
  // the signal that distinguishes "sovereign up" from "a model is loaded and the
  // seed engine is active". seed_engine.active comes from the already-fetched
  // /v1/health/ready body; models-in-VRAM from ollama /api/ps (distinct from
  // /api/tags, which lists models on DISK, not loaded).
  const olPs = await getJson(fetcher, `${olBase}/api/ps`, timeoutMs);
  const loaded_model_ids =
    olPs.ok && Array.isArray(olPs.json?.models)
      ? olPs.json.models.map((m) => m?.name).filter(Boolean)
      : [];
  const cognition = {
    probed: true,
    seed_engine_active:
      typeof ready.json?.seed_engine?.active === "boolean"
        ? ready.json.seed_engine.active
        : null,
    models_loaded_in_vram: olPs.ok ? loaded_model_ids.length : ol.ok ? 0 : null,
    loaded_model_ids,
  };

  // Canonical roots — existence only, no recursion (recursion would be a home scan).
  const dataLake = env.BIZRA_DATA_LAKE || "/data/bizra/repos/bizra-data-lake";
  const canonical_roots = [
    { path: demaHome, exists: exists(demaHome) },
    { path: join(demaHome, "receipts"), exists: exists(join(demaHome, "receipts")) },
    { path: dataLake, exists: exists(dataLake) },
  ];

  // Identity — key-file PRESENCE only. Never read the key's content.
  // Generation store (active-key.json) is authority; legacy flat file counts
  // for pre-migration homes.
  const keyPath = join(demaHome, "keys", "node0-ed25519.pub.pem");
  const pointerPath = join(demaHome, "keys", "active-key.json");
  const identity = {
    key_file_path: keyPath,
    key_file_present: exists(pointerPath) || exists(keyPath),
  };

  return {
    dema_repo: { git_present: exists(join(process.cwd(), ".git")), package_name: "dema", command_surface_count: null },
    sovereign,
    local_models: { lm_studio, ollama },
    cognition,
    canonical_roots,
    identity,
  };
}
