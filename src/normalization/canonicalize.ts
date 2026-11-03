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
 *   - MUST NOT collapse *shared* (DAG) references into false circular markers.
 *   - Bounded recursion depth to survive pathological payloads.
 *
 * The output is a stable string key suitable for Set/Map lookups.
 */

/** Tag used to discriminate node kinds. */
const TYPE = '__t';
/** Marker emitted for a genuine cycle. */
const CIRCULAR = '__circular__';
/** Maximum recursion depth. */
const MAX_DEPTH = 64;

/**
 * Produce a stable, order-independent string for any JSON-like value.
 *
 * Two values that differ only in key order produce identical keys. Genuinely
 * circular structures produce the same key for structurally identical cycles,
 * and different keys for different cycles.
 */
export function canonicalizeKey(value: unknown): string {
  // `ancestors` tracks the *current path* only, so a value referenced twice
  // in sibling positions is not mistaken for a cycle.
  const ancestors = new WeakSet<object>();
  return stringifyStable(normalize(value, ancestors, 0));
}

/** Internal normalized node after sorting/collapsing. */
type Node =
  | { [TYPE]: 'null' }
  | { [TYPE]: 'undefined' }
  | { [TYPE]: 'boolean'; v: boolean }
  | { [TYPE]: 'number'; v: string }
  | { [TYPE]: 'string'; v: string }
  | { [TYPE]: 'bigint'; v: string }
  | { [TYPE]: 'circular' }
  | { [TYPE]: 'array'; v: Node[] }
  | { [TYPE]: 'object'; v: [string, Node][] };

function normalize(value: unknown, ancestors: WeakSet<object>, depth: number): Node {
  if (depth > MAX_DEPTH) return { [TYPE]: 'circular' };

  if (value === null) return { [TYPE]: 'null' };
  if (value === undefined) return { [TYPE]: 'undefined' };

  switch (typeof value) {
    case 'boolean':
      return { [TYPE]: 'boolean', v: value };
    case 'number':
      // Normalize -0 to 0 and NaN/Infinity to stable strings so that
      // structurally equivalent values always compare equal.
      if (Number.isNaN(value)) return { [TYPE]: 'number', v: 'NaN' };
      if (value === Infinity) return { [TYPE]: 'number', v: 'Infinity' };
      if (value === -Infinity) return { [TYPE]: 'number', v: '-Infinity' };
      return { [TYPE]: 'number', v: String(Object.is(value, -0) ? 0 : value) };
    case 'string':
      return { [TYPE]: 'string', v: value };
    case 'bigint':
      return { [TYPE]: 'bigint', v: value.toString() };
    case 'function':
    case 'symbol':
      // Not comparable data; treat as undefined.
      return { [TYPE]: 'undefined' };
    default:
      break;
  }

  const obj = value as object;

  // Only the *current path* counts as an ancestor. A value that appears twice
  // in sibling positions (a DAG, not a cycle) is traversed twice.
  if (ancestors.has(obj)) return { [TYPE]: 'circular' };
  ancestors.add(obj);

  try {
    if (Array.isArray(value)) {
      const arr: Node[] = value.map((item) => normalize(item, ancestors, depth + 1));
      return { [TYPE]: 'array', v: arr };
    }

    if (value instanceof Date) {
      return { [TYPE]: 'string', v: value.toISOString() };
    }
    if (value instanceof RegExp) {
      return { [TYPE]: 'string', v: value.toString() };
    }
    if (value instanceof Map) {
      const entries = [...value.entries()]
        .map(([k, v]) => [String(k), normalize(v, ancestors, depth + 1)] as [string, Node])
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      return { [TYPE]: 'object', v: entries };
    }
    if (value instanceof Set) {
      // A Set has no defined iteration order, so its members are sorted by
      // their canonical key to keep the result stable.
      const arr: Node[] = [...value.values()]
        .map((item) => normalize(item, ancestors, depth + 1))
        .sort((a, b) => (stringifyStable(a) < stringifyStable(b) ? -1 : 1));
      return { [TYPE]: 'array', v: arr };
    }

    const entries = Object.keys(obj)
      .sort()
      .map((k) => {
        const v = (obj as Record<string, unknown>)[k];
        return [k, normalize(v, ancestors, depth + 1)] as [string, Node];
      });
    return { [TYPE]: 'object', v: entries };
  } finally {
    ancestors.delete(obj);
  }
}

/**
 * Compact, type-prefixed serialization. Prefixes guarantee that e.g. the
 * string "1" and the number 1 never collide as keys.
 */
function stringifyStable(node: Node): string {
  switch (node[TYPE]) {
    case 'null':
      return 'n';
    case 'undefined':
      return 'u';
    case 'boolean':
      return node.v ? 'b1' : 'b0';
    case 'number':
      return `N${node.v}`;
    case 'string':
      return `S${node.v}`;
    case 'bigint':
      return `B${node.v}`;
    case 'circular':
      return CIRCULAR;
    case 'array': {
      let out = `[${node.v.length}:`;
      for (const child of node.v) out += `${stringifyStable(child)},`;
      return `${out}]`;
    }
    case 'object': {
      let out = `{${node.v.length}:`;
      for (const [k, child] of node.v) {
        out += `${JSON.stringify(k)}:${stringifyStable(child)},`;
      }
      return `${out}}`;
    }
    default:
      return 'u';
  }
}

/**
 * A cheap, order-insensitive hash of a canonicalized key.
 *
 * Used to keep memory bounded when tracking many distinct call signatures.
 * This is FNV-1a (32-bit) — not cryptographic, only used for bucketing.
 */
export function hashKey(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    // hash *= 16777619, kept in 32-bit space via Math.imul.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
