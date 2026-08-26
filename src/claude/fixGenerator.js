'use strict';

const { fixGenerationPrompt } = require('./prompts');
const { readFileIfExists } = require('../utils/fs');

const MAX_FILE_REQUEST_ROUNDS = 3;

/**
 * Asks Claude to produce source file changes that make the current failing
 * tests pass, feeding it whatever files it asks for along the way.
 *
 * @returns {Promise<{reasoning: string, fixFiles: {path: string, action: string, content?: string}[]}>}
 */
async function generateFix({
  claude,
  issue,
  testOutput,
  workspaceDir,
  previousAttempt,
  logger,
}) {
  const relevantFiles = {};

  for (let round = 0; round <= MAX_FILE_REQUEST_ROUNDS; round += 1) {
    const { system, prompt } = fixGenerationPrompt({
      issue,
      testOutput,
      relevantFiles,
      previousAttempt,
    });
    const result = await claude.completeJson({ system, prompt });

    if (result.filesNeeded && result.filesNeeded.length > 0 && round < MAX_FILE_REQUEST_ROUNDS) {
      logger?.debug(`Claude requested ${result.filesNeeded.length} file(s) for fix generation`);
      for (const filePath of result.filesNeeded) {
        if (relevantFiles[filePath] !== undefined) continue;
        const content = await readFileIfExists(workspaceDir, filePath);
        relevantFiles[filePath] = content ?? '// file not found in repository';
      }
      continue;
    }

    if (!result.fixFiles || result.fixFiles.length === 0) {
      throw new Error('Claude did not return any file changes for the fix.');
    }

    return { reasoning: result.reasoning || '', fixFiles: result.fixFiles };
  }

  throw new Error('Exceeded max rounds requesting files during fix generation.');
}

module.exports = { generateFix };
