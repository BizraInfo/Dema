// Single-byte keyboard dispatch for the bare `dema` banner.
// Reads one raw keypress and maps it to a subcommand string or null.
// All I/O is injected so the module is testable with mock streams.

// Mapping from key character to subcommand argv (passed to dispatch()).
export const KEY_BINDINGS = Object.freeze({
  m: ["mission", "propose"],
  j: ["today"],
  r: ["receipts"],
  b: ["explain"],
  "?": ["help"],
  h: ["help"]
});

// Keys that signal "quit without dispatch" — returns null to caller.
const QUIT_KEYS = new Set([
  "q",
  "\x1b",  // ESC
  "\x03",  // Ctrl-C
  "\r",    // Enter (CR)
  "\n"     // Enter (LF)
]);

const VALID_KEYS = new Set([...Object.keys(KEY_BINDINGS), ...QUIT_KEYS]);

const PROMPT_LINE = "\nPress a key: m j r b ? q  (or Enter to skip) ▸ ";
const RETRY_HINT  = "Press m/j/r/b/?/q (or Enter to skip)\n";

// runBannerKeyLoop — read keys repeatedly, dispatch each, exit on null.
// Pure orchestration: I/O is delegated to `readKey` (defaults to
// readBannerKey but can be mocked in tests) and dispatch is delegated
// to `dispatchFn`. A safety cap of 50 iterations bounds any pathological
// raw-mode loop. Returns the number of dispatches that fired.
export async function runBannerKeyLoop({
  readKey,
  dispatchFn,
  bindings = KEY_BINDINGS,
  maxIterations = 50,
  readKeyOpts = {}
} = {}) {
  if (typeof readKey !== "function") throw new TypeError("runBannerKeyLoop requires readKey()");
  if (typeof dispatchFn !== "function") throw new TypeError("runBannerKeyLoop requires dispatchFn()");
  let dispatches = 0;
  for (let i = 0; i < maxIterations; i++) {
    const key = await readKey(readKeyOpts);
    if (!key) return dispatches;
    const subArgv = bindings[key];
    if (subArgv) {
      await dispatchFn(subArgv);
      dispatches++;
    }
  }
  return dispatches;
}

// readBannerKey — exported for both CLI and tests.
// Returns the mapped key char (e.g. 'm') if it has a dispatch binding,
// or null if the user pressed a quit/skip key or the timeout fired.
//
// opts:
//   stdin     — readable stream; must support setRawMode if isTTY is true
//   stdout    — writable stream
//   timeoutMs — how long to wait before giving up (default 60000)
export async function readBannerKey({ stdin, stdout, timeoutMs = 60_000 } = {}) {
  if (!stdin || !stdin.isTTY) return null;

  stdout.write(PROMPT_LINE);

  let rawModeSet = false;
  let timeoutHandle = null;
  let dataListener = null;
  let errorListener = null;

  // Restore raw mode and remove listeners — idempotent, safe to call twice.
  function restore() {
    if (rawModeSet) {
      try { stdin.setRawMode(false); } catch { /* best-effort */ }
      rawModeSet = false;
    }
    if (dataListener) {
      stdin.removeListener("data", dataListener);
      dataListener = null;
    }
    if (errorListener) {
      stdin.removeListener("error", errorListener);
      errorListener = null;
    }
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    try { stdin.pause(); } catch { /* best-effort */ }
  }

  // SIGINT/SIGTERM: restore before process exits.
  function sigHandler() {
    restore();
    process.exit(0);
  }

  process.once("SIGINT",  sigHandler);
  process.once("SIGTERM", sigHandler);

  try {
    stdin.setRawMode(true);
    rawModeSet = true;
    stdin.resume();

    return await new Promise((resolve) => {
      timeoutHandle = setTimeout(() => {
        resolve(null);
      }, timeoutMs);

      // Inner loop: keep reading until we get a valid or quit key.
      function onData(buf) {
        const ch = buf.toString("utf8")[0] ?? "";

        if (QUIT_KEYS.has(ch)) {
          stdout.write("\n");
          resolve(null);
          return;
        }

        if (KEY_BINDINGS[ch]) {
          stdout.write("\n");
          resolve(ch);
          return;
        }

        // Unknown key — show retry hint and wait again.
        stdout.write(`\n${RETRY_HINT}${PROMPT_LINE}`);
      }

      errorListener = () => resolve(null);

      dataListener = onData;
      stdin.on("data", dataListener);
      stdin.on("error", errorListener);
    });
  } finally {
    restore();
    process.removeListener("SIGINT",  sigHandler);
    process.removeListener("SIGTERM", sigHandler);
  }
}
