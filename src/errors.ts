import type { GuardReason } from './types.js';

/**
 * Base class for every error thrown by the framework.
 */
export class AgentLoopGuardError extends Error {
  constructor(
    message: string,
    public readonly reason?: GuardReason,
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'AgentLoopGuardError';
    // Restore the prototype chain when compiled down to ES5-era output.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a checker is misconfigured (bad options, missing validator...).
 */
export class GuardConfigurationError extends AgentLoopGuardError {
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super(message, undefined, details);
    this.name = 'GuardConfigurationError';
  }
}

/**
 * Thrown when the guard is used in a way that is not supported, for example
 * awaiting an async checker on a purely synchronous code path.
 */
export class GuardUsageError extends AgentLoopGuardError {
  constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super(message, undefined, details);
    this.name = 'GuardUsageError';
  }
}
