import type {
  AgentStep,
  Checker,
  CheckerContext,
  GuardDecision,
} from '../types.js';
import { extractText, normalizeForMatching } from '../utils/content.js';

/**
 * Options for {@link HallucinationChecker}.
 */
export interface HallucinationOptions {
  /**
   * How strict the grounding check is.
   *
   * - `low` — never blocks.
   * - `medium` — blocks on strong contradiction signals only.
   * - `high` — blocks on any contradiction signal.
   *
   * Default: `medium`.
   */
  strictness?: 'low' | 'medium' | 'high';
  /**
   * Words that signal a contradiction between a tool result and an LLM claim.
   *
   * Default: a small English set.
   */
  contradictionKeywords?: string[];
  /**
   * Require a preceding tool call before evaluating an LLM response.
   *
   * Default: `true`. When `false`, every `llm_response` is evaluated.
   */
  requireToolContext?: boolean;
  /**
   * Only inspect these response types.
   *
   * Default: `['llm_response']`.
   */
  inspectTypes?: AgentStep['type'][];
}

/** Default contradiction markers. */
export const DEFAULT_CONTRADICTION_KEYWORDS: readonly string[] = [
  'actually',
  'however',
  'incorrectly',
  'instead of',
  'contrary to',
  'not found',
  'does not exist',
  "doesn't exist",
  'failed to',
  'unable to find',
  'no such',
  'as opposed to',
  'rather than',
  'despite the',
];

/**
 * Flags LLM responses that contradict the tool output they claim to be based on.
 *
 * This is a grounding heuristic, not a truth oracle: it looks for textual
 * contradiction markers in a response that follows a tool call. Use the
 * `medium`/`high` strictness levels in combination with your own domain
 * rules rather than as a sole safety net.
 */
export class HallucinationChecker implements Checker {
  readonly name = 'HallucinationChecker';

  private readonly strictness: 'low' | 'medium' | 'high';
  private readonly keywords: readonly string[];
  private readonly requireToolContext: boolean;
  private readonly inspectTypes: ReadonlySet<AgentStep['type']>;

  constructor(options: HallucinationOptions = {}) {
    this.strictness = options.strictness ?? 'medium';
    this.keywords = (options.contradictionKeywords ?? DEFAULT_CONTRADICTION_KEYWORDS).map((k) =>
      k.toLowerCase()
    );
    this.requireToolContext = options.requireToolContext ?? true;
    this.inspectTypes = new Set(options.inspectTypes ?? ['llm_response']);
  }

  /**
   * Evaluate a step.
   */
  check(step: AgentStep, history: AgentStep[], _context?: CheckerContext): GuardDecision {
    if (this.strictness === 'low') return { allowed: true };
    if (!this.inspectTypes.has(step.type)) return { allowed: true };

    const content = extractText(step.content);
    if (!content) return { allowed: true };

    if (this.requireToolContext) {
      const lastToolCall = [...history].reverse().find((h) => h.type === 'tool_call');
      if (!lastToolCall) return { allowed: true };
    }

    const normalized = normalizeForMatching(content);

    const matched = this.keywords.filter((word) => word && normalized.includes(word));
    if (matched.length === 0) return { allowed: true };

    // `high` blocks on any signal; `medium` requires more than one, or one of
    // the stronger phrases, to avoid false positives on ordinary prose.
    const shouldBlock =
      this.strictness === 'high' ||
      matched.length >= 2 ||
      matched.some((word) => STRONG_SIGNALS.has(word));

    if (!shouldBlock) return { allowed: true };

    return {
      allowed: false,
      reason: 'HALLUCINATION_SUSPECTED',
      severity: this.strictness === 'high' ? 'high' : 'medium',
      checker: this.name,
      message: `Response may contradict the preceding tool result (matched: ${matched.join(', ')}).`,
      metadata: { matched, strictness: this.strictness },
    };
  }
}

/** Contradiction phrases that are strong enough to block on their own. */
const STRONG_SIGNALS = new Set([
  'does not exist',
  "doesn't exist",
  'not found',
  'no such',
]);
