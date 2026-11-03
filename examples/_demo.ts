import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * `true` when the current module is the process entry point.
 *
 * Used by the examples to run a demo only when executed directly, not when
 * imported. `pathToFileURL` is used because on Windows `import.meta.url`
 * starts with `file:///C:/...` while `process.argv[1]` starts with `C:\...`.
 */
export function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;

  try {
    return pathToFileURL(realpathSync(entry)).href === metaUrl;
  } catch {
    return false;
  }
}
