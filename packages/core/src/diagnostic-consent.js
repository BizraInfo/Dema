// Diagnostic consent leaf — single-purpose constants module.
//
// Holds the exact-string consent phrase required to authorize Node0's
// bounded diagnostic preview. This file is a TRUE LEAF: it has no
// outbound imports. That property is what breaks the file-edge cycle
// between core (which imports from verifier via behavioral-modulation)
// and verifier (which previously imported the phrase from core/mission).
//
// Operating law applied: After the spine exists, map the spine. After
// the map finds a cycle, break the cycle before extending the spine.
//
// Backward compatibility: `core/mission.js` re-exports this constant so
// existing callers and tests keep working without import changes.

export const BOUNDED_DIAGNOSTIC_CONSENT_PHRASE =
  "GO: Node0 bounded diagnostic activation only";
