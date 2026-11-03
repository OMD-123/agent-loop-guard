#!/usr/bin/env node
/**
 * Remove previous build output.
 *
 * A clean `dist/` matters: stale artifacts from older releases were being
 * published to npm because the build never cleared the directory.
 */
import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

await rm(dist, { recursive: true, force: true });
console.log(`[clean] removed ${dist}`);
