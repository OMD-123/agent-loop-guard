import type { Detector, DetectorContext } from "./types.js";
import { deny } from "../core/decisions.js";

/**
 * Stops a run once it exceeds a configured wall-clock budget.
 *
 * Uses a monotonic clock (performance.now when available, falling back to
 * Date.now) so the measurement is not skewed by system clock adjustments.
 * The budget is measured from the run start time, not from the first check.
 */
export class DurationDetector implements Detector {
  readonly name = "Duration";

  reset(): void {
    // Run timing lives in GuardState; nothing to clear here.
  }

  check(ctx: DetectorContext) {
    const limit = ctx.options.maxDuration;
    if (limit <= 0) return null; // disabled
    const start = ctx.state.startTime;
    if (start === null) return null; // guard.start()/lazy init not yet applied
    const elapsed = ctx.now - start;
    if (elapsed > limit) {
      return deny("MAX_DURATION_EXCEEDED", ctx.stepCount, {
        elapsedMs: Math.round(elapsed),
        maxDuration: limit,
      });
    }
    return null;
  }
}
