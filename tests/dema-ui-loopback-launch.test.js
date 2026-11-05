import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const { scripts } = JSON.parse(read("packages/dema-ui/package.json"));

test("direct UI development launch explicitly binds IPv4 loopback", () => {
  assert.match(scripts.dev, /\bnext dev\b[^|]* -H 127\.0\.0\.1(?:\s|$)/);
});

test("direct standalone UI launch overrides inherited HOSTNAME with loopback", () => {
  assert.match(scripts.start, /^HOSTNAME=127\.0\.0\.1 NODE_ENV=production node /);
});

test("managed-service and genesis launch paths retain their loopback bindings", () => {
  assert.match(read("scripts/install/install-node0-user-services.sh"), /Environment=HOSTNAME=127\.0\.0\.1/);
  const genesis = read("scripts/genesis-node0.mjs");
  assert.match(read("scripts/genesis/urp0-server.mjs"), /BIND_HOST = "127\.0\.0\.1"/);
  assert.match(genesis, /"-H", BIND_HOST/);
});
