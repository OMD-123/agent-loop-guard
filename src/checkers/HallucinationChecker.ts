
import { Checker, AgentStep, GuardDecision } from '../types/index.js';

export interface HallucinationOptions {
  strictness?: 'low' | 'medium' | 'high';
  contradictionKeywords?: string[];
}

export class HallucinationChecker implements Checker {
  name = 'HallucinationChecker';
  private options: HallucinationOptions;

  constructor(options: HallucinationOptions = {}) {
    this.options = {
      strictness: options.strictness || 'medium',
      contradictionKeywords: options.contradictionKeywords || ['actually', 'however', 'incorrectly', 'instead of']
    };
  }

  check(step: AgentStep, history: AgentStep[]): GuardDecision {
    if (step.type !== 'llm_response') return { allowed: true };

    const content = typeof step.content === 'string' ? step.content : JSON.stringify(step.content);
    if (!content) return { allowed: true };

    const lastToolCall = [...history].reverse().find(h => h.type === 'tool_call');
    if (!lastToolCall) return { allowed: true };

    const keywords = this.options.contradictionKeywords || [];
    const hasContradictionSignal = keywords.some(word => 
      word && content.toLowerCase().includes(word.toLowerCase())
    );

    if (hasContradictionSignal && this.options.strictness === 'high') {
      return { 
        allowed: false, 
        reason: 'HALLUCINATION_SUSPECTED', 
        message: 'LLM response appears to contradict the tool result.' 
      };
    }

    return { allowed: true };
  }
}
