import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { htmlSafeJson } from "../packages/core/src/html-safe.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

// --- recovered from PR #161 (5ee2a51), the helper's own contract ------------
describe("htmlSafeJson", () => {
  it("escapes a </script> breakout in a string field", () => {
    const out = htmlSafeJson({ human: "</script><script>alert(1)</script>" });
    assert.equal(out.includes("</script>"), false, "raw </script> must not appear");
    assert.match(out, /\\u003c/, "< must be escaped to \\u003c");
  });

  it("escapes <, >, and & to unicode escapes", () => {
    const out = htmlSafeJson({ v: "a<b>c&d" });
    assert.equal(out.includes("<"), false);
    assert.equal(out.includes(">"), false);
    assert.equal(out.includes("&"), false);
    assert.match(out, /a\\u003cb\\u003ec\\u0026d/);
  });

  it("escapes U+2028 and U+2029 line separators", () => {
    const out = htmlSafeJson({ v: `a${LINE_SEP}b${PARA_SEP}c` });
    assert.equal(out.includes(LINE_SEP), false);
    assert.equal(out.includes(PARA_SEP), false);
    assert.match(out, /\\u2028/);
    assert.match(out, /\\u2029/);
  });

  it("output remains valid JSON that round-trips to the original value", () => {
    const value = { human: "</script>", node: "Node0", n: 7, b: true, arr: [1, "x<y"] };
    assert.deepEqual(JSON.parse(htmlSafeJson(value)), value);
  });

  it("leaves benign payloads structurally equal to JSON.stringify", () => {
    const value = { a: 1, b: "plain", c: [true, null] };
    assert.equal(htmlSafeJson(value), JSON.stringify(value));
  });

  it("fails closed on top-level values JSON.stringify cannot serialize", () => {
    // JSON.stringify returns undefined for a top-level undefined/function/
    // symbol. Rather than crash on .replace or silently emit non-JSON
    // `undefined`, the helper throws an explicit, stable error.
    for (const bad of [undefined, () => {}, Symbol("x")]) {
      assert.throws(
        () => htmlSafeJson(bad),
        (err) =>
          err instanceof TypeError &&
          err.message === "htmlSafeJson: top-level value is not JSON-serializable",
      );
    }
  });
});

// --- dashboard integration: the current-main-specific $-channel repair -------
// Reproduce the embedding the dashboard performs and assert both the breakout
// AND the String.replace $-substitution channel are closed.
function embed(statusPayload) {
  const html = "<html><body></body></html>";
  const injection = `<script>window.__DEMA_STATUS__=${htmlSafeJson(statusPayload)};</script>`;
  // callback replace — a replacement STRING here would interpret $', $`, $$.
  return html.replace("</body>", () => injection + "\n</body>");
}

describe("dashboard script embedding", () => {
  it("neutralizes a </script> breakout, leaving exactly one closing tag", () => {
    const out = embed({ human: "</script><script>window.__RECOVERY_TEST__=1</script>" });
    assert.equal((out.match(/<\/script>/g) || []).length, 1, "only the legitimate closing tag");
    assert.ok(out.includes("\\u003c/script\\u003e"), "payload breakout escaped");
    assert.equal(out.includes("__RECOVERY_TEST__=1</script>"), false, "no live breakout");
  });

  it("escapes raw U+2028 / U+2029 in embedded status", () => {
    const out = embed({ v: `a${LINE_SEP}b${PARA_SEP}c` });
    assert.equal(out.includes(LINE_SEP), false);
    assert.equal(out.includes(PARA_SEP), false);
  });

  for (const pat of ["$'", "$`", "$$"]) {
    it(`preserves literal ${pat} in payload (callback replace closes the $ channel)`, () => {
      const payload = { v: `X${pat}Y` };
      const out = embed(payload);
      const inner = htmlSafeJson(payload).slice(1, -1); // & already escaped; $-seq intact
      assert.ok(out.includes(inner), `${pat} must survive verbatim, not be interpreted`);
    });
  }

  it("$& is harmless because htmlSafeJson escapes &", () => {
    const out = embed({ v: "X$&Y" });
    assert.ok(out.includes("X$\\u0026Y"), "$& arrives as $\\u0026 (inert)");
  });

  it("benign payload round-trips through the embedded JSON", () => {
    const value = { a: 1, b: "plain", node: "Node0" };
    const out = embed(value);
    const m = out.match(/window\.__DEMA_STATUS__=(.*);<\/script>/);
    assert.ok(m, "embedded JSON extractable");
    assert.deepEqual(JSON.parse(m[1]), value);
  });
});

// --- dashboard source contract (static assertions) --------------------------
describe("dashboard.js source integration", () => {
  const src = readFileSync(join(__dirname, "..", "apps", "cli", "src", "commands", "dashboard.js"), "utf8");

  it("imports htmlSafeJson", () => {
    assert.match(src, /import\s*\{\s*htmlSafeJson\s*\}\s*from/);
  });
  it("embeds via htmlSafeJson(statusPayload), not raw JSON.stringify", () => {
    assert.match(src, /htmlSafeJson\(statusPayload\)/);
    assert.equal(src.includes("JSON.stringify(statusPayload)"), false, "no raw JSON.stringify of statusPayload");
  });
  it("uses a callback replacement for </body>, not a replacement string", () => {
    assert.match(src, /html\.replace\(\s*"<\/body>"\s*,\s*\(\)\s*=>/);
  });
});
