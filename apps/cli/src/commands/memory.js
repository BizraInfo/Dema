import {
  readMemoryEntry,
  summarizeMemory,
} from "../../../../packages/memory/src/memory-store.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_memory(ctx) {
  const { argv, subcommand } = ctx;
  const action = subcommand;
  if (action === "--help" || action === "-h") {
    console.log(
      [
        "dema memory — local memory entries + BIZRA Omega AgentDB query (MC-A v0.1)",
        "",
        "USAGE",
        "  dema memory [list]                       List Dema auto-memory entries",
        "  dema memory show <name>                  Show one memory entry by name",
        '  dema memory query "<text>" [--top N]     Query BIZRA Omega AgentDB (MC-A)',
        "    [--json]",
        "",
        "MC-A query: spawns ~/.dema/bin/agent-db-query · AgentDB.search() facade",
        "  Discipline: read-only · no LLM · no mission loop · no receipt mint",
        "  Override Omega root with BIZRA_OMEGA_ROOT env var (default: /data/bizra/dema-runtime-arch-wt)",
        "  Override wrapper path with DEMA_AGENT_DB_QUERY_PATH (test only)",
      ].join("\n"),
    );
    process.exit(process.exitCode ?? 0);
  }
  if (!action || action === "list") {
    console.log(JSON.stringify(await summarizeMemory(), null, 2));
  } else if (action === "show") {
    const name = argv[2];
    if (!name) throw new Error("Usage: dema memory show <name>");
    console.log(JSON.stringify(await readMemoryEntry(name), null, 2));
  } else if (action === "query") {
    // MC-A v0.1 · read-only operator-local memory query against BIZRA
    // Omega AgentDB. Bridges Dema JS → ~/.dema/bin/agent-db-query (Python)
    // → AgentDB.search() facade. Per ADR-022 doctrine the Omega substrate
    // stays outside this repo. Discipline: read-only · no LLM · no mission
    // loop · no chain mint · schema-envelope-bound (NOT receipt-bound).
    const queryText = argv[2];
    if (!queryText || queryText.startsWith("-")) {
      console.error(
        'dema memory query: missing <text> argument. Usage: dema memory query "<text>" [--top N]',
      );
      process.exitCode = 2;
      process.exit(process.exitCode ?? 0);
    }
    const memTopArg = argValue(argv, "--top");
    let memTop = memTopArg ? parseInt(memTopArg, 10) : 3;
    if (!Number.isInteger(memTop) || memTop < 1 || memTop > 20) {
      console.error(
        `dema memory query: --top out of range: must be integer in [1, 20] (got '${memTopArg}')`,
      );
      process.exitCode = 2;
      process.exit(process.exitCode ?? 0);
    }
    const memWantsJson = argv.includes("--json");

    const { existsSync: memExistsSync } = await import("node:fs");
    const { spawnSync: memSpawnSync } = await import("node:child_process");
    const { homedir: memHomedir } = await import("node:os");
    const { join: memJoinPath } = await import("node:path");

    const wrapperPath =
      process.env.DEMA_AGENT_DB_QUERY_PATH ||
      memJoinPath(memHomedir(), ".dema", "bin", "agent-db-query");

    // Defensive snippet truncation: even if the wrapper misbehaves and
    // returns snippets longer than 200 chars, Dema must keep its boundary
    // claim honest (memory_domain_boundary.snippet_max_chars: 200).
    const truncateHits = (rawHits) => {
      if (!Array.isArray(rawHits)) return [];
      return rawHits.map((h) => {
        const snippet =
          typeof h?.snippet === "string" ? h.snippet.slice(0, 200) : h?.snippet;
        return { ...h, snippet };
      });
    };

    const buildMemEnv = ({
      wrapperExit,
      wrapperDurationMs,
      wrapperEnvelope,
      errorMessage,
    }) => ({
      schema: "bizra.dema.memory_query_result.v0.1",
      tool_version: "dema-memory-query-v0.1",
      generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      query: queryText,
      top: memTop,
      hits: truncateHits(wrapperEnvelope?.hits),
      hits_count: wrapperEnvelope?.hits_count ?? 0,
      wrapper_invoked: wrapperPath,
      wrapper_exit_code: wrapperExit,
      wrapper_duration_ms: wrapperDurationMs,
      omega_root_used: wrapperEnvelope?.omega_root_used ?? null,
      error: errorMessage ?? null,
      verdict_role: "suggestion",
      consent: {
        consent_mode: "typed_command_read_only",
        consent_level: "C0_OPERATOR_LOCAL_READ",
        exact_string_consent_required: false,
      },
      boundary: {
        filesystem_write_performed: false,
        network_used: false,
        runtime_execution_performed: true,
        model_loaded: false,
        model_invocation_performed: false,
        prompt_executed: false,
        external_call_performed: false,
        raw_corpus_scan_performed: false,
        raw_data_included: false,
        tool_executed: false,
        chain_advance_performed: false,
        receipt_mint_performed: false,
        federation_invoked: false,
        node_connection_performed: false,
        public_network_used: false,
        consent_collected: true,
      },
      memory_domain_boundary: {
        memory_snippet_included: true,
        raw_memory_dump_included: false,
        snippet_max_chars: 200,
        public_safe: false,
        operator_local_only: true,
      },
    });

    if (!memExistsSync(wrapperPath)) {
      const env = buildMemEnv({
        wrapperExit: -1,
        wrapperDurationMs: 0,
        wrapperEnvelope: null,
        errorMessage: `wrapper not found at ${wrapperPath} — install or set DEMA_AGENT_DB_QUERY_PATH`,
      });
      if (memWantsJson) {
        console.log(JSON.stringify(env, null, 2));
      } else {
        // Same degraded-verdict contract as the runtime-failure path: the
        // human surface names the degradation class, never a bare path error.
        console.error(`Dema memory query: MEMORY_DEGRADED`);
        console.error(`  reason: wrapper not found at ${wrapperPath}`);
        console.error(`  still works: dema memory list · dema memory show <name> · dema today`);
        console.error(
          "  fix: install ~/.dema/bin/agent-db-query or set DEMA_AGENT_DB_QUERY_PATH",
        );
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    const memT0 = Date.now();
    const memResult = memSpawnSync(
      "python3",
      [wrapperPath, "--query", queryText, "--top", String(memTop), "--json"],
      { encoding: "utf8", timeout: 30000 },
    );
    const memDuration = Date.now() - memT0;
    let memWrapperEnv = null;
    let memErrMsg = null;
    if (memResult.error) {
      memErrMsg = `spawn failed: ${memResult.error.message}`;
    } else if (memResult.signal === "SIGTERM") {
      memErrMsg = `wrapper timeout after 30000ms`;
    } else {
      try {
        memWrapperEnv = JSON.parse(memResult.stdout || "{}");
      } catch (e) {
        memErrMsg = `wrapper stdout not JSON: ${e.message}`;
      }
    }
    const memExit = memResult.status ?? -1;
    // Propagate wrapper non-zero exit into env.error so the Dema exit code
    // honestly reflects the subprocess outcome. Without this, a wrapper
    // exit 3 + valid JSON stdout would silently let Dema exit 0.
    if (!memErrMsg && memExit !== 0) {
      const wrappedErr =
        memWrapperEnv &&
        typeof memWrapperEnv.error === "string" &&
        memWrapperEnv.error
          ? memWrapperEnv.error
          : `wrapper exited with code ${memExit}`;
      memErrMsg = wrappedErr;
    }
    const env = buildMemEnv({
      wrapperExit: memExit,
      wrapperDurationMs: memDuration,
      wrapperEnvelope: memWrapperEnv,
      errorMessage: memErrMsg,
    });
    if (memWantsJson) {
      console.log(JSON.stringify(env, null, 2));
    } else if (env.error) {
      // Degraded-verdict rendering: never leak raw substrate constructor
      // errors at a human surface, never print a misleading "0 hit(s)"
      // success line above a failure, and always name what STILL works.
      console.error(`Dema memory query: MEMORY_DEGRADED`);
      console.error(`  reason: ${env.error}`);
      console.error(`  still works: dema memory list · dema memory show <name> · dema today`);
      console.error(
        `  fix: initialize/rebuild the Omega AgentDB index (~/.dema/bin/agent-db-query)`,
      );
    } else {
      console.log(
        `Dema memory query: ${env.hits_count} hit(s) for "${env.query}" (top=${env.top})`,
      );
      for (const h of env.hits) {
        console.log(
          `  · ${h.id} [score ${h.score}] — ${h.snippet?.slice(0, 80) ?? ""}…`,
        );
      }
    }
    process.exitCode = env.error ? 1 : 0;
    process.exit(process.exitCode ?? 0);
  } else {
    throw new Error(
      'Unknown memory command. Use `dema memory [list]` or `dema memory show <name>` or `dema memory query "<text>" [--top N]`.',
    );
  }
  process.exit(process.exitCode ?? 0);
}
