#!/usr/bin/env python3
"""CANONICAL-JSON-V1-0A -- independent Python verifier.

Re-implements the bizra.canonical-json.v1 contract with the standard library
only and replays the committed vector corpus byte-for-byte. Divergence from
the JavaScript implementation is a contract failure, not a tolerance.

js_only vectors use JavaScript-specific values (undefined, Symbol, getters)
that have no Python construction; they are skipped and reported as skipped.
"""

import hashlib
import json
import math
import sys
from decimal import Decimal
from pathlib import Path

ALGORITHM = "bizra.canonical-json.v1"
MAX_CANONICAL_DEPTH = 64
MAX_CANONICAL_BYTES = 1048576
MAX_OBJECT_KEYS = 256
MAX_ARRAY_LENGTH = 1024
MAX_STRING_BYTES = 65536
MAX_SAFE = 9007199254740991  # 2^53 - 1

REPO = Path(__file__).resolve().parents[2]
VALID = REPO / "packages/canon/vectors/canonical-json-v1-valid.json"
INVALID = REPO / "packages/canon/vectors/canonical-json-v1-invalid.json"


class CanonErr(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def ecma_number(f):
    """ECMAScript Number::toString layout over shortest round-trip digits.

    Python repr() yields the same shortest digits as JS for binary64; only the
    textual layout differs, so we re-lay repr's digits per ECMA-262.
    """
    sign, digits, exp = Decimal(repr(f)).as_tuple()
    s = "".join(map(str, digits))
    stripped = s.rstrip("0")
    exp += len(s) - len(stripped)
    s = stripped or "0"
    k = len(s)
    n = exp + k
    if k <= n <= 21:
        out = s + "0" * (n - k)
    elif 0 < n <= 21:
        out = s[:n] + "." + s[n:]
    elif -6 < n <= 0:
        out = "0." + "0" * (-n) + s
    else:
        mantissa = s[0] + ("." + s[1:] if k > 1 else "")
        e = n - 1
        out = mantissa + ("e+" + str(e) if e >= 0 else "e-" + str(-e))
    return ("-" if sign else "") + out


def canon_string(s):
    for ch in s:
        if 0xD800 <= ord(ch) <= 0xDFFF:
            raise CanonErr("string_lone_surrogate")
    if len(s.encode("utf-8", "strict")) > MAX_STRING_BYTES:
        raise CanonErr("string_bytes_exceeded")
    return json.dumps(s, ensure_ascii=False)


def canon_int(v):
    if abs(v) > MAX_SAFE:
        raise CanonErr("number_unsafe_integer")
    return str(v)


def serialize(v, depth, seen):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return canon_int(v)
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            raise CanonErr("number_not_finite")
        if v == 0:
            return "0"  # covers -0.0 normalization
        if v.is_integer():
            return canon_int(int(v))
        return ecma_number(v)
    if isinstance(v, str):
        return canon_string(v)
    if isinstance(v, list):
        if depth + 1 > MAX_CANONICAL_DEPTH:
            raise CanonErr("depth_exceeded")
        if id(v) in seen:
            raise CanonErr("circular_reference")
        if len(v) > MAX_ARRAY_LENGTH:
            raise CanonErr("array_length_exceeded")
        seen.add(id(v))
        parts = [serialize(x, depth + 1, seen) for x in v]
        seen.discard(id(v))
        return "[" + ",".join(parts) + "]"
    if isinstance(v, dict):
        if depth + 1 > MAX_CANONICAL_DEPTH:
            raise CanonErr("depth_exceeded")
        if id(v) in seen:
            raise CanonErr("circular_reference")
        keys = list(v.keys())
        if any(not isinstance(k, str) for k in keys):
            raise CanonErr("object_not_plain")
        if len(keys) > MAX_OBJECT_KEYS:
            raise CanonErr("object_keys_exceeded")
        seen.add(id(v))
        parts = [
            canon_string(k) + ":" + serialize(v[k], depth + 1, seen)
            for k in sorted(keys)  # Python str sort == code-point order
        ]
        seen.discard(id(v))
        return "{" + ",".join(parts) + "}"
    raise CanonErr("object_not_plain")


def canonicalize(value):
    text = serialize(value, 0, set())
    if len(text.encode("utf-8")) > MAX_CANONICAL_BYTES:
        raise CanonErr("total_bytes_exceeded")
    return text


def build_generator(g):
    t = g["type"]
    if t == "nest_arrays":
        v = g["leaf"]
        for _ in range(g["depth"]):
            v = [v]
        return v
    if t == "string_repeat":
        return g["char"] * g["count"]
    if t == "key_fanout":
        return {f"k{i:03d}": 0 for i in range(g["count"])}
    if t == "array_fill":
        return [g["value"]] * g["count"]
    if t == "array_of_strings":
        return [g["char"] * g["repeat"]] * g["count"]
    raise ValueError(f"unknown generator {t}")


def build_invalid(construct):
    if construct == "nan":
        return {"n": float("nan")}
    if construct == "infinity":
        return {"n": float("inf")}
    if construct == "negative_infinity":
        return {"n": float("-inf")}
    if construct == "unsafe_integer_pos":
        return 9007199254740992
    if construct == "unsafe_integer_neg":
        return -9007199254740992
    if construct == "huge_integral_float":
        return 1e300
    if construct == "circular_reference":
        o = {"a": {}}
        o["a"]["back"] = o
        return o
    if construct == "depth_exceeded":
        v = 1
        for _ in range(MAX_CANONICAL_DEPTH + 1):
            v = [v]
        return v
    if construct == "string_bytes_exceeded":
        return "a" * (MAX_STRING_BYTES + 1)
    if construct == "object_keys_exceeded":
        return {f"k{i}": 0 for i in range(MAX_OBJECT_KEYS + 1)}
    if construct == "array_length_exceeded":
        return [0] * (MAX_ARRAY_LENGTH + 1)
    if construct == "total_bytes_exceeded":
        return ["a" * 60000] * 20
    if construct == "lone_high_surrogate":
        return "x\ud800y"
    if construct == "lone_low_surrogate":
        return "x\udc00y"
    raise ValueError(f"no python construction for {construct}")


def main():
    failures = []
    valid_doc = json.loads(VALID.read_text(encoding="utf-8"))
    invalid_doc = json.loads(INVALID.read_text(encoding="utf-8"))

    valid_passed = 0
    for vec in valid_doc["vectors"]:
        vid = vec["id"]
        try:
            value = build_generator(vec["generator"]) if "generator" in vec else vec["value"]
            text = canonicalize(value)
            if "expected_canonical" in vec and text != vec["expected_canonical"]:
                failures.append(f"{vid}: canonical text mismatch: {text!r}")
                continue
            raw = text.encode("utf-8")
            if "expected_byte_length" in vec and len(raw) != vec["expected_byte_length"]:
                failures.append(f"{vid}: byte length {len(raw)} != {vec['expected_byte_length']}")
                continue
            digest = "sha256:" + hashlib.sha256(raw).hexdigest()
            if digest != vec["expected_sha256"]:
                failures.append(f"{vid}: hash mismatch: {digest}")
                continue
            if canonicalize(value) != text:
                failures.append(f"{vid}: repeated serialization differs")
                continue
            valid_passed += 1
        except Exception as exc:  # noqa: BLE001 - report, don't crash the run
            failures.append(f"{vid}: unexpected {type(exc).__name__}: {exc}")

    invalid_passed = 0
    skipped = 0
    for vec in invalid_doc["vectors"]:
        vid = vec["id"]
        if vec.get("js_only"):
            skipped += 1
            continue
        try:
            value = build_invalid(vec["construct"])
        except ValueError as exc:
            failures.append(f"{vid}: {exc}")
            continue
        try:
            canonicalize(value)
            failures.append(f"{vid}: accepted, expected {vec['expected_error_code']}")
        except CanonErr as err:
            if err.code == vec["expected_error_code"]:
                invalid_passed += 1
            else:
                failures.append(f"{vid}: code {err.code} != {vec['expected_error_code']}")
        except RecursionError:
            failures.append(f"{vid}: RecursionError instead of fail-closed error")

    result = {
        "schema": "bizra.dema.canonical_json_v1_python_verify.v0.1",
        "algorithm": ALGORITHM,
        "ok": not failures,
        "valid_total": len(valid_doc["vectors"]),
        "valid_passed": valid_passed,
        "invalid_total": len(invalid_doc["vectors"]),
        "invalid_passed": invalid_passed,
        "skipped_js_only": skipped,
        "failures": failures,
    }
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()
