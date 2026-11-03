#!/usr/bin/env node
/**
 * Validate the contents of a packed tarball.
 *
 * `npm pack --json` writes the build script's stdout before the JSON
 * payload, so the JSON is extracted from the tail of the log. The check
 * asserts that:
 *
 *   - every file required by the `exports` map is present;
 *   - no stale artifacts from earlier releases are shipped;
 *   - the `package.json` `exports` map points at files that exist.
 *
 * Usage: `node scripts/check-tarball.mjs <path-to-pack-log>`
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const logPath = process.argv[2] ?? 'pack.log';

/** Files that must be present in every release. */
const REQUIRED = [
  'dist/esm/index.js',
  'dist/esm/index.d.ts',
  'dist/esm/package.json',
  'dist/cjs/index.js',
  'dist/cjs/index.d.ts',
  'dist/cjs/package.json',
];

/** Artifacts from earlier releases that must never be published. */
const FORBIDDEN = [
  'dist/detectors/',
  'dist/core/GuardState',
  'dist/core/options',
  'dist/core/decisions',
  '.npmrc',
];

/**
 * Extract the JSON payload from a `npm pack --json` log.
 *
 * The build script's stdout precedes the JSON, so the payload is located by
 * scanning for the first line that consists of exactly `[` and then parsing
 * from there to the end of the log.
 */
function extractJson(log) {
  const lines = log.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== '[') continue;
    const candidate = lines.slice(i).join('\n');
    try {
      return JSON.parse(candidate);
    } catch {
      // Not the start of the payload — keep scanning.
    }
  }

  throw new Error('could not parse the npm pack JSON payload');
}

async function main() {
  const log = await readFile(resolve(root, logPath), 'utf8');
  const packs = extractJson(log);
  const pack = Array.isArray(packs) ? packs[0] : packs;

  if (!pack || !Array.isArray(pack.files)) {
    throw new Error('npm pack did not report a file list');
  }

  const names = pack.files.map((file) => file.path);

  const missing = REQUIRED.filter((file) => !names.includes(file));
  if (missing.length > 0) {
    console.error(`missing from tarball: ${missing.join(', ')}`);
    process.exit(1);
  }

  const forbidden = names.filter((name) =>
    FORBIDDEN.some((needle) => name.includes(needle))
  );
  if (forbidden.length > 0) {
    console.error(`forbidden artifacts in tarball: ${forbidden.join(', ')}`);
    process.exit(1);
  }

  // The `exports` map must not reference files that are missing.
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const referenced = new Set();
  const walk = (node) => {
    if (typeof node === 'string') {
      if (node.startsWith('./dist/')) referenced.add(node.slice(2));
      return;
    }
    if (node && typeof node === 'object') {
      for (const value of Object.values(node)) walk(value);
    }
  };
  walk(pkg.exports);

  const dangling = [...referenced].filter((file) => !names.includes(file));
  if (dangling.length > 0) {
    console.error(`exports map references missing files: ${dangling.join(', ')}`);
    process.exit(1);
  }

  console.log(
    `tarball OK: ${names.length} files, ${pack.size} bytes, ` +
      `${referenced.size} exports targets present`
  );
}

main().catch((error) => {
  console.error(`tarball check failed: ${error.message}`);
  process.exit(1);
});
