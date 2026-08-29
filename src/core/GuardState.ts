import type { AgentStep } from "../types/index.js";

/**
 * Mutable, per-run state for a single agent run. Kept separate from the
 * detectors so the guard can (a) reset cleanly and (b) expose read-only stats
 * without detectors leaking internals. All counters are simple numbers/arrays
 * chosen for O(1) per-step work and bounded memory.
 */
export class GuardState {
  /** Total steps seen this run (LLM + tool + custom). */
  stepCount = 0;
  /** Count of `type: "tool"` steps. */
  toolCalls = 0;
  /** Count of `type: "llm"` steps. */
  llmCalls = 0;
  /** Set of distinct tool names seen. */
  uniqueTools = new Set<string>();
  /**
   * Rolling list of step keys (`${type}:${name}#${argsKey}`).
   * Bounded to the larger of loopPatternWindow and ~2*maxSameToolCalls to keep
   * memory flat while still giving the pattern/same-tool detectors enough
   * history. Bounding here prevents unbounded growth on long runs.
   */
  history: string[] = [];
  /** Monotonic start time (ms) for this run, or null if not yet started. */
  startTime: number | null = null;
  /** Most recent monotonic sample (ms); defaults to startTime when untouched. */
  lastSampleTime: number | null = null;
  /** Key of the most recently committed step (for repeat accounting). */
  private lastKey: string | null = null;
  /** Count of steps that duplicated the immediately preceding step. */
  repeatCount = 0;

  /** Maximum number of history entries to retain (set by the guard). */
  historyLimit = 64;

  reset(): void {
    this.stepCount = 0;
    this.toolCalls = 0;
    this.llmCalls = 0;
    this.uniqueTools.clear();
    this.history.length = 0;
    this.startTime = null;
    this.lastSampleTime = null;
    this.lastKey = null;
    this.repeatCount = 0;
  }

  /** Record a committed step's key; returns true when it duplicates the prior step. */
  record(key: string): boolean {
    const isRepeat = this.lastKey !== null && this.lastKey === key;
    if (isRepeat) this.repeatCount += 1;
    this.lastKey = key;
    this.history.push(key);
    if (this.history.length > this.historyLimit) {
      // Drop oldest entries; only a trailing window is ever inspected.
      this.history.splice(0, this.history.length - this.historyLimit);
    }
    return isRepeat;
  }
}

/** Build the stable key for a step from its type, name, and canonical args. */
export function stepKey(step: AgentStep, argsKey: string): string {
  return `${step.type}:${step.name}#${argsKey}`;
}
