import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readOperatorPreferredName,
  readOperatorLanguage,
  writeOperatorLanguage,
  writeGenesisPreviewCard,
  readGenesisPreviewCards,
  defaultDemaHome,
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
      JSON.stringify({ preferred_name: "Mumu" }),
    );
    assert.equal(await readOperatorPreferredName(home), "Mumu");
  });
});

test("operator-profile · legacy fallback: returns `name` when preferred_name absent", async () => {
  await withHome(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ name: "LegacyName" }),
    );
    assert.equal(await readOperatorPreferredName(home), "LegacyName");
  });
});

test("operator-profile · precedence: preferred_name wins over legacy name", async () => {
  await withHome(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "Mumu", name: "Old" }),
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
      JSON.stringify({ preferred_name: "" }),
    );
    assert.equal(await readOperatorPreferredName(home), null);
  });
});

test("operator-profile · adversarial · non-string preferred_name: returns null (defensive)", async () => {
  await withHome(async (home) => {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: 42 }),
    );
    assert.equal(await readOperatorPreferredName(home), null);
  });
});

test("operator-profile · readOperatorLanguage: profile with language_code → returns it", async () => {
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

test("operator-profile · readOperatorLanguage: profile absent → source='absent'", async () => {
  await withHome(async (home) => {
    const result = await readOperatorLanguage(home);
    assert.equal(result.source, "absent");
    assert.equal(result.language_code, null);
    assert.equal(result.secondary_language_code, null);
  });
});

test("operator-profile · writeOperatorLanguage: preserves preferred_name when merging", async () => {
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
      language_code: "fr",
      secondary_language_code: null,
    });
    const raw = await readFile(join(home, "profile.json"), "utf8");
    const data = JSON.parse(raw);
    assert.equal(
      data.preferred_name,
      "Mumu",
      "preferred_name must be preserved",
    );
    assert.equal(data.language_code, "fr");
  });
});

// ─── writeGenesisPreviewCard / readGenesisPreviewCards ───────────────────────

test("operator-profile · writeGenesisPreviewCard creates state/ subdirectory if absent", async () => {
  await withHome(async (home) => {
    const fakeCard = {
      schema: "bizra.dema.genesis_preview_card.v0.1",
      card_storage: {
        path: "~/.dema/state/genesis-preview-2026-05-19T00:00:00.000Z.json",
      },
    };
    await writeGenesisPreviewCard({ home, card: fakeCard });
    // Verify state/ directory exists
    await access(join(home, "state"));
  });
});

test("operator-profile · writeGenesisPreviewCard returns the full path written", async () => {
  await withHome(async (home) => {
    const fakeCard = {
      schema: "bizra.dema.genesis_preview_card.v0.1",
      card_storage: {
        path: "~/.dema/state/genesis-preview-2026-05-19T12:00:00.000Z.json",
      },
    };
    const written = await writeGenesisPreviewCard({ home, card: fakeCard });
    assert.ok(written.startsWith(home));
    assert.ok(written.includes("genesis-preview-"));
    assert.ok(written.endsWith(".json"));
  });
});

test("operator-profile · readGenesisPreviewCards returns [] when state/ is empty or absent", async () => {
  await withHome(async (home) => {
    const cards = await readGenesisPreviewCards(home);
    assert.deepEqual(cards, []);
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
