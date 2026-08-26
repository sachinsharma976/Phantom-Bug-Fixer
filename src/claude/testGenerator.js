'use strict';

const { testGenerationPrompt } = require('./prompts');
const { readFileIfExists } = require('../utils/fs');

const MAX_FILE_REQUEST_ROUNDS = 3;

/**
 * Asks Claude to generate failing test(s) that reproduce the bug, feeding it
 * whatever source files it asks for along the way.
 *
 * @returns {Promise<{reasoning: string, testFiles: {path: string, content: string}[]}>}
 */
async function generateTests({ claude, issue, repoTree, workspaceDir, logger }) {
  const relevantFiles = {};

  for (let round = 0; round <= MAX_FILE_REQUEST_ROUNDS; round += 1) {
    const { system, prompt } = testGenerationPrompt({ issue, repoTree, relevantFiles });
    const result = await claude.completeJson({ system, prompt });

    if (result.filesNeeded && result.filesNeeded.length > 0 && round < MAX_FILE_REQUEST_ROUNDS) {
      logger?.debug(`Claude requested ${result.filesNeeded.length} file(s) for test generation`);
      for (const filePath of result.filesNeeded) {
        if (relevantFiles[filePath] !== undefined) continue;
        const content = await readFileIfExists(workspaceDir, filePath);
        relevantFiles[filePath] = content ?? '// file not found in repository';
      }
      continue;
    }

    if (!result.testFiles || result.testFiles.length === 0) {
      throw new Error('Claude did not return any test files for the ticket.');
    }

    return { reasoning: result.reasoning || '', testFiles: result.testFiles };
  }

  throw new Error('Exceeded max rounds requesting files during test generation.');
}

module.exports = { generateTests };
