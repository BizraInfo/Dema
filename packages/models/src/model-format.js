function modelLine(model) {
  const size = model.size && model.size !== "unknown" ? ` (${model.size})` : "";
  return `  - ${model.id}${size}`;
}

function appendModels(lines, models, limit = 8) {
  for (const model of models.slice(0, limit)) lines.push(modelLine(model));
  if (models.length > limit) lines.push(`  - ... +${models.length - limit} more`);
}

function isAbsolutePathLike(value) {
  return /^(?:[A-Za-z]:\\|\\\\|\/)/.test(String(value ?? ""));
}

function pathForDisplay(path, { includeAbsolutePaths = false } = {}) {
  if (!path) return "unknown";
  if (includeAbsolutePaths || !isAbsolutePathLike(path)) return path;
  return "[local-downloads-root-redacted]";
}

function appendOllama(lines, ollama) {
  lines.push(`Ollama: ${ollama.reachable ? "reachable" : "unreachable"} (${ollama.model_count} models, ${ollama.active_count} active)`);
  if (ollama.error) lines.push(`  error: ${ollama.error}`);
  if (ollama.active.length > 0) {
    lines.push("  active:");
    appendModels(lines, ollama.active, 4);
  }
  if (ollama.models.length > 0) {
    lines.push("  available:");
    appendModels(lines, ollama.models);
  }
}

function appendLmStudio(lines, lmStudio) {
  lines.push("");
  lines.push(`LM Studio: ${lmStudio.reachable ? "reachable" : "unreachable"} (${lmStudio.model_count} models)`);
  if (lmStudio.error) lines.push(`  error: ${lmStudio.error}`);
  appendModels(lines, lmStudio.models);
}

function appendDownloads(lines, downloads, options = {}) {
  lines.push("");
  lines.push(`Downloads: ${pathForDisplay(downloads.root, options)} (${downloads.model_count} model files)`);
  if (downloads.error) lines.push(`  error: ${downloads.error}`);
  appendModels(lines, downloads.models);
}

function appendRouting(lines, recommendations) {
  lines.push("");
  lines.push("Routing hints:");
  for (const [useCase, rec] of Object.entries(recommendations)) {
    const label = rec ? `${rec.model} [${rec.source}] - ${rec.reason}` : "none detected";
    lines.push(`  ${useCase}: ${label}`);
  }
}

function appendSafety(lines, safety) {
  lines.push("");
  lines.push("Safety:");
  if (safety.exposures.length === 0) {
    lines.push(`  exposure check: ${safety.exposure_check}; no LAN-exposed model server detected by Dema`);
  } else {
    for (const exposure of safety.exposures) {
      lines.push(`  LAN-exposed: ${exposure.provider} on ${exposure.address}:${exposure.port} - bind to 127.0.0.1 unless intentional`);
    }
  }
  for (const flag of safety.model_name_flags) {
    lines.push(`  policy-review: ${flag.model} [${flag.source}] - ${flag.message}`);
  }
}

export function formatModelInventory(inventory, { includeAbsolutePaths = false } = {}) {
  const lines = [
    "DEMA Local Model Inventory",
    "",
    `Total models: ${inventory.total_models}`,
    ""
  ];

  appendOllama(lines, inventory.providers.ollama);
  appendLmStudio(lines, inventory.providers.lm_studio);
  appendDownloads(lines, inventory.providers.downloads, { includeAbsolutePaths });
  appendRouting(lines, inventory.routing_recommendations);
  appendSafety(lines, inventory.safety);

  lines.push("");
  lines.push(
    "Boundary: read-only; local probes only; no model invoked; no files mutated; no receipt minted."
  );
  return lines.join("\n");
}
