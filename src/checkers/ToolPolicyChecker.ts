import type {
  AgentStep,
  Checker,
  CheckerContext,
  GuardDecision,
} from '../types.js';

/**
 * Options for {@link ToolPolicyChecker}.
 */
export interface ToolPolicyOptions {
  /**
   * If set, only these tools may be called. Any other tool is blocked.
   */
  allowedTools?: readonly string[];
  /**
   * If set, these tools may never be called.
   */
  deniedTools?: readonly string[];
  /**
   * Require tool calls to declare arguments.
   *
   * Default: `false`.
   */
  requireArgs?: boolean;
  /**
   * Maximum number of times a single tool may be called in a session.
   */
  maxCallsPerTool?: number;
  /**
   * Severity of the violation.
   *
   * Default: `'critical'` for denied tools, `'high'` otherwise.
   */
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Enforces a tool allow/deny policy.
 *
 * Complements {@link LoopChecker}: the loop checker notices *that* a tool is
 * being hammered, this one controls *whether* it may be used at all.
 */
export class ToolPolicyChecker implements Checker {
  readonly name = 'ToolPolicyChecker';

  private readonly allowedTools?: ReadonlySet<string>;
  private readonly deniedTools: ReadonlySet<string>;
  private readonly requireArgs: boolean;
  private readonly maxCallsPerTool?: number;
  private readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(options: ToolPolicyOptions = {}) {
    if (options.allowedTools && options.deniedTools) {
      const denied = options.deniedTools.filter((tool) => options.allowedTools?.includes(tool));
      if (denied.length > 0) {
        throw new Error(
          `ToolPolicyChecker: tool(s) cannot be both allowed and denied: ${denied.join(', ')}`
        );
      }
    }

    this.allowedTools = options.allowedTools ? new Set(options.allowedTools) : undefined;
    this.deniedTools = new Set(options.deniedTools ?? []);
    this.requireArgs = options.requireArgs ?? false;
    this.maxCallsPerTool = options.maxCallsPerTool;
    this.severity = options.severity ?? 'high';

    if (this.maxCallsPerTool !== undefined && this.maxCallsPerTool < 1) {
      throw new RangeError(
        `maxCallsPerTool must be >= 1, received ${this.maxCallsPerTool}`
      );
    }
  }

  /**
   * Evaluate a step.
   */
  check(step: AgentStep, history: AgentStep[], _context?: CheckerContext): GuardDecision {
    if (step.type !== 'tool_call') return { allowed: true };

    const tool = step.tool;
    if (!tool) {
      return {
        allowed: false,
        reason: 'TOOL_NOT_ALLOWED',
        severity: 'high',
        checker: this.name,
        message: 'Tool call is missing a `tool` name.',
      };
    }

    if (this.deniedTools.has(tool)) {
      return {
        allowed: false,
        reason: 'TOOL_NOT_ALLOWED',
        severity: 'critical',
        checker: this.name,
        message: `Tool "${tool}" is denied by policy.`,
        metadata: { tool },
      };
    }

    if (this.allowedTools && !this.allowedTools.has(tool)) {
      return {
        allowed: false,
        reason: 'TOOL_NOT_ALLOWED',
        severity: this.severity,
        checker: this.name,
        message: `Tool "${tool}" is not in the allow-list.`,
        metadata: { tool, allowed: [...this.allowedTools] },
      };
    }

    if (this.requireArgs && (step.args === undefined || step.args === null)) {
      return {
        allowed: false,
        reason: 'ARGUMENT_SCHEMA_VIOLATION',
        severity: 'medium',
        checker: this.name,
        message: `Tool "${tool}" requires arguments.`,
        metadata: { tool },
      };
    }

    if (this.maxCallsPerTool !== undefined) {
      const calls = history.filter((h) => h.type === 'tool_call' && h.tool === tool).length;
      if (calls >= this.maxCallsPerTool) {
        return {
          allowed: false,
          reason: 'TOOL_NOT_ALLOWED',
          severity: 'medium',
          checker: this.name,
          message: `Tool "${tool}" has reached its call limit (${this.maxCallsPerTool}).`,
          metadata: { tool, calls, limit: this.maxCallsPerTool },
        };
      }
    }

    return { allowed: true };
  }
}
