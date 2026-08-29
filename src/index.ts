/**
 * agent-loop-guard
 *
 * Provider-independent safety and reliability utility for AI agents. Detects
 * runaway agent execution: too many steps, too long a duration, repeated tool
 * calls, same-tool hammering, and circular/looping step patterns.
 *
 * The guard only OBSERVES steps — it never executes tools, models, or any
 * caller code. Integration is a few lines around your existing agent loop.
 */

export { AgentLoopGuard } from "./core/AgentLoopGuard.js";
export { AgentLoopGuardError } from "./errors/AgentLoopGuardError.js";
export { canonicalizeKey } from "./normalization/canonicalize.js";

export type {
  AgentStep,
  StepType,
  GuardReason,
  GuardDecision,
  ViolationEvent,
  ViolationHandler,
  GuardStats,
} from "./types/index.js";

export type {
  AgentLoopGuardOptions,
} from "./core/options.js";
