import { buildLocalLLMRouterPreview } from "../../../../packages/core/src/local-llm-router-preview.js";

export async function cmd_llm_router(ctx) {
  console.log(JSON.stringify(buildLocalLLMRouterPreview(), null, 2));
  process.exit(process.exitCode ?? 0);
}
