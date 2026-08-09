// MODEL-EVAL-BASELINE-1A — read-only eval gatherer (apps/cli, outside the
// kernel-purity scan). Discovers the LOCAL model pool and runs the frozen
// bizra-local-small suite against each reachable model, capturing only derived
// signals + a bounded, secret-elided sample. Injected fetchImpl/fsImpl/time so
// CI does zero real network/disk. Default: NO external providers.
//
// Honest provenance: this gatherer DOES invoke local inference (POST). That is
// recorded here, not in the kernel boundary — the kernel itself does no I/O.

import { BIZRA_LOCAL_SMALL_SUITE } from "../../../../packages/core/src/model-eval-baseline.js";

export function isLocalUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
    return host === "127.0.0.1" || host === "::1" || host === "localhost";
  } catch {
    return false;
  }
}

const MAX_SAMPLE = 400;
// Strip anything resembling a path or key material before keeping a sample.
function elide(s) {
  if (typeof s !== "string") return "";
  return s
    .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, "[elided-key]")
    .replace(/(?:\/home\/|\/Users\/|[A-Za-z]:\\)[^\s"']*/g, "[elided-path]")
    .slice(0, MAX_SAMPLE);
}

async function postJson(fetcher, url, payload, timeoutMs) {
  if (!isLocalUrl(url)) return { reachable: false, http_status: null, json: null, error_class: "non_local_url_refused" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetcher(url, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const isRedirect = typeof res.status === "number" && res.status >= 300 && res.status < 400;
    let json = null;
    if (!isRedirect) {
      try { json = await res.json(); } catch { json = null; }
    }
    const ok = res.ok === true && !isRedirect;
    return { reachable: ok, http_status: res.status ?? null, json, error_class: ok ? null : isRedirect ? "redirect_refused" : `http_${res.status ?? "error"}` };
  } catch {
    return { reachable: false, http_status: null, json: null, error_class: "provider_unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(fetcher, url, timeoutMs) {
  if (!isLocalUrl(url)) return { ok: false, json: null };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetcher(url, { method: "GET", redirect: "manual", signal: ctrl.signal });
    if (!res.ok) return { ok: false, json: null };
    let json = null;
    try { json = await res.json(); } catch { json = null; }
    return { ok: true, json };
  } catch {
    return { ok: false, json: null };
  } finally {
    clearTimeout(timer);
  }
}

// MODEL-ARTIFACT-IDENTITY-INGRESS-1A — a provider list entry is an ALIAS, not an
// artifact. `ids()` therefore yields { id, identity }: identity is the strongest
// artifact fingerprint the list endpoint itself supplies (Ollama's manifest
// digest), or null when the provider offers none. Never a second request — the
// identity must come from the same read that produced the alias.
function descriptors(entries, idKey) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((m) => ({ id: m?.[idKey], identity: typeof m?.digest === "string" && m.digest ? m.digest : null }))
    .filter((m) => Boolean(m.id));
}

// Provider adapters: { listUrl, ids(json), genUrl(base), genBody(model, prompt), genOut(json) }
function providers(env) {
  return {
    ollama: {
      base: env.OLLAMA_URL || "http://127.0.0.1:11434",
      list: (b) => `${b}/api/tags`,
      ids: (j) => descriptors(j?.models, "name"),
      gen: (b) => `${b}/api/generate`,
      body: (model, prompt) => ({ model, prompt, stream: false, options: { num_predict: 64 } }),
      warm: (model) => ({ model, prompt: "ready", stream: false, options: { num_predict: 1 } }),
      out: (j) => (typeof j?.response === "string" ? j.response : ""),
    },
    lm_studio: {
      base: env.LMSTUDIO_URL || "http://127.0.0.1:1234",
      list: (b) => `${b}/v1/models`,
      ids: (j) => descriptors(j?.data, "id"),
      gen: (b) => `${b}/v1/chat/completions`,
      body: (model, prompt) => ({ model, messages: [{ role: "user", content: prompt }], max_tokens: 64 }),
      warm: (model) => ({ model, messages: [{ role: "user", content: "ready" }], max_tokens: 1 }),
      out: (j) => j?.choices?.[0]?.message?.content ?? j?.choices?.[0]?.message?.reasoning_content ?? "",
    },
    llamacpp: {
      base: env.LLAMACPP_URL || "http://127.0.0.1:8080",
      list: (b) => `${b}/v1/models`,
      ids: (j) => descriptors(j?.data, "id"),
      gen: (b) => `${b}/v1/chat/completions`,
      body: (model, prompt) => ({ model, messages: [{ role: "user", content: prompt }], max_tokens: 64 }),
      warm: (model) => ({ model, messages: [{ role: "user", content: "ready" }], max_tokens: 1 }),
      out: (j) => j?.choices?.[0]?.message?.content || j?.choices?.[0]?.message?.reasoning_content || "",
    },
  };
}

// Read-only discovery of the LOCAL model pool (no suite run, no inference).
export async function discoverLocalModels({ fetchImpl, env = process.env, includeExternalProviders = false, timeoutMs = 4000 } = {}) {
  const fetcher = fetchImpl || globalThis.fetch;
  const provs = providers(env);
  const provider_discovery = {};
  const models = []; // { key, provider, model, identity, identity_status }
  for (const [name, p] of Object.entries(provs)) {
    if (!isLocalUrl(p.base) && !includeExternalProviders) {
      provider_discovery[name] = { reachable: false, model_count: 0 };
      continue;
    }
    const r = await getJson(fetcher, p.list(p.base), timeoutMs);
    const ids = r.ok ? p.ids(r.json) : [];
    provider_discovery[name] = { reachable: r.ok, model_count: ids.length };
    for (const { id, identity } of ids) {
      models.push({
        key: `${name}:${id}`,
        provider: name,
        model: id,
        identity,
        identity_status: identity ? "PROVIDER_DIGEST" : "UNVERIFIED_PROVIDER_IDENTITY",
      });
    }
  }
  return { provider_discovery, models };
}

// Collapse alias tags onto the artifact they actually name, BEFORE any bound is
// applied. Grouping key is (provider, identity): a digest namespace belongs to
// the provider that issued it, so an identical string under two providers is two
// artifacts. An absent identity NEVER merges — absence of evidence is not
// evidence of sameness, so each unverified alias stays its own artifact.
// The first alias in discovery order is canonical, so the choice is deterministic.
// NUL delimiter: the one byte that cannot occur in a provider name or a digest,
// so `a` + `bc` can never collide with `ab` + `c`. Written as an escape rather
// than a literal NUL so the file stays TEXT to git: a raw NUL makes the whole
// source binary and the diff unreviewable.
const SEP = "\u0000";

export function dedupeByArtifact(models) {
  const byArtifact = new Map();
  for (const m of models) {
    const groupKey = m.identity ? `${m.provider}${SEP}${m.identity}` : `${SEP}unverified${SEP}${m.key}`;
    const seen = byArtifact.get(groupKey);
    if (seen) seen.aliases.push(m.key);
    else byArtifact.set(groupKey, { canonical: m, aliases: [m.key] });
  }
  const groups = [...byArtifact.values()];
  return {
    unique: groups.map((g) => g.canonical),
    artifact_identity: {
      alias_count: models.length,
      unique_artifact_count: groups.length,
      aliases_by_model: Object.fromEntries(groups.map((g) => [g.canonical.key, [...g.aliases].sort()])),
      identity_status_by_model: Object.fromEntries(groups.map((g) => [g.canonical.key, g.canonical.identity_status])),
    },
  };
}

// A chat-suite model only — embedding endpoints cannot answer a chat prompt, so
// scoring them against bizra-local-small would just record false unreachables.
function isChatCandidate(id) {
  return typeof id === "string" && !/embed/i.test(id);
}

// Round-robin across providers so a fleet-heavy provider (e.g. many Ollama tags)
// cannot starve another (e.g. LM Studio) out of the bounded slice.
function interleaveByProvider(models) {
  const queues = new Map();
  for (const m of models) {
    if (!queues.has(m.provider)) queues.set(m.provider, []);
    queues.get(m.provider).push(m);
  }
  const lanes = [...queues.values()];
  const out = [];
  let drained = false;
  while (!drained) {
    drained = true;
    for (const lane of lanes) {
      const next = lane.shift();
      if (next) { out.push(next); drained = false; }
    }
  }
  return out;
}

export async function gatherModelEvalBaseline({
  fetchImpl,
  env = process.env,
  time = () => new Date(),
  suiteId = "bizra-local-small",
  includeExternalProviders = false, // DEFAULT FALSE — local only
  timeoutMs = 60000, // cold-load-aware: a big model offloaded to CPU can be slow per token
  warmupTimeoutMs = 180000, // generous one-shot load: a 26B model into a 16GB GPU takes time
  maxModels = 6, // bounded by default — each reachable model runs the full suite via real inference
} = {}) {
  const fetcher = fetchImpl || globalThis.fetch;
  const provs = providers(env);
  const { provider_discovery, models } = await discoverLocalModels({ fetchImpl, env, includeExternalProviders, timeoutMs });
  // Identity BEFORE the bound: aliases must not consume maxModels slots, and one
  // artifact must not race itself on latency.
  const { unique, artifact_identity } = dedupeByArtifact(models.filter((m) => isChatCandidate(m.model)));
  const chosen = interleaveByProvider(unique).slice(0, maxModels);
  const results_by_model = {};
  for (const { key, provider, model } of chosen) {
    const p = provs[provider];
    const tasks = {};
    // Warm-up pass FIRST, with a generous timeout, so the cold-load cost is paid
    // before the suite is timed. A model that never loads is recorded unreachable
    // across the suite without spending the full 6-task budget on it.
    const warm = await postJson(fetcher, p.gen(p.base), p.warm(model), warmupTimeoutMs);
    if (!warm.reachable) {
      for (const task of BIZRA_LOCAL_SMALL_SUITE) {
        tasks[task.id] = { reachable: false, latency_ms: null, output: "", usage: null };
      }
      results_by_model[key] = { tasks };
      continue;
    }
    for (const task of BIZRA_LOCAL_SMALL_SUITE) {
      const t0 = time().getTime();
      const probe = await postJson(fetcher, p.gen(p.base), p.body(model, task.prompt), timeoutMs);
      const t1 = time().getTime();
      tasks[task.id] = {
        reachable: probe.reachable,
        latency_ms: probe.reachable ? Math.max(0, t1 - t0) : null,
        output: probe.reachable ? elide(p.out(probe.json)) : "",
        usage: probe.json?.usage && typeof probe.json.usage === "object" ? { ...probe.json.usage } : null,
      };
    }
    results_by_model[key] = { tasks };
  }

  return {
    generated_at_iso: time().toISOString(),
    suite_id: suiteId,
    provider_discovery,
    artifact_identity,
    models_tested: chosen.map((c) => c.key),
    results_by_model,
  };
}
