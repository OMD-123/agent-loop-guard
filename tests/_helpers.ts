import type { ResolvedOptions } from "../src/core/options.js";
import { GuardState } from "../src/core/GuardState.js";
import type { GuardDecision } from "../src/types/index.js";

/** Build a fully-resolved options object for direct detector unit tests. */
export function makeOptions(overrides: Partial<ResolvedOptions> = {}): ResolvedOptions {
  return {
    maxSteps: 0,
    maxDuration: 0,
    maxRepeatedCalls: 0,
    maxSameToolCalls: 0,
    loopPatternWindow: 0,
    detectDuplicateArguments: true,
    ...overrides,
  };
}

/** Make a fresh guard state with an optional start time. */
export function makeState(startTime: number | null = 100): GuardState {
  const s = new GuardState();
  s.startTime = startTime;
  s.lastSampleTime = startTime;
  return s;
}

/** Type guard: narrow a GuardDecision to its blocking (allowed:false) form. */
export function isBlocked(
  d: GuardDecision,
): d is Extract<GuardDecision, { allowed: false }> {
  return !d.allowed;
}
