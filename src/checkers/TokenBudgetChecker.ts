import type {
  AgentStep,
  Checker,
  CheckerContext,
  GuardDecision,
} from '../types.js';

/**
 * Options for {@link TokenBudgetChecker}.
 */
export interface TokenBudgetOptions {
  /**
   * Maximum number of tokens the session may consume.
   *
   * Tokens are read from `step.tokens` when present. Steps without a token
   * count contribute nothing.
   */
  maxTokens: number;
  /**
   * Warn (but allow) once usage crosses this fraction of the budget.
   *
   * Default: `0.8`. Set to `1` to disable.
   */
  warnThreshold?: number;
  /**
   * Severity of the violation.
   *
   * Default: `'high'`.
   */
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Blocks a session once it exceeds a token budget.
 *
 * Protects against the "one more call" behaviour that turns a small agent
 * loop into an expensive bill.
 */
export class TokenBudgetChecker implements Checker {
  readonly name = 'TokenBudgetChecker';

  private readonly maxTokens: number;
  private readonly warnThreshold: number;
  private readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(options: TokenBudgetOptions) {
    if (!Number.isFinite(options?.maxTokens) || options.maxTokens <= 0) {
      throw new RangeError(
        `maxTokens must be a positive number, received ${options?.maxTokens}`
      );
    }
    this.maxTokens = options.maxTokens;
    this.warnThreshold = options.warnThreshold ?? 0.8;
    this.severity = options.severity ?? 'high';
  }

  /**
   * Evaluate a step.
   */
  check(step: AgentStep, history: AgentStep[], _context?: CheckerContext): GuardDecision {
    const used = sumTokens(history);
    const incoming = step.tokens ?? 0;
    const projected = used + incoming;

    if (projected > this.maxTokens) {
      return {
        allowed: false,
        reason: 'TOKEN_BUDGET_EXCEEDED',
        severity: this.severity,
        checker: this.name,
        message: `Token budget exceeded: ${projected}/${this.maxTokens} tokens.`,
        metadata: { used, incoming, projected, limit: this.maxTokens },
      };
    }

    if (this.warnThreshold < 1 && projected >= this.maxTokens * this.warnThreshold) {
      // Not a violation — but surfaced so the caller can log a warning.
      return {
        allowed: true,
        reason: 'TOKEN_BUDGET_EXCEEDED',
        severity: 'low',
        checker: this.name,
        message: `Token budget ${Math.round(this.warnThreshold * 100)}% consumed (${projected}/${this.maxTokens}).`,
        metadata: { used, incoming, projected, limit: this.maxTokens, warning: true },
      };
    }

    return { allowed: true };
  }
}

/** Sum the token counts of a history slice. */
function sumTokens(history: readonly AgentStep[]): number {
  let total = 0;
  for (const step of history) {
    if (typeof step.tokens === 'number' && Number.isFinite(step.tokens)) {
      total += step.tokens;
    }
  }
  return total;
}
