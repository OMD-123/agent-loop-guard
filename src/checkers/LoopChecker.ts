
import { Checker, AgentStep, GuardDecision } from '../types/index.js';

export interface LoopOptions {
  maxSteps?: number;
  maxDuration?: number;
  maxRepeatedCalls?: number;
}

export class LoopChecker implements Checker {
  name = 'LoopChecker';

  constructor(private options: LoopOptions = {}, private startTime: number = 0) {}

  check(step: AgentStep, history: AgentStep[]): GuardDecision {
    if (this.options.maxSteps && history.length >= this.options.maxSteps) {
      return { allowed: false, reason: 'MAX_STEPS_EXCEEDED' };
    }

    if (this.options.maxDuration && this.startTime) {
      if (Date.now() - this.startTime > this.options.maxDuration) {
        return { allowed: false, reason: 'MAX_DURATION_EXCEEDED' };
      }
    }

    if (this.options.maxRepeatedCalls && step.type === 'tool_call') {
      const repeats = history.filter(h => 
        h.type === 'tool_call' && 
        h.tool === step.tool && 
        JSON.stringify(h.args) === JSON.stringify(step.args)
      ).length;

      if (repeats >= this.options.maxRepeatedCalls) {
        return { allowed: false, reason: 'LOOP_PATTERN_DETECTED' };
      }
    }

    return { allowed: true };
  }
}
