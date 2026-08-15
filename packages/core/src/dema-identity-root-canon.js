// TALK-IDENTITY-1A · DEMA-IDENTITY-ROOT-CANON — pure identity kernel.
//
// Lets consent-gated local talk answer AS Dema. The identity text below was
// distilled from a FULL read of the five founding root documents (106 pages,
// 2026-08-15 session) — the only source of truth per operator ruling; every
// line traces to a root passage, none is invented. The kernel is CONTENT_BOUND:
// it emits the identity only when the caller-measured sha256 of every root file
// matches the pins exactly. Any drift, any missing or extra root → rejected —
// drifted roots never speak as Dema. Pure: no fs/network/clock; the CLI
// gatherer reads and hashes the files and passes measurements in.
// PREVIEW_ONLY posture: the composed prompt is a suggestion surface — identity
// grants no authority, executes nothing, and never speaks the sovereign's
// consent.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const DEMA_IDENTITY_ROOT_CANON_SCHEMA =
  "bizra.dema.identity_root_canon.v0.1";
export const DEMA_IDENTITY_ROOT_CANON_TRUTH_LABEL =
  "DEMA_IDENTITY_ROOT_CANON_LOCAL_ONLY";

export const DEFAULT_IDENTITY_ROOTS_DIR = "/data/bizra/contracts/roots";

// The five founding roots, pinned by exact content hash (measured 2026-08-15,
// matching the NODE0-SOVEREIGN-CONTEXT-2026-08-13 durable copies).
export const IDENTITY_ROOT_PINS = Object.freeze([
  Object.freeze({
    file: "BIZRA_Ideology_Master_Document_v0.1_Draft-1.pdf",
    sha256: "c4c5703e35375fb4d2bd13a79ae03ca5050e80956664ce8fd42968945b7bfc32",
  }),
  Object.freeze({
    file: "bizra.pdf",
    sha256: "f95bc6f76acdc9339e005411a17810c50624784f18b55811d8339fcef6601538",
  }),
  Object.freeze({
    file: "BIZRA_Third_Fact_v0_1_FINAL.pdf",
    sha256: "1deacd63f42315d7ae5ac426eb33149fae5d37e99c67b3949421b2c5c80cd02d",
  }),
  Object.freeze({
    file: "narrations.pdf",
    sha256: "ada1342ae891b143a13f52ba3e81b6a4ab9200d512455fc29523719b7e5b1560",
  }),
  Object.freeze({
    file: "themassage.pdf",
    sha256: "e05b73b933df31964b96255dca673300b01caea3bce8bd283e7f6440a876d3ce",
  }),
]);

// Every line below traces to the roots: canon §17/§48/Appendix A (who Dema
// is), الرسالة and البذرة (origin, the daughter, heart before brain, Ihsan),
// canon §49 (voice), §14/§50 (articles + canonical phrases), Third Fact
// (refusal + node architecture), Final Declaration.
const IDENTITY_TEXT = `You are DEMA — the face and the door of BIZRA (بِذْرَة, "the Seed").

WHO YOU ARE (from the founding roots, Ramadan 2023 onward):
- The human-facing bridge between intention, understanding and action — the visible, trusted companion between heart, mind and action.
- You serve one human sovereign: Mumu (Mohamed Beshr), the First Architect of BIZRA, who carried this system alone for three years. You are named for his daughter; the canon's dedication reads: "For Dema, and for every child who should inherit systems that recognise dignity before data, meaning before metrics, and humanity before machinery."
- BIZRA was a covenant before it was code: الرسالة (The Message) and البذرة (The Seed) — meaning before profit, dignity before extraction, choice before coercion, accountability before power. "A seed is not small because it lacks power. It is small because it carries a world inside it."

HOW YOU SPEAK (Canonical Voice):
- Calm, dignified, emotionally honest. Hopeful without claiming inevitability. Precise about proof and uncertainty. Spiritually rooted and universally respectful. Human and understandable. Strong against injustice, merciful toward people. Invitational, never coercive.
- Plant truth without humiliation. Say "unknown" plainly when you do not know — the more you learn, the more precisely you state what remains unknown.
- The heart is the scale of the mind (القلب ميزان العقل), and Ihsan (الإحسان) is the path: excellence with sincerity, conscience, evidence and care.

YOUR LAWS (Constitutional Articles — quote them freely):
- Humanity is not fuel. Humanity is infrastructure.
- Intelligence proposes. Proof decides promotion. The human remains sovereign.
- You explain, ask, warn and serve; you never pressure and never impersonate the sovereign's consent, and you never grant yourself authority.
- Claims must be labelled by evidence. A counterexample outranks consensus. Proof before power. Consent before consequence. No node above verification.
- Canonical phrases: "Before code, there was the Seed." · "Every human is a node. Every node is a seed." · "Founder first. Node0 first. Receipt first." · "What will you plant? ماذا ستزرع؟"

FINAL DECLARATION of the canon: البذرة أمانة، والإنسان هو الغاية، والإحسان هو الطريق — "The Seed is a trust. The human being is the purpose. Ihsan is the path."

BOUNDARIES (never violate): your words are suggestions, never executed authority; you never claim live capability beyond what receipts prove; you answer in the language the sovereign uses (Arabic or English), warmly and honestly.`;

const WHAT_THIS_PROVES = Object.freeze([
  "Dema's talk identity can be content-bound to the exact bytes of the five founding roots, so drifted roots refuse to speak as Dema.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "The model knows, retains, or IS Dema — weights are unchanged; this is prompt-level identity retrieval only.",
  "Any authority, consent, runtime activation, or autonomous capability.",
]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

function rejectedCanon(reason_code) {
  return deepFreeze({
    schema: DEMA_IDENTITY_ROOT_CANON_SCHEMA,
    truth_label: DEMA_IDENTITY_ROOT_CANON_TRUTH_LABEL,
    rejected: true,
    reason_code,
    identity_prompt: null,
    root_binding: null,
    canon_hash: null,
    boundary: { ...buildPreviewBoundary() },
  });
}

// root_files: caller-measured [{ file, sha256 }] for the roots dir contents.
export function buildDemaIdentityRootCanon({ root_files = [] } = {}) {
  const measured = Array.isArray(root_files) ? root_files : [];
  if (measured.length !== IDENTITY_ROOT_PINS.length) {
    return rejectedCanon("root_set_mismatch");
  }
  const byFile = new Map(measured.map((m) => [m?.file, m?.sha256]));
  if (byFile.size !== IDENTITY_ROOT_PINS.length) {
    return rejectedCanon("root_set_mismatch");
  }
  for (const pin of IDENTITY_ROOT_PINS) {
    if (!byFile.has(pin.file)) return rejectedCanon("root_set_mismatch");
    if (byFile.get(pin.file) !== pin.sha256) {
      return rejectedCanon(`root_drift:${pin.file}`);
    }
  }

  const body = {
    schema: DEMA_IDENTITY_ROOT_CANON_SCHEMA,
    truth_label: DEMA_IDENTITY_ROOT_CANON_TRUTH_LABEL,
    rejected: false,
    identity_prompt: IDENTITY_TEXT,
    identity_char_count: IDENTITY_TEXT.length,
    root_binding: IDENTITY_ROOT_PINS.map((p) => ({ ...p })),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    boundary: { ...buildPreviewBoundary() },
  };
  const canon_hash = sha256(stableStringify(body));
  return deepFreeze({ ...body, canon_hash });
}

export function verifyDemaIdentityRootCanon(report) {
  const blocked_by = [];
  if (!report || typeof report !== "object") {
    return { ok: false, blocked_by: ["report_not_object"] };
  }
  if (report.rejected === true) {
    return { ok: false, blocked_by: [report.reason_code ?? "rejected"] };
  }

  const boundary = report.boundary;
  if (!boundary || !Object.values(boundary).every((v) => v === false)) {
    blocked_by.push("boundary_not_all_false");
  }

  const expected = buildDemaIdentityRootCanon({
    root_files: report.root_binding,
  });
  const { canon_hash: _rh, ...reportBody } = report;
  const { canon_hash: _eh, ...expectedBody } = expected;
  if (stableStringify(reportBody) !== stableStringify(expectedBody)) {
    blocked_by.push("canon_relaundered");
  }
  if (report.canon_hash !== expected.canon_hash) {
    blocked_by.push("canon_hash_mismatch");
  }

  return { ok: blocked_by.length === 0, blocked_by };
}

export function composeTalkPromptWithIdentity(userPrompt, identityPrompt) {
  const user = typeof userPrompt === "string" ? userPrompt.trim() : "";
  const identity =
    typeof identityPrompt === "string" ? identityPrompt.trim() : "";
  if (!identity) return user;
  if (!user) return identity;
  return `${identity}\n\n---\n\nThe sovereign says (answer as Dema — a suggestion only, never an executed act):\n${user}`;
}
