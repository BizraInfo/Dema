import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { isExposedAddress, portFor } from "./model-common.js";
import { allModelCandidates } from "./model-routing.js";

const execFileAsync = promisify(execFile);

export function parseSsBindings(stdout, ports = []) {
  const wanted = new Set(ports.map(Number));
  const bindings = [];

  for (const line of String(stdout ?? "").split("\n")) {
    const binding = parseSsLine(line, wanted);
    if (binding) bindings.push(binding);
  }

  return bindings;
}

function parseSsLine(line, wantedPorts) {
  if (!line.includes("LISTEN")) return null;

  const local = line.trim().split(/\s+/)[3];
  const match = local?.match(/^(.*):(\d+)$/);
  if (!match) return null;

  const port = Number(match[2]);
  if (!wantedPorts.has(port)) return null;

  return {
    port,
    address: match[1].replace(/^\[|\]$/g, ""),
  };
}

async function detectTcpBindings(ports) {
  if (process.env.DEMA_MODELS_SKIP_TCP === "1") {
    return { available: false, skipped: true, bindings: [] };
  }

  try {
    const { stdout } = await execFileAsync("ss", ["-tln"], { timeout: 1500 });
    return {
      available: true,
      skipped: false,
      bindings: parseSsBindings(stdout, ports),
    };
  } catch (err) {
    return {
      available: false,
      skipped: false,
      bindings: [],
      error: err?.message ?? String(err),
    };
  }
}

export function resolveTcpBindings(ports, tcpBindings) {
  if (tcpBindings) {
    return Promise.resolve({
      available: true,
      skipped: false,
      bindings: tcpBindings,
    });
  }
  return detectTcpBindings(ports);
}

export function buildSafety({
  ollamaUrl,
  lmStudioUrl,
  llamacppUrl,
  tcp,
  providers,
}) {
  return {
    exposure_check: tcp.available
      ? "measured"
      : tcp.skipped
        ? "skipped"
        : "unavailable",
    exposures: buildExposures(ollamaUrl, lmStudioUrl, llamacppUrl, tcp.bindings),
    model_name_flags: buildModelNameFlags(providers),
  };
}

function buildExposures(ollamaUrl, lmStudioUrl, llamacppUrl, bindings) {
  const providerPorts = [
    { provider: "ollama", port: portFor(ollamaUrl) },
    { provider: "lm_studio", port: portFor(lmStudioUrl) },
    { provider: "llamacpp", port: portFor(llamacppUrl) },
  ];

  return providerPorts.flatMap((entry) => {
    return bindings
      .filter(
        (binding) =>
          binding.port === entry.port && isExposedAddress(binding.address),
      )
      .map((binding) => ({
        provider: entry.provider,
        port: binding.port,
        address: binding.address,
        severity: "review",
        message: `${entry.provider} is listening beyond localhost on ${binding.address}:${binding.port}`,
      }));
  });
}

function buildModelNameFlags(providers) {
  return allModelCandidates(providers)
    .filter((model) => /uncensored|aggressive/i.test(model.id))
    .map((model) => ({
      model: model.id,
      source: model.source,
      severity: "review",
      message:
        "model name signals uncensored/aggressive behavior; route only by explicit operator choice",
    }));
}
