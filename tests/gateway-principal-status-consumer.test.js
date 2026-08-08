import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  createGatewayHttpAdapter,
  fetchPrincipalStatus,
} from "../packages/node-adapter/src/gateway-http-adapter.js";

function startGateway(handler) {
  const calls = [];
  const server = createServer((req, res) => {
    calls.push({ method: req.method, url: req.url });
    handler(req, res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        calls,
        async stop() {
          await new Promise((r) => server.close(r));
        },
      });
    });
  });
}

const VERIFIED_STATUS = Object.freeze({
  schema: "bizra.node0.principal_identity_status.v0.1",
  verdict: "VERIFIED",
  identityVerified: true,
  bridgeEligible: true,
  verifiedIdentity: {
    principalId: "11".repeat(32),
    principalProfileHash: "22".repeat(32),
    nodePubkey: "33".repeat(32),
    activationReceiptRef: "44".repeat(32),
    receiptId: "55".repeat(32),
    timestampNs: "1759999999",
    prevChain: "66".repeat(32),
  },
  evidenceState: {
    profilePresent: true,
    activeChainRecordFound: true,
    durableReceiptMetadataFound: true,
    canonicalPayloadAvailable: true,
    chainContinuityVerified: true,
  },
  chainHead: "77".repeat(32),
  chainLength: 3,
  authorityPolicy: {
    activationRequires: "EXPLICIT_GO_REQUIRED",
    authorityDelta: 0,
  },
  operationEffects: {
    mutationPerformed: false,
    activationPerformed: false,
    witnessIssued: false,
    poiMinted: false,
    soakStarted: false,
  },
  reasonCodes: [],
});

test("principal-status consumer performs one localhost GET and returns producer evidence unchanged", async () => {
  const gw = await startGateway((req, res) => {
    assert.equal(req.url, "/principal/status");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(VERIFIED_STATUS));
  });
  try {
    const result = await fetchPrincipalStatus(gw.url, { timeoutMs: 1000 });
    assert.equal(result.ok, true);
    assert.equal(result.label, "principal");
    assert.equal(result.url, `${gw.url}/principal/status`);
    assert.deepEqual(result.json, VERIFIED_STATUS);
    assert.deepEqual(gw.calls, [{ method: "GET", url: "/principal/status" }]);
  } finally {
    await gw.stop();
  }
});

test("gateway adapter exposes the principal-status read without changing ordinary status polling", async () => {
  const gw = await startGateway((req, res) => {
    if (req.url === "/principal/status") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(VERIFIED_STATUS));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  try {
    const adapter = createGatewayHttpAdapter({ baseUrl: gw.url, timeoutMs: 1000 });
    const result = await adapter.principalStatus();
    assert.equal(result.ok, true);
    assert.equal(result.json.verdict, "VERIFIED");
    assert.equal(result.json.authorityPolicy.authorityDelta, 0);
    assert.equal(result.json.operationEffects.mutationPerformed, false);
    assert.deepEqual(gw.calls, [{ method: "GET", url: "/principal/status" }]);
  } finally {
    await gw.stop();
  }
});

test("principal-status consumer refuses non-local endpoints before fetch", async () => {
  const result = await fetchPrincipalStatus("https://example.com", { timeoutMs: 100 });
  assert.equal(result.ok, false);
  assert.equal(result.label, "principal");
  assert.equal(result.error, "non-localhost_gateway_url_refused");
  assert.equal(result.url, "https://example.com/principal/status");
});

test("principal-status consumer reports HTTP and content-type failures without inventing identity", async () => {
  for (const mode of ["http", "content-type"]) {
    const gw = await startGateway((_req, res) => {
      if (mode === "http") {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "unavailable" }));
      } else {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("not-json");
      }
    });
    try {
      const result = await fetchPrincipalStatus(gw.url, { timeoutMs: 1000 });
      assert.equal(result.ok, false);
      assert.equal(result.label, "principal");
      assert.equal("json" in result, false);
      if (mode === "http") assert.equal(result.error, "HTTP 503");
      else assert.match(result.error, /non-JSON response/);
    } finally {
      await gw.stop();
    }
  }
});
