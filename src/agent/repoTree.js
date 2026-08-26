'use strict';

const fs = require('fs-extra');
const path = require('path');

const IGNORED_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage']);

/**
 * Produces a shallow, indented directory listing so Claude has enough
 * context to know where things live without dumping the whole repo.
 */
async function buildRepoTree(rootDir, { maxDepth = 3, maxEntriesPerDir = 40 } = {}) {
  const lines = [];

  async function walk(dir, depth, prefix) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const filtered = entries
      .filter((e) => !IGNORED_DIRS.has(e.name) && !e.name.startsWith('.'))
      .slice(0, maxEntriesPerDir);

    for (const entry of filtered) {
      lines.push(`${prefix}${entry.isDirectory() ? entry.name + '/' : entry.name}`);
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), depth + 1, prefix + '  ');
      }
    }
  }

  await walk(rootDir, 0, '');
  return lines.join('\n');
}

module.exports = { buildRepoTree };
