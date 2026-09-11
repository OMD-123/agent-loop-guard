import type { AgentStep, GuardDecision } from "../types/index";
import type { GuardState } from "../core/GuardState";
import type { ResolvedOptions } from "../core/options";

export type { AgentStep, GuardDecision };

/**
 * Context handed to each detector on every {@link AgentLoopGuard.check} call.
 * The candidate step has NOT yet been committed to `state` — detectors inspect
 * it against the prior committed history and counters, then the guard commits
 * only when no detector blocks.
 */
export interface DetectorContext {
  candidate: AgentStep;
  /** Stable key for the candidate: `${type}:${name}#${canonicalArgs}`. */
  candidateKey: string;
  state: GuardState;
  /** Total steps including the candidate (1-based count of this call). */
  stepCount: number;
  options: ResolvedOptions;
  /** Monotonic clock value (ms) for this check. */
  now: number;
}

/**
 * A single detection rule. Detectors are stateless with respect to the guard's
 * history (they read `state`), but may keep their own bounded counters; the
 * guard calls {@link Detector.reset} on {@link AgentLoopGuard.reset}.
 */
export interface Detector {
  readonly name: string;
  reset(): void;
  /** Return a blocking decision, or `null` if no violation for this step. */
  check(ctx: DetectorContext): GuardDecision | null;
}
