
export type StepType = 'tool_call' | 'llm_response' | 'system_message';

export interface AgentStep {
  type: StepType;
  content: any;
  tool?: string;
  args?: any;
  timestamp: number;
}

export type GuardReason = 
  | 'LOOP_PATTERN_DETECTED' 
  | 'MAX_STEPS_EXCEEDED' 
  | 'MAX_DURATION_EXCEEDED' 
  | 'PROMPT_INJECTION_DETECTED' 
  | 'UNSAFE_CONTENT_DETECTED' 
  | 'BUSINESS_LOGIC_VIOLATION' 
  | 'HALLUCINATION_SUSPECTED';

export interface GuardDecision {
  allowed: boolean;
  reason?: GuardReason;
  message?: string;
}

export interface ViolationEvent {
  reason: GuardReason;
  step: AgentStep;
  timestamp: number;
}

export type ViolationHandler = (event: ViolationEvent) => void;

export interface Checker {
  name: string;
  check(step: AgentStep, history: AgentStep[]): GuardDecision;
}
