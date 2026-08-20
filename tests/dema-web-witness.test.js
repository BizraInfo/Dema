// DEMA-WEB-WITNESS-1A — browser use the Dema way: not autonomous browsing,
// a consent-gated, single-page, credential-free GET whose result is a
// content-addressed WITNESS — hash-pinned, boundary-declared, re-verifiable,
// and diffable against a later witness of the same page.
//
// Pure-kernel tests: the observation is injected, so nothing here touches the
// network. The gatherer owns fetch; the kernel owns truth.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildWebWitness,
  verifyWebWitness,
  diffWebWitness,
  DEMA_WEB_WITNESS_SCHEMA,
  DEMA_WEB_WITNESS_TRUTH_LABEL,
  DEMA_WEB_WITNESS_GO_PHRASE,
  WEB_WITNESS_TEXT_EXCERPT_MAX_CHARS,
  WEB_WITNESS_MAX_LINKS,
} from "../packages/core/src/dema-web-witness.js";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

function observation(overrides = {}) {
  const body = "<html><title>Seed</title><body>hello world</body></html>";
  return {
    request_url: "https://example.org/page",
    final_url: "https://example.org/page",
    redirected: false,
    fetched_at_iso: "2026-08-20T03:00:00.000Z",
    status: 200,
    content_type: "text/html",
    body_sha256: sha256(body),
    body_byte_length: Buffer.byteLength(body),
    body_overflow: false,
    title: "Seed",
    text_excerpt: "hello world",
    links: ["https://example.org/a"],
    link_count_total: 1,
    ...overrides,
  };
}

test("WW-01 consent is an exact string — anything else refuses and builds nothing", () => {
  for (const bad of [undefined, "", "go: dema web witness one page read-only",
    DEMA_WEB_WITNESS_GO_PHRASE + " ", "yes"]) {
    const out = buildWebWitness({ consent: bad, observation: observation() });
    assert.equal(out.ok, false);
    assert.equal(out.reason, "consent_exact_string_mismatch");
    assert.equal(out.witness, undefined);
  }
});

test("WW-02 a valid witness re-verifies; a tampered body hash fails closed", () => {
  const out = buildWebWitness({
    consent: DEMA_WEB_WITNESS_GO_PHRASE,
    observation: observation(),
  });
  assert.equal(out.ok, true);
  const w = out.witness;
  assert.equal(w.schema, DEMA_WEB_WITNESS_SCHEMA);
  assert.equal(w.truth_label, DEMA_WEB_WITNESS_TRUTH_LABEL);
  assert.deepEqual(verifyWebWitness(w), { ok: true });

  const tampered = { ...w, body_sha256: sha256("someone else's page") };
  const verdict = verifyWebWitness(tampered);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "witness_hash_mismatch");
});

test("WW-03 the witness binds the observation facts it was given", () => {
  const body = "specific bytes 12345";
  const obs = observation({
    body_sha256: sha256(body),
    body_byte_length: Buffer.byteLength(body),
    status: 404,
    content_type: "text/plain",
    title: null,
    text_excerpt: "specific bytes 12345",
    links: [],
    link_count_total: 0,
  });
  const { witness } = buildWebWitness({
    consent: DEMA_WEB_WITNESS_GO_PHRASE,
    observation: obs,
  });
  assert.equal(witness.status, 404);
  assert.equal(witness.body_sha256, sha256(body));
  assert.equal(witness.body_byte_length, Buffer.byteLength(body));
  assert.equal(witness.title, null);
  assert.match(witness.what_this_does_not_prove, /scripts were not executed/i);
});

test("WW-04 the executed boundary is declared exactly — network true, everything else pinned", () => {
  const { witness } = buildWebWitness({
    consent: DEMA_WEB_WITNESS_GO_PHRASE,
    observation: observation(),
  });
  assert.deepEqual(witness.boundary, {
    network_used: true,
    method_get_only: true,
    credentials_included: false,
    cookies_sent: false,
    scripts_executed: false,
    filesystem_write_performed: false,
    runtime_execution_performed: false,
    raw_body_retained: false,
  });
  // Boundary must be frozen — a caller cannot quietly widen it after the fact.
  assert.throws(() => { witness.boundary.network_used = false; }, TypeError);
});

test("WW-05 bounds hold: text excerpt capped with a declared flag, links capped with true total", () => {
  const longText = "x".repeat(WEB_WITNESS_TEXT_EXCERPT_MAX_CHARS + 500);
  const manyLinks = Array.from({ length: WEB_WITNESS_MAX_LINKS + 9 },
    (_, i) => `https://example.org/l${i}`);
  const { witness } = buildWebWitness({
    consent: DEMA_WEB_WITNESS_GO_PHRASE,
    observation: observation({
      text_excerpt: longText,
      links: manyLinks,
      link_count_total: manyLinks.length,
    }),
  });
  assert.equal(witness.text_excerpt.length, WEB_WITNESS_TEXT_EXCERPT_MAX_CHARS);
  assert.equal(witness.text_excerpt_truncated, true);
  assert.equal(witness.links.length, WEB_WITNESS_MAX_LINKS);
  assert.equal(witness.link_count_total, WEB_WITNESS_MAX_LINKS + 9);
  assert.deepEqual(verifyWebWitness(witness), { ok: true });
});

test("WW-06 diff of two witnesses states drift honestly", () => {
  const a = buildWebWitness({
    consent: DEMA_WEB_WITNESS_GO_PHRASE,
    observation: observation(),
  }).witness;
  const sameBody = buildWebWitness({
    consent: DEMA_WEB_WITNESS_GO_PHRASE,
    observation: observation({ fetched_at_iso: "2026-08-21T03:00:00.000Z" }),
  }).witness;
  const drifted = buildWebWitness({
    consent: DEMA_WEB_WITNESS_GO_PHRASE,
    observation: observation({
      body_sha256: sha256("changed"),
      body_byte_length: 7,
      status: 500,
    }),
  }).witness;

  const same = diffWebWitness(a, sameBody);
  assert.equal(same.ok, true);
  assert.equal(same.same_body, true);
  assert.equal(same.status_changed, false);

  const drift = diffWebWitness(a, drifted);
  assert.equal(drift.ok, true);
  assert.equal(drift.same_body, false);
  assert.equal(drift.status_changed, true);
  assert.equal(drift.earlier_body_sha256, a.body_sha256);
  assert.equal(drift.later_body_sha256, drifted.body_sha256);

  // A diff over a tampered witness refuses rather than reporting fiction.
  const forged = { ...drifted, body_sha256: sha256("forged-again") };
  const refused = diffWebWitness(a, forged);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "later_witness_invalid");
});

test("WW-07 URL hygiene fails closed: credentials and non-http(s) schemes refuse", () => {
  for (const badUrl of [
    "https://user:pass@example.org/",
    "ftp://example.org/x",
    "file:///etc/passwd",
    "not a url",
  ]) {
    const out = buildWebWitness({
      consent: DEMA_WEB_WITNESS_GO_PHRASE,
      observation: observation({ request_url: badUrl, final_url: badUrl }),
    });
    assert.equal(out.ok, false, `should refuse ${badUrl}`);
    assert.equal(out.reason, "url_not_witnessable");
  }
});
