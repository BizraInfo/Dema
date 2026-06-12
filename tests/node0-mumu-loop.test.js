import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  symlinkSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  runMumuLoop,
  buildSatPassports,
  SAT_ROLES,
  isSecretName,
  runSatReview,
  SAFE_BOUNDARY,
  expectedConsentPhrase,
  evaluateConsent,
} from "../scripts/node0-mumu-loop.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, "../scripts/node0-mumu-loop.mjs");

// content markers that must NEVER appear in any artifact (proves no content read)
const MARKERS = [
  "SECRET_CONTENT_MARKER",
  "SECRET_ENV_VALUE",
  "PRIVATE_KEY_BODY",
  "WALLET_SEED_PHRASE",
];

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "n0-mumu-root-"));
  mkdirSync(join(root, "proj"), { recursive: true });
  writeFileSync(join(root, "proj", "package.json"), '{"name":"x"}\n');
  writeFileSync(join(root, "proj", "app.js"), "console.log(1)\n");
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(
    join(root, "docs", "notes.md"),
    "SECRET_CONTENT_MARKER must never be read\n",
  );
  mkdirSync(join(root, "research"), { recursive: true });
  writeFileSync(join(root, "research", "idea-notes.md"), "research note\n");
  mkdirSync(join(root, "media"), { recursive: true });
  writeFileSync(join(root, "media", "demo.png"), "png-bytes\n");
  writeFileSync(join(root, ".hidden"), "hidden\n");
  writeFileSync(join(root, ".env"), "API=SECRET_ENV_VALUE\n");
  writeFileSync(join(root, "id_rsa"), "PRIVATE_KEY_BODY\n");
  writeFileSync(join(root, "wallet-seed.txt"), "WALLET_SEED_PHRASE\n");
  writeFileSync(join(root, "creds.pem"), "pem-bytes\n");
  mkdirSync(join(root, "node_modules"), { recursive: true });
  writeFileSync(join(root, "node_modules", "lib.js"), "lib\n");
  mkdirSync(join(root, ".git"), { recursive: true });
  writeFileSync(join(root, ".git", "config"), "git\n");
  try {
    symlinkSync(join(root, "docs", "notes.md"), join(root, "link-to-notes"));
  } catch {
    /* symlink may be unsupported; test stays valid */
  }
  return root;
}

function freshOut() {
  return mkdtempSync(join(tmpdir(), "n0-mumu-out-"));
}

function allArtifactText(outDir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(readFileSync(p, "utf8"));
    }
  };
  walk(outDir);
  return out.join("\n");
}

function baseOpts(root, out, extra = {}) {
  return {
    root,
    out,
    offline: true,
    metadataOnly: true,
    maxFiles: 50000,
    maxDepth: 8,
    testMode: true,
    autoConsentTest: false,
    consent: null,
    ...extra,
  };
}

describe("runMumuLoop — scan limit validation", () => {
  it("fails closed on a non-finite --max-files (e.g. --max-files foo -> NaN)", () => {
    const r = runMumuLoop(
      baseOpts(makeFixture(), freshOut(), {
        autoConsentTest: true,
        maxFiles: NaN,
      }),
    );
    assert.equal(r.ok, false);
    assert.match(r.error, /max_files|scan_limit/);
  });

  it("fails closed on a non-finite --max-depth", () => {
    const r = runMumuLoop(
      baseOpts(makeFixture(), freshOut(), {
        autoConsentTest: true,
        maxDepth: NaN,
      }),
    );
    assert.equal(r.ok, false);
    assert.match(r.error, /max_depth|scan_limit/);
  });
});

describe("runMumuLoop — happy path (test-mode + auto-consent)", () => {
  it("completes, writes artifacts, and never leaks content or secrets", () => {
    const root = makeFixture();
    const out = freshOut();
    try {
      const r = runMumuLoop(baseOpts(root, out, { autoConsentTest: true }));
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.equal(r.sat_verdict, "PASS");
      assert.equal(r.network_mode, "GENESIS_SINGLE_NODE_ACTIVE_NETWORK");
      assert.ok(r.inventory_hash.startsWith("sha256:"));
      assert.ok(r.decision_id && r.decision_id.length === 12);
      assert.ok(r.receipt_chain_head.startsWith("sha256:"));

      // required artifacts exist
      for (const rel of [
        "canon/root-canon.v0.1.json",
        "canon/root-source-receipt.v0.1.json",
        "canon/root-canon-map.v0.1.md",
        "state/network-mode.v0.1.json",
        "state/node0-manifest.v0.1.json",
        "inventory/metadata-inventory.v0.1.json",
        "realm/world-map.v0.1.json",
        "opportunity/value-register.v0.1.json",
        "quest/recommended-quest.v0.1.json",
        "pat/pat-panel.v0.1.json",
        "sat/sat-passports.v0.1.json",
        "sat/sat-review.v0.1.json",
        "urp/local-urp.v0.1.json",
        "urp/shared-roots.local.v0.1.json",
        "covenant/decision.v0.1.json",
        "covenant/consent-request.v0.1.json",
        "action/mumu-today.v0.1.md",
        "action/first-public-proof-package-plan.v0.1.md",
        "receipts/receipt-chain.v0.1.jsonl",
        "poi/impact-preview.v0.1.json",
        "economy/dual-token-preview.v0.1.json",
        "mobile/dema-today.mobile.v0.1.json",
        "reflection/muhasabah-report.v0.1.md",
      ]) {
        assert.ok(existsSync(join(out, rel)), `missing artifact ${rel}`);
      }

      // no private content marker in ANY artifact
      const text = allArtifactText(out);
      for (const m of MARKERS)
        assert.equal(text.includes(m), false, `leaked ${m}`);
      // no secret-like basenames recorded
      for (const s of [".env", "id_rsa", "wallet-seed", "creds.pem"]) {
        assert.equal(text.includes(s), false, `recorded secret-ish name ${s}`);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("runMumuLoop — inventory skip rules", () => {
  it("skips secrets, dotfiles, denied dirs, symlinks and reads no content", () => {
    const root = makeFixture();
    const out = freshOut();
    try {
      runMumuLoop(baseOpts(root, out, { autoConsentTest: true }));
      const inv = JSON.parse(
        readFileSync(
          join(out, "inventory/metadata-inventory.v0.1.json"),
          "utf8",
        ),
      );
      assert.equal(inv.mode, "metadata_only");
      assert.ok(
        inv.skipped_secret_count >= 3,
        `secrets ${inv.skipped_secret_count}`,
      );
      assert.ok(inv.skipped_dotfile_count >= 2);
      assert.ok(inv.skipped_denied_dir_count >= 1);
      // no record is a secret name, and no denied dir descended
      for (const rec of inv.records) {
        assert.equal(
          isSecretName(rec.basename),
          false,
          `recorded ${rec.basename}`,
        );
        assert.equal(rec.relative_path.includes("node_modules"), false);
        assert.equal(rec.relative_path.startsWith("."), false);
      }
      // proj/app.js present (proves real scan happened)
      assert.ok(inv.records.some((r) => r.relative_path === "proj/app.js"));
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("runMumuLoop — consent gate", () => {
  it("fails closed without consent, on bare GO, and on wrong decision id; passes on exact phrase", () => {
    const root = makeFixture();
    const out = freshOut();
    try {
      // discover the decision id deterministically
      const probe = runMumuLoop(baseOpts(root, out, { autoConsentTest: true }));
      const id = probe.decision_id;
      const phrase = expectedConsentPhrase(id);

      const noConsent = runMumuLoop(baseOpts(root, freshOut()));
      assert.equal(noConsent.ok, false);
      assert.equal(noConsent.reason, "consent_required");

      const bareGo = runMumuLoop(baseOpts(root, freshOut(), { consent: "GO" }));
      assert.equal(bareGo.ok, false);
      assert.equal(bareGo.reason, "bare_go_rejected");

      const wrongId = runMumuLoop(
        baseOpts(root, freshOut(), {
          consent: "GO: START MUMU NODE0 QUEST deadbeef0000",
        }),
      );
      assert.equal(wrongId.ok, false);
      assert.equal(wrongId.reason, "consent_phrase_mismatch");

      const correct = runMumuLoop(
        baseOpts(root, freshOut(), { consent: phrase }),
      );
      assert.equal(correct.ok, true, JSON.stringify(correct));
      assert.equal(correct.decision_id, id);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("runMumuLoop — fail-closed boundaries", () => {
  it("requires --root, --metadata-only, and refuses output inside scanned root", () => {
    const root = makeFixture();
    try {
      assert.equal(
        runMumuLoop(baseOpts(null, freshOut(), { autoConsentTest: true }))
          .error,
        "root_required",
      );
      assert.equal(
        runMumuLoop({
          ...baseOpts(root, freshOut(), { autoConsentTest: true }),
          metadataOnly: false,
        }).error,
        "metadata_only_required",
      );
      const inside = runMumuLoop(
        baseOpts(root, join(root, "out"), { autoConsentTest: true }),
      );
      assert.equal(inside.ok, false);
      assert.equal(inside.error, "output_inside_scanned_root");
      // confirm the loop wrote NOTHING inside root
      assert.equal(existsSync(join(root, "out")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("auto-consent-test is rejected without test-mode", () => {
    const root = makeFixture();
    try {
      const r = runMumuLoop({
        ...baseOpts(root, freshOut()),
        testMode: false,
        autoConsentTest: true,
      });
      assert.equal(r.error, "auto_consent_requires_test_mode");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("SAT passports + review", () => {
  it("creates exactly 5 probation passports with zero authority", () => {
    const p = buildSatPassports();
    assert.equal(p.passports.length, 5);
    assert.deepEqual(
      p.passports.map((x) => x.role),
      SAT_ROLES,
    );
    for (const sat of p.passports) {
      assert.equal(sat.status, "probation");
      assert.equal(sat.authority_weight, 0);
      assert.equal(sat.can_validate_local, true);
      assert.equal(sat.can_validate_urp, false);
      assert.equal(sat.can_read_private_file_content, false);
      assert.equal(sat.can_override_user_private_pat, false);
    }
  });

  it("SAT review blocks when any boundary flag is unsafe", () => {
    assert.equal(runSatReview(SAFE_BOUNDARY).verdict, "PASS");
    const unsafe = runSatReview({ ...SAFE_BOUNDARY, token_minted: true });
    assert.equal(unsafe.verdict, "BLOCK");
    assert.ok(unsafe.violations.includes("token_minted"));
  });
});

describe("runMumuLoop — token + determinism", () => {
  it("token_minted is never true anywhere", () => {
    const root = makeFixture();
    const out = freshOut();
    try {
      runMumuLoop(baseOpts(root, out, { autoConsentTest: true }));
      const text = allArtifactText(out);
      assert.equal(/"token_minted"\s*:\s*true/.test(text), false);
      const dual = JSON.parse(
        readFileSync(join(out, "economy/dual-token-preview.v0.1.json"), "utf8"),
      );
      assert.equal(dual.token_minted, false);
      assert.equal(dual.simulation_only, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("test-mode output is deterministic for the same tree", () => {
    const root = makeFixture();
    try {
      const a = runMumuLoop(
        baseOpts(root, freshOut(), { autoConsentTest: true }),
      );
      const b = runMumuLoop(
        baseOpts(root, freshOut(), { autoConsentTest: true }),
      );
      assert.equal(a.inventory_hash, b.inventory_hash);
      assert.equal(a.decision_id, b.decision_id);
      assert.equal(a.receipt_chain_head, b.receipt_chain_head);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("root canon (Layer 0) binding", () => {
  const KNOWN = {
    ROOT_1_THE_MESSAGE:
      "e05b73b933df31964b96255dca673300b01caea3bce8bd283e7f6440a876d3ce",
    ROOT_2_THE_SEED:
      "f95bc6f76acdc9339e005411a17810c50624784f18b55811d8339fcef6601538",
    ROOT_3_THE_THIRD_FACT:
      "1deacd63f42315d7ae5ac426eb33149fae5d37e99c67b3949421b2c5c80cd02d",
  };

  it("binds Node0 to the immutable canon by real sha256 and renders Root Alignment", () => {
    const root = makeFixture();
    const out = freshOut();
    try {
      const r = runMumuLoop(baseOpts(root, out, { autoConsentTest: true }));
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.equal(r.canon_verified, true);
      assert.equal(r.canon_result, "BIZRA_ROOT_CANON_SEALED");

      const canon = JSON.parse(
        readFileSync(join(out, "canon/root-canon.v0.1.json"), "utf8"),
      );
      assert.equal(canon.canon_id, "BIZRA_ROOT_CANON");
      assert.equal(canon.status, "IMMUTABLE");
      assert.equal(canon.verified, true);
      assert.equal(canon.roots.length, 3);

      const receipt = JSON.parse(
        readFileSync(join(out, "canon/root-source-receipt.v0.1.json"), "utf8"),
      );
      assert.equal(receipt.verified, true);
      for (const rt of receipt.roots) {
        assert.equal(rt.sha256_ok, true, `root ${rt.id} hash mismatch`);
        assert.equal(
          rt.actual_sha256,
          KNOWN[rt.id],
          `root ${rt.id} not bound to real source`,
        );
        assert.equal(rt.expected_sha256, KNOWN[rt.id]);
      }

      const today = readFileSync(
        join(out, "action/mumu-today.v0.1.md"),
        "utf8",
      );
      assert.match(today, /## Root Alignment/);
      assert.match(today, /The Message/);
      assert.match(today, /The Seed/);
      assert.match(today, /Third Fact/);
      assert.match(today, /Ihsan guardrail/);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("script hygiene", () => {
  it("imports no network or shell modules", () => {
    const src = readFileSync(SCRIPT, "utf8");
    for (const mod of [
      "node:http",
      "node:https",
      "node:net",
      "node:dgram",
      "node:child_process",
      "node:worker_threads",
      "node:cluster",
    ]) {
      assert.equal(src.includes(`"${mod}"`), false, `forbidden import ${mod}`);
    }
  });

  it("evaluateConsent unit matrix", () => {
    const decision = {
      expected_consent_phrase: "GO: START MUMU NODE0 QUEST abc123abc123",
    };
    assert.equal(evaluateConsent({ consent: null, decision }).granted, false);
    assert.equal(
      evaluateConsent({ consent: "GO", decision }).reason,
      "bare_go_rejected",
    );
    assert.equal(
      evaluateConsent({ consent: "wrong", decision }).reason,
      "consent_phrase_mismatch",
    );
    assert.equal(
      evaluateConsent({ consent: decision.expected_consent_phrase, decision })
        .granted,
      true,
    );
    assert.equal(
      evaluateConsent({ decision, testMode: true, autoConsentTest: true })
        .granted,
      true,
    );
  });
});
