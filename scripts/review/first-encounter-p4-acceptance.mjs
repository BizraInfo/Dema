#!/usr/bin/env node
/**
 * DEMA-FIRST-ENCOUNTER-1A · P4 — acceptance harness.
 *
 * Checks the sprint's stated acceptance criteria against a RUNNING production
 * server. Read-only over HTTP; asserts nothing about code it cannot observe.
 *
 *   PORT=3123 npm --prefix packages/dema-ui start &
 *   node scripts/review/first-encounter-p4-acceptance.mjs http://127.0.0.1:3123
 *
 * Exit 0 only if every criterion passes.
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const results = [];
const check = (group, name, ok, detail = "") => results.push({ group, name, ok, detail });

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, text: await res.text() };
};
const postJson = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};

/* ── entry ──────────────────────────────────────────────────────────────── */
const home = await get("/");
check("entry", "homepage responds", home.status === 200, `HTTP ${home.status}`);
check("entry", "no chatbot copy", !/how can i help/i.test(home.text));
check("entry", "mission-first headline", home.text.includes("What are we trying to accomplish"));
check("entry", "ROOT-3 definition rendered", home.text.includes("visible bridge"));

const realm = await get("/realm");
check("entry", "game surface preserved at /realm", realm.status === 200, `HTTP ${realm.status}`);

/* ── inventory ──────────────────────────────────────────────────────────── */
const inv = await get("/api/first-encounter/inventory");
check("inventory", "inventory responds", inv.status === 200, `HTTP ${inv.status}`);
const payload = JSON.parse(inv.text);
check("inventory", "displays 30 files", payload.inventory.file_count === 30, String(payload.inventory.file_count));

const keys = new Set();
for (const f of payload.inventory.files) for (const k of Object.keys(f)) keys.add(k);
const expected = "extension,file_hash,modified_time,relative_path,size";
check("inventory", "metadata only — exactly 5 fields", [...keys].sort().join(",") === expected, [...keys].sort().join(","));

const FORBIDDEN = ["content", "preview", "text", "excerpt", "body", "snippet", "embedding"];
const raw = inv.text;
check(
  "inventory",
  "no content-shaped field in the wire payload",
  !payload.inventory.files.some((f) => FORBIDDEN.some((k) => k in f)),
);
check("inventory", "corpus manifest hash visible", typeof payload.contract.scope.manifest_hash === "string");

/* ── security ───────────────────────────────────────────────────────────── */
check("security", "challenge key absent from payload", !raw.includes("CHALLENGE_KEY"));
check("security", "no answer-key content leaked", !raw.includes("REQ-013") && !raw.includes("SEC-004"));
check(
  "security",
  "declared scope is the corpus dir, not its parent",
  payload.contract.scope.root_real_path.endsWith("/corpus"),
  payload.contract.scope.root_real_path,
);
check("security", "no symlink followed / nothing skipped unexpectedly", Array.isArray(payload.skipped));

/* ── consent ────────────────────────────────────────────────────────────── */
const c = payload.contract;
check("consent", "exact path scope visible", c.scope.root_real_path.startsWith("/"));
check("consent", "exact file count visible", c.scope.file_count === 30);
check("consent", "exact permission visible", c.permission.effect === "READ_FILE_CONTENT");
check("consent", "write not permitted", c.permission.write_permitted === false);
check("consent", "delete not permitted", c.permission.delete_permitted === false);
check("consent", "network not permitted", c.permission.network_permitted === false);
check("consent", "scope does not transfer", c.permission.transfers_to_other_scopes === false);
check("consent", "reject option present", c.reject_option.available === true);

const empty = await postJson("/api/first-encounter/admit", { phrase: "" });
check("consent", "no phrase → REFUSED", empty.json.verdict.state === "REFUSED");
check("consent", "no phrase → content not admitted", empty.json.verdict.content_admitted === false);
check("consent", "refusal is HTTP 403", empty.status === 403, `HTTP ${empty.status}`);

const fuzzy = await postJson("/api/first-encounter/admit", { phrase: c.required_phrase.toLowerCase() });
check("consent", "near-miss phrase → REFUSED (no fuzzy consent)", fuzzy.json.verdict.state === "REFUSED");

const wider = await postJson("/api/first-encounter/admit", {
  phrase: `READ 30 FILES IN ${c.scope.root_real_path.replace(/\/corpus$/, "")}`,
});
check("consent", "phrase for a wider scope → REFUSED", wider.json.verdict.state === "REFUSED");

const exact = await postJson("/api/first-encounter/admit", { phrase: c.required_phrase });
check("consent", "exact phrase → ADMITTED", exact.json.verdict.state === "ADMITTED");
check("consent", "granted scope equals declared scope", exact.json.verdict.granted_scope?.root_real_path === c.scope.root_real_path);
check("consent", "granted count equals declared count", exact.json.verdict.granted_scope?.file_count === 30);
check(
  "consent",
  "admission still reads no content (P4 stops at the verdict)",
  !JSON.stringify(exact.json).includes("REQ-013"),
);

/* ── report ─────────────────────────────────────────────────────────────── */
let lastGroup = "";
for (const r of results) {
  if (r.group !== lastGroup) {
    console.log(`\n${r.group.toUpperCase()}`);
    lastGroup = r.group;
  }
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  [${r.detail}]` : ""}`);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} criteria passed`);
process.exit(failed.length === 0 ? 0 : 1);
