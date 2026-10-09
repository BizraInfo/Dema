import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

import { projectCanonicalStanding, applyPracticeAward } from "../src/lib/companion/receipt-standing.ts";
import { projectWelcome } from "../src/lib/companion/welcome-projection.ts";
import { projectPresence } from "../src/lib/companion/presence-projection.ts";
import { issueLocalSession } from "../src/lib/auth/session-boundary-core.mjs";
import { saveSeasonState } from "../../receipts/src/season-state-store.js";
import { GET as welcomeGet } from "../src/app/api/companion/welcome/route.ts";
import { GET as presenceGet } from "../src/app/api/companion/presence/route.ts";
import { GET as standingGet } from "../src/app/api/companion/standing/route.ts";
import { GET as receiptGet } from "../src/app/api/companion/season-receipt/route.ts";
import { GET as bondGet, POST as bondPost } from "../src/app/api/companion/bond/route.ts";

const SECRET = "local-auth-secret-0123456789abcdef0123456789";
const COMMIT = "68b8efd43925335a4b3f3742ea735baaa501c2b9";
const TREE = "35e50e2df264c841fcc7624af635604bdff9779c";
const HASH = `sha256:${"ab".repeat(32)}`;

const prior = {
  DEMA_HOME: process.env.DEMA_HOME,
  DEMA_LOCAL_AUTH_SECRET: process.env.DEMA_LOCAL_AUTH_SECRET,
};

function restoreEnv() {
  if (prior.DEMA_HOME === undefined) delete process.env.DEMA_HOME;
  else process.env.DEMA_HOME = prior.DEMA_HOME;
  if (prior.DEMA_LOCAL_AUTH_SECRET === undefined) delete process.env.DEMA_LOCAL_AUTH_SECRET;
  else process.env.DEMA_LOCAL_AUTH_SECRET = prior.DEMA_LOCAL_AUTH_SECRET;
}

function authed(path, { method = "GET", body } = {}) {
  process.env.DEMA_LOCAL_AUTH_SECRET = SECRET;
  const session = issueLocalSession(SECRET);
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      host: "localhost:3000",
      cookie: `dema_local_session_v1=${session}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("welcome projection stays UNKNOWN without a season and does not invent a phase", () => {
  const empty = projectWelcome({ listed: { ok: true, season_ids: [] } });
  assert.equal(empty.outcome, "EMPTY");
  assert.equal(empty.items.find((item) => item.field === "mission_phase").value, null);
  assert.equal(empty.items.every((item) => item.truth === "UNKNOWN"), true);
  assert.equal(empty.preferred_name, null);

  const ambiguous = projectWelcome({
    listed: { ok: true, season_ids: ["a", "b"] },
    profile: { preferred_name: "Momo", language_code: "ar", language_source: "profile.json" },
  });
  assert.equal(ambiguous.outcome, "CONTRADICTION");
  assert.equal(ambiguous.reason, "season_ambiguous");
  assert.equal(ambiguous.items.find((item) => item.field === "next_safe_action").value, null);
  assert.equal(ambiguous.preferred_name, "Momo");
  assert.equal(ambiguous.name_receipt_hash, null);
  assert.equal(ambiguous.season_binding, "BLOCKED");
});

test("welcome projection links every season field to the resume receipt", () => {
  const projection = projectWelcome({
    listed: { ok: true, season_ids: ["season-test"] },
    resume: {
      ok: true,
      outcome: "OK",
      receipt_hash: HASH,
      saved_at: "2026-08-05T12:00:00Z",
      continuation: {
        season_id: "season-test",
        mission_phase: "IMPLEMENTATION",
        completed_steps: ["kernel implemented"],
        next_safe_action: "QUALIFY_MINIMUM_SEASON_SAVE_RESUME",
        pending_consent: [{ phrase: "GO: example", scope: "local" }],
        state_hash: HASH,
      },
    },
  });
  assert.equal(projection.outcome, "VERIFIED");
  assert.equal(projection.receipt_hash, HASH);
  for (const item of projection.items) {
    assert.equal(item.receipt_hash, HASH);
    assert.equal(item.truth, "VERIFIED");
  }
  assert.deepEqual(projection.items.find((item) => item.field === "pending_consent").value, [
    { phrase: "GO: example", scope: "local" },
  ]);
});

test("standing is the verified ledger count and stays null when unverified", () => {
  const empty = projectCanonicalStanding({ readable: true, verified: true, entries: [] });
  assert.equal(empty.truth_label, "VERIFIED_EMPTY");
  assert.equal(empty.xp, 0);
  assert.equal(empty.standing, 0);
  assert.equal(empty.xp_granted, false);

  const id = "cd".repeat(32);
  const counted = projectCanonicalStanding({
    readable: true,
    verified: true,
    entries: [{ receipt_id: id }, { receipt_id: "ef".repeat(32) }],
  });
  assert.equal(counted.xp, 2);
  assert.equal(counted.standing, 2);
  assert.equal(counted.receipts[0].receipt_id, id);
  assert.equal(counted.receipts[0].source, "receipts/canonical-ledger.ndjson");

  const unknown = projectCanonicalStanding({ readable: true, verified: false, reason: "ledger_unverified", entries: [{ receipt_id: id }] });
  assert.equal(unknown.truth_label, "UNKNOWN");
  assert.equal(unknown.xp, null);
  assert.equal(unknown.standing, null);
  assert.equal(unknown.receipts.length, 0);

  const malformed = projectCanonicalStanding({ readable: true, verified: true, entries: [{ receipt_id: "nope" }] });
  assert.equal(malformed.truth_label, "UNKNOWN");
  assert.equal(malformed.xp, null);
});

test("practice award does not change earned xp", () => {
  const agents = { truthBinder: { xp: 0, level: 1, practiceXp: 0 } };
  const next = applyPracticeAward(agents, "truthBinder", 25);
  assert.equal(next.truthBinder.xp, 0);
  assert.equal(next.truthBinder.level, 1);
  assert.equal(next.truthBinder.practiceXp, 25);
  assert.equal(agents.truthBinder.practiceXp, 0);
});

test("presence withholds IDLE when no receipt justifies it", () => {
  const empty = projectPresence({
    observations: [{ source: "local_session", observed: true, receipt_hash: null }],
  });
  assert.equal(empty.state, "UNKNOWN");
  assert.equal(empty.reason, "no_receipt_bound_presence_events");
  assert.equal(empty.kernel_empty_state, "IDLE");
  assert.equal(empty.kernel_empty_withheld, true);
  assert.equal(empty.justified_by, null);
  assert.equal(empty.refused[0].admissible, false);

  const refused = projectPresence({
    events: [{ kind: "mission_verified", seq: 1, emitted_at: "2026-08-05T12:00:00Z" }],
  });
  assert.equal(refused.state, "UNKNOWN");
  assert.equal(refused.events_consumed, 0);

  const verified = projectPresence({
    events: [{
      kind: "mission_verified",
      receipt_hash: HASH,
      seq: 0,
      emitted_at: "2026-08-05T12:00:00Z",
    }],
  });
  assert.equal(verified.state, "VERIFIED_DONE");
  assert.equal(verified.justified_by, HASH);
  assert.equal(verified.events_consumed, 1);
});

test("companion routes refuse anonymous reads", async () => {
  process.env.DEMA_LOCAL_AUTH_SECRET = SECRET;
  try {
    const request = new NextRequest("http://localhost:3000/api/companion/welcome", {
      headers: { host: "localhost:3000" },
    });
    const response = await welcomeGet(request);
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.ok, false);
  } finally {
    restoreEnv();
  }
});

test("welcome and season receipt routes read a saved season and nothing else", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-welcome-"));
  process.env.DEMA_HOME = home;
  process.env.DEMA_LOCAL_AUTH_SECRET = SECRET;
  try {
    const saved = await saveSeasonState({
      demaHome: home,
      state: {
        season_id: "season-test",
        mission_id: "NODE0-MINIMUM-SEASON-SAVE-RESUME-1A",
        mission_contract_hash: null,
        mission_phase: "IMPLEMENTATION",
        completed_steps: ["kernel implemented"],
        next_safe_action: "QUALIFY_MINIMUM_SEASON_SAVE_RESUME",
        must_not_repeat: [],
        pending_consent: [{ phrase: "GO: example", scope: "local" }],
        last_receipt_hash: null,
        repository_commit: COMMIT,
        repository_tree: TREE,
        saved_at: "2026-08-05T12:00:00.000Z",
      },
    });
    assert.equal(saved.ok, true, JSON.stringify(saved));

    const welcome = await welcomeGet(authed("/api/companion/welcome"));
    assert.equal(welcome.status, 200);
    const body = await welcome.json();
    assert.equal(body.outcome, "VERIFIED");
    assert.equal(body.receipt_hash, saved.receipt_hash);
    assert.equal(body.items.find((item) => item.field === "mission_phase").value, "IMPLEMENTATION");
    assert.equal(body.items.find((item) => item.field === "next_safe_action").receipt_hash, saved.receipt_hash);
    assert.equal(body.preferred_name, null);
    assert.equal(body.season_binding, "BLOCKED");

    const receipt = await receiptGet(authed(`/api/companion/season-receipt?hash=${encodeURIComponent(saved.receipt_hash)}`));
    assert.equal(receipt.status, 200);
    const receiptBody = await receipt.json();
    assert.equal(receiptBody.receipt.receipt_hash, saved.receipt_hash);

    const missing = await receiptGet(authed(`/api/companion/season-receipt?hash=${HASH}`));
    assert.equal(missing.status, 404);
  } finally {
    restoreEnv();
    await rm(home, { recursive: true, force: true });
  }
});

test("standing route is 0 on an empty ledger and UNKNOWN on a broken one", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-standing-"));
  process.env.DEMA_HOME = home;
  process.env.DEMA_LOCAL_AUTH_SECRET = SECRET;
  try {
    const empty = await standingGet(authed("/api/companion/standing"));
    assert.equal(empty.status, 200);
    const emptyBody = await empty.json();
    assert.equal(emptyBody.truth_label, "VERIFIED_EMPTY");
    assert.equal(emptyBody.xp, 0);
    assert.equal(emptyBody.xp_granted, false);

    await mkdir(join(home, "receipts"), { recursive: true });
    await writeFile(join(home, "receipts", "canonical-ledger.ndjson"), "not-json\n");
    const broken = await standingGet(authed("/api/companion/standing"));
    const brokenBody = await broken.json();
    assert.equal(brokenBody.truth_label, "UNKNOWN");
    assert.equal(brokenBody.xp, null);
    assert.equal(brokenBody.reason, "ledger_unreadable");
  } finally {
    restoreEnv();
    await rm(home, { recursive: true, force: true });
  }
});

test("presence route stays UNKNOWN and bond writes profile.json only", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-bond-"));
  process.env.DEMA_HOME = home;
  process.env.DEMA_LOCAL_AUTH_SECRET = SECRET;
  try {
    const presence = await presenceGet(authed("/api/companion/presence"));
    const presenceBody = await presence.json();
    assert.equal(presenceBody.state, "UNKNOWN");
    assert.equal(presenceBody.kernel_empty_withheld, true);
    assert.equal(presenceBody.refused.some((row) => row.reason === "session_cookie_is_not_a_receipt"), true);

    const phrase = await bondGet(authed("/api/companion/bond"));
    const phraseBody = await phrase.json();
    assert.equal(phraseBody.season_binding, "BLOCKED");
    assert.equal(typeof phraseBody.required_phrase, "string");

    const refused = await bondPost(authed("/api/companion/bond", {
      method: "POST",
      body: { consent: "nope", preferred_name: "Momo", language_code: "ar" },
    }));
    assert.equal(refused.status, 403);
    assert.equal(await readFile(join(home, "profile.json"), "utf8").then(() => true, () => false), false);

    const saved = await bondPost(authed("/api/companion/bond", {
      method: "POST",
      body: { consent: phraseBody.required_phrase, preferred_name: "Momo", language_code: "ar" },
    }));
    assert.equal(saved.status, 200);
    const profile = JSON.parse(await readFile(join(home, "profile.json"), "utf8"));
    assert.equal(profile.preferred_name, "Momo");
    assert.equal(profile.language_code, "ar");
    const savedBody = await saved.json();
    assert.equal(savedBody.season_binding, "BLOCKED");
    assert.equal(await readFile(join(home, "seasons"), "utf8").then(() => true, () => false), false);

    const welcome = await welcomeGet(authed("/api/companion/welcome"));
    const welcomeBody = await welcome.json();
    assert.equal(welcomeBody.preferred_name, "Momo");
    assert.equal(welcomeBody.name_source, "profile.json");
    assert.equal(welcomeBody.name_receipt_hash, null);
    assert.equal(welcomeBody.outcome, "EMPTY");
  } finally {
    restoreEnv();
    await rm(home, { recursive: true, force: true });
  }
});
