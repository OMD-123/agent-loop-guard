#!/usr/bin/env node
/**
 * Finalise the dual ESM/CJS build.
 *
 * The root `package.json` declares `"type": "module"`, so every `.js` file
 * below `dist/` would be treated as ESM by Node. We therefore drop a
 * `package.json` marker into each output folder:
 *
 *   - `dist/esm/package.json` -> `{ "type": "module" }`
 *   - `dist/cjs/package.json` -> `{ "type": "commonjs" }`
 *
 * This is the standard dual-build layout: it avoids renaming every emitted
 * file to `.cjs`/`.mjs` and keeps the declaration files at their natural
 * `.d.ts` paths, which Node's `node16+` module resolution understands.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const esmDir = resolve(root, 'dist', 'esm');
const cjsDir = resolve(root, 'dist', 'cjs');

/** Write a minimal `package.json` marker into a build folder. */
async function writeMarker(dir, type) {
  await writeFile(
    resolve(dir, 'package.json'),
    `${JSON.stringify({ type }, null, 2)}\n`,
    'utf8'
  );
  console.log(`[types] wrote ${type} marker in ${dir}`);
}

try {
  // Sanity check: the entry files must exist before we stamp the folders.
  await readFile(resolve(esmDir, 'index.js'), 'utf8');
  await readFile(resolve(cjsDir, 'index.js'), 'utf8');

  await writeMarker(esmDir, 'module');
  await writeMarker(cjsDir, 'commonjs');

  console.log('[types] dual ESM/CJS build finalized');
} catch (error) {
  console.error('[types] failed:', error);
  process.exit(1);
}
