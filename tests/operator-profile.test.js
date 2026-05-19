import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readOperatorPreferredName,
  defaultDemaHome
} from "../packages/core/src/operator-profile.js";

async function makeHome() {
  return mkdtemp(join(tmpdir(), "dema-operator-profile-"));
}

async function withHome(fn) {
  const home = await makeHome();
  try {
    await fn(home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

test("operator-profile · canonical: returns preferred_name when set", async () => {
  await withHome(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "Mumu" })
    );
    assert.equal(await readOperatorPreferredName(home), "Mumu");
  });
});

test("operator-profile · legacy fallback: returns `name` when preferred_name absent", async () => {
  await withHome(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ name: "LegacyName" })
    );
    assert.equal(await readOperatorPreferredName(home), "LegacyName");
  });
});

test("operator-profile · precedence: preferred_name wins over legacy name", async () => {
  await withHome(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "Mumu", name: "Old" })
    );
    assert.equal(await readOperatorPreferredName(home), "Mumu");
  });
});

test("operator-profile · adversarial · missing file: returns null without throwing", async () => {
  await withHome(async (home) => {
    assert.equal(await readOperatorPreferredName(home), null);
  });
});

test("operator-profile · adversarial · malformed JSON: returns null without throwing", async () => {
  await withHome(async (home) => {
    await writeFile(join(home, "profile.json"), "{ not: valid json");
    assert.equal(await readOperatorPreferredName(home), null);
  });
});

test("operator-profile · adversarial · empty string preferred_name: returns null", async () => {
  await withHome(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "" })
    );
    assert.equal(await readOperatorPreferredName(home), null);
  });
});

test("operator-profile · adversarial · non-string preferred_name: returns null (defensive)", async () => {
  await withHome(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: 42 })
    );
    assert.equal(await readOperatorPreferredName(home), null);
  });
});

test("operator-profile · defaultDemaHome honors DEMA_HOME env", () => {
  const original = process.env.DEMA_HOME;
  try {
    process.env.DEMA_HOME = "/tmp/fixture-dema-home";
    assert.equal(defaultDemaHome(), "/tmp/fixture-dema-home");
  } finally {
    if (original === undefined) delete process.env.DEMA_HOME;
    else process.env.DEMA_HOME = original;
  }
});
