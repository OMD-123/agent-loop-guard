
import { LoopChecker } from '../checkers/LoopChecker.js';
import { LoopOptions } from '../checkers/LoopChecker.js';
import { GuardDecision, AgentStep } from '../types/index.js';

// Shim for backward compatibility with v2 tests
export class AgentLoopGuard {
  private checker: LoopChecker;

  constructor(options: LoopOptions = {}) {
    this.checker = new LoopChecker(options);
  }

  check(step: AgentStep): GuardDecision {
    // This is a simplified shim; real v2 had internal history
    return this.checker.check(step, []);
  }

  start() {}
  reset() {}
}
