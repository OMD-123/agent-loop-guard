import { describe, it, expect } from 'vitest';
import {
  AgentLoopGuardError,
  GuardConfigurationError,
  GuardUsageError,
} from '../src/errors.js';

describe('errors', () => {
  it('AgentLoopGuardError carries a reason and details', () => {
    const error = new AgentLoopGuardError('boom', 'LOOP_PATTERN_DETECTED', { a: 1 });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AgentLoopGuardError');
    expect(error.message).toBe('boom');
    expect(error.reason).toBe('LOOP_PATTERN_DETECTED');
    expect(error.details).toEqual({ a: 1 });
  });

  it('AgentLoopGuardError works without a reason', () => {
    const error = new AgentLoopGuardError('boom');
    expect(error.reason).toBeUndefined();
    expect(error.details).toBeUndefined();
  });

  it('GuardConfigurationError extends the base error', () => {
    const error = new GuardConfigurationError('bad config', { field: 'x' });
    expect(error).toBeInstanceOf(AgentLoopGuardError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('GuardConfigurationError');
    expect(error.details).toEqual({ field: 'x' });
  });

  it('GuardUsageError extends the base error', () => {
    const error = new GuardUsageError('bad usage');
    expect(error).toBeInstanceOf(AgentLoopGuardError);
    expect(error.name).toBe('GuardUsageError');
  });

  it('is catchable as a plain Error', () => {
    try {
      throw new GuardConfigurationError('nope');
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message).toBe('nope');
    }
  });
});
