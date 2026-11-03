/**
 * `agent-loop-guard-js` — a zero-dependency guardrail framework for AI agents.
 *
 * The public API is intentionally small:
 *
 * - {@link Guardrail} — orchestrates a pipeline of checkers.
 * - {@link AgentLoopGuard} — the batteries-included single-object guard.
 * - The checkers — {@link LoopChecker}, {@link SecurityChecker},
 *   {@link HallucinationChecker}, {@link BusinessLogicChecker},
 *   {@link ToolPolicyChecker}, {@link TokenBudgetChecker}.
 *
 * @packageDocumentation
 */

export { Guardrail, type GuardrailOptions } from './core/Guardrail.js';
export { AgentLoopGuard, type AgentLoopGuardOptions } from './core/AgentLoopGuard.js';

export {
  LoopChecker,
  type LoopOptions,
} from './checkers/LoopChecker.js';

export {
  SecurityChecker,
  InjectionScanner,
  DEFAULT_INJECTION_PATTERNS,
  type SecurityOptions,
  type InjectionScanOptions,
} from './checkers/SecurityChecker.js';

export {
  HallucinationChecker,
  DEFAULT_CONTRADICTION_KEYWORDS,
  type HallucinationOptions,
} from './checkers/HallucinationChecker.js';

export {
  BusinessLogicChecker,
  type LogicOptions,
} from './checkers/BusinessLogicChecker.js';

export {
  ToolPolicyChecker,
  type ToolPolicyOptions,
} from './checkers/ToolPolicyChecker.js';

export {
  TokenBudgetChecker,
  type TokenBudgetOptions,
} from './checkers/TokenBudgetChecker.js';

export {
  AgentLoopGuardError,
  GuardConfigurationError,
  GuardUsageError,
} from './errors.js';

export {
  canonicalizeKey,
  hashKey,
} from './normalization/canonicalize.js';

export { detectCycle, sameSignature, type StepSignature } from './normalization/cycle.js';

export { systemClock, ManualClock } from './utils/clock.js';
export { RingBuffer } from './utils/ring-buffer.js';
export { extractText, normalizeForMatching, countOccurrences } from './utils/content.js';

export type {
  AgentStep,
  StepType,
  StepContent,
  GuardReason,
  BuiltinGuardReason,
  GuardSeverity,
  GuardMode,
  GuardDecision,
  ViolationEvent,
  ViolationHandler,
  Checker,
  Detector,
  CheckerContext,
  Clock,
  GuardStats,
  ReasonCounts,
  GuardSnapshot,
  GuardedResult,
  CircuitState,
} from './types.js';
