// tests/root-canon.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { verifyRootCanon } from "../scripts/verify-root-canon.mjs";

test("BIZRA Root Canon verifies exactly three immutable roots", async () => {
  const result = await verifyRootCanon();

  assert.equal(result.verified, true);
  assert.equal(result.status, "IMMUTABLE");
  assert.equal(result.roots_verified, 3);
  assert.equal(result.result, "BIZRA_ROOT_CANON_SEALED");
});
