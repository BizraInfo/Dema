import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import {
  iterateJsonlByteRanges,
  iterateJsonlByteRangesFromStream,
} from "../scripts/chat-cards-gather.mjs";

test("LF records: length includes newline; hash excludes it", () => {
  const buf = Buffer.from('{"a":1}\n{"b":2}\n', "utf8");
  const recs = [...iterateJsonlByteRanges(buf)];
  assert.equal(recs.length, 2);
  assert.equal(recs[0].offset, 0);
  assert.equal(recs[0].length, Buffer.byteLength('{"a":1}\n'));
  assert.equal(recs[0].line, '{"a":1}');
  assert.equal(recs[1].offset, recs[0].length);
  assert.equal(
    createHash("sha256").update(recs[0].line).digest("hex"),
    createHash("sha256").update('{"a":1}').digest("hex"),
  );
});

test("CRLF records: length counts CR+LF; parse line has no CR", () => {
  const buf = Buffer.from('{"a":1}\r\n{"b":2}\r\n', "utf8");
  const recs = [...iterateJsonlByteRanges(buf)];
  assert.equal(recs.length, 2);
  assert.equal(recs[0].length, Buffer.byteLength('{"a":1}\r\n'));
  assert.equal(recs[0].line, '{"a":1}');
  assert.ok(!recs[0].line.includes("\r"));
  const slice = buf.subarray(recs[0].offset, recs[0].offset + recs[0].length);
  assert.equal(slice.toString("utf8").replace(/\r?\n$/, ""), '{"a":1}');
});

test("final record without newline uses exact length (no phantom +1)", () => {
  const buf = Buffer.from('{"a":1}\n{"b":2}', "utf8");
  const recs = [...iterateJsonlByteRanges(buf)];
  assert.equal(recs.length, 2);
  assert.equal(recs[1].length, Buffer.byteLength('{"b":2}'));
  assert.equal(recs[1].offset + recs[1].length, buf.length);
});

test("stream iterator matches buffer ranges across chunk boundaries", async () => {
  const buf = Buffer.from('{"a":1}\r\n{"b":2}\r\n{"c":3}', "utf8");
  const expected = [...iterateJsonlByteRanges(buf)];
  // Force a mid-record split so carry-buffer logic is exercised.
  const stream = Readable.from([buf.subarray(0, 5), buf.subarray(5, 12), buf.subarray(12)]);
  const streamed = [];
  for await (const rec of iterateJsonlByteRangesFromStream(stream)) streamed.push(rec);
  assert.deepEqual(streamed, expected);
});
