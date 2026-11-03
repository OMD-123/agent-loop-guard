import type { Clock } from '../types.js';

/** The default clock: wall-clock time in epoch milliseconds. */
export const systemClock: Clock = () => Date.now();

/**
 * A deterministic clock for tests and replayable simulations.
 *
 * It is a plain object rather than an implementation of the `Clock` function
 * type, so pass `() => clock.now()` where a `Clock` is expected.
 */
export class ManualClock {
  private current: number;

  constructor(start = 0) {
    this.current = start;
  }

  /** Current virtual time. */
  now(): number {
    return this.current;
  }

  /** Advance virtual time by `ms` milliseconds. */
  advance(ms: number): number {
    this.current += ms;
    return this.current;
  }

  /** Set virtual time to an absolute value. */
  set(ms: number): number {
    this.current = ms;
    return this.current;
  }

  /** A `Clock` function bound to this instance. */
  get clock(): Clock {
    return () => this.now();
  }
}
