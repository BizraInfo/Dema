import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { runSetupWizard } from "../packages/core/src/setup-wizard.js";

function makeStdin(lines) {
  const text = lines.join("\n") + "\n";
  return Readable.from([text]);
}

function makeStdinEOF(linesBeforeEOF) {
  const text = linesBeforeEOF.join("\n") + "\n";
  const r = new Readable({
    read() {
      this.push(text);
      this.push(null);
    }
  });
  return r;
}

function makeStdout() {
  const chunks = [];
  const w = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    }
  });
  w.getOutput = () => chunks.join("");
  return w;
}

async function wizard(lines, defaults = {}, eofAfter = null) {
  const stdin = eofAfter !== null ? makeStdinEOF(lines.slice(0, eofAfter)) : makeStdin(lines);
  const stdout = makeStdout();
  let writtenProfile = null;

  const profile = await runSetupWizard({
    stdin,
    stdout,
    defaults,
    writeProfile: async (p) => {
      writtenProfile = p;
      return "/tmp/test-profile.json";
    }
  });

  return { profile, output: stdout.getOutput(), writtenProfile };
}

test("full happy path — 5 valid answers returns profile with all fields", async () => {
  const { profile, writtenProfile } = await wizard([
    "Mumu",
    "MSI-Titan",
    "en",
    "1",
    "I acknowledge"
  ]);
  assert.ok(profile, "profile returned");
  assert.equal(profile.preferred_name, "Mumu");
  assert.equal(profile.device_label, "MSI-Titan");
  assert.equal(profile.language, "en");
  assert.equal(profile.memory_consent, "local");
  assert.equal(profile.daughter_test_acknowledged, true);
  assert.equal(profile.schema, "bizra.dema.profile.v0.1");
  assert.equal(profile.hidden_autonomy, false);
  assert.ok(profile.created_at);
  assert.deepEqual(profile, writtenProfile);
});

test("enter-defaults path — all empty strings uses defaults", async () => {
  const { profile } = await wizard(["", "", "", "", ""], {
    preferred_name: "DefaultUser",
    language: "fr"
  });
  assert.ok(profile);
  assert.equal(profile.preferred_name, "DefaultUser");
  assert.equal(profile.language, "fr");
  assert.equal(profile.memory_consent, "local");
  assert.equal(profile.daughter_test_acknowledged, false);
  assert.equal(profile.device_label, null);
});

test("invalid language code re-prompts, then accepts valid code", async () => {
  const { profile, output } = await wizard([
    "TestUser",
    "",
    "klingon",
    "en",
    "1",
    ""
  ]);
  assert.ok(profile);
  assert.equal(profile.language, "en");
  assert.match(output, /Invalid language code/);
});

test("invalid memory consent re-prompts, then accepts valid choice", async () => {
  const { profile, output } = await wizard([
    "TestUser",
    "",
    "en",
    "9",
    "2",
    ""
  ]);
  assert.ok(profile);
  assert.equal(profile.memory_consent, "local-encrypted");
  assert.match(output, /Invalid choice/);
});

test("daughter test skipped — profile.daughter_test_acknowledged = false", async () => {
  const { profile } = await wizard(["TestUser", "", "en", "1", ""]);
  assert.ok(profile);
  assert.equal(profile.daughter_test_acknowledged, false);
});

test("daughter test acknowledged — exact phrase sets true", async () => {
  const { profile } = await wizard([
    "TestUser",
    "",
    "en",
    "1",
    "I acknowledge"
  ]);
  assert.ok(profile);
  assert.equal(profile.daughter_test_acknowledged, true);
});

test("EOF on stdin mid-wizard returns null, no write", async () => {
  const { profile, writtenProfile } = await wizard(["TestUser"], {}, 1);
  assert.equal(profile, null);
  assert.equal(writtenProfile, null);
});

test("preferred_name empty with no default re-prompts", async () => {
  const { profile, output } = await wizard(["", "ActualName", "", "en", "1", ""], {});
  assert.ok(profile);
  assert.equal(profile.preferred_name, "ActualName");
  assert.match(output, /A name is required/);
});

test("preferred_name whitespace-only re-prompts", async () => {
  const { profile, output } = await wizard(
    ["   ", "RealName", "", "en", "1", ""],
    {}
  );
  assert.ok(profile);
  assert.equal(profile.preferred_name, "RealName");
  assert.match(output, /A name is required/);
});

test("defaults pre-fill from existing profile — used on Enter", async () => {
  const { profile } = await wizard(["", "", "", "1", ""], {
    preferred_name: "ExistingUser",
    language: "ar"
  });
  assert.ok(profile);
  assert.equal(profile.preferred_name, "ExistingUser");
  assert.equal(profile.language, "ar");
});

test("writeProfile injection — mock receives correct shape", async () => {
  const { writtenProfile } = await wizard(
    ["ShapeTest", "MyDevice", "es", "3", "I acknowledge"]
  );
  assert.ok(writtenProfile);
  assert.equal(writtenProfile.schema, "bizra.dema.profile.v0.1");
  assert.equal(writtenProfile.preferred_name, "ShapeTest");
  assert.equal(writtenProfile.device_label, "MyDevice");
  assert.equal(writtenProfile.language, "es");
  assert.equal(writtenProfile.memory_consent, "none");
  assert.equal(writtenProfile.daughter_test_acknowledged, true);
  assert.equal(writtenProfile.hidden_autonomy, false);
});

test("memory choice 3 maps to 'none'", async () => {
  const { profile } = await wizard(["TestUser", "", "en", "3", ""]);
  assert.ok(profile);
  assert.equal(profile.memory_consent, "none");
});

test("Setup complete message emitted on success", async () => {
  const { output } = await wizard(["TestUser", "", "en", "1", ""]);
  assert.match(output, /Setup complete/);
  assert.match(output, /dema doctor/);
  assert.match(output, /dema status/);
});

test("Setup canceled message emitted on EOF", async () => {
  const { output } = await wizard(["TestUser"], {}, 1);
  assert.match(output, /Setup canceled/);
});
