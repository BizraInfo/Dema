// NODE0-HARDWARE-PROFILE-1A — read-only hardware gatherer (apps/cli).
//
// Collects coarse machine observations via os + bounded subprocess probes.
// Feeds packages/core/src/node0-hardware-profile.js. No mutation, no network.

import { execFile as nodeExecFile } from "node:child_process";
import { statfs as nodeStatfs } from "node:fs/promises";
import { totalmem, freemem, cpus, hostname, platform } from "node:os";
import { promisify } from "node:util";

const execFile = promisify(nodeExecFile);

function gbFromBytes(n) {
  return Math.round((n / 1024 ** 3) * 10) / 10;
}

async function queryNvidiaGpus(execFileImpl = execFile) {
  try {
    const { stdout } = await execFileImpl(
      "nvidia-smi",
      ["--query-gpu=name,memory.total,memory.free", "--format=csv,noheader,nounits"],
      { timeout: 5000, maxBuffer: 64 * 1024 },
    );
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name, total, free] = line.split(",").map((s) => s.trim());
        return {
          name: name || null,
          memory_total_mib: Number(total),
          memory_free_mib: Number(free),
        };
      })
      .filter((g) => g.name && Number.isFinite(g.memory_total_mib));
  } catch {
    return [];
  }
}

async function diskFreeGb(mount, statfsImpl = nodeStatfs) {
  try {
    const st = await statfsImpl(mount);
    const free = Number(st.bavail) * Number(st.bsize);
    const total = Number(st.blocks) * Number(st.bsize);
    return {
      mount,
      total_gb: gbFromBytes(total),
      free_gb: gbFromBytes(free),
    };
  } catch {
    return { mount, total_gb: null, free_gb: null };
  }
}

export async function gatherNode0HardwareObservations({
  execFileImpl,
  statfsImpl,
  diskMount = "/",
} = {}) {
  const logicalCores = cpus().length;
  const memoryTotalGb = gbFromBytes(totalmem());
  const memoryAvailableGb = gbFromBytes(freemem());
  const gpus = await queryNvidiaGpus(execFileImpl);
  const disk = await diskFreeGb(diskMount, statfsImpl);

  return Object.freeze({
    platform: platform(),
    hostname: hostname(),
    cpu_cores_logical: logicalCores,
    memory_total_gb: memoryTotalGb,
    memory_available_gb: memoryAvailableGb,
    gpus: Object.freeze(gpus),
    disk: Object.freeze(disk),
  });
}
