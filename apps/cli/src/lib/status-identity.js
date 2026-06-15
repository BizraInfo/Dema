import { readOperatorPreferredName } from "../../../../packages/core/src/operator-profile.js";

export async function statusWithLocalIdentity(adapter) {
  const status = await adapter.status();
  if (status?.human) return status;
  const human = await readOperatorPreferredName();
  return human ? { ...status, human } : status;
}
