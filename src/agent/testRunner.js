'use strict';

const { exec } = require('child_process');

/**
 * Runs the configured test command inside the workspace and returns whether
 * it passed along with combined stdout/stderr for feeding back to Claude.
 */
function runTests({ testCommand, workspaceDir }) {
  return new Promise((resolve) => {
    exec(
      testCommand,
      { cwd: workspaceDir, maxBuffer: 1024 * 1024 * 20 },
      (error, stdout, stderr) => {
        resolve({
          passed: !error,
          exitCode: error ? error.code ?? 1 : 0,
          output: `${stdout}\n${stderr}`.trim(),
        });
      }
    );
  });
}

module.exports = { runTests };
