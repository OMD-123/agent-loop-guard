import type { ViolationHandler } from "../types/index";

/** Configuration for {@link AgentLoopGuard}. */
export interface AgentLoopGuardOptions {
  /** Maximum number of steps (LLM + tool + custom) allowed in a run. */
  maxSteps?: number;
  /** Maximum run duration in ms (monotonic). Disabled when 0/omitted. */
  maxDuration?: number;
  /** Max consecutive identical (same name + same args) calls before block. */
  maxRepeatedCalls?: number;
  /** Max consecutive same-tool calls before block. */
  maxSameToolCalls?: number;
  /** Window length used by the circular-pattern detector. */
  loopPatternWindow?: number;
  /** When false, arguments are ignored for repeated-call detection. */
  detectDuplicateArguments?: boolean;
  /** Maximum total steps allowed across the entire agent session (for ExecutionBoundsDetector). */
  maxTotalSteps?: number;
  /** Maximum total duration in ms allowed across the entire agent session (for ExecutionBoundsDetector). */
  maxTotalDurationMs?: number;
  /** Maximum total number of tool and LLM calls allowed (for RateLimiterDetector by total count). */
  maxTotalCalls?: number;
  /** Callback function invoked when a violation is detected. */
  onViolation?: ViolationHandler;
}

/** Internal resolved configuration (all fields present). */
export interface ResolvedOptions extends Required<Omit<AgentLoopGuardOptions, "onViolation">> {
  onViolation?: ViolationHandler;
}

/** Applied when an option is not provided. Limits of 0 mean "disabled". */
export const DEFAULT_OPTIONS: Omit<ResolvedOptions, "onViolation"> = {
  maxSteps: 0,
  maxDuration: 0,
  maxRepeatedCalls: 0,
  maxSameToolCalls: 0,
  loopPatternWindow: 0,
  detectDuplicateArguments: true,
  maxTotalSteps: 0,
  maxTotalDurationMs: 0,
  maxTotalCalls: 0,
};

export function resolveOptions(input: AgentLoopGuardOptions = {}): ResolvedOptions {
  if (typeof input !== "object" || input === null) {
    throw new Error('agent-loop-guard: invalid configuration: expected an options object, received ' + String(input));
  }

  const out: ResolvedOptions = {
    maxSteps: pick(input.maxSteps, DEFAULT_OPTIONS.maxSteps),
    maxDuration: pick(input.maxDuration, DEFAULT_OPTIONS.maxDuration),
    maxRepeatedCalls: pick(input.maxRepeatedCalls, DEFAULT_OPTIONS.maxRepeatedCalls),
    maxSameToolCalls: pick(input.maxSameToolCalls, DEFAULT_OPTIONS.maxSameToolCalls),
    loopPatternWindow: pick(input.loopPatternWindow, DEFAULT_OPTIONS.loopPatternWindow),
    detectDuplicateArguments: input.detectDuplicateArguments ?? DEFAULT_OPTIONS.detectDuplicateArguments,
    maxTotalSteps: pick(input.maxTotalSteps, DEFAULT_OPTIONS.maxTotalSteps),
    maxTotalDurationMs: pick(input.maxTotalDurationMs, DEFAULT_OPTIONS.maxTotalDurationMs),
    maxTotalCalls: pick(input.maxTotalCalls, DEFAULT_OPTIONS.maxTotalCalls),
  };

  if (input.onViolation !== undefined && typeof input.onViolation !== "function") {
    throw new Error('agent-loop-guard: invalid configuration: onViolation must be a function');
  }
  out.onViolation = input.onViolation;

  // maxSteps: unlimited(0) or a positive integer.
  assertNonNegativeInt(out.maxSteps, "maxSteps");

  // maxDuration: unlimited(0) or a positive number.
  assertNonNegativeNumber(out.maxDuration, "maxDuration");

  // maxRepeatedCalls: 0 disables; otherwise must be >= 1.
  assertNonNegativeInt(out.maxRepeatedCalls, "maxRepeatedCalls");
  if (out.maxRepeatedCalls !== 0 && out.maxRepeatedCalls < 1) {
    throw new Error('agent-loop-guard: invalid configuration: maxRepeatedCalls must be >= 1 when enabled');
  }

  // maxSameToolCalls: 0 disables; otherwise >= 1.
  assertNonNegativeInt(out.maxSameToolCalls, "maxSameToolCalls");
  if (out.maxSameToolCalls !== 0 && out.maxSameToolCalls < 1) {
    throw new Error('agent-loop-guard: invalid configuration: maxSameToolCalls must be >= 1 when enabled');
  }

  // loopPatternWindow: 0 disables; otherwise >= 2 (a loop needs >= 2 entries).
  assertNonNegativeInt(out.loopPatternWindow, "loopPatternWindow");
  if (out.loopPatternWindow !== 0 && out.loopPatternWindow < 2) {
    throw new Error('agent-loop-guard: invalid configuration: loopPatternWindow must be >= 2 when enabled');
  }

  // maxTotalSteps: unlimited(0) or a positive integer.
  assertNonNegativeInt(out.maxTotalSteps, "maxTotalSteps");

  // maxTotalDurationMs: unlimited(0) or a positive number.
  assertNonNegativeNumber(out.maxTotalDurationMs, "maxTotalDurationMs");

  // maxTotalCalls: unlimited(0) or a positive integer.
  assertNonNegativeInt(out.maxTotalCalls, "maxTotalCalls");

  return out;
}

function pick<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

function assertNonNegativeInt(value: number, key: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('agent-loop-guard: invalid configuration: ' + key + ' must be a non-negative integer, received ' + String(value));
  }
}

function assertNonNegativeNumber(value: number, key: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error('agent-loop-guard: invalid configuration: ' + key + ' must be a non-negative number, received ' + String(value));
  }
}
