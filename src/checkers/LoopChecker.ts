import type {
  AgentStep,
  Checker,
  CheckerContext,
  GuardDecision,
} from '../types.js';
import { canonicalizeKey } from '../normalization/canonicalize.js';
import { detectCycle, type StepSignature } from '../normalization/cycle.js';

/**
 * Options for {@link LoopChecker}.
 */
export interface LoopOptions {
  /**
   * Maximum number of steps allowed in a session.
   *
   * The step that would exceed the limit is blocked. `0` blocks every step.
   */
  maxSteps?: number;
  /**
   * Maximum wall-clock duration of a session, in milliseconds.
   *
   * Requires the guard to know the session start time; when a checker is used
   * standalone, pass `startTime` to the constructor.
   */
  maxDuration?: number;
  /**
   * Maximum number of *identical* tool calls (same tool, equivalent arguments)
   * allowed within the history window.
   *
   * Default: `3`.
   */
  maxRepeatedCalls?: number;
  /**
   * Detect repeating *sequences* of calls, e.g. `A → B → A → B`.
   *
   * Default: `true`.
   */
  detectCycles?: boolean;
  /**
   * Longest cycle to consider, in steps.
   *
   * Default: `5`.
   */
  maxCycleLength?: number;
  /**
   * How many recent steps to inspect.
   *
   * Default: `50`.
   */
  windowSize?: number;
}

/**
 * Detects runaway agent loops.
 *
 * Three independent signals are evaluated:
 *
 *  1. **Step budget** — the session exceeded `maxSteps`.
 *  2. **Time budget** — the session exceeded `maxDuration`.
 *  3. **Repetition** — the same tool with equivalent arguments was called
 *     more than `maxRepeatedCalls` times, or a cycle of calls repeated.
 *
 * Argument comparison is order-insensitive: `{ a: 1, b: 2 }` and
 * `{ b: 2, a: 1 }` are treated as the same call. This is what makes the
 * checker actually catch the loops it claims to catch.
 */
export class LoopChecker implements Checker {
  readonly name = 'LoopChecker';

  private readonly maxSteps?: number;
  private readonly maxDuration?: number;
  private readonly maxRepeatedCalls: number;
  private readonly detectCycles: boolean;
  private readonly maxCycleLength: number;
  private readonly windowSize: number;
  private readonly standaloneStartTime: number | undefined;

  constructor(options: LoopOptions = {}, startTime?: number) {
    this.maxSteps = options.maxSteps;
    this.maxDuration = options.maxDuration;
    this.maxRepeatedCalls = options.maxRepeatedCalls ?? 3;
    this.detectCycles = options.detectCycles ?? true;
    this.maxCycleLength = options.maxCycleLength ?? 5;
    this.windowSize = options.windowSize ?? 50;
    this.standaloneStartTime = startTime;

    if (this.maxSteps !== undefined && (!Number.isFinite(this.maxSteps) || this.maxSteps < 0)) {
      throw new RangeError(`maxSteps must be a non-negative number, received ${this.maxSteps}`);
    }
    if (
      this.maxDuration !== undefined &&
      (!Number.isFinite(this.maxDuration) || this.maxDuration < 0)
    ) {
      throw new RangeError(
        `maxDuration must be a non-negative number, received ${this.maxDuration}`
      );
    }
    if (this.maxRepeatedCalls < 1) {
      throw new RangeError(
        `maxRepeatedCalls must be >= 1, received ${this.maxRepeatedCalls}`
      );
    }
  }

  /**
   * Evaluate a step.
   *
   * @param step The proposed step.
   * @param history Recent steps, oldest first.
   * @param context Optional guard context (provides the session start time).
   */
  check(
    step: AgentStep,
    history: AgentStep[],
    context?: CheckerContext
  ): GuardDecision {
    const now = context?.now ?? step.timestamp ?? Date.now();
    const startedAt = context?.startedAt ?? this.standaloneStartTime;

    // 1. Step budget. `history.length` counts steps already accepted.
    if (this.maxSteps !== undefined && history.length >= this.maxSteps) {
      return {
        allowed: false,
        reason: 'MAX_STEPS_EXCEEDED',
        severity: 'high',
        checker: this.name,
        message: `Step budget exhausted: ${history.length}/${this.maxSteps} steps used.`,
        metadata: { limit: this.maxSteps, used: history.length },
      };
    }

    // 2. Time budget. Skipped when no session start time is known, e.g. when
    //    the checker is used standalone without a guard. A start time of `0`
    //    is valid, so `undefined` — not `0` — marks "unknown".
    if (this.maxDuration !== undefined && startedAt !== undefined) {
      const elapsed = now - startedAt;
      if (elapsed > this.maxDuration) {
        return {
          allowed: false,
          reason: 'MAX_DURATION_EXCEEDED',
          severity: 'high',
          checker: this.name,
          message: `Time budget exhausted: ${elapsed}ms elapsed, limit ${this.maxDuration}ms.`,
          metadata: { limit: this.maxDuration, elapsed },
        };
      }
    }

    // 3. Repetition / cycle detection — only meaningful for tool calls.
    if (step.type === 'tool_call') {
      const window = history.slice(-this.windowSize);

      const signature = signatureOf(step);
      const identical = countIdentical(window, signature);

      if (identical >= this.maxRepeatedCalls) {
        return {
          allowed: false,
          reason: 'LOOP_PATTERN_DETECTED',
          severity: 'high',
          checker: this.name,
          message: `Tool "${step.tool ?? 'unknown'}" called ${identical + 1} times with equivalent arguments.`,
          metadata: {
            tool: step.tool,
            repeats: identical + 1,
            limit: this.maxRepeatedCalls,
          },
        };
      }

      if (this.detectCycles) {
        const signatures = window.map(signatureOf);
        const cycle = detectCycle([...signatures, signature], this.maxCycleLength);
        if (cycle) {
          return {
            allowed: false,
            reason: 'CYCLE_DETECTED',
            severity: 'high',
            checker: this.name,
            message: `Repeating cycle detected across ${cycle.length} steps: ${cycle
              .map((s) => s.tool || s.type)
              .join(' → ')}.`,
            metadata: { cycleLength: cycle.length, cycle },
          };
        }
      }
    }

    return { allowed: true };
  }
}

/** Build the comparable signature of a step. */
function signatureOf(step: AgentStep): StepSignature {
  return {
    type: step.type,
    tool: step.tool ?? '',
    args: step.args === undefined ? '' : canonicalizeKey(step.args),
  };
}

/** Count how many history entries carry an equivalent signature. */
function countIdentical(history: readonly AgentStep[], target: StepSignature): number {
  let count = 0;
  for (const entry of history) {
    const sig = signatureOf(entry);
    if (sig.type === target.type && sig.tool === target.tool && sig.args === target.args) {
      count += 1;
    }
  }
  return count;
}
