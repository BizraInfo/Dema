// Server-only fixed owner reader. Production has no requirement-policy grant.
import { constants, openSync, closeSync, fstatSync, readSync } from "node:fs";
import { createHash } from "node:crypto";

const OWNERS = Object.freeze({
  task: {
    path: "/home/bizra-operating-system/Downloads/Dema/backlog/tasks/task-075.26 - Source-cited-Node0-status-brief-through-one-governed-mission.md",
    hash: "133222699145f360c383230810b3b2aed9ac984c2906afda6d901a17e4a46ac8",
  },
  mission: {
    path: "/home/bizra-operating-system/bizra-worktrees/node0-genesis-release-final/packages/genesis/src/urp0-kernel.js",
    hash: "66a7f07a8d14405e86e58acbaff419c23d20a8f675b8cdbe5b25c6f6939e5ebb",
  },
  operation: {
    path: "/home/bizra-operating-system/bizra-worktrees/node0-genesis-release-final/packages/genesis/src/urp0-mission-kernel.js",
    hash: "94c11fb56492077f1062525fa04721de782efee11ce3077718735fe5e588b5ae",
  },
});
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

function readOwner(path: string) {
  let directory = openSync("/", constants.O_RDONLY | constants.O_DIRECTORY);
  let fd: number | undefined;
  try {
    const parts = path.split("/").filter(Boolean);
    for (const part of parts.slice(0, -1)) {
      // Directory descriptors keep the parent stable across rename/symlink swaps.
      const next = openSync(`/proc/self/fd/${directory}/${part}`,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      closeSync(directory);
      directory = next;
    }
    fd = openSync(`/proc/self/fd/${directory}/${parts.at(-1)}`,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NOATIME);
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile() || before.size <= BigInt(0) || before.size > BigInt(262144)) throw Error("TRUSTED_OWNER_SIZE_INVALID");
    const bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!count) throw Error("TRUSTED_OWNER_SHORT_READ");
      offset += count;
    }
    const after = fstatSync(fd, { bigint: true });
    if (["dev", "ino", "size", "mtimeNs", "ctimeNs"].some(key => before[key] !== after[key])) {
      throw Error("TRUSTED_OWNER_SOURCE_DRIFT");
    }
    return bytes;
  } finally {
    if (fd !== undefined) closeSync(fd);
    closeSync(directory);
  }
}

export function resolveTrustedRequirement(taskId: unknown, {
  read_owner = readOwner,
  test_policy_bytes = null,
  source_text = undefined,
}: { read_owner?: (path: string) => Buffer; test_policy_bytes?: Buffer | null; source_text?: unknown } = {}) {
  const readPinned = (role: keyof typeof OWNERS) => {
    const owner = OWNERS[role];
    const bytes = read_owner(owner.path);
    if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > 262144 || hash(bytes) !== owner.hash) {
      throw Error("TRUSTED_OWNER_SOURCE_DRIFT");
    }
    return bytes.toString("utf8");
  };
  if (taskId !== "TASK-075.26" && taskId !== "BIZRA-GENESIS-LOCAL-MISSION-0") {
    if (taskId != null || typeof source_text !== "string") return null;
    // Exact owner-title recognition can classify an unsupported brief, never admit an unbound legacy request.
    const title = readPinned("task").match(/^title: (.+)$/m)?.[1];
    if (!title || source_text.trim() !== title) return null;
    taskId = "TASK-075.26";
  }
  const mission = readPinned("mission");
  const operation = readPinned("operation");
  if (!/^export const URP0_MISSION_ID = "BIZRA-GENESIS-LOCAL-MISSION-0";$/m.test(mission) ||
      !/^export const MISSION_PERMITTED_OPERATION = "METADATA_INVENTORY_READ_ONLY";$/m.test(operation) ||
      !/^export const MISSION_CONTRACT_SCHEMA = "bizra.genesis.mission_contract.v0.1";$/m.test(operation)) {
    throw Error("TRUSTED_OWNER_DECLARATION_INVALID");
  }
  const owner = taskId === "TASK-075.26" ? OWNERS.task : OWNERS.mission;
  if (taskId === "TASK-075.26") {
    const task = readPinned("task");
    if (!/^id: TASK-075\.26$/m.test(task) || !task.includes("source-cited status brief")) {
      throw Error("TRUSTED_TASK_DECLARATION_INVALID");
    }
  }
  // This dependency is injected only by offline tests; no request or environment toggle supplies a policy.
  let policy = null;
  if (test_policy_bytes !== null) {
    if (!Buffer.isBuffer(test_policy_bytes) || test_policy_bytes.length > 16384) throw Error("TEST_POLICY_INVALID");
    const parsed = JSON.parse(test_policy_bytes.toString("utf8"));
    if (parsed?.schema !== "bizra.node0.1tr1.test_policy.v1" ||
        parsed.id !== "NODE0-MOMO-TRUSTED-REQUIREMENT-ROUTE-INTEGRATION-1T-R1" ||
        parsed.authority_ref !== `GO ${parsed.id}` || parsed.scope !== "ISOLATED_NONEXECUTING_TEST_ONLY") {
      throw Error("TEST_POLICY_INVALID");
    }
    const { schema: ignored, ...fields } = parsed;
    policy = { ...fields, hash: `sha256:${hash(test_policy_bytes)}` };
  }
  return {
    schema: "bizra.dema.trusted_task_requirement.v1",
    task_id: taskId,
    owner: { identity: owner.path, hash: `sha256:${owner.hash}`, revision: `sha256:${owner.hash}` },
    required_operation: taskId === "TASK-075.26" ? "SOURCE_CONTENT_EVIDENCE_AND_SOURCE_CITED_STATUS_REPORT" : "METADATA_INVENTORY_READ_ONLY",
    capability: {
      mission_id: "BIZRA-GENESIS-LOCAL-MISSION-0", version: "bizra.genesis.mission_contract.v0.1",
      operation: "METADATA_INVENTORY_READ_ONLY",
      owner_hash: `sha256:${OWNERS.operation.hash}`, registration_hash: `sha256:${OWNERS.mission.hash}`,
    },
    policy,
    execution_allowed: false,
    authority_delta: 0,
  };
}
