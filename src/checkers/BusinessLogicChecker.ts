
import { Checker, AgentStep, GuardDecision } from '../types/index.js';

export interface LogicOptions {
  validator: (step: AgentStep) => boolean;
  errorMessage?: string;
}

export class BusinessLogicChecker implements Checker {
  name = 'BusinessLogicChecker';

  constructor(private options: LogicOptions) {}

  check(step: AgentStep, _history: AgentStep[]): GuardDecision {
    if (!this.options.validator(step)) {
      return { 
        allowed: false, 
        reason: 'BUSINESS_LOGIC_VIOLATION', 
        message: this.options.errorMessage || 'Step violates business logic rules.' 
      };
    }
    return { allowed: true };
  }
}
