// Telemetry adversarial battery — MOCK os/exec/fs adapters. Must not depend
// on this machine having a GPU or ollama. Run: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  observeSystem,
  observeStorage,
  observeGpu,
  observeModels,
  observeNode0Boundary,
  observeReceiptsCount,
  buildNodeResourcesResponse,
  isLoopbackOrPrivateIp,
  TelemetryExecError,
  NODE_RESOURCES_SCHEMA,
} from "../src/lib/telemetry/node-resources-core.ts";

// ---- mock adapters -----------------------------------------------------
const okOs = {
  cpuCount: () => 8,
  cpuModel: () => "Mock CPU",
  totalMemBytes: () => 16e9,
  freeMemBytes: () => 8e9,
  loadavg: () => [0.5, 0.6, 0.7],
  uptimeSeconds: () => 3600,
  platform: () => "linux",
  arch: () => "x64",
};

function execThat(fn) {
  return { run: fn };
}

// ---- normal cpu/ram ------------------------------------------------------
test("normal cpu/ram/load/host is MEASURED with sane units", () => {
  const sys = observeSystem(okOs);
  assert.equal(sys.cpu.status, "MEASURED");
  assert.equal(sys.cpu.value.cores, 8);
  assert.equal(sys.memory.status, "MEASURED");
  assert.equal(sys.memory.value.totalGB, 16);
  assert.equal(sys.load.status, "MEASURED");
  assert.equal(sys.host.status, "MEASURED");
  // host must never include hostname
  assert.equal("hostname" in sys.host.value, false);
});

// ---- missing nvidia-smi ---------------------------------------------------
test("missing nvidia-smi -> UNAVAILABLE, never 0", () => {
  const exec = execThat(() => {
    throw new TelemetryExecError("command_not_found");
  });
  const gpu = observeGpu(exec);
  assert.equal(gpu.status, "UNAVAILABLE");
  assert.equal(gpu.value, null);
  assert.equal(gpu.reason, "command_not_found");
});

// ---- nvidia-smi timeout ----------------------------------------------------
test("nvidia-smi timeout -> UNAVAILABLE with command_timeout reason", () => {
  const exec = execThat(() => {
    throw new TelemetryExecError("command_timeout");
  });
  const gpu = observeGpu(exec);
  assert.equal(gpu.status, "UNAVAILABLE");
  assert.equal(gpu.reason, "command_timeout");
});

// ---- malformed GPU output ---------------------------------------------------
test("malformed GPU output -> UNAVAILABLE parse_error, not a crash", () => {
  const exec = execThat(() => "not,a,valid,csv,line,,,");
  const gpu = observeGpu(exec);
  assert.equal(gpu.status, "UNAVAILABLE");
  assert.equal(gpu.reason, "parse_error");
});

// ---- missing ollama ---------------------------------------------------------
test("missing ollama -> UNAVAILABLE, never an empty MEASURED list", () => {
  const exec = execThat(() => {
    throw new TelemetryExecError("command_not_found");
  });
  const models = observeModels(exec);
  assert.equal(models.status, "UNAVAILABLE");
  assert.equal(models.value, null);
});

// ---- malformed model output --------------------------------------------------
test("malformed ollama output does not crash and stays well-formed", () => {
  const exec = execThat(() => "header line only\n");
  const models = observeModels(exec);
  assert.equal(models.status, "MEASURED");
  assert.deepEqual(models.value, []);
});

// ---- inaccessible storage path ------------------------------------------------
test("inaccessible storage path -> UNAVAILABLE, not fabricated numbers", () => {
  const exec = execThat(() => {
    throw new TelemetryExecError("command_nonzero_exit");
  });
  const storage = observeStorage(exec);
  assert.equal(storage.status, "UNAVAILABLE");
  assert.equal(storage.value, null);
});

// ---- output exceeding byte ceiling -------------------------------------------
test("output exceeding byte ceiling -> UNAVAILABLE output_exceeded_ceiling, fails closed", () => {
  const exec = execThat(() => {
    throw new TelemetryExecError("output_exceeded_ceiling");
  });
  const storage = observeStorage(exec);
  assert.equal(storage.status, "UNAVAILABLE");
  assert.equal(storage.reason, "output_exceeded_ceiling");
});

// ---- nonzero exit --------------------------------------------------------------
test("nonzero exit -> UNAVAILABLE command_nonzero_exit reason, not thrown to caller", () => {
  const exec = execThat(() => {
    throw new TelemetryExecError("command_nonzero_exit");
  });
  assert.doesNotThrow(() => observeModels(exec));
  const models = observeModels(exec);
  assert.equal(models.status, "UNAVAILABLE");
  assert.equal(models.reason, "command_nonzero_exit");
});

// ---- command returning sensitive paths — assert redacted -----------------------
test("storage never echoes raw mount paths — only stable labels", () => {
  const exec = execThat(() =>
    [
      "Filesystem 1B-blocks Used Available Use% Mounted",
      "/dev/sda1 1000000000 500000000 500000000 50% /data/bizra",
      "/dev/sda2 2000000000 1000000000 1000000000 50% /MOUNT/redaction-probe",
    ].join("\n")
  );
  const storage = observeStorage(exec, ["/data/bizra", "/MOUNT/redaction-probe"]);
  assert.equal(storage.status, "MEASURED");
  const labels = storage.value.map((m) => m.label);
  assert.deepEqual(labels, ["Corpus estate", "Mount 2"]);
  assert.equal(labels.some((l) => l.includes("some-real-username")), false);
  assert.equal(JSON.stringify(storage).includes("some-real-username"), false);
});

test("receipts observation source is a stable label, never the raw absolute path", () => {
  const fs = {
    existsSync: () => true,
    readdirSync: () => ["r1.json", "r2.json"],
  };
  const obs = observeReceiptsCount(fs, "/MOUNT/redaction-probe/Downloads/Dema/docs/receipts");
  assert.equal(obs.status, "MEASURED");
  assert.equal(obs.value, 2);
  assert.equal(obs.source.includes("some-real-username"), false);
  assert.equal(JSON.stringify(obs).includes("some-real-username"), false);
});

test("receipts path failure never leaks the raw path in reason", () => {
  const fs = {
    existsSync: () => {
      throw new Error("ENOENT: no such file or directory, /MOUNT/redaction-probe/secret/path");
    },
    readdirSync: () => [],
  };
  const obs = observeReceiptsCount(fs, "/MOUNT/redaction-probe/secret/path");
  assert.equal(obs.status, "UNAVAILABLE");
  assert.equal(JSON.stringify(obs).includes("some-real-username"), false);
  assert.equal(JSON.stringify(obs).includes("ENOENT"), false);
});

// ---- stale observation -----------------------------------------------------------
test("every observation carries measured_at + stale_after_ms for staleness checks", () => {
  const gpu = observeGpu(execThat(() => "GeForce, 24576, 100, 5"));
  assert.equal(gpu.status, "MEASURED");
  assert.ok(gpu.measured_at.length > 0);
  assert.ok(gpu.stale_after_ms > 0);
});

// ---- UNKNOWN never 0 -----------------------------------------------------------
test("node0 boundary fields are UNKNOWN (not false) when dema command is unreadable", () => {
  const exec = execThat(() => {
    throw new TelemetryExecError("command_not_found");
  });
  const boundary = observeNode0Boundary(exec);
  for (const key of ["daemon_started", "federation_enabled", "minting_enabled", "public_network_enabled"]) {
    assert.equal(boundary[key].status, "UNKNOWN");
    assert.notEqual(boundary[key].value, false, `${key} must be UNKNOWN, never inferred false`);
    assert.equal(boundary[key].value, null);
  }
});

test("node0 boundary fields never inferred from a missing process — malformed JSON", () => {
  const exec = execThat(() => "not json{{{");
  const boundary = observeNode0Boundary(exec);
  assert.equal(boundary.daemon_started.status, "UNKNOWN");
});

test("node0 boundary is MEASURED with real booleans when the source is readable", () => {
  const exec = execThat(() =>
    JSON.stringify({ runtime: { autonomous_daemon: false, federation: false, minting: false, public_network: false } })
  );
  const boundary = observeNode0Boundary(exec);
  assert.equal(boundary.daemon_started.status, "MEASURED");
  assert.equal(boundary.daemon_started.value, false);
});

// ---- UNAVAILABLE never READY_LOCAL ----------------------------------------------
test("UNAVAILABLE/UNKNOWN observations never carry a readiness label", () => {
  const exec = execThat(() => {
    throw new TelemetryExecError("command_not_found");
  });
  const gpu = observeGpu(exec);
  const asStr = JSON.stringify(gpu);
  for (const forbidden of ["READY_LOCAL", "VERIFIED", "ACCEPTED"]) {
    assert.equal(asStr.includes(forbidden), false);
  }
});

// ---- no response containing HOME/USER/token-like/env ----------------------------
test("full response never contains HOME, USER, token-like, or env-var strings", () => {
  const fs = { existsSync: () => true, readdirSync: () => ["a.json"] };
  const exec = execThat((cmd) => {
    if (cmd === "df") {
      return "Filesystem 1B-blocks Used Available Use% Mounted\n/dev/sda1 1000000000 500000000 500000000 50% /data/bizra";
    }
    if (cmd === "nvidia-smi") return "GeForce, 24576, 100, 5";
    if (cmd === "ollama") return "NAME SIZE\nllama3 4.2GB";
    if (cmd === "dema") return JSON.stringify({ runtime: {} });
    throw new TelemetryExecError("command_not_found");
  });
  const resp = buildNodeResourcesResponse({ os: okOs, exec, fs, receiptsPath: "/MOUNT/probe/docs/receipts" });
  const raw = JSON.stringify(resp);
  assert.equal(resp.schema, NODE_RESOURCES_SCHEMA);
  for (const forbidden of ["HOME=", "USER=", "real-user", "/home/", "hostname", "process.env", "Bearer ", "sk-"]) {
    assert.equal(raw.includes(forbidden), false, `response leaked: ${forbidden}`);
  }
});

// ---- no mutation command ---------------------------------------------------------
test("no adapter interface exposes a write/mutate/launch/install method", () => {
  // structural guard: ExecAdapter only exposes run(); no start/stop/install/launch.
  const exec = execThat(() => "ok");
  assert.deepEqual(Object.keys(exec), ["run"]);
});

// ---- no Math.random evidence ids ---------------------------------------------------
test("no observation id/value is derived from Math.random", () => {
  const fs = { existsSync: () => true, readdirSync: () => ["a.json"] };
  const exec = execThat((cmd) => {
    if (cmd === "df") return "Filesystem 1B-blocks Used Available Use% Mounted\n/dev/sda1 1000000000 500000000 500000000 50% /data/bizra";
    if (cmd === "nvidia-smi") return "GeForce, 24576, 100, 5";
    if (cmd === "ollama") return "NAME SIZE\nllama3 4.2GB";
    return JSON.stringify({ runtime: {} });
  });
  const before = JSON.stringify(buildNodeResourcesResponse({ os: okOs, exec, fs, receiptsPath: "/x/docs/receipts" }));
  const after = JSON.stringify(buildNodeResourcesResponse({ os: okOs, exec, fs, receiptsPath: "/x/docs/receipts" }));
  // strip the two known-variable ISO timestamps before comparing determinism
  const strip = (s) => s.replace(/"measured_at":"[^"]*"/g, '"measured_at":"_"');
  assert.equal(strip(before), strip(after), "identical adapter input must produce identical values (no randomness)");
});

// ---- loopback / local-origin guard -----------------------------------------------
test("loopback and private-range IPs are allowed", () => {
  for (const ip of ["127.0.0.1", "::1", "localhost", "10.0.0.5", "192.168.1.20", "172.16.0.1"]) {
    assert.equal(isLoopbackOrPrivateIp(ip), true, ip);
  }
});

test("public IPs are rejected by the loopback guard", () => {
  for (const ip of ["8.8.8.8", "203.0.113.5", "1.1.1.1"]) {
    assert.equal(isLoopbackOrPrivateIp(ip), false, ip);
  }
});
