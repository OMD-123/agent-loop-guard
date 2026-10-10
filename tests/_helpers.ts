
import { AgentStep } from '../src/types/index.js';

export const tool = (name: string, args = {}) => ({
  type: 'tool_call' as const,
  tool: name,
  args,
  timestamp: Date.now(),
} as AgentStep);

export const llm = (content: string) => ({
  type: 'llm_response' as const,
  content,
  timestamp: Date.now(),
} as AgentStep);

export const isBlocked = (decision: any) => !decision.allowed;
