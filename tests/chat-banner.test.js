import test from "node:test";
import assert from "node:assert/strict";
import { buildChatBanner } from "../packages/core/src/chat-banner.js";

test("banner contains 'DEMA CHAT' and the provided human name", () => {
  const out = buildChatBanner({ human: "Mumu", suppressed: false });
  assert.match(out, /DEMA CHAT/);
  assert.match(out, /Mumu/);
});

test("suppressed: true returns empty string", () => {
  const out = buildChatBanner({ human: "Mumu", suppressed: true });
  assert.equal(out, "");
});

test("banner contains 'Boundary:' and 'Law of Assumption'", () => {
  const out = buildChatBanner({ human: null });
  assert.match(out, /Boundary:/);
  assert.match(out, /Law of Assumption/);
});

test("banner has correct box-drawing structure (top/mid/bot characters)", () => {
  const out = buildChatBanner({ human: "Tester" });
  const lines = out.split("\n");
  assert.match(lines[0], /^┌─+┐$/);
  const botLine = lines[lines.length - 1];
  assert.match(botLine, /^└─+┘$/);
  const midLines = lines.filter((l) => /^├─+┤$/.test(l));
  assert.ok(midLines.length >= 3, "expected at least 3 separator lines");
  const contentLines = lines.filter((l) => l.startsWith("│"));
  assert.ok(contentLines.length > 5, "expected content rows");
});

test("null human falls back to 'operator' label", () => {
  const out = buildChatBanner({ human: null });
  assert.match(out, /operator/);
  assert.doesNotMatch(out, /null/);
});

test("unicode operator name rendered verbatim", () => {
  const out = buildChatBanner({ human: "محمد" });
  assert.match(out, /محمد/);
});
