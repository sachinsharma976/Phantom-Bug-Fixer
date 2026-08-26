'use strict';

const fs = require('fs-extra');
const path = require('path');

/**
 * Applies a list of file operations produced by Claude.
 * Each op: { path: string, action: 'write' | 'delete', content?: string }
 * All paths are resolved relative to `rootDir` and clamped inside it so a
 * model response can never escape the repo checkout.
 */
async function applyFileOps(rootDir, ops) {
  const applied = [];

  for (const op of ops) {
    const resolved = path.resolve(rootDir, op.path);
    if (!resolved.startsWith(path.resolve(rootDir) + path.sep)) {
      throw new Error(`Refusing to write outside of workspace: ${op.path}`);
    }

    if (op.action === 'delete') {
      await fs.remove(resolved);
    } else {
      await fs.ensureDir(path.dirname(resolved));
      await fs.writeFile(resolved, op.content ?? '', 'utf8');
    }
    applied.push({ path: op.path, action: op.action });
  }

  return applied;
}

async function readFileIfExists(rootDir, relativePath) {
  const resolved = path.resolve(rootDir, relativePath);
  if (!(await fs.pathExists(resolved))) return null;
  return fs.readFile(resolved, 'utf8');
}

module.exports = { applyFileOps, readFileIfExists };
