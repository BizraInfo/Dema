import test from "node:test";
import assert from "node:assert/strict";

import {
  stableStringify,
  sha256,
} from "../packages/consent/src/consent-common.js";
import {
  PARSER_FUZZ_LITE_SCHEMA,
  runParserFuzzLite,
} from "../packages/consent/src/parser-fuzz-lite.js";

test("runParserFuzzLite passes bounded stableStringify + JSON round-trip properties", () => {
  const report = runParserFuzzLite({ stableStringify, sha256 });
  assert.equal(report.schema, PARSER_FUZZ_LITE_SCHEMA);
  assert.equal(report.ok, true, JSON.stringify(report.failures, null, 2));
  assert.ok(report.iterations >= 400);
});

test("runParserFuzzLite surfaces injected stableStringify failures", () => {
  const report = runParserFuzzLite({
    stableStringify: () => {
      throw new Error("boom");
    },
    sha256,
    iterations: 3,
  });
  assert.equal(report.ok, false);
  assert.ok(report.failures.length > 0);
});
