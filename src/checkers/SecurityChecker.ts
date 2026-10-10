
import { Checker, AgentStep, GuardDecision } from '../types/index.js';

export interface SecurityOptions {
  detectInjection: boolean;
  blockUnsafeWords: string[];
}

export class SecurityChecker implements Checker {
  name = 'SecurityChecker';

  constructor(private options: SecurityOptions) {}

  private injectionPatterns = [
    /ignore all previous instructions/i,
    /ignore all instructions/i,
    /system prompt/i,
    /you are now a/i,
    /forget everything you know/i,
    /bypass security/i,
    /DAN mode/i
  ];

  check(step: AgentStep, _history: AgentStep[]): GuardDecision {
    let content = '';
    if (typeof step.content === 'string') {
      content = step.content;
    } else if (step.content !== null && step.content !== undefined) {
      content = JSON.stringify(step.content);
    }

    if (!content) return { allowed: true };

    if (this.options.detectInjection) {
      if (this.injectionPatterns.some(pattern => pattern.test(content))) {
        return { allowed: false, reason: 'PROMPT_INJECTION_DETECTED', message: 'Potential jailbreak attempt detected.' };
      }
    }

    if (this.options.blockUnsafeWords && this.options.blockUnsafeWords.length > 0) {
      const lowerContent = content.toLowerCase();
      if (this.options.blockUnsafeWords.some(word => word && lowerContent.includes(word.toLowerCase()))) {
        return { allowed: false, reason: 'UNSAFE_CONTENT_DETECTED', message: 'Output contains prohibited content.' };
      }
    }

    return { allowed: true };
  }
}
