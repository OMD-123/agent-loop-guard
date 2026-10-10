
import { AgentStep, GuardDecision, Checker, ViolationEvent, ViolationHandler } from '../types/index.js';

export class Guardrail {
  private history: AgentStep[] = [];
  private startTime: number = 0;

  constructor(
    private checkers: Checker[], 
    private onViolation?: ViolationHandler
  ) {}

  start() {
    this.startTime = Date.now();
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
    this.startTime = 0;
  }

  getHistory() {
    return [...this.history];
  }
}
