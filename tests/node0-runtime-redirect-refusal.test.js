import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const source = readFileSync(
  new URL("../packages/dema-ui/src/app/api/mission/node0-runtime.ts", import.meta.url),
  "utf8",
);

function sourceLine(name) {
  const line = source.match(new RegExp(`^const ${name} = .*;$`, "m"))?.[0];
  assert.ok(line, `missing source declaration ${name}`);
  return line;
}

function sourceBlock(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `missing source block ${startMarker}`);
  return source.slice(start, end);
}

const helperSource = stripTypeScriptTypes([
  sourceLine("LOOPBACK_HOSTS"),
  sourceLine("RUNTIME_ROUTES"),
  sourceLine("GOVERNED_RUNTIME_TIMEOUT_MS"),
  sourceBlock("function runtimeUrl()", "\nexport function proposalBinding"),
  sourceBlock("export async function callGovernedRuntime", "\nexport function readIntent"),
].join("\n").replace(/^export /gm, ""));
const callGovernedRuntime = new Function(`${helperSource}\nreturn callGovernedRuntime;`)();

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test("callGovernedRuntime refuses a loopback 307 without forwarding to its target", async () => {
  let firstRequests = 0;
  let secondRequests = 0;
  let secondPort;
  const second = createServer((_request, response) => {
    secondRequests++;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });
  const first = createServer((_request, response) => {
    firstRequests++;
    response.writeHead(307, { location: `http://127.0.0.1:${secondPort}/redirect-target` });
    response.end();
  });
  const priorRuntimeUrl = process.env.BIZRA_NODE0_GOVERNED_RUNTIME_URL;

  try {
    secondPort = await listen(second);
    const firstPort = await listen(first);
    process.env.BIZRA_NODE0_GOVERNED_RUNTIME_URL = `http://127.0.0.1:${firstPort}`;

    await assert.rejects(
      () => callGovernedRuntime("/api/authorize", { secret: "must-not-forward" }),
      TypeError,
    );
    assert.equal(firstRequests, 1);
    assert.equal(secondRequests, 0);
  } finally {
    if (priorRuntimeUrl === undefined) delete process.env.BIZRA_NODE0_GOVERNED_RUNTIME_URL;
    else process.env.BIZRA_NODE0_GOVERNED_RUNTIME_URL = priorRuntimeUrl;
    await Promise.all([close(first), close(second)]);
  }
});
