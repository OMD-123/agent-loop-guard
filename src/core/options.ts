import type { ViolationHandler } from "../types/index.js";

/**
 * Configuration for {@link AgentLoopGuard}.
 *
 * Every limit is optional. When omitted, that particular protection is
 * disabled (an unlimited budget). See {@link DEFAULT_OPTIONS} for the resolved
 * defaults applied after construction.
 */
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
  /** Fired once per blocking decision. */
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
};

const ERR_PREFIX = "agent-loop-guard: invalid configuration";

/**
 * Validate user-supplied options and fill in defaults.
 * Throws a clear, typed error rather than silently accepting bad config.
 */
export function resolveOptions(input: AgentLoopGuardOptions = {}): ResolvedOptions {
  if (typeof input !== "object" || input === null) {
    throw new Error(`${ERR_PREFIX}: expected an options object, received ${String(input)}`);
  }

  const out: ResolvedOptions = {
    maxSteps: pick(input.maxSteps, DEFAULT_OPTIONS.maxSteps),
    maxDuration: pick(input.maxDuration, DEFAULT_OPTIONS.maxDuration),
    maxRepeatedCalls: pick(input.maxRepeatedCalls, DEFAULT_OPTIONS.maxRepeatedCalls),
    maxSameToolCalls: pick(input.maxSameToolCalls, DEFAULT_OPTIONS.maxSameToolCalls),
    loopPatternWindow: pick(input.loopPatternWindow, DEFAULT_OPTIONS.loopPatternWindow),
    detectDuplicateArguments: input.detectDuplicateArguments ?? DEFAULT_OPTIONS.detectDuplicateArguments,
  };

  // maxSteps: unlimited(0) or a positive integer.
  assertNonNegativeInt(out.maxSteps, "maxSteps");

  // maxDuration: unlimited(0) or a positive number.
  assertNonNegativeNumber(out.maxDuration, "maxDuration");

  // maxRepeatedCalls: 0 disables; otherwise must be >= 1.
  assertNonNegativeInt(out.maxRepeatedCalls, "maxRepeatedCalls");
  if (out.maxRepeatedCalls !== 0 && out.maxRepeatedCalls < 1) {
    throw new Error(`${ERR_PREFIX}: maxRepeatedCalls must be >= 1 when enabled`);
  }

  // maxSameToolCalls: 0 disables; otherwise >= 1.
  assertNonNegativeInt(out.maxSameToolCalls, "maxSameToolCalls");
  if (out.maxSameToolCalls !== 0 && out.maxSameToolCalls < 1) {
    throw new Error(`${ERR_PREFIX}: maxSameToolCalls must be >= 1 when enabled`);
  }

  // loopPatternWindow: 0 disables; otherwise >= 2 (a loop needs >= 2 entries).
  assertNonNegativeInt(out.loopPatternWindow, "loopPatternWindow");
  if (out.loopPatternWindow !== 0 && out.loopPatternWindow < 2) {
    throw new Error(`${ERR_PREFIX}: loopPatternWindow must be >= 2 when enabled`);
  }

  if (input.onViolation !== undefined && typeof input.onViolation !== "function") {
    throw new Error(`${ERR_PREFIX}: onViolation must be a function`);
  }
  out.onViolation = input.onViolation;

  return out;
}

function pick<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

function assertNonNegativeInt(value: number, key: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${ERR_PREFIX}: ${key} must be a non-negative integer, received ${String(value)}`);
  }
}

function assertNonNegativeNumber(value: number, key: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${ERR_PREFIX}: ${key} must be a non-negative number, received ${String(value)}`);
  }
}
