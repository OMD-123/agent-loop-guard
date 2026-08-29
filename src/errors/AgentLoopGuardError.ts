import type { GuardDecision, GuardReason } from "../types/index.js";

/**
 * Thrown by callers who convert a blocking {@link GuardDecision} into an error.
 * Carries the structured decision so handlers can branch on `reason` without
 * parsing strings.
 *
 * @example
 * const decision = guard.check(step);
 * if (!decision.allowed) throw new AgentLoopGuardError(decision);
 */
export class AgentLoopGuardError extends Error {
  /** The blocking reason, e.g. "MAX_STEPS_EXCEEDED". */
  readonly reason: GuardReason;
  /** Total steps recorded at the moment of the violation. */
  readonly stepCount: number;
  /** The full decision object that triggered this error. */
  readonly decision: GuardDecision;

  constructor(decision: Extract<GuardDecision, { allowed: false }>) {
    super(`AgentLoopGuard: ${decision.reason} (step ${decision.stepCount})`);
    this.name = "AgentLoopGuardError";
    this.reason = decision.reason;
    this.stepCount = decision.stepCount;
    this.decision = decision;
    // Preserve prototype chain for instanceof under transpilation.
    Object.setPrototypeOf(this, AgentLoopGuardError.prototype);
  }
}
