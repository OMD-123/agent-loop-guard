/**
 * Public type definitions for agent-loop-guard.
 *
 * These types are intentionally framework-agnostic. An "agent step" is any
 * observable action an AI agent takes (an LLM call, a tool invocation, or a
 * custom event). The guard only inspects steps; it never executes them.
 */

/** The category of an agent step. Extend this union as new step kinds appear. */
export type StepType = "llm" | "tool" | "custom";

/**
 * A single observable action taken by an agent.
 *
 * `arguments` carries the inputs to the step (e.g. tool parameters). It is
 * treated as untrusted data: the guard only canonicalizes it for comparison
 * and never evaluates or executes it.
 */
export interface AgentStep {
  /** Category of the step. */
  type: StepType;
  /** Name of the step (e.g. tool name, model id, or custom label). */
  name: string;
  /** Inputs/parameters of the step. Optional for steps without arguments. */
  arguments?: unknown;
  /** Override timestamp (ms). Defaults to the guard's monotonic clock. */
  timestamp?: number;
  /** Arbitrary consumer metadata; never used for detection logic. */
  metadata?: Record<string, unknown>;
}

/** Canonical reasons a guard decision can block execution. */
export type GuardReason =
  | "MAX_STEPS_EXCEEDED"
  | "MAX_DURATION_EXCEEDED"
  | "REPEATED_CALL_LIMIT_EXCEEDED"
  | "SAME_TOOL_LIMIT_EXCEEDED"
  | "LOOP_PATTERN_DETECTED";

/**
 * Result of {@link AgentLoopGuard.check}.
 * Either a green-light (`allowed: true`) or a structured block.
 */
export type GuardDecision =
  | {
      allowed: true;
      stepCount: number;
    }
  | {
      allowed: false;
      reason: GuardReason;
      stepCount: number;
      details?: Record<string, unknown>;
    };

/**
 * Optional callback fired when a check is blocked (a violation is detected).
 * Fired exactly once per blocking decision, before `check` returns.
 */
export type ViolationHandler = (event: ViolationEvent) => void;

/** Payload delivered to {@link ViolationHandler}. */
export interface ViolationEvent {
  reason: GuardReason;
  stepCount: number;
  timestamp: number;
  details?: Record<string, unknown>;
}

/** Read-only runtime statistics exposed by {@link AgentLoopGuard.stats}. */
export interface GuardStats {
  stepCount: number;
  toolCalls: number;
  llmCalls: number;
  duration: number;
  uniqueTools: number;
  repeatedCalls: number;
}
