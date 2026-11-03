/**
 * Public type surface for `agent-loop-guard-js`.
 *
 * Design rules:
 *  - No `any` in the public API. Unknown payloads are typed as `unknown` and
 *    narrowed by helpers in `./utils/content.js`.
 *  - `GuardReason` stays open so downstream projects can define their own
 *    reasons without casting to `any`.
 */

/** The kinds of step an agent loop can produce. */
export type StepType = 'tool_call' | 'llm_response' | 'system_message';

/**
 * Content carried by a step.
 *
 * Agent frameworks hand over arbitrary provider-shaped objects — `{ text }`,
 * `{ content: [...] }`, `{ message: { content } }` and so on — so this is
 * deliberately `unknown`. Use the `extractText()` helper (exported from the
 * package root) to flatten a payload into searchable text, and narrow the
 * value yourself if you need a specific shape.
 */
export type StepContent = unknown;

/**
 * A single unit of work proposed by an agent.
 *
 * Only `type` and `timestamp` are required. `timestamp` is normally
 * `Date.now()`, but is injectable so tests and deterministic replays are
 * possible.
 */
export interface AgentStep {
  /** What kind of step this is. */
  type: StepType;
  /** The payload (message text, tool result, ...). */
  content?: StepContent;
  /** Tool name for `tool_call` steps. */
  tool?: string;
  /** Tool arguments for `tool_call` steps. */
  args?: unknown;
  /** Unix epoch milliseconds. */
  timestamp: number;
  /** Optional stable identifier for correlating steps. */
  id?: string;
  /** Optional token cost of the step, used by `TokenBudgetChecker`. */
  tokens?: number;
  /** Optional caller-defined metadata. Never interpreted by the framework. */
  metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Reasons emitted by the built-in checkers.
 */
export type BuiltinGuardReason =
  | 'LOOP_PATTERN_DETECTED'
  | 'CYCLE_DETECTED'
  | 'MAX_STEPS_EXCEEDED'
  | 'MAX_DURATION_EXCEEDED'
  | 'PROMPT_INJECTION_DETECTED'
  | 'UNSAFE_CONTENT_DETECTED'
  | 'BUSINESS_LOGIC_VIOLATION'
  | 'HALLUCINATION_SUSPECTED'
  | 'TOKEN_BUDGET_EXCEEDED'
  | 'TOOL_NOT_ALLOWED'
  | 'ARGUMENT_SCHEMA_VIOLATION'
  | 'CIRCUIT_OPEN';

/**
 * A violation reason.
 *
 * The `string & {}` branch keeps editor autocomplete for the built-in reasons
 * while still allowing custom reasons (for example `BUDGET_EXCEEDED`) without
 * losing type safety.
 */
export type GuardReason = BuiltinGuardReason | (string & NonNullable<unknown>);

/** How severe a violation is considered. */
export type GuardSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Enforcement mode.
 *
 * - `enforce` — violations block the step (default).
 * - `monitor` — violations are recorded and reported but never block.
 */
export type GuardMode = 'enforce' | 'monitor';

/** The verdict returned by a checker or the orchestrator. */
export interface GuardDecision {
  /** `true` when the step may proceed. */
  allowed: boolean;
  /** Machine-readable reason. Absent when allowed. */
  reason?: GuardReason;
  /** Human-readable explanation. */
  message?: string;
  /** Name of the checker that produced the decision. */
  checker?: string;
  /** Severity of the violation. */
  severity?: GuardSeverity;
  /** Structured details for logging / debugging. */
  metadata?: Readonly<Record<string, unknown>>;
}

/** Emitted whenever a step is blocked (or monitored in `monitor` mode). */
export interface ViolationEvent {
  /** Why the step was flagged. */
  reason: GuardReason;
  /** The step that was flagged. */
  step: AgentStep;
  /** Unix epoch milliseconds. */
  timestamp: number;
  /** The full decision, including severity and metadata. */
  decision: GuardDecision;
  /** Name of the checker that produced the decision. */
  checker?: string;
}

/** Callback invoked on every violation. */
export type ViolationHandler = (event: ViolationEvent) => void;

/**
 * Context handed to checkers.
 *
 * Everything a checker might need that is not derivable from the step and
 * the history slice.
 */
export interface CheckerContext {
  /** Recently recorded steps (bounded by `historyLimit`). */
  readonly history: readonly AgentStep[];
  /** Epoch ms at which the current guard session started. */
  readonly startedAt: number;
  /** Current epoch ms, from the injected clock. */
  readonly now: number;
  /** The injected clock. */
  readonly clock: Clock;
  /** Current enforcement mode. */
  readonly mode: GuardMode;
}

/** Injectable time source, for deterministic tests. */
export type Clock = () => number;

/**
 * The contract every checker implements.
 *
 * `check` may be synchronous. Checkers that need to await something can also
 * implement `checkAsync`; the orchestrator prefers it when present.
 */
export interface Checker {
  /** Unique checker name, surfaced in decisions and statistics. */
  name: string;
  /** Evaluate a step against the recent history. */
  check(step: AgentStep, history: AgentStep[], context?: CheckerContext): GuardDecision;
  /** Optional asynchronous variant. */
  checkAsync?(
    step: AgentStep,
    history: AgentStep[],
    context: CheckerContext
  ): Promise<GuardDecision>;
  /** Optional hook to clear per-session state. */
  reset?(): void;
}

/** Legacy alias kept for v2-era code. */
export type Detector = Checker;

/** Per-reason violation counters. */
export type ReasonCounts = Readonly<Record<string, number>>;

/** Aggregated counters describing guard activity. */
export interface GuardStats {
  /** Total steps evaluated. */
  totalChecks: number;
  /** Steps that passed every checker. */
  allowed: number;
  /** Steps that were blocked. */
  blocked: number;
  /** Steps that were flagged but allowed through (monitor mode). */
  monitored: number;
  /** Violations grouped by reason. */
  byReason: ReasonCounts;
  /** Violations grouped by checker name. */
  byChecker: ReasonCounts;
  /** Consecutive violations since the last allowed step. */
  consecutiveViolations: number;
  /** Current circuit-breaker state. */
  circuitState: CircuitState;
  /** Epoch ms at which stats were last reset. */
  startedAt: number;
  /** Epoch ms of the most recent violation. */
  lastViolationAt?: number;
}

/** Circuit-breaker states. */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * A snapshot of the guard's internal state, safe to serialise.
 */
export interface GuardSnapshot {
  /** Epoch ms at which the session started. */
  startedAt: number;
  /** Number of steps currently retained in history. */
  historySize: number;
  /** Retained steps, oldest first. */
  history: readonly AgentStep[];
  /** Copy of the current statistics. */
  stats: GuardStats;
  /** Current circuit-breaker state. */
  circuitState: CircuitState;
}

/** Result of wrapping an executor with the guard. */
export interface GuardedResult<T> {
  /** Whether the step was allowed to run. */
  allowed: boolean;
  /** The executor's return value. Absent when the step was blocked. */
  value?: T;
  /** The decision that was taken. */
  decision: GuardDecision;
  /** Present when the executor itself threw. */
  error?: unknown;
}
