import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { llmAdapterConsentPhraseFor } from "../../core/src/llm-adapter.js";

const SCHEMA = "bizra.dema.think_dry_run.v0.1";

function queryMemory(query, top) {
  const wrapperPath =
    process.env.DEMA_AGENT_DB_QUERY_PATH ||
    join(homedir(), ".dema", "bin", "agent-db-query");

  if (!existsSync(wrapperPath)) {
    return {
      available: false,
      hits_count: 0,
      hit_summaries: [],
      wrapper_path: wrapperPath,
      reason: "wrapper_not_found",
    };
  }

  try {
    const t0 = Date.now();
    const result = spawnSync(
      "python3",
      [wrapperPath, "--query", query, "--top", String(top), "--json"],
      { encoding: "utf8", timeout: 30000 },
    );
    const durationMs = Date.now() - t0;

    if (result.status !== 0) {
      return {
        available: false,
        hits_count: 0,
        hit_summaries: [],
        wrapper_path: wrapperPath,
        wrapper_exit_code: result.status,
        duration_ms: durationMs,
        reason: "wrapper_exit_nonzero",
      };
    }

    const envelope = JSON.parse(result.stdout || "{}");
    const hits = Array.isArray(envelope.hits) ? envelope.hits : [];
    return {
      available: true,
      hits_count: hits.length,
      hit_summaries: hits.map((h) => ({
        id: h.id ?? null,
        score: h.score ?? null,
      })),
      wrapper_path: wrapperPath,
      wrapper_exit_code: 0,
      duration_ms: durationMs,
      reason: null,
    };
  } catch {
    return {
      available: false,
      hits_count: 0,
      hit_summaries: [],
      wrapper_path: wrapperPath,
      reason: "wrapper_spawn_error",
    };
  }
}

async function checkModelReadiness() {
  const ollamaHome = join(homedir(), ".ollama", "models");
  const ollamaInstalled = existsSync(ollamaHome);

  let apiModels = [];
  let apiReachable = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      apiModels = Array.isArray(data.models) ? data.models : [];
      apiReachable = true;
    }
  } catch {
    apiReachable = false;
  }

  const textModels = apiModels
    .filter((m) => !m.name.includes("embed"))
    .sort((a, b) => (a.size ?? Infinity) - (b.size ?? Infinity));
  const recommended = textModels.length > 0 ? textModels[0].name : null;

  return {
    ollama_installed: ollamaInstalled || apiReachable,
    ollama_models_dir: ollamaInstalled ? ollamaHome : null,
    broker_reachable: apiReachable ? "LOCALHOST_API_OBSERVED" : "NOT_REACHABLE",
    available_models: textModels.map((m) => m.name),
    recommended_model: recommended,
    consent_phrase_pattern: "GO: invoke local LLM at <model>",
    model_readiness_evidence: apiReachable
      ? "LOCALHOST_API_OBSERVED"
      : ollamaInstalled
        ? "DISK_CHECK_ONLY"
        : "NOT_DETECTED",
  };
}

export async function buildThinkDryRun(
  query,
  { now = new Date(), top = 3 } = {},
) {
  if (!query || typeof query !== "string" || !query.trim()) {
    return { error: 'Usage: dema think "<query>" --dry-run [--json]' };
  }

  const trimmedQuery = query.trim();
  const memoryRaw = queryMemory(trimmedQuery, top);
  const modelReadiness = await checkModelReadiness();

  const contextLength = trimmedQuery.length;

  const memoryResult = {
    available: memoryRaw.available,
    hits_count: memoryRaw.hits_count,
    hit_summaries: memoryRaw.hit_summaries,
    wrapper_path: memoryRaw.wrapper_path,
    reason: memoryRaw.reason ?? null,
  };

  const payload = {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mode: "DRY_RUN",
    query: trimmedQuery,
    context_manifest: {
      memory: memoryResult,
      model_readiness: modelReadiness,
      resource_estimate: {
        truth_label: "LOCAL_STATIC_ESTIMATE",
        estimated_wall_time_class: "low",
        static_wall_time_budget_ms: 10000,
        context_length_chars: contextLength,
        memory_hits_included: memoryResult.hits_count,
      },
    },
    would_invoke: {
      model: modelReadiness.recommended_model,
      prompt_length_chars: contextLength,
      consent_required: true,
      think_consent_phrase: "RUN LOCAL THINK",
      required_model_consent_phrase: modelReadiness.recommended_model
        ? llmAdapterConsentPhraseFor(modelReadiness.recommended_model)
        : modelReadiness.consent_phrase_pattern,
      model_invocation_performed: false,
    },
    boundary: {
      filesystem_write_performed: false,
      network_used: false,
      runtime_execution_performed: memoryResult.available,
      model_loaded: false,
      model_invocation_performed: false,
      prompt_executed: false,
      external_call_performed: false,
      raw_corpus_scan_performed: false,
      raw_data_included: false,
      tool_executed: false,
      chain_advance_performed: false,
      receipt_mint_performed: false,
      federation_invoked: false,
      node_connection_performed: false,
      public_network_used: false,
      consent_collected: false,
    },
    boundary_evidence: {
      model_invocation: "NOT_PERFORMED_DRY_RUN",
      network_used:
        modelReadiness.broker_reachable === "LOCALHOST_API_OBSERVED"
          ? "LOCALHOST_API_OBSERVED"
          : "STATIC_CHECKED",
      receipt_minted: "NOT_PERFORMED_DRY_RUN",
      filesystem_write: "NOT_PERFORMED_DRY_RUN",
      memory_query: memoryResult.available
        ? "WRAPPER_SPAWNED_LOCAL"
        : memoryResult.reason || "WRAPPER_MISSING",
      model_readiness: modelReadiness.model_readiness_evidence,
      public_network: "NOT_PERFORMED_DRY_RUN",
    },
  };

  payload.proof_hash = sha256(stableStringify(payload));

  return payload;
}

export function formatThinkDryRun(envelope) {
  if (envelope.error) return envelope.error;

  const cm = envelope.context_manifest;
  const mem = cm.memory;
  const mr = cm.model_readiness;
  const re = cm.resource_estimate;
  const wi = envelope.would_invoke;
  const be = envelope.boundary_evidence;

  const lines = [
    "Dema Think Dry-Run v0.1",
    "=".repeat(42),
    `  Query:    ${envelope.query}`,
    `  Mode:     ${envelope.mode}`,
    "",
    "  Memory Context:",
    `    Available:    ${mem.available ? "yes" : "no"}`,
    `    Hits:         ${mem.hits_count}`,
  ];

  if (mem.hit_summaries.length > 0) {
    for (const h of mem.hit_summaries) {
      lines.push(`      - ${h.id ?? "?"} (score: ${h.score ?? "?"})`);
    }
  }

  if (!mem.available) {
    lines.push(`    Reason:       ${mem.reason}`);
  }

  lines.push("");
  lines.push("  Model Readiness:");
  lines.push(`    Ollama installed: ${mr.ollama_installed ? "yes" : "no"}`);
  lines.push(`    Broker probed:    ${mr.broker_reachable}`);
  lines.push(
    `    Recommended:      ${mr.recommended_model ?? "none (dry-run)"}`,
  );

  lines.push("");
  lines.push("  Would Invoke:");
  lines.push(`    Model:            ${wi.model ?? "none selected"}`);
  lines.push(`    Prompt length:    ${wi.prompt_length_chars} chars`);
  lines.push(`    Consent required: yes`);
  lines.push(`    Consent phrase:   ${wi.consent_phrase}`);
  lines.push(`    Invoked:          no (dry-run)`);

  lines.push("");
  lines.push("  Resources (estimated):");
  lines.push(
    `    Wall time:        ${re.estimated_wall_time_class} (budget: ${re.static_wall_time_budget_ms}ms)`,
  );
  lines.push(`    Context:          ${re.context_length_chars} chars`);
  lines.push(`    Memory hits:      ${re.memory_hits_included}`);

  lines.push("");
  lines.push("  Boundary Evidence:");
  lines.push(`    model_invocation: ${be.model_invocation}`);
  lines.push(`    network_used:     ${be.network_used}`);
  lines.push(`    memory_query:     ${be.memory_query}`);
  lines.push(`    model_readiness:  ${be.model_readiness}`);
  lines.push(`    receipt_minted:   ${be.receipt_minted}`);

  lines.push("");
  lines.push(`  Proof Hash:         ${envelope.proof_hash.slice(0, 16)}...`);
  lines.push("=".repeat(42));

  return lines.join("\n");
}
