import type { GuardDecision, GuardReason } from "../types/index.js";

/** @internal Build an allow decision. */
export function allow(stepCount: number): GuardDecision {
  return { allowed: true, stepCount };
}

/** @internal Build a block decision with optional structured details. */
export function deny(
  reason: GuardReason,
  stepCount: number,
  details?: Record<string, unknown>,
): GuardDecision {
  return details === undefined
    ? { allowed: false, reason, stepCount }
    : { allowed: false, reason, stepCount, details };
}
