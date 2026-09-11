import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildPhysicalState,
  buildEventForAppend,
  collectAncestorContexts,
  collectContext,
} from "../scripts/context-spine.mjs";

import { appendEvent } from "../packages/core/src/event-log.js";

import {
  buildContextEvent,
  buildContextLock,
  parseContextContract,
  renderProjection,
  resolveContext,
  verifyContextLock,
  verifyProjection,
  verifyResolvedContext,
} from "../packages/core/src/context-spine.js";

const AUTHORITY = {
  capabilities: {
    runtime: { default: "DENY", grantability: "HUMAN_EXPLICIT" },
    model_invocation: { default: "DENY", grantability: "HUMAN_EXPLICIT" },
    external_write: { default: "DENY", grantability: "HUMAN_EXPLICIT" },
    signing: { default: "DENY", grantability: "HUMAN_EXPLICIT" },
  },
  network: { default: "NONE", max_grantable: "BOUNDED_REMOTE" },
  never_delegable: ["self_expand_authority", "fabricate_consent"],
};

const LEGACY_AUTHORITY = {
  runtime: false,
  model_invocation: false,
  external_write: false,
  signing: false,
  network_mode: "NONE",
};

function authorityWith({ capabilities = {}, network = {}, never_delegable } = {}) {
  return {
    capabilities: { ...AUTHORITY.capabilities, ...capabilities },
    network: { ...AUTHORITY.network, ...network },
    never_delegable: [...(never_delegable ?? AUTHORITY.never_delegable)],
  };
}

const RULES = {
  context_inherited: true,
  authority_human_granted: true,
  evidence_observed: true,
  memory_derived: true,
  tool_projection_only: true,
};

function contextMarkdown({
  scope,
  context_id,
  parent_context_id = null,
  authority = AUTHORITY,
  schema = "bizra.context.contract.v2",
  authority_ceiling = LEGACY_AUTHORITY,
  rules = RULES,
  required_mission_for = ["write", "runtime", "external"],
} = {}) {
  const contract = {
    schema,
    scope,
    context_id,
    parent_context_id,
    rules,
    required_mission_for,
    invariants: ["context-is-inherited", "authority-is-human-granted"],
  };
  if (schema === "bizra.context.contract.v1") contract.authority_ceiling = authority_ceiling;
  else contract.authority = authority;
  return [
    `# ${scope} context`,
    "",
    "<!-- BIZRA_CONTEXT",
    JSON.stringify(contract),
    "-->",
    "",
    `${scope} meaning is stable context, not current runtime state.`,
    "",
  ].join("\n");
}

function layers(overrides = {}) {
  const node = contextMarkdown({
    scope: "node",
    context_id: "bizra://node",
    ...overrides.node,
  });
  const repository = contextMarkdown({
    scope: "repository",
    context_id: "bizra://node/dema",
    parent_context_id: "bizra://node",
    ...overrides.repository,
  });
  const subtree = contextMarkdown({
    scope: "subtree",
    context_id: "bizra://node/dema/packages-core",
    parent_context_id: "bizra://node/dema",
    ...overrides.subtree,
  });
  return [
    { path: "/node/BIZRA.md", content: node },
    { path: "/repo/BIZRA.md", content: repository },
    { path: "/repo/packages/core/BIZRA.md", content: subtree },
  ];
}

function recursiveLayers() {
  const entries = [
    ["/node/BIZRA.md", { scope: "node", context_id: "bizra://node" }],
    [
      "/repo/BIZRA.md",
      { scope: "repository", context_id: "bizra://node/dema", parent_context_id: "bizra://node" },
    ],
    [
      "/repo/packages/BIZRA.md",
      { scope: "subtree", context_id: "bizra://node/dema/packages", parent_context_id: "bizra://node/dema" },
    ],
    [
      "/repo/packages/core/BIZRA.md",
      {
        scope: "subtree",
        context_id: "bizra://node/dema/packages-core",
        parent_context_id: "bizra://node/dema/packages",
      },
    ],
    [
      "/repo/packages/core/runtime/BIZRA.md",
      {
        scope: "subtree",
        context_id: "bizra://node/dema/packages-core-runtime",
        parent_context_id: "bizra://node/dema/packages-core",
      },
    ],
  ];
  return entries.map(([path, contract]) => ({ path, content: contextMarkdown(contract) }));
}

const MISSION = {
  mission_id: "TASK-081",
  contract_version: "1",
  lease_id: "BIZRA-CONTEXT-SPINE-1A",
};

const SESSION = {
  tool: "codex",
  session_id: "session-context-spine-1a",
  started_at: "2026-09-05T00:00:00.000Z",
};

const PHYSICAL_STATE = {
  cwd: "/repo/packages/core",
  repo_root: "/repo",
  repo: "Dema",
  branch: "main",
  head: "a".repeat(40),
  tree: "b".repeat(40),
  dirty_digest: `sha256:${"c".repeat(64)}`,
};

test("resolves one deterministic inherited context and independently verifies it", () => {
  const input = { layers: layers(), operation_class: "read" };
  const first = resolveContext(input);
  const second = resolveContext(input);

  assert.equal(first.ok, true);
  assert.equal(first.authority_delta, 0);
  assert.match(first.effective_context_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(
    first.context_chain.map((entry) => entry.scope),
    ["node", "repository", "subtree"],
  );
  assert.equal(first.effective_context_sha256, second.effective_context_sha256);
  assert.equal(verifyResolvedContext(first, input).ok, true);
});

test("authority semantics separate defaults, grants, hard denial, and migration", () => {
  const withoutLease = resolveContext({ layers: layers(), operation_class: "write" });
  assert.equal(withoutLease.ok, false);
  assert.equal(withoutLease.authority_status.decision, "DEFAULT_DENY_WITHOUT_LEASE");
  assert.ok(withoutLease.blocked_by.includes("DEFAULT_DENY_WITHOUT_LEASE"));
  assert.ok(withoutLease.blocked_by.includes("MISSION_REQUIRED"));

  const withLease = resolveContext({ layers: layers(), operation_class: "write", mission: MISSION });
  assert.equal(withLease.ok, true);
  assert.equal(withLease.authority_status.decision, "ELIGIBLE_UNDER_STRUCTURALLY_VALID_DECLARED_LEASE");
  assert.equal(withLease.authority_status.lease_structure, "VALID");
  assert.equal(withLease.authority_status.human_authenticity, "UNATTESTED");
  assert.equal(withLease.authority_status.lease_freshness, "UNATTESTED");
  assert.equal(withLease.authority_status.actor_identity_assurance, "DECLARED");
  assert.equal(withLease.authority_status.active_effect, false);
  assert.equal(withLease.active_effect, false);
  assert.equal(withLease.authority_delta, 0);

  const networkWithoutLease = resolveContext({ layers: [layers()[0]], operation_class: "network" });
  assert.equal(networkWithoutLease.ok, false);
  assert.equal(networkWithoutLease.authority_status.decision, "DEFAULT_DENY_WITHOUT_LEASE");
  assert.ok(networkWithoutLease.blocked_by.includes("DEFAULT_DENY_WITHOUT_LEASE"));
  const networkWithLease = resolveContext({
    layers: [layers()[0]],
    operation_class: "network",
    mission: MISSION,
  });
  assert.equal(networkWithLease.ok, true);
  assert.equal(networkWithLease.authority_status.decision, "ELIGIBLE_FOR_BOUNDED_SCOPE_ADJUDICATION");
  assert.equal(networkWithLease.authority_status.context_network_max_grantable, "BOUNDED_REMOTE");
  assert.equal(networkWithLease.authority_status.network_scope_adjudication, "REQUIRED");
  assert.equal(networkWithLease.authority_status.active_network_effect, false);
  assert.equal(networkWithLease.authority_status.active_effect, false);
  assert.equal(networkWithLease.boundary.network_used, false);
  assert.equal(networkWithLease.active_effect, false);

  const hardDeny = authorityWith({
    capabilities: { runtime: { default: "DENY", grantability: "NEVER" } },
  });
  const hardDenied = resolveContext({
    layers: layers({ repository: { authority: hardDeny }, subtree: { authority: hardDeny } }),
    operation_class: "runtime",
    mission: MISSION,
  });
  assert.equal(hardDenied.ok, false);
  assert.equal(hardDenied.authority_status.decision, "HARD_DENY");
  assert.ok(hardDenied.blocked_by.includes("AUTHORITY_HARD_DENY"));

  const migrated = parseContextContract(
    contextMarkdown({
      schema: "bizra.context.contract.v1",
      scope: "node",
      context_id: "bizra://legacy-node",
      authority_ceiling: LEGACY_AUTHORITY,
    }),
    "/legacy/BIZRA.md",
  );
  assert.equal(migrated.authority_migration, "V1_MIGRATION_EXPLICIT");
  assert.deepEqual(migrated.authority.capabilities.runtime, {
    default: "DENY",
    grantability: "HUMAN_EXPLICIT",
  });
  assert.deepEqual(migrated.authority.network, { default: "NONE", max_grantable: "NONE" });
});

test("authority folding is restrictive and malformed contracts fail closed", () => {
  const narrowedAuthority = authorityWith({
    capabilities: { runtime: { default: "DENY", grantability: "NEVER" } },
    network: { default: "NONE", max_grantable: "NONE" },
  });
  const narrowed = resolveContext({
    layers: layers({ repository: { authority: narrowedAuthority }, subtree: { authority: narrowedAuthority } }),
    operation_class: "read",
  });
  assert.equal(narrowed.ok, true);
  assert.equal(narrowed.effective_context.authority.capabilities.runtime.grantability, "NEVER");
  assert.equal(narrowed.effective_context.authority.network.max_grantable, "NONE");

  const runtimeNarrowAuthority = authorityWith({
    capabilities: { runtime: { default: "DENY", grantability: "NEVER" } },
  });
  const broadenedGrantability = resolveContext({
    layers: layers({
      repository: { authority: runtimeNarrowAuthority },
      subtree: { authority: AUTHORITY },
    }),
    operation_class: "read",
  });
  assert.equal(broadenedGrantability.ok, false);
  assert.ok(broadenedGrantability.blocked_by.includes("AUTHORITY_BROADENING"));

  const networkNarrowAuthority = authorityWith({
    network: { default: "NONE", max_grantable: "NONE" },
  });
  const broadenedNetwork = resolveContext({
    layers: layers({
      repository: { authority: networkNarrowAuthority },
      subtree: { authority: AUTHORITY },
    }),
    operation_class: "read",
  });
  assert.ok(broadenedNetwork.blocked_by.includes("AUTHORITY_BROADENING"));

  assert.throws(
    () => parseContextContract(
      contextMarkdown({
        scope: "node",
        context_id: "bizra://malformed",
        authority: authorityWith({ capabilities: { runtime: { default: "DENY" } } }),
      }),
      "/malformed/BIZRA.md",
    ),
    /authority.*grantability.*invalid/i,
  );
  assert.throws(
    () => parseContextContract(
      contextMarkdown({
        scope: "node",
        context_id: "bizra://malformed-network",
        authority: authorityWith({ network: { default: "BOUNDED_REMOTE", max_grantable: "NONE" } }),
      }),
      "/malformed-network/BIZRA.md",
    ),
    /default exceeds max_grantable/i,
  );
});

test("a child cannot broaden authority or contradict constitutional rules", () => {
  const broadened = resolveContext({
    layers: layers({
      subtree: {
        authority: {
          ...AUTHORITY,
          capabilities: {
            ...AUTHORITY.capabilities,
            model_invocation: { default: "ALLOW", grantability: "HUMAN_EXPLICIT" },
          },
        },
      },
    }),
    operation_class: "read",
  });
  assert.equal(broadened.ok, false);
  assert.ok(broadened.blocked_by.includes("AUTHORITY_BROADENING"));

  const contradiction = resolveContext({
    layers: layers({
      subtree: { rules: { ...RULES, memory_derived: false } },
    }),
    operation_class: "read",
  });
  assert.equal(contradiction.ok, false);
  assert.ok(contradiction.blocked_by.includes("CONTEXT_CONTRADICTION"));
});

test("write-bound context requires a mission and memory cannot override disk", () => {
  const withoutMission = resolveContext({
    layers: layers(),
    operation_class: "write",
  });
  assert.equal(withoutMission.ok, false);
  assert.ok(withoutMission.blocked_by.includes("MISSION_REQUIRED"));

  const withStaleMemory = resolveContext({
    layers: layers(),
    operation_class: "write",
    mission: MISSION,
    memory: { effective_context_sha256: `sha256:${"f".repeat(64)}` },
  });
  assert.equal(withStaleMemory.ok, true);
  assert.equal(withStaleMemory.memory_status, "SUPERSEDED");
  assert.equal(
    withStaleMemory.effective_context_sha256,
    resolveContext({ layers: layers(), operation_class: "write", mission: MISSION })
      .effective_context_sha256,
  );
});

test("parent binding and source drift are not silently accepted", () => {
  const wrongParent = resolveContext({
    layers: layers({ repository: { parent_context_id: "bizra://other" } }),
    operation_class: "read",
  });
  assert.equal(wrongParent.ok, false);
  assert.ok(wrongParent.blocked_by.includes("PARENT_CONTEXT_MISMATCH"));

  const resolved = resolveContext({ layers: layers(), operation_class: "read" });
  const drifted = layers();
  drifted[2] = { ...drifted[2], content: `${drifted[2].content}\nmanual drift\n` };
  assert.equal(
    verifyResolvedContext(resolved, { layers: drifted, operation_class: "read" }).ok,
    false,
  );

  const missingParent = recursiveLayers();
  missingParent[2] = {
    ...missingParent[2],
    content: contextMarkdown({
      scope: "subtree",
      context_id: "bizra://node/dema/packages",
      parent_context_id: "bizra://missing",
    }),
  };
  const missing = resolveContext({ layers: missingParent, operation_class: "read" });
  assert.equal(missing.ok, false);
  assert.ok(missing.blocked_by.includes("PARENT_CONTEXT_MISSING"));
});

test("resolves every applicable subtree ancestor in broad-to-narrow order", () => {
  const resolved = resolveContext({ layers: recursiveLayers(), operation_class: "read" });
  assert.equal(resolved.ok, true);
  assert.deepEqual(
    resolved.context_chain.map((entry) => entry.context_id),
    [
      "bizra://node",
      "bizra://node/dema",
      "bizra://node/dema/packages",
      "bizra://node/dema/packages-core",
      "bizra://node/dema/packages-core-runtime",
    ],
  );
  assert.equal(resolved.authority_delta, 0);
  assert.equal(verifyResolvedContext(resolved, { layers: recursiveLayers(), operation_class: "read" }).ok, true);
});

test("refuses skipped, duplicate, cyclic, escaped, and nondeterministic context chains", () => {
  const full = recursiveLayers();

  const skipped = resolveContext({
    layers: [full[0], full[1], full[4]],
    operation_class: "read",
  });
  assert.equal(skipped.ok, false);
  assert.ok(skipped.blocked_by.includes("CONTEXT_LAYER_SKIPPED"));

  const duplicate = [...full];
  duplicate[3] = {
    ...duplicate[3],
    content: contextMarkdown({
      scope: "subtree",
      context_id: "bizra://node/dema/packages",
      parent_context_id: "bizra://node/dema/packages",
    }),
  };
  const duplicateResult = resolveContext({ layers: duplicate, operation_class: "read" });
  assert.equal(duplicateResult.ok, false);
  assert.ok(duplicateResult.blocked_by.includes("DUPLICATE_CONTEXT_ID"));

  const cyclic = [...full];
  cyclic[2] = {
    ...cyclic[2],
    content: contextMarkdown({
      scope: "subtree",
      context_id: "bizra://node/dema/packages",
      parent_context_id: "bizra://node/dema/packages-core-runtime",
    }),
  };
  const cycleResult = resolveContext({ layers: cyclic, operation_class: "read" });
  assert.equal(cycleResult.ok, false);
  assert.ok(cycleResult.blocked_by.includes("CONTEXT_CYCLE"));

  const escaped = [...full];
  escaped[2] = {
    path: "/outside/packages/BIZRA.md",
    content: escaped[2].content,
  };
  const escapedResult = resolveContext({ layers: escaped, operation_class: "read" });
  assert.equal(escapedResult.ok, false);
  assert.ok(escapedResult.blocked_by.includes("CONTEXT_SCOPE_ESCAPE"));

  const reordered = [full[0], full[1], full[3], full[2], full[4]];
  const reorderedResult = resolveContext({ layers: reordered, operation_class: "read" });
  assert.equal(reorderedResult.ok, false);
  assert.ok(reorderedResult.blocked_by.includes("CONTEXT_ORDER_NONDETERMINISTIC"));
});

test("filesystem discovery returns all applicable BIZRA ancestors deterministically", () => {
  const root = mkdtempSync(join(tmpdir(), "bizra-context-chain-"));
  const repoRoot = join(root, "repo");
  const cwd = join(repoRoot, "packages", "core", "runtime");
  const nodeRoot = join(root, "node");
  mkdirSync(cwd, { recursive: true });
  mkdirSync(nodeRoot, { recursive: true });
  const discovered = recursiveLayers().slice(2).map((layer) => layer.path.replace("/repo", repoRoot));
  try {
    writeFileSync(join(repoRoot, "BIZRA.md"), recursiveLayers()[1].content);
    writeFileSync(join(nodeRoot, "BIZRA.md"), recursiveLayers()[0].content);
    for (const [index, path] of discovered.entries()) {
      writeFileSync(path, recursiveLayers()[index + 2].content);
    }
    assert.deepEqual(collectAncestorContexts({ cwd, repoRoot }).map(({ path }) => path), discovered);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("filesystem binding refuses a cwd outside the selected repository", () => {
  assert.throws(
    () => buildPhysicalState({ cwd: "/outside", repoRoot: "/repo" }),
    /REPO_ROOT_MISMATCH/,
  );
});

test("context collection refuses when the node root has no canonical context", () => {
  const missingNodeRoot = mkdtempSync(join(tmpdir(), "bizra-context-spine-"));
  try {
    assert.throws(
      () => collectContext({ cwd: process.cwd(), repoRoot: process.cwd(), nodeRoot: missingNodeRoot }),
      /NODE_CONTEXT_MISSING/,
    );
  } finally {
    rmSync(missingNodeRoot, { recursive: true, force: true });
  }
});

test("projections are deterministic, source-bound, and reject manual edits", () => {
  const resolved = resolveContext({ layers: layers(), operation_class: "read" });
  const projection = renderProjection({ target: "codex", resolved });

  assert.match(projection, /GENERATED.*DO NOT EDIT DIRECTLY/);
  assert.equal(verifyProjection(projection, { target: "codex", resolved }).ok, true);
  assert.equal(
    verifyProjection(`${projection}\nextra instruction`, { target: "codex", resolved }).ok,
    false,
  );
  assert.equal(
    verifyProjection(projection.replace("projection_only", "human_granted"), {
      target: "codex",
      resolved,
    }).ok,
    false,
  );
  assert.notEqual(
    renderProjection({ target: "claude", resolved }),
    projection,
  );
});

test("context lock is content-addressed, redacts secrets, and rejects forged-clean edits", () => {
  const resolved = resolveContext({
    layers: layers(),
    operation_class: "write",
    mission: MISSION,
  });
  const lock = buildContextLock({
    resolved,
    physical_state: PHYSICAL_STATE,
    mission: MISSION,
    session: SESSION,
    observed_at_iso: "2026-09-05T00:00:00.000Z",
  });

  assert.match(lock.lock_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(verifyContextLock(lock, { resolved, physical_state: PHYSICAL_STATE }).ok, true);

  const forged = {
    ...lock,
    authority_delta: 1,
  };
  assert.equal(verifyContextLock(forged, { resolved, physical_state: PHYSICAL_STATE }).ok, false);
  assert.throws(
    () => buildContextLock({
      resolved,
      physical_state: PHYSICAL_STATE,
      mission: { ...MISSION, api_token: "secret" },
      session: SESSION,
    }),
    /secret/i,
  );
});

test("lifecycle events remain flat, local, and authority-neutral", () => {
  const resolved = resolveContext({
    layers: layers(),
    operation_class: "write",
    mission: MISSION,
  });
  const lock = buildContextLock({
    resolved,
    physical_state: PHYSICAL_STATE,
    mission: MISSION,
    session: SESSION,
    observed_at_iso: "2026-09-05T00:00:00.000Z",
  });
  const bound = buildContextEvent({ event_type: "CONTEXT_BOUND", lock, session: SESSION });
  const receipt = buildContextEvent({
    event_type: "SESSION_RECEIPT",
    lock,
    session: SESSION,
    outcome: "ok",
    summary: { next_frontier: "verify-projection" },
  });

  assert.equal(bound.command, "CONTEXT_BOUND");
  assert.equal(receipt.command, "SESSION_RECEIPT");
  assert.equal(bound.metadata.authority_delta, 0);
  assert.equal(receipt.metadata.next_frontier, "verify-projection");
  assert.equal(bound.boundary.network_used, false);
  assert.equal(bound.boundary.model_invocation_performed, false);
  assert.equal(bound.boundary.runtime_started, false);
  assert.equal(bound.boundary.source_estate_mutation, false);
  assert.equal(bound.boundary.evidence_workspace_mutation, false);
  assert.equal(bound.boundary.event_log_appended, false);
  assert.equal(bound.boundary.runtime_mutation, false);
  assert.equal(bound.boundary.external_effect, false);
  assert.equal(bound.boundary.active_effect, false);
  assert.ok(Object.values(bound.metadata).every((value) =>
    value === null || ["string", "number", "boolean"].includes(typeof value),
  ));
});

test("lease, network, and mutation truth labels cannot imply an effect", () => {
  const mission = { ...MISSION };
  const write = resolveContext({ layers: layers(), operation_class: "write", mission });
  const network = resolveContext({ layers: [layers()[0]], operation_class: "network", mission });
  const networkWithoutScope = resolveContext({ layers: [layers()[0]], operation_class: "network", mission });

  assert.equal(write.authority_status.decision, "ELIGIBLE_UNDER_STRUCTURALLY_VALID_DECLARED_LEASE");
  assert.equal(write.authority_status.human_authenticity, "UNATTESTED");
  assert.equal(write.authority_status.lease_freshness, "UNATTESTED");
  assert.equal(write.authority_status.active_effect, false);
  assert.equal(network.authority_status.decision, "ELIGIBLE_FOR_BOUNDED_SCOPE_ADJUDICATION");
  assert.equal(networkWithoutScope.authority_status.network_scope_adjudication, "REQUIRED");
  assert.equal(networkWithoutScope.authority_status.active_network_effect, false);
  assert.equal(networkWithoutScope.boundary.network_used, false);
  assert.equal(networkWithoutScope.boundary.active_effect, false);
  assert.equal(networkWithoutScope.authority_delta, 0);
  assert.deepEqual(
    Object.fromEntries([
      "source_estate_mutation",
      "evidence_workspace_mutation",
      "event_log_appended",
      "runtime_mutation",
      "external_effect",
    ].map((key) => [key, networkWithoutScope.boundary[key]])),
    {
      source_estate_mutation: false,
      evidence_workspace_mutation: false,
      event_log_appended: false,
      runtime_mutation: false,
      external_effect: false,
    },
  );
});

test("appended lifecycle receipts expose evidence mutation without source or external effect", () => {
  const resolved = resolveContext({ layers: layers(), operation_class: "write", mission: MISSION });
  const lock = buildContextLock({
    resolved,
    physical_state: PHYSICAL_STATE,
    mission: MISSION,
    session: SESSION,
    observed_at_iso: "2026-09-05T00:00:00.000Z",
  });
  const home = mkdtempSync(join(tmpdir(), "context-spine-1b2r3-"));
  try {
    const event = buildEventForAppend({ event_type: "SESSION_RECEIPT", lock, session: SESSION });
    const append = appendEvent({ home, event });
    const stored = JSON.parse(readFileSync(append.path, "utf8").trim());
    assert.equal(stored.boundary.source_estate_mutation, false);
    assert.equal(stored.boundary.evidence_workspace_mutation, true);
    assert.equal(stored.boundary.event_log_appended, true);
    assert.equal(stored.boundary.runtime_mutation, false);
    assert.equal(stored.boundary.external_effect, false);
    assert.equal(stored.boundary.active_effect, false);
    assert.equal(stored.boundary.network_used, false);
    assert.equal(stored.metadata.authority_delta, 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
