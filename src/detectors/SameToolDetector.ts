import type { Detector, DetectorContext } from "./types.js";
import { deny } from "../core/decisions.js";

/**
 * Detects a run of consecutive calls to the *same tool* regardless of their
 * arguments. This catches loops where an agent keeps calling one tool with
 * slightly different (but ineffective) inputs — e.g. retrying the same failing
 * operation forever.
 *
 * Counter is bounded (holds only the current same-tool run length).
 */
export class SameToolDetector implements Detector {
  readonly name = "SameTool";

  /** Count of consecutive calls to `currentTool`. */
  private runCount = 0;
  /** The tool name we are currently counting. */
  private currentTool: string | null = null;

  reset(): void {
    this.runCount = 0;
    this.currentTool = null;
  }

  check(ctx: DetectorContext) {
    const limit = ctx.options.maxSameToolCalls;
    if (limit <= 0) return null; // disabled

    // Only tool steps are subject to the same-tool limit.
    if (ctx.candidate.type !== "tool") {
      // Crossing into an LLM/custom step breaks the same-tool run.
      this.currentTool = null;
      this.runCount = 0;
      return null;
    }

    if (this.currentTool !== null && this.currentTool === ctx.candidate.name) {
      this.runCount += 1;
    } else {
      this.currentTool = ctx.candidate.name;
      this.runCount = 1;
    }

    if (this.runCount > limit) {
      return deny("SAME_TOOL_LIMIT_EXCEEDED", ctx.stepCount, {
        tool: ctx.candidate.name,
        maxSameToolCalls: limit,
      });
    }
    return null;
  }
}
