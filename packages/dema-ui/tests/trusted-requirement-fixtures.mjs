import { readFileSync } from "node:fs";

const owners = new Map([
  ["/home/bizra-operating-system/Downloads/Dema/backlog/tasks/task-075.26 - Source-cited-Node0-status-brief-through-one-governed-mission.md",
    () => readFileSync(new URL("./fixtures/task-075.26-owner.md", import.meta.url))],
  ["/home/bizra-operating-system/bizra-worktrees/node0-genesis-release-final/packages/genesis/src/urp0-kernel.js",
    () => readFileSync(new URL("../../genesis/src/urp0-kernel.js", import.meta.url))],
  ["/home/bizra-operating-system/bizra-worktrees/node0-genesis-release-final/packages/genesis/src/urp0-mission-kernel.js",
    () => readFileSync(new URL("../../genesis/src/urp0-mission-kernel.js", import.meta.url))],
]);

export function readTrustedOwnerFixture(path) {
  const read = owners.get(path);
  if (!read) throw Error("TEST_OWNER_FIXTURE_UNAVAILABLE");
  return read();
}
