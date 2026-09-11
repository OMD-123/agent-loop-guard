import type { AgentStep, GuardDecision, GuardStats, ViolationEvent } from "../types/index.js";
import { canonicalizeKey } from "../normalization/canonicalize.js";
import { allow } from "./decisions.js";
import { GuardState, stepKey } from "./GuardState.js";
import { resolveOptions, type AgentLoopGuardOptions, type ResolvedOptions } from "./options.js";
import type { Detector, DetectorContext } from "../detectors/types.js";
import { MaxStepsDetector } from "../detectors/MaxStepsDetector.js";
import { DurationDetector } from "../detectors/DurationDetector.js";
import { RepetitionDetector } from "../detectors/RepetitionDetector.js";
import { SameToolDetector } from "../detectors/SameToolDetector.js";
import { LoopPatternDetector } from "../detectors/LoopPatternDetector.js";
import { ExecutionBoundsDetector } from "../detectors/ExecutionBoundsDetector.js";
import { RateLimiterDetector } from "../detectors/RateLimiterDetector.js";

/** Monotonic clock: prefers performance.now, falls back to Date.now. */
function nowMonotonic(): number {
  const perf = (globalThis as { performance?: { now(): number } }).performance;
  return perf ? perf.now() : Date.now();
}

/**
 * Provider-independent safety guard for AI agent loops.
 *
 * The guard ONLY observes steps — it never executes tools, models, or any
 * caller code. You call `check(step)` before each step; if the returned
 * decision is `allowed: false` you stop (or throw). This makes the guard safe
 * to drop into any agent architecture regardless of framework.
 *
 * Lifecycle: `start()` begins a run (records start time); `check()` validates
 * the next step; `end()` closes the run. For fire-and-forget usage, `check()` 
 * lazily starts the run on first call, so `start()` is optional.
 */
export class AgentLoopGuard {
  private readonly options: ResolvedOptions;
  private readonly state = new GuardState();
  private readonly detectors: Detector[];

  /** True once `start()` has been called (or a check lazily started). */
  private started = false;
  /** True after `end()` / `reset()`; further checks will lazily re-start. */
  private ended = false;

  constructor(options: AgentLoopGuardOptions = {}) {
    this.options = resolveOptions(options);

    // Bounded history window: enough for pattern detection + same-tool runs.
    const fallback = Math.max(this.options.loopPatternWindow, this.options.maxSameToolCalls * 2);
    this.state.historyLimit = Math.max(fallback, 2);

    this.detectors = [
      new MaxStepsDetector(),
      new DurationDetector(),
      new RepetitionDetector(),
      new SameToolDetector(),
      new LoopPatternDetector(),
      new ExecutionBoundsDetector(),
      new RateLimiterDetector(),
    ];
  }

  /** Begin a new run. Records the monotonic start time. Idempotent until reset. */
  start(timestamp?: number): this {
    if (!this.started || this.ended) {
      const t =
        typeof timestamp === "number" && Number.isFinite(timestamp)
          ? timestamp
          : nowMonotonic();
      this.state.startTime = t;
      this.state.lastSampleTime = t;
      this.started = true;
      this.ended = false;
    }
    return this;
  }

  /** Close the current run. After this, `check()` will lazily start a new one. */
  end(): this {
    this.ended = true;
    return this;
  }

  /** Clear all run state so the same instance can guard an independent run. */
  reset(): this {
    this.state.reset();
    for (const d of this.detectors) d.reset();
    this.started = false;
    this.ended = false;
    return this;
  }

  /**
   * Validate the next step. Returns a structured decision — never throws.
   * The step is committed to history only when no detector blocks, so a blocked
   * step does not poison subsequent runs' history.
   */
  check(step: AgentStep): GuardDecision {
    this.ensureStarted(step);

    // Prefer the step's supplied timestamp (consistent with the calling agent's
    // clock) then fall back to the monotonic clock.
    const now =
      typeof step.timestamp === "number" && Number.isFinite(step.timestamp)
        ? step.timestamp
        : nowMonotonic();

    const argsKey = this.options.detectDuplicateArguments
      ? canonicalizeKey(step.arguments)
      : "args-ignored";
    const candidateKey = stepKey(step, argsKey);

    const stepCount = this.state.stepCount + 1;
    const ctx: DetectorContext = {
      candidate: step,
      candidateKey,
      state: this.state,
      stepCount,
      options: this.options,
      now,
    };

    for (const detector of this.detectors) {
      const result = detector.check(ctx);
      if (result && !result.allowed) {
        this.emitViolation(result, now);
        return result;
      }
    }

    // No violation: commit the step.
    this.commit(step, candidateKey, now);
    return allow(this.state.stepCount);
  }

  /** Read-only runtime statistics for the current (or last) run. */
  stats(): GuardStats {
    const start = this.state.startTime;
    const last = this.state.lastSampleTime ?? start;
    const duration = start !== null && last !== null ? Math.round(last - start) : 0;
    return {
      stepCount: this.state.stepCount,
      toolCalls: this.state.toolCalls,
      llmCalls: this.state.llmCalls,
      duration,
      uniqueTools: this.state.uniqueTools.size,
      // Repeated calls = steps that duplicated the immediately prior step
      // (a bounded, O(1) counter tracked in GuardState).
      repeatedCalls: this.state.repeatCount,
    };
  }

  /** Number of steps recorded so far this run. */
  get stepCount(): number {
    return this.state.stepCount;
  }

  // --- internals -----------------------------------------------------------

  private ensureStarted(step: AgentStep): void {
    if (!this.started || this.ended) {
      this.start(step.timestamp);
    }
  }

  private commit(step: AgentStep, key: string, now: number): void {
    this.state.lastSampleTime = now;
    this.state.stepCount += 1;
    if (step.type === "tool") {
      this.state.toolCalls += 1;
      this.state.uniqueTools.add(step.name);
    } else if (step.type === "llm") {
      this.state.llmCalls += 1;
    }
    this.state.record(key);
  }

  private emitViolation(decision: GuardDecision, now: number): void {
    const handler = this.options.onViolation;
    if (!handler || decision.allowed) return;
    const event: ViolationEvent = {
      reason: decision.reason,
      stepCount: decision.stepCount,
      timestamp: Math.round(now),
      details: decision.details,
    };
    try {
      handler(event);
    } catch {
      // A misbehaving consumer callback must never break the guard's decision.
    }
  }
}
