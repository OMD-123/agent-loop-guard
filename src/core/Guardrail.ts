import type {
  AgentStep,
  Checker,
  CheckerContext,
  CircuitState,
  Clock,
  GuardDecision,
  GuardMode,
  GuardSnapshot,
  GuardStats,
  GuardedResult,
  ViolationEvent,
  ViolationHandler,
} from '../types.js';
import { systemClock } from '../utils/clock.js';
import { RingBuffer } from '../utils/ring-buffer.js';

/**
 * Options for {@link Guardrail}.
 */
export interface GuardrailOptions {
  /**
   * Enforcement mode.
   *
   * - `enforce` (default) — violations block the step.
   * - `monitor` — violations are recorded and reported, but the step runs.
   */
  mode?: GuardMode;
  /**
   * Maximum number of steps retained in the history window.
   *
   * Bounds memory usage for long-running agents.
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
   *
   * Default: `Date.now`.
   */
  clock?: Clock;
  /**
   * Enable the circuit breaker.
   *
   * When enabled, `failureThreshold` consecutive violations open the
   * circuit; subsequent steps are rejected without running the checkers.
   *
   * Default: `false`.
   */
  circuitBreaker?: boolean;
  /**
   * Consecutive violations required to open the circuit.
   *
   * Default: `5`.
   */
  failureThreshold?: number;
  /**
   * Milliseconds the circuit stays open before allowing a trial request.
   *
   * Default: `30_000`.
   */
  resetTimeout?: number;
}

/**
 * Orchestrates a pipeline of {@link Checker}s.
 *
 * The guard sits between the agent and its tools: every proposed step is
 * offered to each checker, and the first violation decides the outcome.
 *
 * ```ts
 * const guard = new Guardrail([
 *   new LoopChecker({ maxSteps: 20 }),
 *   new SecurityChecker({ detectInjection: true }),
 * ]);
 *
 * guard.start();
 * const decision = guard.check(step);
 * if (!decision.allowed) return; // blocked
 * ```
 */
export class Guardrail {
  private checkers: Checker[];
  private mode: GuardMode;
  private readonly historyLimit: number;
  private readonly onViolation?: ViolationHandler;
  private readonly clock: Clock;
  private readonly circuitBreakerEnabled: boolean;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;

  private history: RingBuffer<AgentStep>;
  private startedAt = 0;
  private consecutiveViolations = 0;
  private circuitState: CircuitState = 'closed';
  private circuitOpenedAt = 0;
  private totalChecks = 0;
  private allowedCount = 0;
  private blockedCount = 0;
  private monitoredCount = 0;
  private byReason: Record<string, number> = {};
  private byChecker: Record<string, number> = {};
  private lastViolationAt?: number;

  constructor(checkers: Checker[] = [], options: GuardrailOptions = {}) {
    if (!Array.isArray(checkers)) {
      throw new TypeError('Guardrail expects an array of checkers');
    }
    for (const checker of checkers) {
      if (!checker || typeof checker.check !== 'function' || typeof checker.name !== 'string') {
        throw new TypeError('Each checker must implement { name: string, check(...) }');
      }
    }

    this.checkers = [...checkers];
    this.mode = options.mode ?? 'enforce';
    this.historyLimit = options.historyLimit ?? 200;
    this.onViolation = options.onViolation;
    this.clock = options.clock ?? systemClock;
    this.circuitBreakerEnabled = options.circuitBreaker ?? false;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 30_000;

    if (!Number.isFinite(this.historyLimit) || this.historyLimit < 1) {
      throw new RangeError(
        `historyLimit must be >= 1, received ${this.historyLimit}`
      );
    }
    if (this.failureThreshold < 1) {
      throw new RangeError(
        `failureThreshold must be >= 1, received ${this.failureThreshold}`
      );
    }

    this.history = new RingBuffer<AgentStep>(this.historyLimit);
    this.startedAt = this.clock();
  }

  /**
   * Begin a new session: clears the history and resets statistics.
   *
   * Call this before the agent loop begins.
   */
  start(): void {
    this.startedAt = this.clock();
    this.history = new RingBuffer<AgentStep>(this.historyLimit);
    this.consecutiveViolations = 0;
    this.circuitState = 'closed';
    this.circuitOpenedAt = 0;
    this.totalChecks = 0;
    this.allowedCount = 0;
    this.blockedCount = 0;
    this.monitoredCount = 0;
    this.byReason = {};
    this.byChecker = {};
    this.lastViolationAt = undefined;
    for (const checker of this.checkers) {
      checker.reset?.();
    }
  }

  /**
   * Clear the history and statistics without restarting the session clock.
   */
  reset(): void {
    this.history.clear();
    this.consecutiveViolations = 0;
    this.circuitState = 'closed';
    this.circuitOpenedAt = 0;
    this.totalChecks = 0;
    this.allowedCount = 0;
    this.blockedCount = 0;
    this.monitoredCount = 0;
    this.byReason = {};
    this.byChecker = {};
    this.lastViolationAt = undefined;
    for (const checker of this.checkers) {
      checker.reset?.();
    }
  }

  /**
   * Evaluate a step against every checker.
   *
   * @param step The proposed step.
   * @returns The decision. `allowed` is `false` when a checker rejected it
   *          (in `enforce` mode).
   */
  check(step: AgentStep): GuardDecision {
    this.totalChecks += 1;
    const context = this.buildContext();
    const history = this.history.toArray();

    // Circuit breaker: reject fast without running any checker.
    const circuitDecision = this.checkCircuit(context.now);
    if (circuitDecision) {
      this.recordViolation(circuitDecision, step, context.now);
      this.history.push(step);
      return circuitDecision;
    }

    let warning: GuardDecision | undefined;

    for (const checker of this.checkers) {
      const decision = checker.check(step, history, context);
      if (!decision.allowed) {
        const enriched = this.finalize(decision, checker);
        this.recordViolation(enriched, step, context.now);
        // The blocked step is still recorded so that repetition patterns can
        // be detected across blocked attempts.
        this.history.push(step);
        return enriched;
      }
      // Surface non-blocking warnings (e.g. token budget warnings). The
      // decision is merged into the result so the caller can see it.
      if (decision.allowed && decision.reason && decision.metadata?.warning === true) {
        this.monitoredCount += 1;
        warning = decision;
      }
    }

    this.history.push(step);
    this.consecutiveViolations = 0;
    this.allowedCount += 1;
    return warning ? { ...warning, allowed: true } : { allowed: true };
  }

  /**
   * Asynchronous variant of {@link Guardrail.check}.
   *
   * Checkers that implement `checkAsync` are awaited; the rest run
   * synchronously.
   */
  async checkAsync(step: AgentStep): Promise<GuardDecision> {
    this.totalChecks += 1;
    const context = this.buildContext();
    const history = this.history.toArray();

    const circuitDecision = this.checkCircuit(context.now);
    if (circuitDecision) {
      this.recordViolation(circuitDecision, step, context.now);
      this.history.push(step);
      return circuitDecision;
    }

    let warning: GuardDecision | undefined;

    for (const checker of this.checkers) {
      const decision = checker.checkAsync
        ? await checker.checkAsync(step, history, context)
        : checker.check(step, history, context);

      if (!decision.allowed) {
        const enriched = this.finalize(decision, checker);
        this.recordViolation(enriched, step, context.now);
        // The blocked step is still recorded so that repetition patterns can
        // be detected across blocked attempts.
        this.history.push(step);
        return enriched;
      }

      if (decision.allowed && decision.reason && decision.metadata?.warning === true) {
        this.monitoredCount += 1;
        warning = decision;
      }
    }

    this.history.push(step);
    this.consecutiveViolations = 0;
    this.allowedCount += 1;
    return warning ? { ...warning, allowed: true } : { allowed: true };
  }

  /**
   * Run `executor` only if the step is allowed.
   *
   * A convenient wrapper for tool calls:
   *
   * ```ts
   * const result = await guard.guard(step, () => callTool());
   * ```
   */
  async guard<T>(
    step: AgentStep,
    executor: () => T | Promise<T>
  ): Promise<GuardedResult<T>> {
    const decision = await this.checkAsync(step);
    if (!decision.allowed) {
      return { allowed: false, decision };
    }
    try {
      const value = await executor();
      return { allowed: true, value, decision };
    } catch (error) {
      return { allowed: true, decision, error };
    }
  }

  /**
   * Synchronous variant of {@link Guardrail.guard}.
   */
  guardSync<T>(step: AgentStep, executor: () => T): GuardedResult<T> {
    const decision = this.check(step);
    if (!decision.allowed) {
      return { allowed: false, decision };
    }
    try {
      const value = executor();
      return { allowed: true, value, decision };
    } catch (error) {
      return { allowed: true, decision, error };
    }
  }

  /** Current enforcement mode. */
  getMode(): GuardMode {
    return this.mode;
  }

  /** Change the enforcement mode at runtime. */
  setMode(mode: GuardMode): void {
    if (mode !== 'enforce' && mode !== 'monitor') {
      throw new TypeError(`Unknown guard mode: ${String(mode)}`);
    }
    this.mode = mode;
  }

  /** A copy of the retained history, oldest first. */
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

  /** Current circuit-breaker state. */
  getCircuitState(): CircuitState {
    return this.circuitState;
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
      circuitState: this.circuitState,
    };
  }

  /**
   * Aggregated counters describing the session.
   */
  getStats(): GuardStats {
    return {
      totalChecks: this.totalChecks,
      allowed: this.allowedCount,
      blocked: this.blockedCount,
      monitored: this.monitoredCount,
      byReason: { ...this.byReason },
      byChecker: { ...this.byChecker },
      consecutiveViolations: this.consecutiveViolations,
      circuitState: this.circuitState,
      startedAt: this.startedAt,
      ...(this.lastViolationAt !== undefined ? { lastViolationAt: this.lastViolationAt } : {}),
    };
  }

  /** The registered checkers. */
  getCheckers(): readonly Checker[] {
    return this.checkers;
  }

  /** Build the context handed to checkers. */
  private buildContext(): CheckerContext {
    const now = this.clock();
    return {
      history: this.history.toArray(),
      startedAt: this.startedAt,
      now,
      clock: this.clock,
      mode: this.mode,
    };
  }

  /**
   * Evaluate the circuit breaker.
   *
   * @returns A decision when the circuit is open, otherwise `null`.
   */
  private checkCircuit(now: number): GuardDecision | null {
    if (!this.circuitBreakerEnabled) return null;
    if (this.circuitState === 'closed') return null;

    if (this.circuitState === 'open') {
      if (now - this.circuitOpenedAt >= this.resetTimeout) {
        // Half-open: let one request through to probe recovery.
        this.circuitState = 'half-open';
        return null;
      }
      return {
        allowed: false,
        reason: 'CIRCUIT_OPEN',
        severity: 'critical',
        message: `Circuit breaker is open; retry in ${this.resetTimeout - (now - this.circuitOpenedAt)}ms.`,
        metadata: { state: 'open', threshold: this.failureThreshold },
      };
    }

    // half-open: allow a probe through.
    return null;
  }

  /**
   * Attach checker metadata and apply the enforcement mode.
   */
  private finalize(decision: GuardDecision, checker: Checker): GuardDecision {
    const enriched: GuardDecision = {
      ...decision,
      checker: decision.checker ?? checker.name,
    };

    // In monitor mode the step is allowed through, but the reason is kept so
    // callers can report it.
    if (this.mode === 'monitor') {
      return { ...enriched, allowed: true };
    }
    return enriched;
  }

  /**
   * Record a violation and update the circuit breaker.
   */
  private recordViolation(decision: GuardDecision, step: AgentStep, now: number): void {
    this.consecutiveViolations += 1;
    this.lastViolationAt = now;

    const reason = decision.reason ?? 'UNKNOWN';
    this.byReason[reason] = (this.byReason[reason] ?? 0) + 1;

    const checkerName = decision.checker ?? 'unknown';
    this.byChecker[checkerName] = (this.byChecker[checkerName] ?? 0) + 1;

    if (this.mode === 'monitor') {
      this.monitoredCount += 1;
    } else {
      this.blockedCount += 1;
    }

    if (
      this.circuitBreakerEnabled &&
      this.circuitState !== 'half-open' &&
      this.consecutiveViolations >= this.failureThreshold
    ) {
      this.circuitState = 'open';
      this.circuitOpenedAt = now;
    }

    if (this.onViolation) {
      const event: ViolationEvent = {
        reason,
        step,
        timestamp: now,
        decision,
        ...(decision.checker ? { checker: decision.checker } : {}),
      };
      try {
        this.onViolation(event);
      } catch {
        // A throwing violation handler must never break the agent loop.
      }
    }
  }
}
