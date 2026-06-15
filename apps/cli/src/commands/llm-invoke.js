import {
  buildLLMInvocationPreview,
  buildLLMInvocationSummary,
  invokeLocalLLM,
} from "../../../../packages/core/src/llm-adapter.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_llm_invoke(ctx) {
  const { argv } = ctx;
  // C1 spine surface (per ADR-008 §C1) · two modes:
  //   no --invoke    → preview-only · canonical boundary all false
  //   --invoke       → actual Ollama call · requires --consent exact phrase
  const model = argValue(argv, "--model") ?? "";
  const prompt = argValue(argv, "--prompt") ?? "";
  const consent = argValue(argv, "--consent") ?? "";
  const ollamaBaseUrl = argValue(argv, "--base") ?? undefined;
  const wantsSummary = argv.includes("--summary");
  const wantsInvoke = argv.includes("--invoke");

  if (!wantsInvoke) {
    const preview = wantsSummary
      ? buildLLMInvocationSummary({ model, prompt, ollamaBaseUrl })
      : buildLLMInvocationPreview({ model, prompt, ollamaBaseUrl });
    console.log(JSON.stringify(preview, null, 2));
    process.exit(process.exitCode ?? 0);
  }

  const result = await invokeLocalLLM({
    model,
    prompt,
    consentPhrase: consent,
    ollamaBaseUrl,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.invocation_status === "failed") {
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}
