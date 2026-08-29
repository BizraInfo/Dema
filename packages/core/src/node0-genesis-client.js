// Thin Dema → governed Node0 client. No mission, SAT, FATE, effect, receipt,
// or recovery logic lives here; those remain runtime-owned.

export const NODE0_GENESIS_CLIENT_SCHEMA = "bizra.dema.node0_genesis_client.v0.1";

function boundary(localhostNetworkUsed = false) {
  return Object.freeze({
    localhost_network_used: localhostNetworkUsed,
    public_network: false,
    runtime_started: false,
    model_invoked: false,
    authority_delta: 0,
  });
}
function refused(code, extra = {}) {
  return Object.freeze({
    schema: NODE0_GENESIS_CLIENT_SCHEMA,
    ok: false,
    refusal: code,
    status: null,
    body: null,
    boundary: boundary(false),
    ...extra,
  });
}

function loopbackEndpoint(baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    const host = parsed.hostname;
    if (
      parsed.protocol !== "http:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      !["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)
    ) {
      return null;
    }
    return new URL("/genesis/execute", parsed.origin).toString();
  } catch {
    return null;
  }
}

export async function postGenesisExecution({
  baseUrl = "http://127.0.0.1:7421",
  request,
  fetchImpl = globalThis.fetch,
  timeoutMs = 30_000,
} = {}) {
  const endpoint = loopbackEndpoint(baseUrl);
  if (endpoint === null) return refused("endpoint_not_loopback");
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return refused("request_not_object");
  }
  if (typeof fetchImpl !== "function") return refused("fetch_not_available");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30_000,
  );
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    let body;
    try {
      body = await response.json();
    } catch {
      return refused("response_not_json", {
        status: response.status,
        boundary: boundary(true),
      });
    }
    return Object.freeze({
      schema: NODE0_GENESIS_CLIENT_SCHEMA,
      ok: response.ok,
      refusal: response.ok ? null : "governed_runtime_refused",
      status: response.status,
      body,
      boundary: boundary(true),
    });
  } catch (error) {
    return refused(error?.name === "AbortError" ? "timeout" : "network_error", {
      boundary: boundary(true),
    });
  } finally {
    clearTimeout(timeout);
  }
}
