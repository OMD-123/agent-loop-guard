import type {
  AgentStep,
  Checker,
  CheckerContext,
  GuardDecision,
} from '../types.js';
import { countOccurrences, extractText, normalizeVariants } from '../utils/content.js';

/**
 * Options for {@link SecurityChecker}.
 */
export interface SecurityOptions {
  /**
   * Enable prompt-injection detection.
   *
   * Default: `true`.
   */
  detectInjection?: boolean;
  /**
   * Lowercase words that must not appear in step content.
   *
   * Matching is substring-based and case-insensitive.
   */
  blockUnsafeWords?: string[];
  /**
   * Extra regular expressions treated as injection attempts.
   *
   * They are evaluated against normalised text (NFKC-folded, whitespace
   * collapsed, lowercased), so they should be written in that form.
   */
  customInjectionPatterns?: RegExp[];
  /**
   * Disable the built-in injection patterns.
   *
   * Default: `false`.
   */
  ignoreDefaultPatterns?: boolean;
  /**
   * Only inspect steps of these types.
   *
   * Default: `['tool_call', 'llm_response', 'system_message']` (all).
   */
  inspectTypes?: AgentStep['type'][];
}

/**
 * Default prompt-injection patterns.
 *
 * These are matched against normalised text: NFKC-folded, whitespace-collapsed
 * and lowercased. Obfuscation attempts such as `I g n o r e   a l l` or
 * full-width characters therefore still match.
 */
export const DEFAULT_INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore (all |any |the )?(previous |prior |above |earlier )?instructions?/,
  /ignore (all |any )?(previous |prior )?prompts?/,
  /disregard (all |any |the )?(previous |prior |above )?(instructions?|prompts?)/,
  /forget (everything|all) (you|that)/,
  /you are now (a|an|in) /,
  /act as (a|an) /,
  /bypass (the |your |all )?(security|safeguards?|guardrails?|restrictions?|filters?)/,
  /disable (the |your |all )?(safety|security|guardrails?|filters?|content policy)/,
  /reveal (your |the )?(system prompt|instructions?|rules?|prompt)/,
  /show (me )?(your |the )?(system prompt|initial instructions)/,
  /print (your |the )?(system prompt|instructions?)/,
  /developer mode/,
  /\bDAN mode\b/,
  /do anything now/,
  /without any (restrictions?|limitations?|filters?)/,
  /pretend (you|to be) /,
  /new instructions?:/,
  /system prompt:/,
  /override (your |the )?(instructions?|rules?|safety|guardrails?)/,
  /jailbreak/,
  /prompt injection/,
];

/**
 * Detects prompt injection and unsafe content in agent steps.
 *
 * The checker is heuristic and provider-independent: it inspects the raw
 * payload rather than trying to understand it. Patterns are evaluated against
 * normalised text so simple obfuscation does not bypass them.
 */
export class SecurityChecker implements Checker {
  readonly name = 'SecurityChecker';

  private readonly detectInjection: boolean;
  private readonly blockUnsafeWords: readonly string[];
  private readonly patterns: readonly RegExp[];
  private readonly inspectTypes: ReadonlySet<AgentStep['type']>;

  constructor(options: SecurityOptions = {}) {
    this.detectInjection = options.detectInjection ?? true;
    this.blockUnsafeWords = (options.blockUnsafeWords ?? []).map((word) => word.toLowerCase());
    this.inspectTypes = new Set(options.inspectTypes ?? ['tool_call', 'llm_response', 'system_message']);

    const base = options.ignoreDefaultPatterns
      ? []
      : DEFAULT_INJECTION_PATTERNS;

    this.patterns = [...base, ...(options.customInjectionPatterns ?? [])];

    for (const pattern of this.patterns) {
      if (!(pattern instanceof RegExp)) {
        throw new TypeError('customInjectionPatterns must contain RegExp instances');
      }
    }
  }

  /**
   * Evaluate a step.
   */
  check(step: AgentStep, _history: AgentStep[], _context?: CheckerContext): GuardDecision {
    if (!this.inspectTypes.has(step.type)) return { allowed: true };

    const raw = extractText(step.content);
    if (!raw) return { allowed: true };

    const variants = normalizeVariants(raw);

    if (this.detectInjection) {
      for (const pattern of this.patterns) {
        for (const variant of variants) {
          if (pattern.test(variant)) {
            return {
              allowed: false,
              reason: 'PROMPT_INJECTION_DETECTED',
              severity: 'critical',
              checker: this.name,
              message: 'Potential prompt injection detected in step content.',
              metadata: { pattern: pattern.source },
            };
          }
        }
      }
    }

    if (this.blockUnsafeWords.length > 0) {
      for (const word of this.blockUnsafeWords) {
        if (!word) continue;
        for (const variant of variants) {
          if (variant.includes(word)) {
            return {
              allowed: false,
              reason: 'UNSAFE_CONTENT_DETECTED',
              severity: 'high',
              checker: this.name,
              message: `Step content contains prohibited term "${word}".`,
              metadata: { term: word },
            };
          }
        }
      }
    }

    return { allowed: true };
  }
}

/**
 * Options for {@link InjectionScanner}.
 */
export interface InjectionScanOptions {
  /** Extra patterns to look for. */
  customInjectionPatterns?: RegExp[];
  /** Disable the built-in patterns. */
  ignoreDefaultPatterns?: boolean;
  /** Lowercase words that must not appear. */
  blockUnsafeWords?: string[];
}

/**
 * Standalone prompt-injection scanner.
 *
 * Useful when you want to inspect a string *before* it reaches the agent,
 * rather than guarding individual steps.
 */
export class InjectionScanner {
  private readonly patterns: readonly RegExp[];
  private readonly blockUnsafeWords: readonly string[];

  constructor(options: InjectionScanOptions = {}) {
    this.patterns = options.ignoreDefaultPatterns
      ? []
      : [...DEFAULT_INJECTION_PATTERNS, ...(options.customInjectionPatterns ?? [])];
    this.blockUnsafeWords = (options.blockUnsafeWords ?? []).map((w) => w.toLowerCase());
  }

  /**
   * Scan a string and return the violations found.
   */
  scan(content: unknown): GuardDecision[] {
    const text = extractText(content);
    if (!text) return [];

    const variants = normalizeVariants(text);
    const findings: GuardDecision[] = [];

    for (const pattern of this.patterns) {
      for (const variant of variants) {
        if (pattern.test(variant)) {
          findings.push({
            allowed: false,
            reason: 'PROMPT_INJECTION_DETECTED',
            severity: 'critical',
            checker: 'InjectionScanner',
            message: `Injection pattern matched: ${pattern.source}`,
            metadata: { pattern: pattern.source },
          });
          break;
        }
      }
    }

    for (const word of this.blockUnsafeWords) {
      if (!word) continue;
      const occurrences = Math.max(
        ...variants.map((variant) => countOccurrences(variant, word))
      );
      if (occurrences > 0) {
        findings.push({
          allowed: false,
          reason: 'UNSAFE_CONTENT_DETECTED',
          severity: 'high',
          checker: 'InjectionScanner',
          message: `Prohibited term "${word}" found ${occurrences} time(s).`,
          metadata: { term: word, occurrences },
        });
      }
    }

    return findings;
  }

  /**
   * `true` when the content contains nothing suspicious.
   */
  isSafe(content: unknown): boolean {
    return this.scan(content).length === 0;
  }
}
