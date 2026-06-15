import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { htmlSafeJson } from "../packages/core/src/html-safe.js";

describe("htmlSafeJson", () => {
  it("escapes a </script> breakout in a string field", () => {
    const out = htmlSafeJson({ human: "</script><script>alert(1)</script>" });
    assert.equal(
      out.includes("</script>"),
      false,
      "raw </script> must not appear",
    );
    assert.match(out, /\\u003c/, "< must be escaped to \\u003c");
  });

  it("escapes <, >, and & to unicode escapes", () => {
    const out = htmlSafeJson({ v: "a<b>c&d" });
    assert.equal(out.includes("<"), false);
    assert.equal(out.includes(">"), false);
    assert.equal(out.includes("&"), false);
    assert.match(out, /a\\u003cb\\u003ec\\u0026d/); // a<b>c&d fully escaped, in order
  });

  it("escapes U+2028 and U+2029 line separators", () => {
    const out = htmlSafeJson({ v: "a b c" });
    assert.equal(out.includes(" "), false);
    assert.equal(out.includes(" "), false);
    assert.match(out, /\\u2028/);
    assert.match(out, /\\u2029/);
  });

  it("output remains valid JSON that round-trips to the original value", () => {
    const value = {
      human: "</script>",
      node: "Node0",
      n: 7,
      b: true,
      arr: [1, "x<y"],
    };
    const parsed = JSON.parse(htmlSafeJson(value));
    assert.deepEqual(parsed, value);
  });

  it("leaves benign payloads structurally equal to JSON.stringify", () => {
    const value = { a: 1, b: "plain", c: [true, null] };
    assert.equal(htmlSafeJson(value), JSON.stringify(value));
  });
});
