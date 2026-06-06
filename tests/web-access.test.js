import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildWebAccessPreview,
  buildWebAccessSummary,
  buildWebFetchRequest,
  WEB_ACCESS_ALLOWLIST_HOSTS_DEFAULT,
  WEB_ACCESS_REQUIRED_BLOCKED_EFFECTS,
} from "../packages/core/src/web-access.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("Web access canonical schema · localhost in default allowlist", () => {
  const p = buildWebAccessPreview();
  assert.equal(p.schema, "bizra.dema.web_access.v0.1");
  assert.ok(p.allowlist_hosts.includes("localhost"));
  assert.ok(p.allowlist_hosts.includes("127.0.0.1"));
});

test("Web access · method_allowlist is GET + HEAD only", () => {
  const p = buildWebAccessPreview();
  assert.deepEqual([...p.method_allowlist], ["GET", "HEAD"]);
});

test("Web access · boundary canonical · refusals enumerated", () => {
  const p = buildWebAccessPreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(
    p.refusal_invariants.some((r) =>
      r.includes("never fetches without typed per-URL consent"),
    ),
  );
  assert.ok(p.refusal_invariants.some((r) => r.includes("only uses GET/HEAD")));
});

test("Web access · blocked_effects · fetch-without-consent · non-allowlist · execute-code", () => {
  const p = buildWebAccessPreview();
  assert.ok(p.blocked_effects.includes("fetch_without_per_url_consent"));
  assert.ok(p.blocked_effects.includes("fetch_from_non_allowlisted_host"));
  assert.ok(p.blocked_effects.includes("execute_received_code"));
});

test("Fetch request · allowlisted host + valid URL → valid", () => {
  const r = buildWebFetchRequest({
    url: "https://www.localfirst.fm/",
    purpose: "browse episode list",
  });
  assert.equal(r.valid, true);
  assert.equal(r.host, "www.localfirst.fm");
  assert.match(r.consent_phrase, /^GO: fetch /);
  assert.equal(r.fetch_performed, false);
  assert.match(r.cache_path, /^~\/\.dema\/web-cache\/[a-f0-9]{64}\.json$/);
});

test("Fetch request · non-allowlisted host → invalid", () => {
  const r = buildWebFetchRequest({
    url: "https://evil.example.com/",
    purpose: "test",
  });
  assert.equal(r.valid, false);
  assert.ok(r.violations.some((v) => v.includes("host_not_in_allowlist")));
});

test("Fetch request · disallowed protocol (ftp/file) → invalid", () => {
  const r = buildWebFetchRequest({
    url: "ftp://localhost/file",
    purpose: "test",
  });
  assert.equal(r.valid, false);
  assert.ok(r.violations.some((v) => v.includes("disallowed_protocol")));
});

test("Fetch request · malformed URL → invalid", () => {
  const r = buildWebFetchRequest({
    url: "not a url",
    purpose: "test",
  });
  assert.equal(r.valid, false);
  assert.ok(r.violations.includes("invalid_url_format"));
});

test("Fetch request · missing purpose → invalid", () => {
  const r = buildWebFetchRequest({
    url: "https://localhost/",
  });
  assert.equal(r.valid, false);
  assert.ok(r.violations.includes("no_purpose"));
});

test("Fetch request · URL hash deterministic (sha256 of URL)", () => {
  const r1 = buildWebFetchRequest({
    url: "https://localhost/x",
    purpose: "test",
  });
  const r2 = buildWebFetchRequest({
    url: "https://localhost/x",
    purpose: "test2",
  });
  assert.equal(r1.url_hash, r2.url_hash);
  assert.equal(r1.url_hash.length, 64);
});

test("Fetch request · custom allowlist overrides default", () => {
  const r = buildWebFetchRequest({
    url: "https://allowed.test/",
    purpose: "test",
    allowlist_hosts: ["allowed.test"],
  });
  assert.equal(r.valid, true);
});

test("Fetch request · deep-frozen + canonical boundary", () => {
  const r = buildWebFetchRequest({
    url: "https://localhost/",
    purpose: "test",
  });
  assert.ok(Object.isFrozen(r));
  assert.ok(isCanonicalBoundary(r.boundary));
});

test("Summary + exports", () => {
  const s = buildWebAccessSummary();
  assert.ok(s.allowlist_host_count >= 5);
  assert.ok(JSON.stringify(s, null, 2).split("\n").length <= 40);
  assert.ok(Object.isFrozen(WEB_ACCESS_ALLOWLIST_HOSTS_DEFAULT));
  assert.ok(Object.isFrozen(WEB_ACCESS_REQUIRED_BLOCKED_EFFECTS));
});
