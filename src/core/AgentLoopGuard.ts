import type {
  AgentStep,
  GuardDecision,
  GuardMode,
  GuardStats,
  GuardSnapshot,
  ViolationEvent,
  ViolationHandler,
} from '../types.js';
import { LoopChecker, type LoopOptions } from '../checkers/LoopChecker.js';
import { SecurityChecker, type SecurityOptions } from '../checkers/SecurityChecker.js';
import { BusinessLogicChecker, type LogicOptions } from '../checkers/BusinessLogicChecker.js';
import { HallucinationChecker, type HallucinationOptions } from '../checkers/HallucinationChecker.js';
import { systemClock } from '../utils/clock.js';
import { RingBuffer } from '../utils/ring-buffer.js';

/**
 * Options for {@link AgentLoopGuard}.
 */
export interface AgentLoopGuardOptions {
  /** Loop-detection options. */
  loop?: LoopOptions;
  /** Security-checker options. */
  security?: SecurityOptions;
  /** Business-logic options. Enables the business-logic checker. */
  logic?: LogicOptions;
  /** Hallucination-checker options. */
  hallucination?: HallucinationOptions;
  /**
   * Enforcement mode.
   *
   * Default: `'enforce'`.
   */
  mode?: GuardMode;
  /**
   * Maximum number of steps retained in the history window.
   *
   * Default: `200`.
   */
  historyLimit?: number;
  /**
   * Called on every violation.
   */
  onViolation?: ViolationHandler;
  /**
   * Injectable clock, for deterministic tests.
   */
  clock?: () => number;
}

/**
 * The batteries-included guard.
 *
 * `AgentLoopGuard` bundles the four standard checkers behind a single object
 * and maintains its own history, so it can be used without a `Guardrail`:
 *
 * ```ts
 * const guard = new AgentLoopGuard({
 *   loop: { maxSteps: 20, maxRepeatedCalls: 3 },
 *   security: { detectInjection: true },
 * });
 *
 * guard.start();
 * const decision = guard.check(step);
 * ```
 *
 * For finer control over the pipeline, compose the checkers yourself and use
 * {@link Guardrail}.
 */
export class AgentLoopGuard {
  private readonly loopChecker: LoopChecker;
  private readonly securityChecker: SecurityChecker;
  private readonly businessChecker?: BusinessLogicChecker;
  private readonly hallucinationChecker: HallucinationChecker;

  private readonly mode: GuardMode;
  private readonly historyLimit: number;
  private readonly onViolation?: ViolationHandler;
  private readonly clock: () => number;

  private history: RingBuffer<AgentStep>;
  private startedAt: number;
  private totalChecks = 0;
  private blocked = 0;
  private consecutiveViolations = 0;
  private byReason: Record<string, number> = {};

  constructor(options: AgentLoopGuardOptions = {}) {
    this.clock = options.clock ?? systemClock;
    this.mode = options.mode ?? 'enforce';
    this.historyLimit = options.historyLimit ?? 200;
    this.onViolation = options.onViolation;

    if (!Number.isFinite(this.historyLimit) || this.historyLimit < 1) {
      throw new RangeError(`historyLimit must be >= 1, received ${this.historyLimit}`);
    }

    this.history = new RingBuffer<AgentStep>(this.historyLimit);
    this.startedAt = this.clock();

    // The loop checker needs the session start time so that its duration
    // budget can be evaluated.
    this.loopChecker = new LoopChecker(options.loop ?? {}, this.startedAt);
    this.securityChecker = new SecurityChecker(options.security ?? {});
    this.hallucinationChecker = new HallucinationChecker(
      options.hallucination ?? {}
    );
    if (options.logic) {
      this.businessChecker = new BusinessLogicChecker(options.logic);
    }
  }

  /**
   * Begin a new session: clears the history and counters.
   */
  start(): void {
    this.startedAt = this.clock();
    this.history = new RingBuffer<AgentStep>(this.historyLimit);
    this.totalChecks = 0;
    this.blocked = 0;
    this.consecutiveViolations = 0;
    this.byReason = {};
  }

  /**
   * Clear the history and counters.
   */
  reset(): void {
    this.start();
  }

  /**
   * Evaluate a step against the bundled checkers.
   */
  check(step: AgentStep): GuardDecision {
    this.totalChecks += 1;
    const history = this.history.toArray();
    const context = {
      history,
      startedAt: this.startedAt,
      now: this.clock(),
      clock: this.clock,
      mode: this.mode,
    };

    const checkers = [
      this.loopChecker,
      this.securityChecker,
      this.hallucinationChecker,
      ...(this.businessChecker ? [this.businessChecker] : []),
    ];

    for (const checker of checkers) {
      const decision = checker.check(step, history, context);
      if (!decision.allowed) {
        const enriched: GuardDecision = {
          ...decision,
          checker: decision.checker ?? checker.name,
        };

        const reason = enriched.reason ?? 'UNKNOWN';
        this.byReason[reason] = (this.byReason[reason] ?? 0) + 1;
        this.consecutiveViolations += 1;

        if (this.mode === 'monitor') {
          this.history.push(step);
          this.emitViolation({
            reason,
            step,
            timestamp: context.now,
            decision: enriched,
            checker: enriched.checker,
          });
          return { ...enriched, allowed: true };
        }

        this.blocked += 1;
        this.history.push(step);
        this.emitViolation({
          reason,
          step,
          timestamp: context.now,
          decision: enriched,
          checker: enriched.checker,
        });
        return enriched;
      }
    }

    this.history.push(step);
    this.consecutiveViolations = 0;
    return { allowed: true };
  }

  /**
   * A copy of the retained history, oldest first.
   */
  getHistory(): AgentStep[] {
    return this.history.toArray();
  }

  /** Number of retained steps. */
  getHistorySize(): number {
    return this.history.size;
  }

  /** Epoch ms at which the session started. */
  getStartTime(): number {
    return this.startedAt;
  }

  /**
   * Aggregated counters describing the session.
   */
  getStats(): GuardStats {
    return {
      totalChecks: this.totalChecks,
      allowed: this.totalChecks - this.blocked,
      blocked: this.blocked,
      monitored: 0,
      byReason: { ...this.byReason },
      byChecker: {},
      consecutiveViolations: this.consecutiveViolations,
      circuitState: 'closed',
      startedAt: this.startedAt,
    };
  }

  /**
   * A point-in-time copy of the guard's state.
   */
  snapshot(): GuardSnapshot {
    return {
      startedAt: this.startedAt,
      historySize: this.history.size,
      history: this.history.toArray(),
      stats: this.getStats(),
      circuitState: 'closed',
    };
  }

  /** Notify the violation handler, swallowing handler errors. */
  private emitViolation(event: ViolationEvent): void {
    if (!this.onViolation) return;
    try {
      this.onViolation(event);
    } catch {
      // Never let a handler failure break the agent loop.
    }
  }
}
