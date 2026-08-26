'use strict';

function branchNameForIssue(issueKey) {
  const slug = issueKey.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `phantom-bug-fixer/${slug}`;
}

function prTitleForIssue(issue) {
  return `fix(${issue.key}): ${issue.summary}`;
}

function prBodyForIssue({ issue, summary, testFiles, fixFiles, iterations }) {
  const lines = [
    `Auto-generated fix for [${issue.key}](${issue.url ?? '#'}) by **phantom-bug-fixer**.`,
    '',
    '## Summary',
    summary || issue.summary,
    '',
    '## What changed',
    fixFiles.length
      ? fixFiles.map((f) => `- \`${f}\``).join('\n')
      : '_No files reported by the fix generator._',
    '',
    '## Tests added',
    testFiles.length
      ? testFiles.map((f) => `- \`${f}\``).join('\n')
      : '_No new test files._',
    '',
    `Resolved after **${iterations}** fix iteration(s). All tests passing at time of PR creation.`,
    '',
    '---',
    '_This PR was opened automatically. Please review carefully before merging._',
  ];
  return lines.join('\n');
}

module.exports = { branchNameForIssue, prTitleForIssue, prBodyForIssue };
