'use strict';

const { parseJsonLoose } = require('../src/claude/client');
const { testGenerationPrompt, fixGenerationPrompt } = require('../src/claude/prompts');

describe('parseJsonLoose', () => {
  test('parses plain JSON', () => {
    expect(parseJsonLoose('{"a": 1}')).toEqual({ a: 1 });
  });

  test('parses JSON wrapped in a markdown code fence', () => {
    const raw = '```json\n{"a": 1, "b": [1,2,3]}\n```';
    expect(parseJsonLoose(raw)).toEqual({ a: 1, b: [1, 2, 3] });
  });

  test('throws a descriptive error on invalid JSON', () => {
    expect(() => parseJsonLoose('not json at all')).toThrow(/Failed to parse JSON/);
  });
});

describe('prompts', () => {
  const issue = { key: 'BUG-1', summary: 'Login broken', description: 'desc', priority: 'High', issueType: 'Bug' };

  test('testGenerationPrompt embeds the issue and repo tree', () => {
    const { prompt } = testGenerationPrompt({ issue, repoTree: 'src/\n  index.js', relevantFiles: {} });
    expect(prompt).toContain('BUG-1');
    expect(prompt).toContain('src/');
  });

  test('fixGenerationPrompt embeds test output and previous attempt', () => {
    const { prompt } = fixGenerationPrompt({
      issue,
      testOutput: 'FAIL src/foo.test.js',
      relevantFiles: { 'src/foo.js': 'module.exports = {}' },
      previousAttempt: { reasoning: 'tried X', fixFiles: [{ path: 'src/foo.js', content: 'x' }] },
    });
    expect(prompt).toContain('FAIL src/foo.test.js');
    expect(prompt).toContain('tried X');
    expect(prompt).toContain('src/foo.js');
  });
});
