export type WorldTruthLabel =
  | "MEASURED"
  | "SOURCE_BOUND"
  | "DESIGNED_NOT_LIVE"
  | "UNKNOWN";

export type WorldSurface = Readonly<{
  route: "/" | "/realm" | "/world";
  name: string;
  role: string;
  authority: string;
  truth: WorldTruthLabel;
}>;

export type WorldPlane = Readonly<{
  id: string;
  title: string;
  purpose: string;
  owner: string;
  state: WorldTruthLabel;
  invariant: string;
}>;

export const WORLD_PROJECTION_SOURCE = Object.freeze({
  schema: "bizra.dema.world_projection.v1",
  truth_label: "SOURCE_BOUND" as const,
  simulation_archive_sha256:
    "d526126c4a7dee216b5c1d2f20c994fb7a6fb9c326fcf5fdb210d00bc43c7ebd",
  simulation_workspace_head:
    "3f5664ec4398236c08e2a4117d504a09bd05952a",
  simulation_presentation_seal:
    "bf7e5de74137c9bab49bd27edbff045eb065e76e",
  dema_base:
    "53e636c81e2677756bc3b6b3178cb651c17ceb02",
  imported_at: "2026-08-04T22:11:00+04:00",
  authority_delta: 0,
  runtime_effects: false,
});

export const WORLD_SURFACES: readonly WorldSurface[] = Object.freeze([
  Object.freeze({
    route: "/",
    name: "Dema Mission",
    role: "Consent-first mission front door",
    authority: "Reads and renders verdicts from Dema core; does not mint them",
    truth: "MEASURED",
  }),
  Object.freeze({
    route: "/realm",
    name: "Dema Realm",
    role: "Operational spatial projection",
    authority: "Presents local realm state; core kernels remain authoritative",
    truth: "MEASURED",
  }),
  Object.freeze({
    route: "/world",
    name: "BIZRA World",
    role: "Source-bound constitutional and architectural projection",
    authority: "Presentation only; zero state, consent, effect, identity, or economic authority",
    truth: "SOURCE_BOUND",
  }),
]);

export const WORLD_PLANES: readonly WorldPlane[] = Object.freeze([
  Object.freeze({
    id: "human",
    title: "Human Sovereign",
    purpose: "Purpose, consent, exceptional judgment and final authority",
    owner: "Human",
    state: "MEASURED",
    invariant: "The system may remove burden, never sovereignty.",
  }),
  Object.freeze({
    id: "experience",
    title: "Dema Experience",
    purpose: "One product face across mission, realm and world views",
    owner: "packages/dema-ui",
    state: "MEASURED",
    invariant: "Views render authority; they do not create it.",
  }),
  Object.freeze({
    id: "mission",
    title: "Mission and FATE",
    purpose: "Durable contract, bounded authority, exact consent and legal transitions",
    owner: "Dema core and mission packages",
    state: "MEASURED",
    invariant: "Models propose; code validates; FATE controls effects.",
  }),
  Object.freeze({
    id: "cognition",
    title: "PAT / SAT Cognition",
    purpose: "Private assistance and independent integrity adjudication",
    owner: "Governed agent roles",
    state: "DESIGNED_NOT_LIVE",
    invariant: "The builder is not its sole evaluator.",
  }),
  Object.freeze({
    id: "proof",
    title: "Proof and Receipts",
    purpose: "Replayable evidence, claim discipline and recovery history",
    owner: "Receipt and proof packages",
    state: "MEASURED",
    invariant: "No receipt, no promotion; no evidence, no strong claim.",
  }),
  Object.freeze({
    id: "network",
    title: "URP / Federation / PoI",
    purpose: "Shared resources, cross-node cooperation and verified-impact economics",
    owner: "Future governed network",
    state: "DESIGNED_NOT_LIVE",
    invariant: "Simulation cannot mint value and one estate cannot manufacture a quorum.",
  }),
]);

export const WORLD_OPEN_GATES = Object.freeze([
  "Persistent model-independent realm memory is not yet an operational boot path.",
  "Production signer ceremony remains a human-only identity boundary.",
  "Federation, shared URP runtime, token economics and PoI rewards are not live.",
  "The imported simulation is evidence and design material, not runtime state.",
]);
