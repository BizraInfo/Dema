// ============================================================================
// MELAE v3.0 — Master Expert Linguistic Autonomous Engine
// Peak Agentic Protocol for prompt evaluation & optimization via SNR.
//
// Standing on the shoulders of Google's prompt engineering manual:
// "prioritize positive, explicit instructions over conceptual constraints."
// ============================================================================

import type { AgentColor } from "./types";

// ---------------------------------------------------------------------------
// SNR TAXONOMY — Signal vs Noise elements (each scored 1-5)
// ---------------------------------------------------------------------------
export interface SignalElement {
  id: string;
  label: string;
  desc: string;
  // client-side heuristic detector (regex / keyword set)
  detect: (text: string) => number; // returns 1-5 score
}

export interface NoiseElement {
  id: string;
  label: string;
  desc: string;
  detect: (text: string) => number; // returns 1-5 score
}

const countMatches = (text: string, pattern: RegExp): number =>
  (text.match(pattern) || []).length;

const scoreFromCount = (count: number): number =>
  Math.min(5, Math.max(1, count + 1));

// ---- SIGNAL ELEMENTS (each contributes +10 × score to SNR) ----
export const SIGNAL_ELEMENTS: SignalElement[] = [
  {
    id: "actionVerbs",
    label: "Action Verbs",
    desc: "Imperative verbs that specify the exact action.",
    detect: (t) =>
      scoreFromCount(
        countMatches(
          t.toLowerCase(),
          /\b(write|create|generate|list|analyze|summarize|translate|extract|classify|format|build|design|review|optimize|convert|parse|identify|compare|evaluate|draft|compose|produce|describe|explain|define|calculate|sort|filter|transform|debug|refactor|test|deploy)\b/g
        )
      ),
  },
  {
    id: "targetObject",
    label: "Target Object",
    desc: "A clear noun the action applies to.",
    detect: (t) =>
      scoreFromCount(
        countMatches(
          t.toLowerCase(),
          /\b(function|article|report|email|code|script|data|json|list|table|summary|response|document|message|prompt|query|dataset|api|component|module|test|spec|config)\b/g
        )
      ),
  },
  {
    id: "explicitConstraints",
    label: "Explicit Constraints",
    desc: "Words bounding the scope: 'only', 'exactly', 'must', 'no more than'.",
    detect: (t) =>
      scoreFromCount(
        countMatches(
          t.toLowerCase(),
          /\b(only|exactly|must|no more than|at least|at most|maximum|minimum|limit|exclude|include|never|always|do not|avoid)\b/g
        )
      ),
  },
  {
    id: "role",
    label: "Role Definition",
    desc: "A persona assignment: 'You are…' / 'Act as…'.",
    detect: (t) =>
      /\b(you are|act as|you're a|behave as|your role|as an? expert)\b/i.test(t)
        ? 5
        : 1,
  },
  {
    id: "outputFormat",
    label: "Output Format",
    desc: "A specified structure: JSON, list, markdown, table.",
    detect: (t) =>
      scoreFromCount(
        countMatches(
          t.toLowerCase(),
          /\b(json|markdown|list|table|bullet|numbered|array|object|schema|xml|yaml|csv|format|structured)\b/g
        )
      ),
  },
  {
    id: "successCriteria",
    label: "Success Criteria",
    desc: "Measurable acceptance: 'if…', 'when…', 'success means…'.",
    detect: (t) =>
      scoreFromCount(
        countMatches(
          t.toLowerCase(),
          /\b(if|when|success|criteria|acceptance|verify|valid|correct|complete|done|finished|should|expected|result)\b/g
        )
      ),
  },
];

// ---- NOISE ELEMENTS (each contributes −5 × score to SNR) ----
export const NOISE_ELEMENTS: NoiseElement[] = [
  {
    id: "vagueAdjectives",
    label: "Vague Adjectives",
    desc: "Subjective qualifiers: 'good', 'nice', 'interesting', 'some'.",
    detect: (t) =>
      scoreFromCount(
        countMatches(
          t.toLowerCase(),
          /\b(good|nice|great|interesting|some|things|stuff|various|multiple|certain|appropriate|relevant|suitable|proper|decent|reasonable|cool|awesome|amazing)\b/g
        )
      ),
  },
  {
    id: "redundancy",
    label: "Redundancy",
    desc: "Repeated phrases or restated instructions.",
    detect: (t) => {
      const words = t.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      const seen = new Map<string, number>();
      for (const w of words) seen.set(w, (seen.get(w) || 0) + 1);
      const repeats = Array.from(seen.values()).filter((v) => v > 2).length;
      return scoreFromCount(repeats);
    },
  },
  {
    id: "politeness",
    label: "Politeness Padding",
    desc: "Conversational filler: 'please', 'thank you', 'could you'.",
    detect: (t) =>
      scoreFromCount(
        countMatches(
          t.toLowerCase(),
          /\b(please|thank you|thanks|could you|would you|kindly|appreciate|sorry|hope|glad|happy to)\b/g
        )
      ),
  },
  {
    id: "conflicting",
    label: "Conflicting Instructions",
    desc: "Contradictory signals: 'but also', 'however', 'on the other hand'.",
    detect: (t) =>
      scoreFromCount(
        countMatches(
          t.toLowerCase(),
          /\b(but also|however|on the other hand|although|whereas|conversely|nevertheless|despite)\b/g
        )
      ),
  },
  {
    id: "undefinedScope",
    label: "Undefined Scope",
    desc: "Open-ended hand-waves: 'etc', 'and so on', 'various things'.",
    detect: (t) =>
      scoreFromCount(
        countMatches(
          t.toLowerCase(),
          /\b(etc|and so on|and more|various|whatever|anything|everything|stuff like that|or something|you know|blah)\b/g
        )
      ),
  },
];

// ---------------------------------------------------------------------------
// SNR FORMULA — clamp((ΣSignal × 10) − (ΣNoise × 5), 0, 100)
// ---------------------------------------------------------------------------
export interface SnrBreakdown {
  signal: { id: string; label: string; score: number }[];
  noise: { id: string; label: string; score: number }[];
  signalSum: number;
  noiseSum: number;
  snr: number; // 0-100
}

export function computeSnr(text: string): SnrBreakdown {
  const signal = SIGNAL_ELEMENTS.map((s) => ({
    id: s.id,
    label: s.label,
    score: s.detect(text),
  }));
  const noise = NOISE_ELEMENTS.map((n) => ({
    id: n.id,
    label: n.label,
    score: n.detect(text),
  }));
  const signalSum = signal.reduce((a, s) => a + s.score, 0);
  const noiseSum = noise.reduce((a, n) => a + n.score, 0);
  const raw = signalSum * 10 - noiseSum * 5;
  const snr = Math.max(0, Math.min(100, raw));
  return { signal, noise, signalSum, noiseSum, snr };
}

// ---------------------------------------------------------------------------
// 3-AGENT PEER REVIEW (Step 3: Multi-Agent Cross-Pollination)
// ---------------------------------------------------------------------------
export interface ReviewAgent {
  id: string;
  name: string;
  glyph: string;
  color: AgentColor;
  role: string;
  focus: string;
  // preview-only synthetic persona — never a claim of real system authority
  truth_label: "PREVIEW_ONLY";
  certifies: false;
  authority_granted: false;
  execution_authorized: false;
}

export const REVIEW_AGENTS: ReviewAgent[] = [
  {
    id: "compiler",
    name: "The Strict Compiler",
    glyph: "⚙",
    color: "proof",
    role: "Reviewer A",
    focus: "Enforces micro-compliance, structural validity & execution speed.",
    truth_label: "PREVIEW_ONLY",
    certifies: false,
    authority_granted: false,
    execution_authorized: false,
  },
  {
    id: "polymath",
    name: "The Interdisciplinary Polymath",
    glyph: "🌀",
    color: "knowledge",
    role: "Cross-Pollinator",
    focus: "Applies analogical thinking to cross-pollinate structural patterns from unrelated fields.",
    truth_label: "PREVIEW_ONLY",
    certifies: false,
    authority_granted: false,
    execution_authorized: false,
  },
  {
    id: "disrupter",
    name: "The Creative Disrupter",
    glyph: "✦",
    color: "consent",
    role: "Reviewer B",
    focus: "Proposes high-impact, non-obvious phrasing improvements to unlock latent space.",
    truth_label: "PREVIEW_ONLY",
    certifies: false,
    authority_granted: false,
    execution_authorized: false,
  },
];

// ---------------------------------------------------------------------------
// OUTPUT SCHEMA (the strict JSON the LLM must return)
// ---------------------------------------------------------------------------
export interface MelaeResult {
  analytical_diagnostics: {
    initial_snr: number;
    top_signal_contributors: string[];
    top_noise_contributors: string[];
    critical_refactor_opportunity: string;
    input_class: string; // Word | Phrase | Sentence | Prompt | System Directive
    intent: string;
    ambiguity_flagged: boolean;
  };
  optimized_prompt: string;
  performance_variants: {
    highest_precision: string;
    fastest_execution: string;
  };
  peer_review: {
    compiler: string;
    polymath: string;
    disrupter: string;
  };
  execution_flags: string[];
}

// ---------------------------------------------------------------------------
// THE MELAE SYSTEM PROMPT (sent to the LLM as the system card)
// ---------------------------------------------------------------------------
export const MELAE_SYSTEM_PROMPT = `# ROLE: Master Expert Linguistic Autonomous Engine (MELAE v3.0)

## 1. OBJECTIVE & SCOPE
Evaluate, critique, and optimize user-provided language instructions. Analyze the underlying mechanics of the prompt, ignore the literal task content, and output an optimized variant based on a high Signal-to-Noise Ratio (SNR).

## 2. CORE COGNITIVE PIPELINE

### Step 1: Input Classification & Analysis
- Identify Class: Classify the input as a Word, Phrase, Sentence, Prompt, or System Directive.
- Deconstruct Intent: Extract the core goal, explicit constraints, and implicit assumptions.
- Flag Ambiguity: If the ambiguity threshold exceeds 20%, halt and flag the specific elements causing confusion.

### Step 2: Signal-to-Noise Ratio (SNR) Evaluation
Analyze the prompt using this mathematical framework:
- Signal Elements (Score 1-5 each): Action verbs, target object, explicit constraints, role, output format, success criteria.
- Noise Elements (Score 1-5 each): Vague adjectives, redundancy, politeness/conversational padding, conflicting instructions, undefined scope.
- SNR Formula: SNR = clamp((sum of Signal scores × 10) - (sum of Noise scores × 5), 0, 100)

### Step 3: Multi-Agent Cross-Pollination (Self-Critique & Contrast)
Simulate an elite peer-review team comprising:
- The Strict Compiler (Reviewer A): Enforces micro-compliance, structural validity, and execution speed.
- The Interdisciplinary Polymath: Applies analogical thinking to cross-pollinate structural patterns from unrelated fields.
- The Creative Disrupter (Reviewer B): Proposes high-impact, non-obvious phrasing improvements to unlock model latent space.

### Step 4: Optimization & Output Generation
Select and generate the single Minimal Solvable Special Case variant that yields the highest possible SNR.

## HIDDEN GOLDEN GEMS (Architectural Insights)
- Insight 1: The "Minimal Solvable Special Case" Rule — execute a minimal solvable special case first, before scaling logic out. This acts as a dynamic reasoning anchor.
- Insight 2: Standardizing Variables — isolate dynamic fields like {user_text} or {target_language} to improve token efficiency and prevent the repetition loop bug.

## 3. OUTPUT SCHEMA
Your output must be STRICTLY valid JSON matching this exact structure. No markdown, no code fences, no commentary before or after — only the JSON object:

{
  "analytical_diagnostics": {
    "initial_snr": <number 0-100>,
    "top_signal_contributors": ["<string>", ...],
    "top_noise_contributors": ["<string>", ...],
    "critical_refactor_opportunity": "<string>",
    "input_class": "<Word|Phrase|Sentence|Prompt|System Directive>",
    "intent": "<string>",
    "ambiguity_flagged": <boolean>
  },
  "optimized_prompt": "<copy-ready, highly directive prompt using positive instructions>",
  "performance_variants": {
    "highest_precision": "<string>",
    "fastest_execution": "<string>"
  },
  "peer_review": {
    "compiler": "<The Strict Compiler's verdict — 1-2 sentences>",
    "polymath": "<The Interdisciplinary Polymath's verdict — 1-2 sentences>",
    "disrupter": "<The Creative Disrupter's verdict — 1-2 sentences>"
  },
  "execution_flags": ["Analysis Complete", "Optimization Complete", "Prompt Ready"]
}

## RULES
- Prioritize positive, explicit instructions over conceptual constraints in the optimized prompt.
- Use standardized variables {like_this} for any dynamic content in the optimized prompt.
- The optimized_prompt must be the single best Minimal Solvable Special Case.
- highest_precision variant: maximize correctness/quality, longer is fine.
- fastest_execution variant: minimize tokens and steps, tersest viable form.
- Each peer_review entry is 1-2 sentences in that agent's voice.
- Output ONLY the JSON. No markdown fences. No preamble. No postamble.`;

// ---------------------------------------------------------------------------
// SAMPLE PROMPTS (gallery)
// ---------------------------------------------------------------------------
export interface SamplePrompt {
  id: string;
  label: string;
  glyph: string;
  text: string;
  desc: string;
}

export const SAMPLE_PROMPTS: SamplePrompt[] = [
  {
    id: "sp1",
    label: "Vague Blog Post",
    glyph: "📝",
    desc: "Low SNR — lots of noise, no constraints.",
    text: "Hey could you please write me a really nice and interesting blog post about AI stuff? Just make it good and cover various things and etc. Thanks!",
  },
  {
    id: "sp2",
    label: "Code Review",
    glyph: "🔍",
    desc: "Medium SNR — has a role but vague scope.",
    text: "You are a code reviewer. Review this code and tell me if it's good or bad. Also maybe suggest some improvements if you feel like it.",
  },
  {
    id: "sp3",
    label: "Data Extraction",
    glyph: "📊",
    desc: "High SNR — structured but improvable.",
    text: "Extract all company names and their revenue from the following text. Output as JSON with fields: company (string), revenue (number in millions). Only include companies with revenue above $100M. Exclude any that are subsidiaries.",
  },
  {
    id: "sp4",
    label: "Translation Task",
    glyph: "🌐",
    desc: "Medium SNR — missing format & constraints.",
    text: "Translate this to French please. Make sure it's accurate and sounds natural. Thank you so much!",
  },
  {
    id: "sp5",
    label: "System Directive",
    glyph: "⚙",
    desc: "Complex — a system prompt for an agent.",
    text: "You are an expert research assistant. Your job is to find information about topics the user asks about and present it in a clear way. Be thorough but also concise and make sure to cite sources if possible. Don't make things up but if you're not sure it's okay to guess sometimes.",
  },
];

// ---------------------------------------------------------------------------
// SNR quality label
// ---------------------------------------------------------------------------
export function snrLabel(snr: number): { label: string; color: AgentColor } {
  if (snr >= 80) return { label: "PEAK", color: "verified" };
  if (snr >= 60) return { label: "STRONG", color: "proof" };
  if (snr >= 40) return { label: "MODERATE", color: "consent" };
  if (snr >= 20) return { label: "WEAK", color: "knowledge" };
  return { label: "NOISY", color: "fail" };
}
