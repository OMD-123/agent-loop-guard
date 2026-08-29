import type { Detector, DetectorContext } from "./types.js";
import { deny } from "../core/decisions.js";

/**
 * Stops a run once it exceeds a configured step budget.
 * Cheapest check — runs first.
 */
export class MaxStepsDetector implements Detector {
  readonly name = "MaxSteps";

  reset(): void {
    // No internal state; the guard owns stepCount.
  }

  check(ctx: DetectorContext) {
    const limit = ctx.options.maxSteps;
    if (limit <= 0) return null; // disabled
    if (ctx.stepCount > limit) {
      return deny("MAX_STEPS_EXCEEDED", ctx.stepCount, { maxSteps: limit });
    }
    return null;
  }
}
