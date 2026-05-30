// RECEIPT-CHAIN-1B · canonical receipt ledger integration (on-disk chain)
//
// Turns RECEIPT-CHAIN-1A's signed-receipt primitive into a real prev_hash chain
// on disk: $DEMA_HOME/receipts/canonical-ledger.ndjson. This is the slice that
// actually closes the disk-verified gap (~/.dema/receipts being a flat bag).
//
// Master-craftsmanship invariant: NEVER extend a corrupt chain — the existing
// ledger is verified before any append. Append is atomic (tmp+rename).
//
// SCOPE (1B): writes a dedicated canonical ledger file under demaHome. Does NOT
// migrate the legacy flat receipts (pre-canonical; left untouched). No token/
// PoI/economy/federation.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendCanonicalReceipt,
  loadCanonicalLedger,
  verifyCanonicalLedger,
  CANONICAL_LEDGER_RELPATH,
} from "../packages/receipts/src/canonical-ledger.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  loadPublicKey,
} from "../packages/receipts/src/authorship-key-store.js";
import { CANONICAL_RECEIPT_CONSENT_PHRASE } from "../packages/receipts/src/canonical-receipt.js";

let n = 0;
function nextNow() {
  n += 1;
  return `2026-05-30T15:${String(n).padStart(2, "0")}:00.000Z`;
}

async function freshKeyedHome() {
  const home = await mkdtemp(join(tmpdir(), "dema-canon-ledger-"));
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  return home;
}

function appendArgs(home, body, overrides = {}) {
  return {
    canonicalBody: body,
    truthLabel: "MEASURED_LOCAL",
    whatProves: "this body was authored by the operator key",
    whatDoesNotProve: "the body's content is true",
    consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
    demaHome: home,
    now: nextNow(),
    ...overrides,
  };
}

describe("RECEIPT-CHAIN-1B · canonical ledger on disk", () => {
  it("first append is genesis (prev_hash null); second chains to it", async () => {
    const home = await freshKeyedHome();
    try {
      const a = await appendCanonicalReceipt(appendArgs(home, { step: 1 }));
      assert.equal(a.appended, true, `genesis: ${a.error}`);
      assert.equal(a.receipt.prev_hash, null);
      assert.equal(a.length, 1);

      const b = await appendCanonicalReceipt(appendArgs(home, { step: 2 }));
      assert.equal(b.appended, true, `second: ${b.error}`);
      assert.equal(b.receipt.prev_hash, a.receipt.receipt_id);
      assert.equal(b.length, 2);
      assert.equal(b.head, b.receipt.receipt_id);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("loadCanonicalLedger reads the chain back; verifyCanonicalLedger confirms it", async () => {
    const home = await freshKeyedHome();
    try {
      await appendCanonicalReceipt(appendArgs(home, { step: 1 }));
      await appendCanonicalReceipt(appendArgs(home, { step: 2 }));
      await appendCanonicalReceipt(appendArgs(home, { step: 3 }));

      const entries = await loadCanonicalLedger({ demaHome: home });
      assert.equal(entries.length, 3);

      const pubkey = await loadPublicKey(home);
      const v = await verifyCanonicalLedger({
        demaHome: home,
        pubkeyPem: pubkey,
      });
      assert.equal(v.verified, true, `verify: ${v.reason}`);
      assert.equal(v.total_entries, 3);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("empty ledger verifies as an empty chain", async () => {
    const home = await freshKeyedHome();
    try {
      const pubkey = await loadPublicKey(home);
      const v = await verifyCanonicalLedger({
        demaHome: home,
        pubkeyPem: pubkey,
      });
      assert.equal(v.verified, true);
      assert.equal(v.total_entries, 0);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("INVARIANT: refuses to extend a corrupt chain → ledger_chain_broken", async () => {
    const home = await freshKeyedHome();
    try {
      await appendCanonicalReceipt(appendArgs(home, { step: 1 }));
      await appendCanonicalReceipt(appendArgs(home, { step: 2 }));
      // corrupt the ledger on disk: tamper the genesis line's content
      const path = join(home, CANONICAL_LEDGER_RELPATH);
      const lines = (await readFile(path, "utf8")).trim().split("\n");
      const g = JSON.parse(lines[0]);
      g.canonical_body = { step: "FORGED" };
      lines[0] = JSON.stringify(g);
      await writeFile(path, lines.join("\n") + "\n");

      const r = await appendCanonicalReceipt(appendArgs(home, { step: 3 }));
      assert.equal(r.appended, false);
      assert.equal(r.error, "ledger_chain_broken");
      // and nothing was appended
      const entries = await loadCanonicalLedger({ demaHome: home });
      assert.equal(entries.length, 2);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: wrong consent → not appended, ledger untouched", async () => {
    const home = await freshKeyedHome();
    try {
      await appendCanonicalReceipt(appendArgs(home, { step: 1 }));
      const r = await appendCanonicalReceipt(
        appendArgs(home, { step: 2 }, { consent: "nope" }),
      );
      assert.equal(r.appended, false);
      assert.equal(r.error, "consent_required");
      assert.equal((await loadCanonicalLedger({ demaHome: home })).length, 1);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("no PRIVATE KEY / token material in the ledger file", async () => {
    const home = await freshKeyedHome();
    try {
      await appendCanonicalReceipt(appendArgs(home, { step: 1 }));
      const raw = await readFile(join(home, CANONICAL_LEDGER_RELPATH), "utf8");
      assert.ok(!raw.includes("PRIVATE KEY"));
      assert.ok(!/token_minted|federation|private_key/i.test(raw));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed on a corrupt (non-JSON) ledger line → ledger_unreadable, not a throw", async () => {
    const home = await freshKeyedHome();
    try {
      await appendCanonicalReceipt(appendArgs(home, { step: 1 }));
      await writeFile(
        join(home, CANONICAL_LEDGER_RELPATH),
        "this is not json\n",
      );
      const r = await appendCanonicalReceipt(appendArgs(home, { step: 2 }));
      assert.equal(r.appended, false);
      assert.equal(r.error, "ledger_unreadable");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
