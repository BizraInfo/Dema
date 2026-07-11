// CANONICAL-JSON-V1-0A — bizra.canonical-json.v1
//
// One authoritative byte contract for FUTURE hash-bearing BIZRA objects.
// Pure and deterministic: no I/O, no crypto, no clock, no mutation of input.
// Everything outside the accepted domain fails closed with a registered error
// code — never a silent coercion (the M5.0 inventory measured legacy
// serializers emitting invalid JSON for `undefined`; v1 refuses instead).
//
// Contract: docs/06-adr/ADR-CANONICAL-JSON-V1.md
// Vectors:  packages/canon/vectors/canonical-json-v1-{valid,invalid}.json
//
// This module must NOT be imported by any production surface in this slice —
// tests and the review gate only (enforced by canonical-json-v1-check.mjs).

import { CanonicalJsonV1Error } from "./canonical-json-errors.js";

export const CANONICAL_JSON_V1_ALGORITHM = "bizra.canonical-json.v1";

// Limits are evidence-based (M5.0 baseline 14a0fff): measured maxima across all
// 47 tracked JSON artifacts, held at <= 25% of each limit.
//   depth 9, bytes 124088, keys 47, array 121, string 5474
export const MAX_CANONICAL_DEPTH = 64;
export const MAX_CANONICAL_BYTES = 1048576;
export const MAX_OBJECT_KEYS = 256;
export const MAX_ARRAY_LENGTH = 1024;
export const MAX_STRING_BYTES = 65536;

const MAX_SAFE = 9007199254740991; // 2^53 - 1

function fail(code, message, path) {
  throw new CanonicalJsonV1Error(code, message, path);
}

function utf8Bytes(s) {
  return Buffer.byteLength(s, "utf8");
}

// Unicode code-point comparison (equals UTF-8 byte order). Deliberately NOT
// UTF-16 code-unit order: for astral keys the two orders disagree.
function compareCodePoints(a, b) {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ca = a.codePointAt(i);
    const cb = b.codePointAt(j);
    if (ca !== cb) return ca - cb;
    i += ca > 0xffff ? 2 : 1;
    j += cb > 0xffff ? 2 : 1;
  }
  return a.length - i - (b.length - j);
}

function canonicalizeString(s, path) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (next < 0xdc00 || next > 0xdfff) {
        fail("string_lone_surrogate", `lone high surrogate U+${c.toString(16)}`, path);
      }
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      fail("string_lone_surrogate", `lone low surrogate U+${c.toString(16)}`, path);
    }
  }
  if (utf8Bytes(s) > MAX_STRING_BYTES) {
    fail("string_bytes_exceeded", `string exceeds ${MAX_STRING_BYTES} UTF-8 bytes`, path);
  }
  // JSON.stringify escaping over a well-formed string matches the contract:
  // \" \\ \b \t \n \f \r and \u00XX for remaining control chars; all other
  // code points pass through raw.
  return JSON.stringify(s);
}

function canonicalizeNumber(n, path) {
  if (!Number.isFinite(n)) {
    fail("number_not_finite", `${String(n)} is not a finite number`, path);
  }
  if (Object.is(n, -0)) return "0";
  if (Number.isInteger(n) && Math.abs(n) > MAX_SAFE) {
    fail("number_unsafe_integer", `integer magnitude exceeds 2^53-1`, path);
  }
  // ECMAScript Number::toString — shortest round-trip decimal form. The
  // Python verifier re-implements this exact layout over repr() digits.
  return String(n);
}

function assertPlainArray(v, path) {
  if (Object.getPrototypeOf(v) !== Array.prototype) {
    fail("object_not_plain", "array with non-Array prototype", path);
  }
  if (Object.getOwnPropertySymbols(v).length > 0) {
    fail("object_symbol_keys", "array carries symbol-keyed properties", path);
  }
  if (v.length > MAX_ARRAY_LENGTH) {
    fail("array_length_exceeded", `array length ${v.length} exceeds ${MAX_ARRAY_LENGTH}`, path);
  }
  for (const name of Object.getOwnPropertyNames(v)) {
    if (name === "length") continue;
    const idx = Number(name);
    if (!Number.isInteger(idx) || idx < 0 || idx >= v.length) {
      fail("object_not_plain", `array carries non-index property "${name}"`, path);
    }
    const desc = Object.getOwnPropertyDescriptor(v, name);
    if (desc.get || desc.set) {
      fail("object_accessor_property", `array index ${name} is an accessor`, path);
    }
  }
  for (let i = 0; i < v.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(v, i)) {
      fail("array_sparse", `hole at index ${i}`, path);
    }
  }
}

function plainObjectKeys(v, path) {
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) {
    fail("object_not_plain", "object with non-plain prototype", path);
  }
  if (Object.getOwnPropertySymbols(v).length > 0) {
    fail("object_symbol_keys", "object carries symbol-keyed properties", path);
  }
  const names = Object.getOwnPropertyNames(v);
  if (names.length > MAX_OBJECT_KEYS) {
    fail("object_keys_exceeded", `${names.length} keys exceed ${MAX_OBJECT_KEYS}`, path);
  }
  for (const name of names) {
    const desc = Object.getOwnPropertyDescriptor(v, name);
    if (desc.get || desc.set) {
      fail("object_accessor_property", `property "${name}" is an accessor`, path);
    }
    if (!desc.enumerable) {
      fail("object_non_enumerable_property", `property "${name}" is not enumerable`, path);
    }
  }
  return names.sort(compareCodePoints);
}

function serialize(v, depth, path, seen) {
  if (v === null) return "null";
  const t = typeof v;
  if (t === "boolean") return v ? "true" : "false";
  if (t === "number") return canonicalizeNumber(v, path);
  if (t === "string") return canonicalizeString(v, path);
  if (t === "undefined") fail("value_undefined", "undefined is outside the v1 domain", path);
  if (t === "function") fail("value_function", "functions are outside the v1 domain", path);
  if (t === "symbol") fail("value_symbol", "symbols are outside the v1 domain", path);
  if (t === "bigint") fail("value_bigint", "BigInt is outside the v1 domain", path);

  // object
  if (depth + 1 > MAX_CANONICAL_DEPTH) {
    fail("depth_exceeded", `nesting exceeds ${MAX_CANONICAL_DEPTH}`, path);
  }
  if (seen.has(v)) fail("circular_reference", "value contains a cycle", path);
  seen.add(v);
  let out;
  if (Array.isArray(v)) {
    assertPlainArray(v, path);
    const parts = new Array(v.length);
    for (let i = 0; i < v.length; i++) {
      parts[i] = serialize(v[i], depth + 1, `${path}[${i}]`, seen);
    }
    out = `[${parts.join(",")}]`;
  } else {
    const keys = plainObjectKeys(v, path);
    const parts = new Array(keys.length);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      parts[i] = `${canonicalizeString(k, path)}:${serialize(v[k], depth + 1, `${path}.${k}`, seen)}`;
    }
    out = `{${parts.join(",")}}`;
  }
  seen.delete(v);
  return out;
}

export function canonicalizeJsonV1(value) {
  const text = serialize(value, 0, "$", new Set());
  if (utf8Bytes(text) > MAX_CANONICAL_BYTES) {
    fail("total_bytes_exceeded", `canonical output exceeds ${MAX_CANONICAL_BYTES} bytes`, "$");
  }
  return text;
}

export function assertCanonicalJsonValueV1(value) {
  canonicalizeJsonV1(value);
}
