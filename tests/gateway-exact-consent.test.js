import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createGatewayServer } from "../scripts/gateway-server.mjs";

const EXACT_CONSENT = "GO: Node0 bounded diagnostic activation only";

describe("PROD02-00A — exact mission consent", () => {
  let gw;
  let baseUrl;
  let stateDir;

  before(async () => {
    stateDir = mkdtempSync(join(tmpdir(), "gw-exact-consent-"));
    gw = createGatewayServer({ port: 0, stateDir });
    await gw.start();
    const addr = gw.server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await gw.stop();
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("accepts the one canonical consent phrase", async () => {
    const res = await fetch(`${baseUrl}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: "exact-consent positive control",
        effect_class: "READ_ONLY_OBSERVATION",
        consent: EXACT_CONSENT,
      }),
    });

    assert.equal(res.status, 200);
  });

  it("refuses a different phrase even when it begins with GO: ", async () => {
    const res = await fetch(`${baseUrl}/mission/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: "non-exact GO-prefixed negative control",
        effect_class: "READ_ONLY_OBSERVATION",
        consent: "GO: unrelated authority escalation",
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, "consent_required");
    assert.equal(body.expected_consent_phrase, EXACT_CONSENT);
  });
});
