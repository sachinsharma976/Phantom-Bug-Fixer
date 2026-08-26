'use strict';

const SYSTEM_BASE = `You are phantom-bug-fixer, an autonomous senior engineer working inside a Next.js repository.
You respond ONLY with strict JSON matching the schema you're given — no prose, no markdown fences, no trailing commentary.
File paths are always relative to the repository root and must use forward slashes.
Never invent files you have not been shown; if you need to see a file's contents, request it explicitly via "filesNeeded" instead of guessing.`;

function testGenerationPrompt({ issue, repoTree, relevantFiles }) {
  const system = `${SYSTEM_BASE}

Your job right now: write failing test case(s) that reproduce the bug described in the JIRA ticket.
Use Jest. Prefer adding to an existing test file's directory conventions if you can infer them from repoTree.
Respond with JSON of the form:
{
  "reasoning": "short explanation of how the tests reproduce the bug",
  "filesNeeded": ["path/to/file.js"],   // files you need to see before you can write good tests; [] if none
  "testFiles": [
    { "path": "src/__tests__/example.test.js", "content": "...full file contents..." }
  ]
}
If you set "filesNeeded" to a non-empty array, leave "testFiles" as [].`;

  const prompt = [
    `## JIRA Ticket ${issue.key}: ${issue.summary}`,
    issue.description || '_no description provided_',
    '',
    `Priority: ${issue.priority} | Type: ${issue.issueType}`,
    '',
    '## Repository file tree (partial)',
    repoTree,
    '',
    '## Relevant file contents',
    formatFileMap(relevantFiles),
  ].join('\n');

  return { system, prompt };
}

function fixGenerationPrompt({ issue, testOutput, relevantFiles, previousAttempt }) {
  const system = `${SYSTEM_BASE}

Your job right now: modify source files so the failing test(s) pass, without breaking the described behavior elsewhere.
Make the smallest change that correctly fixes the root cause — do not refactor unrelated code.
Respond with JSON of the form:
{
  "reasoning": "short explanation of the root cause and the fix",
  "filesNeeded": ["path/to/file.js"],
  "fixFiles": [
    { "path": "src/lib/example.js", "action": "write", "content": "...full new file contents..." }
  ]
}
"action" is "write" (create/overwrite) or "delete". Always send the FULL file content for "write", never a diff.
If you set "filesNeeded" to a non-empty array, leave "fixFiles" as [].`;

  const parts = [
    `## JIRA Ticket ${issue.key}: ${issue.summary}`,
    issue.description || '_no description provided_',
    '',
    '## Latest test run output',
    '```',
    truncate(testOutput, 8000),
    '```',
    '',
    '## Relevant file contents',
    formatFileMap(relevantFiles),
  ];

  if (previousAttempt) {
    parts.push(
      '',
      '## Previous fix attempt (did not make tests pass)',
      previousAttempt.reasoning || '',
      formatFileMap(
        Object.fromEntries(previousAttempt.fixFiles.map((f) => [f.path, f.content]))
      )
    );
  }

  return { system, prompt: parts.join('\n') };
}

function formatFileMap(fileMap) {
  const entries = Object.entries(fileMap || {});
  if (entries.length === 0) return '_none_';
  return entries
    .map(([path, content]) => `### ${path}\n\`\`\`\n${truncate(content, 6000)}\n\`\`\``)
    .join('\n\n');
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max)}\n... [truncated]` : str;
}

module.exports = { testGenerationPrompt, fixGenerationPrompt, formatFileMap, truncate };
