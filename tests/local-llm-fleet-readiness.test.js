import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLocalLlmFleetReadiness,
  LOCAL_LLM_FLEET_READINESS_SCHEMA,
  LOCAL_LLM_FLEET_READINESS_TRUTH_LABEL,
} from "../packages/core/src/local-llm-fleet-readiness.js";

function frozenProbes(overrides = {}) {
  return {
    ollama: {
      provider: "ollama",
      endpoint: "http://127.0.0.1:11434",
      reachable: false,
      error: "ECONNREFUSED",
      installed_model_ids: [],
      loaded_model_ids: [],
      load_observability: "ollama_ps",
      ...overrides.ollama,
    },
    lmstudio: {
      provider: "lmstudio",
      endpoint: "http://127.0.0.1:1234/v1",
      reachable: false,
      error: "ECONNREFUSED",
      installed_model_ids: [],
      loaded_model_ids: [],
      load_observability: "catalog_only",
      ...overrides.lmstudio,
    },
    llamacpp: {
      provider: "llamacpp",
      endpoint: "http://127.0.0.1:8080/v1",
      reachable: false,
      error: "ECONNREFUSED",
      installed_model_ids: [],
      loaded_model_ids: [],
      load_observability: "server_singleton",
      ...overrides.llamacpp,
    },
    disk_gguf_candidates: overrides.disk_gguf_candidates ?? [],
  };
}

test("schema + truth label + deterministic shape", () => {
  const r = buildLocalLlmFleetReadiness({
    provider_probes: frozenProbes(),
    generated_at_iso: "2026-06-24T12:00:00.000Z",
  });
  assert.equal(r.schema, LOCAL_LLM_FLEET_READINESS_SCHEMA);
  assert.equal(r.truth_label, LOCAL_LLM_FLEET_READINESS_TRUTH_LABEL);
  assert.equal(r.generated_at_iso, "2026-06-24T12:00:00.000Z");
  assert.equal(r.providers.length, 3);
  assert.ok(r.preferred_canon_qa.route);
  assert.ok(r.preferred_fast_reply.route);
  assert.deepEqual(buildLocalLlmFleetReadiness({
    provider_probes: frozenProbes(),
    generated_at_iso: "2026-06-24T12:00:00.000Z",
  }), r);
});

test("provider down returns blocked, not crash", () => {
  const r = buildLocalLlmFleetReadiness({ provider_probes: frozenProbes() });
  for (const p of r.providers) {
    assert.equal(p.reachable, false);
  }
  assert.equal(r.preferred_canon_qa.route.live_talk_status, "blocked");
  assert.equal(r.preferred_canon_qa.route.blocking_reason, "provider_unreachable");
});

test("provider up with loaded ollama model returns ready", () => {
  const r = buildLocalLlmFleetReadiness({
    provider_probes: frozenProbes({
      ollama: {
        reachable: true,
        error: null,
        installed_model_ids: ["whiterabbitneo-v3:7b-q4_K_M", "qwen2.5:7b"],
        loaded_model_ids: ["whiterabbitneo-v3:7b-q4_K_M"],
      },
    }),
    env: { DEMA_TALK_PROVIDER: "ollama", DEMA_TALK_MODEL: "whiterabbitneo-v3:7b-q4_K_M" },
  });
  assert.equal(r.preferred_canon_qa.route.provider, "ollama");
  assert.equal(r.preferred_canon_qa.route.live_talk_status, "ready");
  assert.equal(r.preferred_canon_qa.route.blocking_reason, null);
  assert.equal(
    r.preferred_canon_qa.route.consent_phrase,
    "GO: invoke local LLM via ollama at whiterabbitneo-v3:7b-q4_K_M",
  );
});

test("installed but not loaded ollama model returns blocked model_not_loaded", () => {
  const r = buildLocalLlmFleetReadiness({
    provider_probes: frozenProbes({
      ollama: {
        reachable: true,
        error: null,
        installed_model_ids: ["qwen2.5:7b"],
        loaded_model_ids: [],
      },
    }),
    env: { DEMA_TALK_PROVIDER: "ollama", DEMA_TALK_MODEL: "qwen2.5:7b" },
  });
  assert.equal(r.preferred_canon_qa.route.live_talk_status, "blocked");
  assert.equal(r.preferred_canon_qa.route.blocking_reason, "model_not_loaded");
});

test("lmstudio catalog match but not loaded returns blocked with honest reason", () => {
  const r = buildLocalLlmFleetReadiness({
    provider_probes: frozenProbes({
      lmstudio: {
        reachable: true,
        error: null,
        installed_model_ids: ["qwen/qwen3.5-9b"],
        loaded_model_ids: [],
      },
    }),
  });
  assert.equal(r.preferred_canon_qa.route.provider, "lmstudio");
  assert.equal(r.preferred_canon_qa.route.model, "qwen/qwen3.5-9b");
  assert.equal(r.preferred_canon_qa.route.live_talk_status, "blocked");
  assert.equal(
    r.preferred_canon_qa.route.blocking_reason,
    "model_not_loaded_in_lm_studio",
  );
  assert.match(
    r.preferred_canon_qa.route.operator_note ?? "",
    /Load the model in LM Studio/i,
  );
});

test("consent phrase is exact provider/model bound", () => {
  const r = buildLocalLlmFleetReadiness({
    provider_probes: frozenProbes({
      lmstudio: {
        reachable: true,
        error: null,
        installed_model_ids: ["qwen/qwen3.5-9b"],
      },
    }),
  });
  assert.equal(
    r.preferred_canon_qa.route.consent_phrase,
    "GO: invoke local LLM via lmstudio at qwen/qwen3.5-9b",
  );
});

test("non-allowlisted model blocks with model_not_allowlisted", () => {
  const r = buildLocalLlmFleetReadiness({
    provider_probes: frozenProbes({
      ollama: {
        reachable: true,
        error: null,
        installed_model_ids: ["gpt-4:fake"],
        loaded_model_ids: ["gpt-4:fake"],
      },
    }),
    env: { DEMA_TALK_PROVIDER: "ollama", DEMA_TALK_MODEL: "gpt-4:fake" },
  });
  assert.equal(r.preferred_canon_qa.route.live_talk_status, "blocked");
  assert.equal(r.preferred_canon_qa.route.blocking_reason, "model_not_allowlisted");
});

test("boundary asserts no model invocation", () => {
  const r = buildLocalLlmFleetReadiness({ provider_probes: frozenProbes() });
  assert.equal(r.boundary.model_invocation_performed, false);
  assert.equal(r.boundary.model_loaded, false);
  assert.equal(r.boundary.prompt_executed, false);
  assert.equal(r.boundary.network_used, false);
  assert.equal(r.boundary.filesystem_write_performed, false);
});

test("canon_qa prefers first ready route over blocked lmstudio default", () => {
  const r = buildLocalLlmFleetReadiness({
    provider_probes: frozenProbes({
      lmstudio: {
        reachable: true,
        error: null,
        installed_model_ids: ["qwen/qwen3.5-9b"],
      },
      ollama: {
        reachable: true,
        error: null,
        installed_model_ids: ["whiterabbitneo-v3:7b-q4_K_M"],
        loaded_model_ids: ["whiterabbitneo-v3:7b-q4_K_M"],
      },
    }),
  });
  assert.equal(r.preferred_canon_qa.route.provider, "ollama");
  assert.equal(r.preferred_canon_qa.route.live_talk_status, "ready");
});

test("llamacpp reachable with served model can be ready", () => {
  const r = buildLocalLlmFleetReadiness({
    provider_probes: frozenProbes({
      llamacpp: {
        reachable: true,
        error: null,
        installed_model_ids: ["qwen2.5"],
        loaded_model_ids: ["qwen2.5"],
      },
    }),
    env: {
      DEMA_TALK_PROVIDER: "llamacpp",
      DEMA_TALK_MODEL: "qwen2.5",
    },
  });
  assert.equal(r.preferred_canon_qa.route.live_talk_status, "ready");
  assert.equal(
    r.preferred_canon_qa.route.consent_phrase,
    "GO: invoke local LLM via llamacpp at qwen2.5",
  );
});
