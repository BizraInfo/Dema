import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  bootstrapFoundationPersist,
  FOUNDATION_PERSIST_CONSENT_PHRASE,
  FOUNDATION_EPHEMERAL_PHRASE,
  BOOTSTRAP_FOUNDATION_PERSIST_SCHEMA,
} from "../packages/core/src/bootstrap-foundation-persist.js";

function freshRoot() {
  return mkdtempSync(join(tmpdir(), "dema-fp-"));
}

test("GO phrase persists the foundation under root (the first write path)", async () => {
  const root = freshRoot();
  const out = await bootstrapFoundationPersist({
    consent: FOUNDATION_PERSIST_CONSENT_PHRASE,
    root,
  });
  assert.equal(out.schema, BOOTSTRAP_FOUNDATION_PERSIST_SCHEMA);
  assert.equal(out.persisted, true);
  assert.equal(out.mode, "local");
  assert.ok(existsSync(join(root, "profile.json")), "profile.json written");
  assert.ok(existsSync(join(root, "config.local.json")), "config written");
  assert.ok(existsSync(join(root, "receipts")), "receipts dir written");
  // domain boundary: write performed under consent; everything else false
  assert.equal(out.boundary.foundation_persist_performed, true);
  assert.equal(out.boundary.consent_verified, true);
  assert.equal(out.boundary.network_used, false);
  assert.equal(out.boundary.federation_used, false);
  assert.equal(out.boundary.model_invocation_performed, false);
  assert.equal(out.boundary.receipt_mint_performed, false);
  assert.equal(out.boundary.token_minted, false);
});

test("SKIP phrase → ephemeral, nothing written, 'nothing was saved'", async () => {
  const root = freshRoot();
  const out = await bootstrapFoundationPersist({
    consent: FOUNDATION_EPHEMERAL_PHRASE,
    root,
  });
  assert.equal(out.persisted, false);
  assert.equal(out.mode, "ephemeral");
  assert.ok(out.message.includes("nothing was saved"));
  assert.deepEqual(readdirSync(root), [], "root stays empty");
  assert.equal(out.boundary.foundation_persist_performed, false);
});

test("wrong/empty phrase → fail-closed, required_phrase advertised, no partial write", async () => {
  const root = freshRoot();
  const out = await bootstrapFoundationPersist({ consent: "go create", root });
  assert.equal(out.persisted, false);
  assert.equal(out.mode, "refused");
  assert.equal(out.reason, "consent_phrase_mismatch");
  assert.equal(out.required_phrase, FOUNDATION_PERSIST_CONSENT_PHRASE);
  assert.deepEqual(readdirSync(root), [], "no partial write on refusal");

  const empty = await bootstrapFoundationPersist({
    consent: "",
    root: freshRoot(),
  });
  assert.equal(empty.persisted, false);
  assert.equal(empty.mode, "refused");
});

test("dryRun with GO phrase → no write", async () => {
  const root = freshRoot();
  const out = await bootstrapFoundationPersist({
    consent: FOUNDATION_PERSIST_CONSENT_PHRASE,
    root,
    dryRun: true,
  });
  assert.equal(out.persisted, false);
  assert.deepEqual(readdirSync(root), [], "dry run writes nothing");
});

test("idempotent: GO twice does not crash and foundation persists", async () => {
  const root = freshRoot();
  await bootstrapFoundationPersist({
    consent: FOUNDATION_PERSIST_CONSENT_PHRASE,
    root,
  });
  const out2 = await bootstrapFoundationPersist({
    consent: FOUNDATION_PERSIST_CONSENT_PHRASE,
    root,
  });
  assert.equal(out2.persisted, true);
  assert.ok(existsSync(join(root, "profile.json")));
});

test("result is deeply frozen", async () => {
  const out = await bootstrapFoundationPersist({
    consent: FOUNDATION_EPHEMERAL_PHRASE,
    root: freshRoot(),
  });
  assert.ok(Object.isFrozen(out));
  assert.ok(Object.isFrozen(out.boundary));
});
