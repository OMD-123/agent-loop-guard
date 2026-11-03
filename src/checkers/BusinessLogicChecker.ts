import type {
  AgentStep,
  Checker,
  CheckerContext,
  GuardDecision,
} from '../types.js';

/**
 * Options for {@link BusinessLogicChecker}.
 */
export interface LogicOptions {
  /**
   * Predicate that returns `true` when the step is acceptable.
   *
   * A step that fails the predicate is blocked.
   */
  validator: (step: AgentStep, history: readonly AgentStep[]) => boolean;
  /**
   * Message reported when the predicate fails.
   */
  errorMessage?: string;
  /**
   * Severity of the violation.
   *
   * Default: `'high'`.
   */
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Enforces custom, domain-specific rules on agent steps.
 *
 * The validator is a plain synchronous predicate, so it can express anything
 * from "tool X requires flag Y" to "never delete records on a weekend".
 */
export class BusinessLogicChecker implements Checker {
  readonly name = 'BusinessLogicChecker';

  private readonly validator: (
    step: AgentStep,
    history: readonly AgentStep[]
  ) => boolean;
  private readonly errorMessage: string;
  private readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(options: LogicOptions) {
    if (typeof options?.validator !== 'function') {
      throw new TypeError('BusinessLogicChecker requires a `validator` function');
    }
    this.validator = options.validator;
    this.errorMessage = options.errorMessage ?? 'Step violates business logic rules.';
    this.severity = options.severity ?? 'high';
  }

  /**
   * Evaluate a step.
   */
  check(step: AgentStep, history: AgentStep[], _context?: CheckerContext): GuardDecision {
    let ok: boolean;
    try {
      ok = this.validator(step, history);
    } catch (error) {
      // A throwing validator must not crash the host agent. Treat a thrown
      // predicate as a violation — fail closed.
      return {
        allowed: false,
        reason: 'BUSINESS_LOGIC_VIOLATION',
        severity: 'critical',
        checker: this.name,
        message: `Validator threw while evaluating the step: ${describeError(error)}`,
        metadata: { error: describeError(error) },
      };
    }

    if (!ok) {
      return {
        allowed: false,
        reason: 'BUSINESS_LOGIC_VIOLATION',
        severity: this.severity,
        checker: this.name,
        message: this.errorMessage,
      };
    }

    return { allowed: true };
  }
}

/** Render an unknown thrown value as a short string. */
function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
