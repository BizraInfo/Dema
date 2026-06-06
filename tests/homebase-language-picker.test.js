import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  LANGUAGE_OPTIONS,
  GREETING_TEMPLATES,
  resolveOperatorLanguage,
} from "../packages/core/src/homebase-language-picker.js";
import {
  readOperatorLanguage,
  writeOperatorLanguage,
} from "../packages/core/src/operator-profile.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function makeHome() {
  return mkdtemp(join(tmpdir(), "dema-lang-picker-"));
}

async function withHome(fn) {
  const home = await makeHome();
  try {
    await fn(home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

function makeStdin(lines) {
  // Build a Readable that emits the given lines (joined with \n) then closes.
  const buf = lines.join("\n") + "\n";
  const r = Readable.from(
    (async function* () {
      yield buf;
    })(),
  );
  r.isTTY = true;
  return r;
}

function makeStdout() {
  let output = "";
  const w = new Writable({
    write(chunk, _enc, cb) {
      output += chunk.toString();
      cb();
    },
  });
  w.isTTY = true;
  Object.defineProperty(w, "output", { get: () => output });
  return w;
}

function nonTtyStdin() {
  const r = Readable.from((async function* () {})());
  r.isTTY = false;
  return r;
}

function nonTtyStdout() {
  let output = "";
  const w = new Writable({
    write(chunk, _enc, cb) {
      output += chunk.toString();
      cb();
    },
  });
  w.isTTY = false;
  Object.defineProperty(w, "output", { get: () => output });
  return w;
}

function eofStdin() {
  // A Readable that immediately ends without any data
  const r = new Readable({
    read() {
      this.push(null);
    },
  });
  r.isTTY = true;
  return r;
}

// ─── LANGUAGE_OPTIONS shape ──────────────────────────────────────────────────

test("LANGUAGE_OPTIONS has exactly 7 entries", () => {
  assert.equal(LANGUAGE_OPTIONS.length, 7);
});

test("LANGUAGE_OPTIONS: each entry has {code, label} strings", () => {
  for (const opt of LANGUAGE_OPTIONS) {
    assert.equal(
      typeof opt.code,
      "string",
      `code must be string: ${JSON.stringify(opt)}`,
    );
    assert.equal(
      typeof opt.label,
      "string",
      `label must be string: ${JSON.stringify(opt)}`,
    );
    assert.ok(opt.code.length > 0, "code must be non-empty");
    assert.ok(opt.label.length > 0, "label must be non-empty");
  }
});

test("LANGUAGE_OPTIONS includes expected codes: ar en fr es ur hi other", () => {
  const codes = LANGUAGE_OPTIONS.map((o) => o.code);
  for (const expected of ["ar", "en", "fr", "es", "ur", "hi", "other"]) {
    assert.ok(codes.includes(expected), `missing code: ${expected}`);
  }
});

test("LANGUAGE_OPTIONS is deep-frozen (mutation rejected)", () => {
  assert.throws(() => {
    LANGUAGE_OPTIONS[0] = { code: "xx", label: "XX" };
  });
  assert.throws(() => {
    LANGUAGE_OPTIONS[0].code = "mutated";
  });
});

// ─── GREETING_TEMPLATES shape ─────────────────────────────────────────────────

const REQUIRED_KEYS = [
  "welcome_back",
  "welcome_new",
  "picker_prompt",
  "selection_confirmed",
  "second_language_prompt",
  "second_language_skipped",
];

test("GREETING_TEMPLATES has entries for all 7 codes", () => {
  const codes = LANGUAGE_OPTIONS.map((o) => o.code);
  for (const code of codes) {
    assert.ok(
      GREETING_TEMPLATES[code] !== undefined,
      `missing template for: ${code}`,
    );
  }
});

test("GREETING_TEMPLATES: each template has all 6 required keys", () => {
  for (const [code, tmpl] of Object.entries(GREETING_TEMPLATES)) {
    for (const key of REQUIRED_KEYS) {
      assert.equal(
        typeof tmpl[key],
        "string",
        `${code}.${key} must be a string`,
      );
    }
  }
});

test("GREETING_TEMPLATES: each template has truth_label", () => {
  const valid = new Set([
    "DECLARED",
    "DECLARED_NEEDS_NATIVE_REVIEW",
    "PLACEHOLDER_PENDING_NATIVE_AUTHOR",
  ]);
  for (const [code, tmpl] of Object.entries(GREETING_TEMPLATES)) {
    assert.ok(
      valid.has(tmpl.truth_label),
      `${code}.truth_label invalid: ${tmpl.truth_label}`,
    );
  }
});

test("Arabic template uses Arabic Unicode characters", () => {
  const ar = GREETING_TEMPLATES.ar;
  // Arabic Unicode block: U+0600–U+06FF (Arabic script)
  const hasArabic = /[؀-ۿ]/.test(
    ar.welcome_back + ar.welcome_new + ar.picker_prompt,
  );
  assert.ok(
    hasArabic,
    "Arabic template must contain Arabic Unicode characters",
  );
});

test("GREETING_TEMPLATES is deep-frozen (mutation rejected)", () => {
  assert.throws(() => {
    GREETING_TEMPLATES.en.welcome_back = "MUTATED";
  });
  assert.throws(() => {
    GREETING_TEMPLATES.en = {};
  });
});

test("English welcome_back contains {name} placeholder", () => {
  assert.ok(GREETING_TEMPLATES.en.welcome_back.includes("{name}"));
});

test("English selection_confirmed contains {language_label} placeholder", () => {
  assert.ok(
    GREETING_TEMPLATES.en.selection_confirmed.includes("{language_label}"),
  );
});

// ─── Algorithm — Law #9 returning-user load ───────────────────────────────────

test("Law #9: profile with language_code 'ar' → silent load, no prompt, returning_user_load=true", async () => {
  await withHome(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "Test", language_code: "ar" }),
    );
    const stdout = makeStdout();
    // Even with TTY stdin, must not prompt
    const stdin = makeStdin([]);
    const result = await resolveOperatorLanguage({
      home,
      stdin,
      stdout,
      resetLanguage: false,
      skipPrompt: false,
    });
    assert.equal(result.language_code, "ar");
    assert.equal(result.language_source, "profile_load");
    assert.equal(result.returning_user_load, true);
    assert.equal(result.candidate_lifecycle.is_returning_user, true);
    assert.equal(result.candidate_lifecycle.is_first_run, false);
    // No output written to stdout (no prompt fired)
    assert.equal(stdout.output, "");
  });
});

test("Law #9: profile without language_code → triggers interactive picker", async () => {
  await withHome(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "Test" }),
    );
    const stdout = makeStdout();
    // Pick "en" (option 2), then skip secondary
    const stdin = makeStdin(["2", ""]);
    const result = await resolveOperatorLanguage({
      home,
      stdin,
      stdout,
      resetLanguage: false,
      skipPrompt: false,
    });
    assert.equal(result.language_code, "en");
    assert.equal(result.language_source, "first_run_picker");
    assert.equal(result.returning_user_load, false);
    assert.equal(result.candidate_lifecycle.is_first_run, true);
    // Prompt was written to stdout
    assert.ok(stdout.output.length > 0, "picker prompt must have been emitted");
  });
});

test("Law #9 escape hatch: resetLanguage=true + valid profile → run picker, language_source=reset_explicit", async () => {
  await withHome(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "Test", language_code: "ar" }),
    );
    const stdout = makeStdout();
    // Pick "fr" (option 3), then skip secondary
    const stdin = makeStdin(["3", ""]);
    const result = await resolveOperatorLanguage({
      home,
      stdin,
      stdout,
      resetLanguage: true,
      skipPrompt: false,
    });
    assert.equal(result.language_code, "fr");
    assert.equal(result.language_source, "reset_explicit");
    assert.equal(result.returning_user_load, false);
    assert.equal(
      result.candidate_lifecycle.onboarding_trigger,
      "reset_explicit",
    );
  });
});

// ─── Algorithm — Law #10 second language ──────────────────────────────────────

test("Law #10: single Enter on second-language prompt → secondary_language_offered=true, secondary_language_code=null", async () => {
  await withHome(async (home) => {
    const stdout = makeStdout();
    // Pick "en" (2), then press Enter (skip secondary)
    const stdin = makeStdin(["2", ""]);
    const result = await resolveOperatorLanguage({
      home,
      stdin,
      stdout,
      resetLanguage: false,
      skipPrompt: false,
    });
    assert.equal(result.secondary_language_offered, true);
    assert.equal(result.secondary_language_code, null);
    assert.equal(result.language_code, "en");
  });
});

test("Law #10: typing 'fr' as secondary → secondary_language_code='fr', offered=true", async () => {
  await withHome(async (home) => {
    const stdout = makeStdout();
    // Pick "en" (2), then "fr" as secondary
    const stdin = makeStdin(["2", "fr"]);
    const result = await resolveOperatorLanguage({
      home,
      stdin,
      stdout,
      resetLanguage: false,
      skipPrompt: false,
    });
    assert.equal(result.secondary_language_offered, true);
    assert.equal(result.secondary_language_code, "fr");
    assert.equal(result.language_code, "en");
  });
});

// ─── Non-TTY safety ──────────────────────────────────────────────────────────

test("Non-TTY + no profile → language_source=non_tty_default, language_code=null, no prompts", async () => {
  await withHome(async (home) => {
    const stdin = nonTtyStdin();
    const stdout = nonTtyStdout();
    const result = await resolveOperatorLanguage({
      home,
      stdin,
      stdout,
      resetLanguage: false,
      skipPrompt: false,
    });
    assert.equal(result.language_code, null);
    assert.equal(result.language_source, "non_tty_default");
    assert.equal(result.candidate_lifecycle.onboarding_trigger, "non_tty");
    // No prompts written to non-TTY stdout
    assert.equal(stdout.output, "");
    assert.ok(result.warnings.length > 0, "should have a non-TTY warning");
  });
});

// ─── EOF mid-picker ───────────────────────────────────────────────────────────

test("EOF before language selection → language_code=null, warnings populated, no profile write", async () => {
  await withHome(async (home) => {
    const stdin = eofStdin();
    const stdout = makeStdout();
    const result = await resolveOperatorLanguage({
      home,
      stdin,
      stdout,
      resetLanguage: false,
      skipPrompt: false,
    });
    assert.equal(result.language_code, null);
    assert.ok(
      result.warnings.some((w) => w.includes("stdin closed")),
      `expected stdin-closed warning, got: ${JSON.stringify(result.warnings)}`,
    );
    // Profile must NOT have been written
    let profileExists = false;
    try {
      await readFile(join(home, "profile.json"), "utf8");
      profileExists = true;
    } catch {
      /* absent — correct */
    }
    assert.equal(
      profileExists,
      false,
      "profile.json must NOT be written on EOF",
    );
  });
});

// ─── Profile R/W ─────────────────────────────────────────────────────────────

test("writeOperatorLanguage: creates profile.json with v0.1 schema when absent", async () => {
  await withHome(async (home) => {
    await writeOperatorLanguage({
      home,
      language_code: "en",
      secondary_language_code: null,
    });
    const raw = await readFile(join(home, "profile.json"), "utf8");
    const data = JSON.parse(raw);
    assert.equal(data.schema, "bizra.dema.profile.v0.1");
    assert.equal(data.language_code, "en");
    assert.equal(data.secondary_language_code, null);
  });
});

test("writeOperatorLanguage: preserves existing fields when merging", async () => {
  await withHome(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({
        schema: "bizra.dema.profile.v0.1",
        preferred_name: "Mumu",
        memory_consent: "local",
      }),
    );
    await writeOperatorLanguage({
      home,
      language_code: "ar",
      secondary_language_code: "en",
    });
    const raw = await readFile(join(home, "profile.json"), "utf8");
    const data = JSON.parse(raw);
    assert.equal(
      data.preferred_name,
      "Mumu",
      "preferred_name must be preserved",
    );
    assert.equal(
      data.memory_consent,
      "local",
      "memory_consent must be preserved",
    );
    assert.equal(data.language_code, "ar");
    assert.equal(data.secondary_language_code, "en");
  });
});

test("Atomic write: .tmp file cleaned up after rename", async () => {
  await withHome(async (home) => {
    await writeOperatorLanguage({ home, language_code: "fr" });
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(home);
    const tmpFiles = files.filter((f) => f.endsWith(".tmp"));
    assert.equal(tmpFiles.length, 0, "no .tmp files should remain after write");
  });
});

// ─── readOperatorLanguage ─────────────────────────────────────────────────────

test("readOperatorLanguage with profile present + language_code → returns it", async () => {
  await withHome(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ language_code: "ar", secondary_language_code: "en" }),
    );
    const result = await readOperatorLanguage(home);
    assert.equal(result.language_code, "ar");
    assert.equal(result.secondary_language_code, "en");
    assert.equal(result.source, "profile_json");
  });
});

test("readOperatorLanguage with profile absent → returns {source:'absent'}", async () => {
  await withHome(async (home) => {
    const result = await readOperatorLanguage(home);
    assert.equal(result.source, "absent");
    assert.equal(result.language_code, null);
  });
});

test("readOperatorLanguage: legacy 'language' field fallback", async () => {
  await withHome(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ language: "fr" }),
    );
    const result = await readOperatorLanguage(home);
    assert.equal(result.language_code, "fr");
    assert.equal(result.source, "profile_json");
  });
});

test("readOperatorLanguage: malformed JSON → source=malformed, null codes", async () => {
  await withHome(async (home) => {
    await writeFile(join(home, "profile.json"), "{ not valid json");
    const result = await readOperatorLanguage(home);
    assert.equal(result.source, "malformed");
    assert.equal(result.language_code, null);
  });
});

// ─── skipPrompt=true (banner context) ────────────────────────────────────────

test("skipPrompt=true on TTY + no profile → non_tty_default, no output", async () => {
  await withHome(async (home) => {
    const stdin = makeStdin(["would-not-be-read"]);
    const stdout = makeStdout();
    const result = await resolveOperatorLanguage({
      home,
      stdin,
      stdout,
      skipPrompt: true,
    });
    assert.equal(result.language_code, null);
    assert.equal(result.language_source, "non_tty_default");
    assert.equal(stdout.output, "");
  });
});
