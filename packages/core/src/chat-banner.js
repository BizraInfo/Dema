// Chat-homebase v0.2 welcome panel.
// Pure string builder — no I/O, no network.
// Suppressed when non-TTY or --no-banner is passed by caller.

const WIDTH = 72;
const H = "─";
const V = "│";
const TL = "┌";
const TR = "┐";
const BL = "└";
const BR = "┘";
const ML = "├";
const MR = "┤";

function _top() {
  return `${TL}${H.repeat(WIDTH - 2)}${TR}`;
}
function _mid() {
  return `${ML}${H.repeat(WIDTH - 2)}${MR}`;
}
function _bot() {
  return `${BL}${H.repeat(WIDTH - 2)}${BR}`;
}
function _row(text) {
  const inner = WIDTH - 4;
  const padded = text.padEnd(inner);
  return `${V} ${padded} ${V}`;
}
function _blank() {
  return _row("");
}

/**
 * Build the chat-homebase welcome banner.
 *
 * @param {object} opts
 * @param {string|null} opts.human - operator preferred name (null → "operator")
 * @param {boolean}     opts.suppressed - if true, return empty string
 * @returns {string}
 */
export function buildChatBanner({ human = null, suppressed = false } = {}) {
  if (suppressed) return "";

  const name = human && human.trim() ? human.trim() : "operator";

  const lines = [
    _top(),
    _row(`DEMA CHAT · Node0 · ${name} · Local Companion Mode`),
    _mid(),
    _row("I am here inside Node0."),
    _row(
      "I can help with missions, memory, models, receipts, and next actions.",
    ),
    _blank(),
    _row("Current state: local · preview-first · no federation · no mint"),
    _row("Memory: available locally"),
    _row("Gateway: unreachable by design"),
    _mid(),
    _row("Try asking:"),
    _row("  · What is BIZRA?"),
    _row("  · What should I do next?"),
    _row("  · Explain URP"),
    _row("  · Show my Node0 status"),
    _row("  · Help me draft a mission"),
    _mid(),
    _row("Boundary: no action without explicit consent"),
    _row(
      "Law of Assumption: declare boundary between evidence and uncertainty",
    ),
    _bot(),
  ];

  return lines.join("\n");
}
