// FUZZ-LITE-1A · bounded deterministic parser property harness
//
// Pure: no I/O, no network, no Math.random — seeded PRNG only.

export const PARSER_FUZZ_LITE_SCHEMA = "bizra.dema.parser_fuzz_lite.v0.1";

export const PARSER_FUZZ_LITE_DEFAULTS = Object.freeze({
  seed: 0x1a_f00d,
  iterations: 400,
  maxDepth: 6,
  maxArrayLength: 8,
  maxObjectKeys: 8,
  maxStringLength: 64,
});

export const PARSER_FUZZ_LITE_CORPUS = Object.freeze([
  null,
  true,
  false,
  0,
  -0,
  1,
  -1,
  0.5,
  "",
  "a",
  "€".repeat(10),
  "\n\t\"\\",
  [],
  [null, 1, "x"],
  {},
  { a: 1 },
  { z: 2, a: 1 },
  { nested: { b: [1, { c: 3 }] } },
]);

export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canonicalJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function pickPrimitive(rng, maxStringLength) {
  const roll = rng();
  if (roll < 0.12) return null;
  if (roll < 0.24) return roll < 0.18;
  if (roll < 0.36) return Math.floor(rng() * 2000) - 1000;
  const len = Math.floor(rng() * maxStringLength);
  const alphabet = "abc€\n\t\"\\_012 ";
  return Array.from({ length: len }, () =>
    alphabet.charAt(Math.floor(rng() * alphabet.length)),
  ).join("");
}

export function generateJsonSafeValue(
  rng,
  {
    maxDepth = PARSER_FUZZ_LITE_DEFAULTS.maxDepth,
    maxArrayLength = PARSER_FUZZ_LITE_DEFAULTS.maxArrayLength,
    maxObjectKeys = PARSER_FUZZ_LITE_DEFAULTS.maxObjectKeys,
    maxStringLength = PARSER_FUZZ_LITE_DEFAULTS.maxStringLength,
    depth = 0,
  } = {},
) {
  const kind = rng();
  if (depth >= maxDepth || kind < 0.15) {
    return pickPrimitive(rng, maxStringLength);
  }
  if (kind < 0.4) {
    const len = Math.floor(rng() * maxArrayLength);
    return Array.from({ length: len }, () =>
      generateJsonSafeValue(rng, {
        maxDepth,
        maxArrayLength,
        maxObjectKeys,
        maxStringLength,
        depth: depth + 1,
      }),
    );
  }
  const keyCount = Math.floor(rng() * maxObjectKeys) + 1;
  const obj = {};
  for (let i = 0; i < keyCount; i++) {
    const key = `k${Math.floor(rng() * 1000)}_${i}`;
    obj[key] = generateJsonSafeValue(rng, {
      maxDepth,
      maxArrayLength,
      maxObjectKeys,
      maxStringLength,
      depth: depth + 1,
    });
  }
  return obj;
}

export function shuffleObjectKeys(value, rng) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const keys = Object.keys(value).sort(() => rng() - 0.5);
  const out = {};
  for (const key of keys) {
    const child = value[key];
    out[key] =
      child && typeof child === "object"
        ? shuffleObjectKeys(child, rng)
        : child;
  }
  return out;
}

/**
 * @param {object} opts
 * @param {(value: unknown) => string} opts.stableStringify
 * @param {(value: string) => string} opts.sha256
 */
export function runParserFuzzLite({
  stableStringify,
  sha256,
  seed = PARSER_FUZZ_LITE_DEFAULTS.seed,
  iterations = PARSER_FUZZ_LITE_DEFAULTS.iterations,
  ...generatorLimits
} = {}) {
  if (typeof stableStringify !== "function" || typeof sha256 !== "function") {
    throw new Error("stableStringify_and_sha256_required");
  }

  const rng = mulberry32(seed);
  const values = [...PARSER_FUZZ_LITE_CORPUS];
  while (values.length < iterations) {
    values.push(generateJsonSafeValue(rng, generatorLimits));
  }

  const failures = [];
  for (const value of values) {
    try {
      const canonical = canonicalJsonValue(value);
      const once = stableStringify(canonical);
      if (typeof once !== "string") {
        throw new Error("stableStringify_not_string");
      }
      const parsed = JSON.parse(once);
      const twice = stableStringify(canonical);
      if (once !== twice) {
        throw new Error("stableStringify_not_deterministic");
      }
      if (stableStringify(parsed) !== once) {
        throw new Error("json_round_trip_drift");
      }
      if (canonical && typeof canonical === "object" && !Array.isArray(canonical)) {
        const shuffled = shuffleObjectKeys(canonical, rng);
        if (stableStringify(shuffled) !== once) {
          throw new Error("stableStringify_key_order_sensitive");
        }
      }
      const hashOnce = sha256(once);
      const hashTwice = sha256(once);
      if (hashOnce !== hashTwice) {
        throw new Error("sha256_not_deterministic");
      }
    } catch (err) {
      failures.push({
        value,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return Object.freeze({
    schema: PARSER_FUZZ_LITE_SCHEMA,
    ok: failures.length === 0,
    iterations: values.length,
    seed,
    failures: Object.freeze(failures.slice(0, 10)),
  });
}
