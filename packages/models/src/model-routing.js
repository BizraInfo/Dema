export function allModelCandidates(providers) {
  return [
    ...(providers.ollama.models ?? []),
    ...(providers.lm_studio.models ?? []),
    ...(providers.downloads.models ?? []),
  ];
}

export function isSupportFile(model) {
  return /(^|[/_-])mmproj|projector|adapter/i.test(model.id);
}

function pick(candidates, pattern, fallback = null) {
  return candidates.find((model) => pattern.test(model.id)) ?? fallback;
}

function recommendation(model, reason) {
  return model ? { model: model.id, source: model.source, reason } : null;
}

function smallestKnownModel(candidates) {
  return (
    candidates
      .filter(
        (model) => Number.isFinite(model.size_bytes) && model.size_bytes > 0,
      )
      .sort((a, b) => a.size_bytes - b.size_bytes)[0] ??
    candidates[0] ??
    null
  );
}

export function buildRoutingRecommendations(providers) {
  const candidates = allModelCandidates(providers);
  const nonEmbeddings = candidates.filter(
    (model) => !/embed|nomic/i.test(model.id) && !isSupportFile(model),
  );
  const reasoningModel =
    pick(candidates, /deepseek|r1/i) ?? pick(candidates, /qwen/i);

  return {
    coding: recommendation(
      pick(candidates, /coder|qwen/i),
      "coder/qwen naming signal",
    ),
    governance: recommendation(
      pick(candidates, /bizra|gemma/i),
      "BIZRA/Gemma naming signal",
    ),
    reasoning: recommendation(reasoningModel, "reasoning model naming signal"),
    fast: recommendation(
      smallestKnownModel(nonEmbeddings),
      "smallest available non-embedding model",
    ),
    embedding: recommendation(
      pick(candidates, /embed|nomic/i),
      "embedding model naming signal",
    ),
    vision: recommendation(
      pick(candidates, /vision|vl|mmproj/i),
      "vision/multimodal naming signal",
    ),
  };
}
