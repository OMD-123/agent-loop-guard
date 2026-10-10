
import { GuardReason } from '../types/index.js';

export class AgentLoopGuardError extends Error {
  constructor(
    public readonly reason: GuardReason,
    public readonly message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'AgentLoopGuardError';
  }
}
