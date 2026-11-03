#!/usr/bin/env node
/**
 * Generate tarball-check fixtures for the negative tests.
 *
 * Reads a real `npm pack --json` log and writes mutated copies that each
 * violate one of the checks in `check-tarball.mjs`.
 *
 * Usage: `node scripts/make-tarball-fixtures.mjs <pack-log> <out-dir>`
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const logPath = process.argv[2] ?? 'pack.log';
const outDir = process.argv[3] ?? 'pack-fixtures';

/** Extract the JSON payload from a `npm pack --json` log. */
function extractJson(log) {
  const lines = log.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== '[') continue;
    try {
      return JSON.parse(lines.slice(i).join('\n'));
    } catch {
      // keep scanning
    }
  }
  throw new Error('could not parse the npm pack JSON payload');
}

const raw = await readFile(resolve(root, logPath), 'utf8');
const packs = extractJson(raw);

await mkdir(resolve(root, outDir), { recursive: true });

const write = async (name, mutated) => {
  await writeFile(
    resolve(root, outDir, name),
    `\n${JSON.stringify(mutated, null, 2)}`,
    'utf8'
  );
  console.log(`wrote ${outDir}/${name}`);
};

// 1. A required file is missing.
const missing = JSON.parse(JSON.stringify(packs));
missing[0].files = missing[0].files.filter((f) => f.path !== 'dist/cjs/index.js');
await write('missing-required.log', missing);

// 2. A stale artifact from an earlier release is present.
const stale = JSON.parse(JSON.stringify(packs));
stale[0].files.push({
  path: 'dist/detectors/LoopPatternDetector.js',
  size: 10,
  mode: 420,
});
await write('stale-artifact.log', stale);

// 3. The JSON payload is unparsable.
await writeFile(resolve(root, outDir, 'corrupt.log'), 'not json at all\n', 'utf8');
console.log(`wrote ${outDir}/corrupt.log`);
