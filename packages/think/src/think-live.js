import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { invokeLocalLLM } from "../../core/src/llm-adapter.js";

const SCHEMA = "bizra.dema.think_live.v0.1";
const THINK_CONSENT_PHRASE = "RUN LOCAL THINK";
const SNIPPET_MAX_CHARS = 200;

export { THINK_CONSENT_PHRASE };

function queryMemory(query, top) {
  const wrapperPath =
    process.env.DEMA_AGENT_DB_QUERY_PATH ||
    join(homedir(), ".dema", "bin", "agent-db-query");

  if (!existsSync(wrapperPath)) {
    return {
      available: false,
      hits_count: 0,
      hits: [],
      reason: "wrapper_not_found",
    };
  }

  try {
    const result = spawnSync(
      "python3",
      [wrapperPath, "--query", query, "--top", String(top), "--json"],
      { encoding: "utf8", timeout: 30000 },
    );
    if (result.status !== 0) {
      return {
        available: false,
        hits_count: 0,
        hits: [],
        reason: "wrapper_exit_nonzero",
      };
    }
    const envelope = JSON.parse(result.stdout || "{}");
    const hits = Array.isArray(envelope.hits) ? envelope.hits : [];
    return { available: true, hits_count: hits.length, hits, reason: null };
  } catch {
    return {
      available: false,
      hits_count: 0,
      hits: [],
      reason: "wrapper_spawn_error",
    };
  }
}

function buildPrompt(query, memoryHits) {
  const lines = [
    "You are a local thinking assistant for DEMA Node0.",
    "Answer the operator's query using the context provided.",
    "",
  ];

  if (memoryHits.length > 0) {
    lines.push("Context from local memory:");
    for (const h of memoryHits) {
      const snippet =
        typeof h.snippet === "string"
          ? h.snippet.slice(0, SNIPPET_MAX_CHARS)
          : "";
      if (snippet) lines.push(`- [${h.id ?? "?"}] ${snippet}`);
    }
    lines.push("");
  }

  lines.push(`Query: ${query}`);
  return lines.join("\n");
}

function buildHitSummaries(memoryHits) {
  return memoryHits.map((h) => ({
    id: h.id ?? null,
    score: h.score ?? null,
    snippet_hash: typeof h.snippet === "string" ? sha256(h.snippet) : null,
    length_class:
      typeof h.snippet === "string"
        ? h.snippet.length < 50
          ? "short"
          : h.snippet.length < 200
            ? "medium"
            : "long"
        : null,
  }));
}

export async function buildThinkLive(
  query,
  {
    thinkConsent = "",
    modelConsent = "",
    model = "",
    now = new Date(),
    top = 3,
  } = {},
) {
  if (!query || typeof query !== "string" || !query.trim()) {
    return {
      error:
        'Usage: dema think "<query>" --consent "RUN LOCAL THINK" --model-consent "<phrase>" [--json]',
    };
  }

  const trimmedQuery = query.trim();

  if (thinkConsent !== THINK_CONSENT_PHRASE) {
    return {
      error: `Think consent mismatch. Required: "${THINK_CONSENT_PHRASE}"`,
      consent_rejected: true,
    };
  }

  if (!modelConsent) {
    return {
      error:
        "Missing --model-consent. Run --dry-run first to see the required phrase.",
      consent_rejected: true,
    };
  }

  const memoryRaw = queryMemory(trimmedQuery, top);
  const prompt = buildPrompt(trimmedQuery, memoryRaw.hits);
  const hitSummaries = buildHitSummaries(memoryRaw.hits);

  const memoryResult = {
    available: memoryRaw.available,
    hits_count: memoryRaw.hits_count,
    hit_summaries: hitSummaries,
    reason: memoryRaw.reason,
  };

  const selectedModel = model || "gemma4";

  let invocationResult;
  try {
    invocationResult = await invokeLocalLLM({
      model: selectedModel,
      prompt,
      consentPhrase: modelConsent,
    });
  } catch (err) {
    invocationResult = {
      invocation_status: "adapter_error",
      error_reason: err.message,
      model_invoked: selectedModel,
    };
  }

  const modelResponded =
    invocationResult.invocation_status === "completed" ||
    invocationResult.invocation_status === "invocation_completed";
  const modelOutput = invocationResult.response_text_preview ?? null;

  const payload = {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mode: "LIVE_INVOCATION",
    query: trimmedQuery,
    context_manifest: {
      memory: memoryResult,
      model: selectedModel,
      prompt_length_chars: prompt.length,
    },
    invocation: {
      status: invocationResult.invocation_status ?? "unknown",
      model_responded: modelResponded,
      output_length_chars: modelOutput ? modelOutput.length : 0,
      consent_phrase_verified:
        invocationResult.consent_phrase_verified ?? false,
      error_reason: invocationResult.error_reason ?? null,
    },
    output: modelOutput,
    boundary: {
      filesystem_write_performed: false,
      network_used: true,
      runtime_execution_performed: true,
      model_loaded: modelResponded,
      model_invocation_performed: true,
      prompt_executed: modelResponded,
      external_call_performed: true,
      raw_corpus_scan_performed: false,
      raw_data_included: false,
      tool_executed: false,
      chain_advance_performed: false,
      receipt_mint_performed: false,
      federation_invoked: false,
      node_connection_performed: false,
      public_network_used: false,
      consent_collected: true,
    },
    boundary_evidence: {
      model_invocation: modelResponded ? "OBSERVED" : "ATTEMPTED_FAILED",
      network_used: "OBSERVED",
      external_call: "OBSERVED",
      external_call_scope: "localhost_only",
      public_network: "STATIC_CHECKED",
      filesystem_write: "OBSERVED_FALSE",
      receipt_minted: "OBSERVED_FALSE",
      federation: "DECLARED_NOT_OBSERVABLE_V0_2",
      memory_query: memoryRaw.available
        ? "WRAPPER_SPAWNED_LOCAL"
        : memoryRaw.reason || "WRAPPER_MISSING",
    },
  };

  payload.proof_hash = sha256(stableStringify(payload));

  return payload;
}

export function formatThinkLive(envelope) {
  if (envelope.error) return envelope.error;

  const inv = envelope.invocation;
  const cm = envelope.context_manifest;
  const be = envelope.boundary_evidence;

  const lines = [
    "Dema Think Live v0.2A",
    "=".repeat(42),
    `  Query:    ${envelope.query}`,
    `  Mode:     ${envelope.mode}`,
    `  Model:    ${cm.model}`,
    "",
  ];

  if (inv.model_responded && envelope.output) {
    lines.push("  Response:");
    for (const line of envelope.output.split("\n")) {
      lines.push(`    ${line}`);
    }
    lines.push("");
  } else {
    lines.push(`  Invocation: ${inv.status}`);
    if (inv.error_reason) lines.push(`  Error: ${inv.error_reason}`);
    lines.push("");
  }

  lines.push("  Memory Context:");
  lines.push(`    Available:    ${cm.memory.available ? "yes" : "no"}`);
  lines.push(`    Hits:         ${cm.memory.hits_count}`);

  lines.push("");
  lines.push("  Boundary Evidence:");
  lines.push(`    model_invocation: ${be.model_invocation}`);
  lines.push(`    network_used:     ${be.network_used}`);
  lines.push(
    `    external_call:    ${be.external_call} (${be.external_call_scope})`,
  );
  lines.push(`    public_network:   ${be.public_network}`);
  lines.push(`    filesystem_write: ${be.filesystem_write}`);
  lines.push(`    receipt_minted:   ${be.receipt_minted}`);

  lines.push("");
  lines.push(`  Proof Hash:         ${envelope.proof_hash.slice(0, 16)}...`);
  lines.push("=".repeat(42));

  return lines.join("\n");
}
