// DEMA-TALK-PROFILE-1A — `dema talk --profile` CLI smoke tests.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

const SAMPLE = `# Lesson\n\n1. **Daughter Test** — would you subject your family to this output?\n`;

const {
  DEMA_TALK_MODEL: _m,
  DEMA_TALK_PROVIDER: _p,
  ...CLEAN_ENV
} = process.env;

const UNREACHABLE_ENV = {
  DEMA_OLLAMA_URL: "http://127.0.0.1:59999",
  DEMA_LM_STUDIO_URL: "http://127.0.0.1:59998",
  DEMA_LLAMACPP_URL: "http://127.0.0.1:59997",
};

function talk(args, env = {}) {
  return execFileSync("node", [BIN, "talk", ...args], {
    encoding: "utf8",
    env: { ...CLEAN_ENV, DEMA_BANNER_INTERACTIVE: "0", ...UNREACHABLE_ENV, ...env },
  });
}

test("dema talk --profile canon --json returns profile schema and no invocation", () => {
  const d = JSON.parse(talk(["what is SAT?", "--profile", "canon", "--json"]));
  assert.equal(d.schema, "bizra.dema.talk_profile.v0.1");
  assert.equal(d.truth_label, "DEMA_TALK_PROFILE_PREVIEW_ONLY");
  assert.equal(d.profile, "canon");
  assert.equal(d.model_invoked, false);
  assert.ok(d.resolved_provider);
  assert.ok(d.resolved_model);
  assert.ok(d.consent_phrase?.startsWith("GO: invoke local LLM via "));
  assert.equal(d.boundary.model_invocation_performed, false);
});

test("dema talk without --profile keeps talk_loop_preview schema", () => {
  const d = JSON.parse(talk(["what is SAT?", "--json"]));
  assert.equal(d.schema, "bizra.dema.talk_loop_preview.v0.1");
  assert.equal(d.truth_label, "DEMA_TALK_LOOP_PREVIEW_ONLY");
  assert.equal(d.profile, undefined);
});

test("dema talk --profile fast --json resolves route from readiness probe", () => {
  const d = JSON.parse(talk(["hi", "--profile", "fast", "--json"]));
  assert.equal(d.profile, "fast");
  assert.equal(d.live_talk_status, "blocked");
  assert.equal(d.blocking_reason, "provider_unreachable");
});

test("dema talk --profile unknown exits non-zero", () => {
  assert.throws(
    () => talk(["hi", "--profile", "turbo", "--json"]),
    (err) => err.status !== 0,
  );
});

test("dema talk --with-first-lesson --profile canon --json smoke", () => {
  const dir = mkdtempSync(join(tmpdir(), "dema-lesson-"));
  const lessonPath = join(dir, "DEMA_FIRST_LESSON.md");
  writeFileSync(lessonPath, SAMPLE, "utf8");
  const d = JSON.parse(
    talk(
      ["what is SAT?", "--with-first-lesson", "--profile", "canon", "--json"],
      { DEMA_FIRST_LESSON_PATH: lessonPath },
    ),
  );
  assert.equal(d.profile, "canon");
  assert.equal(d.model_invoked, false);
  assert.ok(d.prompt_length_chars > "what is SAT?".length);
});

test("human render discloses profile, route status, and consent phrase", () => {
  const out = talk(["what is SAT?", "--profile", "canon"]);
  assert.match(out, /profile: canon/i);
  assert.match(out, /no model called/i);
  assert.match(out, /consent/i);
  assert.match(out, /blocked|ready/i);
});
