import { describe, it } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REQUIRED_SYMBOLS,
  STATE,
  linkModuleGraph,
  platformAvailable,
  readMeasuredClaim,
  resolveLocalSpecifier,
  runConsumerProbe,
  runPolicyProbe,
  runRotateExportLinkCheck,
} from "../scripts/review/rotate-export-link-check.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SYMBOL = "rotateAuthorshipKey";
const IMPORTS_SYMBOL = `import { ${SYMBOL} } from "./store.mjs";\n`;

// vm.SourceTextModule needs `node --experimental-vm-modules`. The `npm test`
// script carries it, so these run fully there. The check.mjs TAP entrypoint
// deliberately does not (its exact argv is pinned by
// tests/check-exit-integrity-adversarial.test.js), so under that entrypoint this
// file SKIPS WITH A REASON rather than failing or — worse — reporting a pass it
// did not earn. A skip is visible in TAP output; a vacuous pass is not.
const SUITE = platformAvailable()
  ? {}
  : {
      skip:
        "requires `node --experimental-vm-modules`; exercised by the npm test script",
    };

// Fixture roots live in a temp dir that acts as its own repository root, so
// containment is exercised without writing into the real tree.
function fixtures(files) {
  const root = mkdtempSync(join(tmpdir(), "linker2a-"));
  for (const [name, source] of Object.entries(files)) {
    const target = join(root, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  return root;
}

// Every fixture body sets an observable sentinel. If a body ever runs, the
// sentinel appears on globalThis and the no-evaluation claim is falsified.
let sentinelSeq = 0;
function sentinel() {
  const key = `__LINKER2A_RAN_${sentinelSeq++}__`;
  return { key, line: `globalThis.${key} = true;\n` };
}

async function linkEntry(root, entry = "probe.mjs") {
  const path = join(root, entry);
  return linkModuleGraph({
    source: readFileSync(path, "utf8"),
    path,
    repoRoot: root,
  });
}

/** Link a store fixture through a probe that imports SYMBOL. */
async function probeStore(storeSource, extra = {}) {
  const s = sentinel();
  const root = fixtures({
    "probe.mjs": IMPORTS_SYMBOL,
    "store.mjs": s.line + storeSource,
    ...extra,
  });
  const result = await linkEntry(root);
  assert.equal(globalThis[s.key], undefined, "no store body may evaluate");
  return result;
}

describe("module truth · text that lies about structure cannot link", SUITE, () => {
  it("1-2. direct declaration and named export LINK", async () => {
    assert.equal(
      (await probeStore("export function rotateAuthorshipKey() {}")).state,
      STATE.LINKED,
    );
    assert.equal(
      (
        await probeStore(
          "function rotateAuthorshipKey(){}\nexport { rotateAuthorshipKey };",
        )
      ).state,
      STATE.LINKED,
    );
  });

  it("3-4. rename-away fails, rename-to-canonical links", async () => {
    const away = await probeStore(
      "function rotateAuthorshipKey(){}\nexport { rotateAuthorshipKey as legacyRotate };",
    );
    assert.equal(away.state, STATE.LINK_FAILED);
    assert.match(away.reason, /does not provide an export named/);
    assert.equal(
      (
        await probeStore(
          "function legacyRotate(){}\nexport { legacyRotate as rotateAuthorshipKey };",
        )
      ).state,
      STATE.LINKED,
    );
  });

  it("5-9. comments, strings, templates, regex and division cannot fabricate an export", async () => {
    const decoys = {
      line_comment: "// export function rotateAuthorshipKey() {}\nexport const o = 1;",
      block_comment: "/* export { rotateAuthorshipKey } */\nexport const o = 1;",
      single_quote: "const d = 'export { rotateAuthorshipKey }';\nexport const o = 1;",
      double_quote: 'const d = "export { rotateAuthorshipKey }";\nexport const o = 1;',
      nested_template: "const d = `${`export { rotateAuthorshipKey }`}`;\nexport const o = 1;",
      regex_literal: "const p = /`x`export { rotateAuthorshipKey }/;\nexport const o = 1;",
      regex_class: "const p = /[/'\"`]export { rotateAuthorshipKey }/;\nexport const o = 1;",
      division: "const r = numerator / denominator;\nexport const o = 1;",
      chained_division: "const r = a / b / c;\nexport const o = 1;",
      division_after_call: "const r = f(x) / y;\nexport const o = 1;",
    };
    for (const [label, source] of Object.entries(decoys)) {
      const result = await probeStore(source);
      assert.equal(result.state, STATE.LINK_FAILED, `${label} must not link`);
      assert.match(result.reason, /does not provide an export named/, label);
    }
  });

  it("10. THE CATEGORY ERROR: an invalid direct re-export is text that lies", async () => {
    // `export { X } from "./inner.mjs"` where inner does NOT export X. A text
    // oracle reads the literal `export { rotateAuthorshipKey }` and answers YES.
    // The graph answers NO. This is the defect class that made scanner-hardening
    // non-terminating.
    const result = await probeStore(
      'export { rotateAuthorshipKey } from "./inner.mjs";',
      { "inner.mjs": "export const somethingElse = 1;\n" },
    );
    assert.equal(result.state, STATE.LINK_FAILED);
    assert.match(result.reason, /does not provide an export named/);
  });

  it("11. a valid direct re-export links", async () => {
    const result = await probeStore(
      'export { rotateAuthorshipKey } from "./inner.mjs";',
      { "inner.mjs": "export function rotateAuthorshipKey(){}\n" },
    );
    assert.equal(result.state, STATE.LINKED);
  });

  it("12-13. star re-export: unambiguous links, ambiguous fails", async () => {
    const clean = await probeStore('export * from "./inner.mjs";', {
      "inner.mjs": "export function rotateAuthorshipKey(){}\n",
    });
    assert.equal(clean.state, STATE.LINKED);

    // The same name starred in from two modules is excluded from the namespace,
    // so importing it fails rather than silently picking one.
    const ambiguous = await probeStore(
      'export * from "./a.mjs";\nexport * from "./b.mjs";',
      {
        "a.mjs": "export function rotateAuthorshipKey(){ return 'a'; }\n",
        "b.mjs": "export function rotateAuthorshipKey(){ return 'b'; }\n",
      },
    );
    assert.equal(ambiguous.state, STATE.LINK_FAILED);
  });

  it("14. multi-hop re-export links through every hop", async () => {
    const result = await probeStore('export { rotateAuthorshipKey } from "./h1.mjs";', {
      "h1.mjs": 'export { rotateAuthorshipKey } from "./h2.mjs";\n',
      "h2.mjs": "export function rotateAuthorshipKey(){}\n",
    });
    assert.equal(result.state, STATE.LINKED);
  });

  it("15. a cyclic re-export terminates through the module cache", async () => {
    const result = await probeStore(
      'export { rotateAuthorshipKey } from "./cyc.mjs";\nexport const fromStore = 1;',
      {
        "cyc.mjs":
          'export { fromStore } from "./store.mjs";\nexport function rotateAuthorshipKey(){}\n',
      },
    );
    assert.equal(result.state, STATE.LINKED, "cycle must link, not hang");
  });

  it("23. removing or renaming ANY canonical symbol fails the policy probe", async () => {
    for (const target of REQUIRED_SYMBOLS) {
      const others = REQUIRED_SYMBOLS.filter((s) => s !== target);
      const s = sentinel();
      const root = fixtures({
        "store.mjs":
          s.line +
          others.map((n) => `export const ${n} = 1;`).join("\n") +
          `\nfunction ${target}(){}\nexport { ${target} as renamedAway };\n`,
      });
      const result = await runPolicyProbe({ repoRoot: root, storePath: "store.mjs" });
      assert.equal(result.state, STATE.LINK_FAILED, `${target} removed must fail`);
      assert.deepEqual(result.required_symbols, [...REQUIRED_SYMBOLS]);
      assert.equal(globalThis[s.key], undefined, "no evaluation");
    }
  });
});

describe("resolver contract · uncertainty fails closed, never stubs", SUITE, () => {
  it("16. a missing dependency is RESOLUTION_FAILED", async () => {
    const result = await probeStore('export { rotateAuthorshipKey } from "./gone.mjs";');
    assert.equal(result.state, STATE.RESOLUTION_FAILED);
  });

  it("17. a dependency syntax error is PARSE_FAILED", async () => {
    const result = await probeStore(
      'export { rotateAuthorshipKey } from "./bad.mjs";',
      { "bad.mjs": "export const = ;\n" },
    );
    assert.equal(result.state, STATE.PARSE_FAILED);
  });

  it("entry syntax error is PARSE_FAILED", async () => {
    const root = fixtures({ "probe.mjs": "import { from './x.mjs'\n" });
    assert.equal((await linkEntry(root)).state, STATE.PARSE_FAILED);
  });

  it("18. a relative escape out of the root is PATH_ESCAPE_REFUSED", async () => {
    const outer = mkdtempSync(join(tmpdir(), "linker2a-outer-"));
    writeFileSync(join(outer, "outside.mjs"), "export function rotateAuthorshipKey(){}\n");
    const root = join(outer, "inner-root");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "probe.mjs"), 'import { rotateAuthorshipKey } from "../outside.mjs";\n');
    assert.equal((await linkEntry(root)).state, STATE.PATH_ESCAPE_REFUSED);
  });

  it("a symlink pointing out of the root is refused after realpath", async (t) => {
    const outer = mkdtempSync(join(tmpdir(), "linker2a-sym-"));
    writeFileSync(join(outer, "target.mjs"), "export function rotateAuthorshipKey(){}\n");
    const root = join(outer, "root");
    mkdirSync(root, { recursive: true });
    try {
      symlinkSync(join(outer, "target.mjs"), join(root, "link.mjs"));
    } catch {
      return t.skip("symlink creation unavailable in this environment");
    }
    writeFileSync(join(root, "probe.mjs"), 'import { rotateAuthorshipKey } from "./link.mjs";\n');
    assert.equal((await linkEntry(root)).state, STATE.PATH_ESCAPE_REFUSED);
  });

  it("19. an unknown builtin fails closed", async () => {
    const root = fixtures({ "probe.mjs": 'import { x } from "node:definitely-not-a-builtin";\n' });
    assert.equal((await linkEntry(root)).state, STATE.RESOLUTION_FAILED);
  });

  it("real builtins link from the actual platform namespace, including subpaths", async () => {
    const root = fixtures({
      "probe.mjs":
        'import { join } from "node:path";\nimport assert from "node:assert/strict";\nimport { readFileSync } from "node:fs";\n',
    });
    assert.equal((await linkEntry(root)).state, STATE.LINKED);
  });

  it("a builtin export the platform does not have is not invented", async () => {
    const root = fixtures({
      "probe.mjs": 'import { thisExportDoesNotExist } from "node:path";\n',
    });
    assert.equal((await linkEntry(root)).state, STATE.LINK_FAILED);
  });

  it("20. a package specifier is refused, never stubbed", async () => {
    const root = fixtures({ "probe.mjs": 'import x from "some-package";\n' });
    assert.equal((await linkEntry(root)).state, STATE.UNSUPPORTED_SPECIFIER);
  });

  it("unsupported forms — JSON, and a non-admitted extension — are refused", async () => {
    for (const spec of ["./data.json", "./mod.ts", "./mod.node"]) {
      const root = fixtures({ "probe.mjs": `import x from "${spec}";\n` });
      assert.equal(
        (await linkEntry(root)).state,
        STATE.UNSUPPORTED_SPECIFIER,
        spec,
      );
    }
  });

  it("resolveLocalSpecifier refuses bare and non-admitted extensions directly", () => {
    const root = fixtures({ "a.mjs": "export const a = 1;\n" });
    assert.throws(() => resolveLocalSpecifier("pkg", join(root, "p.mjs"), root), /not a relative/);
    assert.throws(() => resolveLocalSpecifier("./a.json", join(root, "p.mjs"), root), /extension not admitted/);
  });
});

describe("no evaluation · observable sentinels", SUITE, () => {
  it("a linked graph runs no body, at any depth", async () => {
    const a = sentinel();
    const b = sentinel();
    const root = fixtures({
      "probe.mjs": IMPORTS_SYMBOL,
      "store.mjs": a.line + 'export { rotateAuthorshipKey } from "./deep.mjs";\n',
      "deep.mjs": b.line + "export function rotateAuthorshipKey(){}\n",
    });
    const result = await linkEntry(root);
    assert.equal(result.state, STATE.LINKED);
    assert.equal(result.user_modules_evaluated, 0);
    assert.equal(globalThis[a.key], undefined, "store body must not run");
    assert.equal(globalThis[b.key], undefined, "transitive body must not run");
  });

  it("the implementation contains no evaluate() call on user source", () => {
    const source = readFileSync(
      join(REPO, "scripts/review/rotate-export-link-check.mjs"),
      "utf8",
    );
    assert.equal(/\.evaluate\s*\(/.test(source), false, "no evaluate() may exist");
  });
});

describe("21. platform availability fails loudly, never falls back", SUITE, () => {
  it("reports PLATFORM_UNAVAILABLE when SourceTextModule is absent", async () => {
    assert.equal(platformAvailable(), true, "expected --experimental-vm-modules");
    const saved = vm.SourceTextModule;
    try {
      vm.SourceTextModule = undefined;
      assert.equal(platformAvailable(), false);
      const result = await linkModuleGraph({ source: "", path: join(REPO, "x.mjs") });
      assert.equal(result.state, STATE.PLATFORM_UNAVAILABLE);
      const report = await runRotateExportLinkCheck({ repoRoot: REPO });
      assert.equal(report.ok, false, "unavailable platform must fail the gate");
      assert.equal(report.experimental_vm_modules, false);
      assert.ok(report.reasons.some((r) => r.startsWith("platform_unavailable")));
    } finally {
      vm.SourceTextModule = saved;
    }
    assert.equal(platformAvailable(), true, "restored");
  });
});

describe("document truth · bounded Markdown row reading", SUITE, () => {
  const ROW = (text) => `| ${text} | evidence |`;

  it("only an explicit positive [MEASURED] rotate row is a claim", () => {
    assert.equal(
      readMeasuredClaim(ROW("[MEASURED] rotation (AUTHORSHIP-KEY-ROTATE-1B)")).claim,
      "MEASURED",
    );
    assert.equal(
      readMeasuredClaim(
        ROW("[MEASURED] rotation (AUTHORSHIP-KEY-ROTATE-1B) with a blocked failure state"),
      ).claim,
      "MEASURED",
      "descriptive prose must not cancel the marker",
    );
    assert.equal(
      readMeasuredClaim(ROW("[BLOCKED] rotation (AUTHORSHIP-KEY-ROTATE-1A)")).claim,
      "NOT_MEASURED",
    );
    assert.equal(
      readMeasuredClaim(ROW("[MEASURED] something unrelated, BLOCKED")).claim,
      "ABSENT",
    );
    assert.equal(readMeasuredClaim("").claim, "ABSENT");
    assert.equal(
      readMeasuredClaim(
        ROW("**BLOCKED** rotation (AUTHORSHIP-KEY-ROTATE-1A) — Missing for MEASURED: a decision"),
      ).claim,
      "NOT_MEASURED",
      "bare prose MEASURED is not a claim",
    );
  });

  it("a MEASURED claim with an unlinkable store fails the gate", async () => {
    const root = fixtures({
      "packages/receipts/src/authorship-key-store.js": "export const unrelated = 1;\n",
      "docs/CURRENT_LIMITS.md": ROW("[MEASURED] rotation (AUTHORSHIP-KEY-ROTATE-1B)"),
    });
    const report = await runRotateExportLinkCheck({ repoRoot: root });
    assert.equal(report.policy_claim, "MEASURED");
    assert.equal(report.policy_probe.state, STATE.LINK_FAILED);
    assert.equal(report.ok, false);
    assert.ok(
      report.reasons.some((r) => r.startsWith("measured_claim_without_linkable_exports")),
    );
  });

  it("24. no claim plus absent consumer reports state without asserting capability", async () => {
    const root = fixtures({
      "packages/receipts/src/authorship-key-store.js": "export const unrelated = 1;\n",
      "docs/CURRENT_LIMITS.md": ROW("[BLOCKED] rotation (AUTHORSHIP-KEY-ROTATE-1A)"),
    });
    const report = await runRotateExportLinkCheck({ repoRoot: root });
    assert.equal(report.policy_claim, "NOT_MEASURED");
    assert.equal(report.consumer_probe.state, STATE.CONSUMER_ABSENT);
    assert.equal(report.ok, true, "no claim means nothing to bind");
    assert.equal(report.user_modules_evaluated, 0);
  });

  it("consumer absence is never reported as an ordinary pass state", async () => {
    const root = fixtures({ "x.mjs": "export const x = 1;\n" });
    const consumer = await runConsumerProbe({ repoRoot: root });
    assert.equal(consumer.state, STATE.CONSUMER_ABSENT);
    assert.notEqual(consumer.state, STATE.LINKED);
  });
});

describe("22/25. non-vacuous proof against exact #440 sources", SUITE, () => {
  const REF = "9ae3242e25d567e59b0a0e4e1dfb0f27614faa3f";
  const worktree = "/data/bizra/worktrees/linker2a-440ref/Dema";

  it("links the real store graph under a real MEASURED claim", async (t) => {
    // External evidence: a checkout of #440. Genuinely unavailable in a shallow
    // clone, so skip explicitly rather than pass vacuously.
    if (!existsSync(join(worktree, "packages/receipts/src/authorship-key-store.js"))) {
      return t.skip(`#440 checkout unavailable (${REF})`);
    }
    let head = "";
    try {
      head = execFileSync("git", ["-C", worktree, "rev-parse", "HEAD"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return t.skip("git unavailable for ref verification");
    }
    assert.equal(head, REF, "the checkout must be the exact #440 head");

    const document = readMeasuredClaim(
      readFileSync(join(worktree, "docs/CURRENT_LIMITS.md"), "utf8"),
    );
    assert.equal(document.claim, "MEASURED", "#440 promotes rotate to MEASURED");

    const policy = await runPolicyProbe({ repoRoot: worktree });
    assert.equal(policy.state, STATE.LINKED, policy.reason ?? "");
    assert.ok(policy.modules_linked >= 2, "a real transitive graph was linked");
    assert.equal(policy.user_modules_evaluated, 0);

    const consumer = await runConsumerProbe({ repoRoot: worktree });
    assert.equal(consumer.state, STATE.LINKED, consumer.reason ?? "");
    assert.equal(consumer.user_modules_evaluated, 0);
  });

  it("renaming a canonical export away on real #440 bytes fails the bind", async (t) => {
    const storePath = join(worktree, "packages/receipts/src/authorship-key-store.js");
    if (!existsSync(storePath)) return t.skip(`#440 checkout unavailable (${REF})`);
    const real = readFileSync(storePath, "utf8");
    const mutated = real.replace(
      /export\s+(async\s+)?function\s+rotateAuthorshipKey/,
      "function rotateAuthorshipKey",
    );
    assert.notEqual(mutated, real, "the mutation must actually apply");
    const root = fixtures({ "store.mjs": mutated });
    const result = await runPolicyProbe({ repoRoot: root, storePath: "store.mjs" });
    // The mutated store no longer exports it; whether its own dependency
    // resolves inside the fixture root is irrelevant — it must not LINK.
    assert.notEqual(result.state, STATE.LINKED, "removing the export must not link");
  });
});
