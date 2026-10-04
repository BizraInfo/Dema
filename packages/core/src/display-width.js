// packages/core/src/display-width.js
// Column arithmetic for terminal surfaces.
//
// WHY THIS EXISTS
//
// `String.prototype.length` counts UTF-16 code units. A terminal column counts
// rendered cells. Those are the same number only for unstyled Latin text, and
// every surface in this repo was quietly assuming they were always the same.
//
// Arabic is where the assumption breaks. Tashkeel (fatha, damma, shadda, sukun…)
// are non-spacing marks: real code points that render inside the preceding
// letter's cell and occupy zero columns of their own. `"المُقَرْنَص".length` is 11;
// the terminal draws 7. Pad by the former and every column to the right shifts.
//
// Before this module the arithmetic was duplicated three ways and wrong in all
// of them for Arabic:
//   doctor-dashboard.js:249   — raw .length, strips nothing
//   dema-realm-home.js:263    — strips ANSI, keeps marks
//   node0-mumu-cockpit.js:65  — strips ANSI, keeps marks
//
// This is the primitive they can converge on. Adopting it is a no-op for every
// string those surfaces render today (Latin and unvocalised Arabic are already
// correct), which is what makes convergence safe to do incrementally.
//
// SCOPE — deliberately narrow. This handles the zero-width cases that actually
// occur in Dema's surfaces: SGR sequences, non-spacing marks, and directional
// controls. It does NOT implement full East Asian wide-character handling
// (UAX#11), because no surface here renders CJK. If one ever does, that is a
// new case with its own test, not a silent assumption.
//
// Pure kernel: no fs, network, process, clock, or random.

// SGR (colour/style) sequences. Invisible, so they cost no columns.
const ANSI_SGR = /\x1b\[[0-9;]*m/g;

// Unicode non-spacing marks. `\p{Mn}` is the general category — it covers
// Arabic tashkeel, Hebrew niqqud, and combining diacritics generally, rather
// than hardcoding one script's block range.
const NON_SPACING = /\p{Mn}/gu;

// Bidirectional formatting controls: RLM, LRM, and the isolate family
// (LRI/RLI/FSI/PDI) plus the deprecated embedding/override set. All zero-width.
// The dirMark idiom in doctor-dashboard.js and onboarding.js emits U+200F, and
// it must not be charged a column.
const DIRECTIONAL = /[‎‏‪-‮⁦-⁩]/g;

/**
 * Rendered column count of a string.
 * @param {unknown} value coerced to string; null/undefined count as empty
 * @returns {number} column count, never negative
 */
export function displayWidth(value) {
  if (value === null || value === undefined) return 0;
  return String(value)
    .replace(ANSI_SGR, "")
    .replace(DIRECTIONAL, "")
    .replace(NON_SPACING, "").length;
}

/**
 * Right-pad with spaces to a target column count, measuring by rendered width.
 * Returns the input unchanged when it already meets or exceeds the target —
 * padding never truncates.
 * @param {unknown} value
 * @param {number} target column count
 * @returns {string}
 */
export function padToWidth(value, target) {
  const text = value === null || value === undefined ? "" : String(value);
  const deficit = target - displayWidth(text);
  return deficit > 0 ? text + " ".repeat(deficit) : text;
}
