import type { AgentStep } from '../src/types.js';

/** Build a tool-call step. */
export const tool = (name: string, args: unknown = {}): AgentStep => ({
  type: 'tool_call',
  tool: name,
  args,
  timestamp: Date.now(),
});

/** Build an LLM-response step. */
export const llm = (content: string, timestamp = Date.now()): AgentStep => ({
  type: 'llm_response',
  content,
  timestamp,
});

/** Build a system-message step. */
export const system = (content: string): AgentStep => ({
  type: 'system_message',
  content,
  timestamp: Date.now(),
});

/** `true` when the decision blocks the step. */
export const isBlocked = (decision: { allowed: boolean }): boolean => !decision.allowed;
