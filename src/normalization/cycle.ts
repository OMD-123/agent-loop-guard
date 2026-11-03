/**
 * Cycle detection over a sequence of steps.
 *
 * Two complementary strategies are used:
 *
 *  1. **Signature detection** — identical (tool, canonical-args) pairs seen
 *     more than `maxRepeats` times in the recent window.
 *  2. **Sequence detection** — the same *cycle* of calls repeating, e.g.
 *     `A → B → A → B → …`. Signature detection alone cannot see this because
 *     no single signature repeats more than twice.
 */

/** A stable identity for a step, used for cycle detection. */
export interface StepSignature {
  /** Canonical tool name (empty string for non-tool steps). */
  tool: string;
  /** Canonical argument key. */
  args: string;
  /** Type of the step. */
  type: string;
}

/**
 * Detect a repeating sequence of signatures.
 *
 * @param signatures Signatures in chronological order.
 * @param maxCycleLength Longest cycle to look for.
 * @returns The detected cycle, or `null`.
 */
export function detectCycle(
  signatures: readonly StepSignature[],
  maxCycleLength = 5
): StepSignature[] | null {
  const n = signatures.length;
  if (n < 2) return null;

  // For every candidate cycle length, look for a repeated window at the tail.
  const maxLength = Math.min(maxCycleLength, Math.floor(n / 2));

  for (let length = 2; length <= maxLength; length += 1) {
    // Check the most recent `length` signatures against the previous block.
    const tail = signatures.slice(n - length);
    const prev = signatures.slice(n - 2 * length, n - length);
    if (prev.length !== tail.length) continue;

    let matches = true;
    for (let i = 0; i < length; i += 1) {
      if (!sameSignature(prev[i] as StepSignature, tail[i] as StepSignature)) {
        matches = false;
        break;
      }
    }
    if (matches) return [...tail];
  }

  return null;
}

/** Compare two signatures for equality. */
export function sameSignature(a: StepSignature, b: StepSignature): boolean {
  return a.type === b.type && a.tool === b.tool && a.args === b.args;
}
