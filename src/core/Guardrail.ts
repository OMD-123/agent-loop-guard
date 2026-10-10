
import { AgentStep, GuardDecision, Checker, ViolationHandler } from '../types/index.js';

export class Guardrail {
  private history: AgentStep[] = [];
  private _startTime: number = 0;

  constructor(
    private checkers: Checker[], 
    private onViolation?: ViolationHandler
  ) {}

  start() {
    this._startTime = Date.now();
    this.history = [];
  }

  check(step: AgentStep): GuardDecision {
    for (const checker of this.checkers) {
      const decision = checker.check(step, this.history);
      if (!decision.allowed) {
        if (this.onViolation) {
          this.onViolation({
            reason: decision.reason as any,
            step,
            timestamp: Date.now(),
          });
        }
        return decision;
      }
    }

    this.history.push(step);
    return { allowed: true };
  }

  reset() {
    this.history = [];
    this._startTime = 0;
  }

  getHistory() {
    return [...this.history];
  }

  getStartTime() {
    return this._startTime;
  }
}
