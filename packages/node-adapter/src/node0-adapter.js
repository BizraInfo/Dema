import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { defaultStatus } from "../../core/src/status.js";
import { createGatewayHttpAdapter } from "./gateway-http-adapter.js";

const execFileAsync = promisify(execFile);

const LEGACY_SHELLOUT_ADAPTER = {
  mode: "legacy-shellout",
  legacy: true,
  operator_owned: true,
  execution: "execFile",
  shell: false
};

export function parseCommandLine(command) {
  const tokens = [];
  let current = "";
  let quote = null;
  let escaping = false;

  for (const char of command) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping) current += "\\";
  if (quote) throw new Error("Unclosed quote in DEMA_NODE0_STATUS_COMMAND");
  if (current) tokens.push(current);
  return tokens;
}

export function normalizeNode0Status(raw) {
  // Adapter input is untrusted (CLAUDE.md invariant 6). `??` falls through
  // only for null/undefined, so a malformed gateway payload like
  // `loaded_model_ids: "phi-2"` would slip past and crash status.js's
  // `.join(", ")` on a string. Coerce to array explicitly here.
  const rawLoadedIds =
    raw?.lm_studio?.loaded_model_ids ?? raw?.model_backend?.loaded_model_ids;
  const loadedModelIds = Array.isArray(rawLoadedIds) ? rawLoadedIds : [];

  return {
    schema: "bizra.dema.status.v0.1",
    node: "Node0",
    human: raw?.profile?.preferred_name ?? raw?.human ?? null,
    ready: Boolean(raw?.ready),
    consoleReady: Boolean(raw?.console_ready ?? raw?.dema_console?.console_ready),
    activationGate: raw?.activation_gate ?? raw?.dema_console?.activation_gate ?? "BLOCKED",
    daemonStatus: raw?.daemon_status ?? raw?.daemon?.status ?? "unknown",
    missionExecuted: Boolean(raw?.mission_executed),
    runtimePulse: {
      fired: Boolean(raw?.runtime_pulse?.fired ?? raw?.runtime_pulse_fired)
    },
    findings: raw?.findings ?? [],
    model: {
      connected: Boolean(raw?.lm_studio?.connected ?? raw?.model_backend?.connected),
      loadedModelIds,
      tokenPresent: Boolean(raw?.lm_studio?.token_present ?? raw?.model_backend?.token_present)
    },
    rustBus: {
      ready: Boolean(raw?.rust_bus?.ready ?? raw?.dependencies?.rust_bus?.ready)
    },
    proof: {
      latestChainHash: raw?.proof?.latest_chain_hash,
      nextArtifact: "ARTIFACT-011"
    },
    nextAdmissibleAction: raw?.next_admissible_action ?? "bounded_diagnostic_activation"
  };
}

function withLegacyShelloutMetadata(status, extra = {}) {
  return {
    ...status,
    source: extra.source ?? "legacy-shellout",
    adapter: {
      ...LEGACY_SHELLOUT_ADAPTER,
      available: extra.available ?? true,
      ...(extra.reason ? { reason: extra.reason } : {})
    }
  };
}

function legacyShelloutUnavailable(reason, finding) {
  const status = defaultStatus();
  return withLegacyShelloutMetadata(
    {
      ...status,
      source: "legacy-shellout-unavailable",
      findings: [...(status.findings ?? []), finding]
    },
    { available: false, reason, source: "legacy-shellout-unavailable" }
  );
}

export function createNode0Adapter(options = {}) {
  // Adapter dispatch (ADR-003): explicit `adapterMode` option wins, else
  // DEMA_NODE0_ADAPTER env var, else a configured gateway URL wins over
  // the legacy shellout backend.
  const adapterMode = options.adapterMode ?? process.env.DEMA_NODE0_ADAPTER;
  const gatewayUrl = options.gatewayUrl ?? process.env.DEMA_GATEWAY_URL;
  if (adapterMode === "gateway-http") {
    return createGatewayHttpAdapter({
      baseUrl: gatewayUrl,
      timeoutMs: options.timeoutMs
    });
  }

  if (!adapterMode && gatewayUrl) {
    return createGatewayHttpAdapter({
      baseUrl: gatewayUrl,
      timeoutMs: options.timeoutMs
    });
  }

  const command = options.command ?? process.env.DEMA_NODE0_STATUS_COMMAND;

  return {
    async status() {
      if (!command) {
        return legacyShelloutUnavailable(
          "legacy_status_command_not_configured",
          "DEMA_NODE0_STATUS_COMMAND unavailable: not configured"
        );
      }

      const [bin, ...args] = parseCommandLine(command);
      if (!bin) throw new Error("DEMA_NODE0_STATUS_COMMAND is empty");
      let stdout;
      try {
        ({ stdout } = await execFileAsync(bin, args, { timeout: 30000 }));
      } catch (error) {
        if (error?.code === "ENOENT") {
          return legacyShelloutUnavailable(
            "legacy_status_command_unavailable",
            `DEMA_NODE0_STATUS_COMMAND unavailable: ${error.message}`
          );
        }
        throw error;
      }
      try {
        return withLegacyShelloutMetadata(normalizeNode0Status(JSON.parse(stdout)));
      } catch (error) {
        throw new Error(
          `DEMA_NODE0_STATUS_COMMAND returned non-JSON output: ${error.message}`
        );
      }
    },

    async listReceipts() {
      return [];
    },

    async proposeBoundedDiagnostic() {
      const status = await this.status();
      return {
        status,
        requiredConsentPhrase: "GO: Node0 bounded diagnostic activation only"
      };
    }
  };
}
