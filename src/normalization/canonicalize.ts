/**
 * Deterministic canonicalization of untrusted step arguments.
 *
 * The guard compares argument objects to detect repeated/duplicated tool calls.
 * Two argument values are considered equivalent when they are semantically
 * equal, regardless of:
 *   - object key ordering ({ a:1, b:2 } === { b:2, a:1 })
 *   - incidental formatting differences
 *
 * Design constraints:
 *   - MUST NOT throw on circular references (JSON.stringify would).
 *   - MUST NOT use eval / new Function.
 *   - O(1)-ish work per step; bounded recursion via a visited set.
 *
 * The output is a stable string key suitable for Set/Map lookups.
 */

const TYPE = "__t";
const SENTINEL = "__circular";

/**
 * Produce a stable, order-independent string for any JSON-like value.
 *
 * Strategy: recursively normalize into a plain object/array tree where object
 * keys are sorted, then serialize with a compact prefix-typed representation.
 * Circular references are collapsed to a stable sentinel so the producer never
 * throws (we simply treat two circular values as "not obviously equal" rather
 * than crashing the host agent).
 */
export function canonicalizeKey(value: unknown): string {
  const seen = new WeakSet<object>();
  const normalized = normalize(value, seen, 0);
  return stringifyStable(normalized);
}

/** Internal normalized node after sorting/collapsing. */
type Node =
  | { [TYPE]: "null" }
  | { [TYPE]: "undefined" }
  | { [TYPE]: "boolean"; v: boolean }
  | { [TYPE]: "number"; v: number }
  | { [TYPE]: "string"; v: string }
  | { [TYPE]: "bigint"; v: string }
  | { [TYPE]: "circular" }
  | { [TYPE]: "array"; v: Node[] }
  | { [TYPE]: "object"; v: [string, Node][] };

function normalize(value: unknown, seen: WeakSet<object>, depth: number): Node {
  // Guard against pathological depth (valid JSON-like payloads are shallow).
  if (depth > 64) return { [TYPE]: "circular" };

  if (value === null) return { [TYPE]: "null" };
  if (value === undefined) return { [TYPE]: "undefined" };

  // Narrow `value` directly (not a cached typeof variable) so TS refines it.
  if (typeof value === "boolean") return { [TYPE]: "boolean", v: value };
  if (typeof value === "number") return { [TYPE]: "number", v: value };
  if (typeof value === "string") return { [TYPE]: "string", v: value };
  if (typeof value === "bigint") return { [TYPE]: "bigint", v: value.toString() };

  // Functions / symbols are not comparable data; treat as undefined.
  if (typeof value !== "object") return { [TYPE]: "undefined" };

  const obj = value as object;
  if (seen.has(obj)) return { [TYPE]: "circular" };
  seen.add(obj);

  if (Array.isArray(value)) {
    const arr: Node[] = value.map((item) => normalize(item, seen, depth + 1));
    return { [TYPE]: "array", v: arr };
  }

  const entries = Object.keys(obj)
    .sort()
    .map((k) => {
      const v = (obj as Record<string, unknown>)[k];
      return [k, normalize(v, seen, depth + 1)] as [string, Node];
    });
  return { [TYPE]: "object", v: entries };
}

/**
 * Compact, type-prefixed serialization. Prefixes guarantee that e.g. the
 * string "1" and the number 1 never collide as keys.
 */
function stringifyStable(node: Node): string {
  switch (node[TYPE]) {
    case "null":
      return "n";
    case "undefined":
      return "u";
    case "boolean":
      return node.v ? "b1" : "b0";
    case "number":
      return "N" + node.v;
    case "string":
      return "S" + node.v;
    case "bigint":
      return "B" + node.v;
    case "circular":
      return SENTINEL;
    case "array": {
      let out = "[" + node.v.length + ":";
      for (const child of node.v) out += stringifyStable(child) + ",";
      return out + "]";
    }
    case "object": {
      let out = "{" + node.v.length + ":";
      for (const [k, child] of node.v) {
        out += JSON.stringify(k) + ":" + stringifyStable(child) + ",";
      }
      return out + "}";
    }
  }
}
