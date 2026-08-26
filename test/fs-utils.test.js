'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { applyFileOps, readFileIfExists } = require('../src/utils/fs');

describe('applyFileOps', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pbf-test-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  test('writes new files, creating parent directories', async () => {
    await applyFileOps(tmpDir, [{ path: 'src/lib/foo.js', action: 'write', content: 'module.exports = 1;' }]);
    const content = await fs.readFile(path.join(tmpDir, 'src/lib/foo.js'), 'utf8');
    expect(content).toBe('module.exports = 1;');
  });

  test('deletes files', async () => {
    const filePath = path.join(tmpDir, 'to-delete.js');
    await fs.writeFile(filePath, 'x');
    await applyFileOps(tmpDir, [{ path: 'to-delete.js', action: 'delete' }]);
    expect(await fs.pathExists(filePath)).toBe(false);
  });

  test('refuses to write outside the workspace root', async () => {
    await expect(
      applyFileOps(tmpDir, [{ path: '../escape.js', action: 'write', content: 'x' }])
    ).rejects.toThrow(/Refusing to write outside/);
  });

  test('readFileIfExists returns null for missing files', async () => {
    const result = await readFileIfExists(tmpDir, 'nope.js');
    expect(result).toBeNull();
  });
});
