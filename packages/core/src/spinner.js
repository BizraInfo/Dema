// Animated CLI spinner for operations that take >1s.
//
// Suppressed automatically when:
//   - stdout is not a TTY (e.g. execFile in tests, pipes)
//   - process.env.NO_COLOR is set
//   - process.env.CI is set
//
// All I/O through injected `stdout` — never touches process.stdout directly.

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const MAX_LABEL_LENGTH = 120;

function shouldSuppress(stdout) {
  return (
    !stdout.isTTY ||
    Boolean(process.env.NO_COLOR) ||
    Boolean(process.env.CI)
  );
}

/**
 * createSpinner({ stdout, label, intervalMs?, suppressed? })
 *
 * Returns { start(), update(label?), stop() }.
 * All methods are safe to call in any order (stop before start is a no-op).
 */
export function createSpinner({
  stdout,
  label,
  intervalMs = 80,
  suppressed = shouldSuppress(stdout)
}) {
  let frameIndex = 0;
  let timer = null;
  let currentLabel = String(label ?? "").slice(0, MAX_LABEL_LENGTH);

  function writeLine() {
    const frame = FRAMES[frameIndex % FRAMES.length];
    frameIndex += 1;
    stdout.write(`\r${frame} ${currentLabel}`);
  }

  function clearLine() {
    const len = 2 + currentLabel.length + 1;
    stdout.write("\r" + " ".repeat(len) + "\r");
  }

  return {
    start() {
      if (suppressed || timer !== null) return;
      writeLine();
      timer = setInterval(writeLine, intervalMs);
    },

    update(newLabel) {
      if (suppressed) return;
      currentLabel = String(newLabel ?? "").slice(0, MAX_LABEL_LENGTH);
    },

    stop() {
      if (suppressed || timer === null) return;
      clearInterval(timer);
      timer = null;
      clearLine();
    }
  };
}
